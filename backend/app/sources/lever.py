"""
Shomvob (সম্ভব) — Lever Job Source.

Fetches job postings from public Lever job boards of target tech companies.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
import httpx

from app.models.job import JobCreate
from app.sources.base import JobSource

logger = logging.getLogger(__name__)

# Representative list of tech companies hiring in AI, Embedded, Robotics, and Backend on Lever
LEVER_COMPANIES = [
    "bostondynamics",
    "anduril",
    "nuro",  # Some companies use both or migrated
    "palantir",
    "toyotaresearchinstitute",
    "reddit",
    "figma",
    "skydio",  # Skydio Lever API fallback
]


class LeverSource(JobSource):
    """Job source adapter for public Lever company boards."""

    @property
    def name(self) -> str:
        return "Lever"

    async def fetch_jobs(
        self, search_terms: list[str], max_results: int = 50
    ) -> list[JobCreate]:
        results: list[JobCreate] = []
        terms = [t.lower() for t in search_terms]

        # Use httpx with async gather to fetch all boards concurrently
        async with httpx.AsyncClient(timeout=12.0) as client:
            tasks = [
                self._fetch_company_jobs(client, company, terms)
                for company in LEVER_COMPANIES
            ]
            company_results = await asyncio.gather(*tasks, return_exceptions=True)

            for cr in company_results:
                if isinstance(cr, list):
                    results.extend(cr)
                elif isinstance(cr, Exception):
                    logger.warning("Lever task failed with exception: %s", cr)

        # Deduplicate and limit
        seen_urls = set()
        deduped_results = []
        for job in results:
            if job.apply_url not in seen_urls:
                seen_urls.add(job.apply_url)
                deduped_results.append(job)

        logger.info(
            "Lever source fetched %d unique jobs across %d companies",
            len(deduped_results),
            len(LEVER_COMPANIES),
        )
        return deduped_results[:max_results]

    async def _fetch_company_jobs(
        self, client: httpx.AsyncClient, company: str, terms: list[str]
    ) -> list[JobCreate]:
        # Lever API v0 endpoint for public postings
        url = f"https://api.lever.co/v0/postings/{company}?mode=json"

        try:
            response = await client.get(url)
            if response.status_code != 200:
                logger.debug(
                    "Lever board for company '%s' returned status code %d",
                    company,
                    response.status_code,
                )
                return []

            postings = response.json()
            if not isinstance(postings, list):
                return []

            matched_jobs: list[JobCreate] = []

            for item in postings:
                title = item.get("text", "")
                apply_url = item.get("hostedUrl", "")
                description = item.get("description", "")
                additional_info = item.get("additional", "")
                lists = item.get("lists", [])

                # Combine list fields (like requirements, responsibilities) for keyword checking
                list_text = " ".join(
                    [li.get("content", "") for sub in lists for li in sub.get("items", [])]
                )
                full_text = f"{description} {additional_info} {list_text}"

                categories_data = item.get("categories", {})
                location = categories_data.get("location", "Remote" if "remote" in title.lower() else "USA")
                commitment = categories_data.get("commitment", "Full-time")

                if not title or not apply_url:
                    continue

                # Filter by search terms
                text_to_search = f"{title} {full_text}".lower()
                matched = False
                for term in terms:
                    if term in text_to_search:
                        matched = True
                        break

                if not matched:
                    continue

                # Parse date
                posted_date = None
                created_at_epoch = item.get("createdAt")
                if created_at_epoch:
                    try:
                        # Lever returns epoch timestamps in milliseconds
                        posted_date = datetime.fromtimestamp(created_at_epoch / 1000.0)
                    except (ValueError, TypeError):
                        pass

                # Remote detection
                is_remote = (
                    "remote" in title.lower()
                    or "remote" in location.lower()
                    or item.get("workplaceType", "").lower() == "remote"
                )
                remote_type = "remote" if is_remote else "onsite"

                # Experience level extraction
                experience_level = None
                title_lower = title.lower()
                if any(x in title_lower for x in ["intern", "co-op", "trainee"]):
                    experience_level = "intern"
                elif any(x in title_lower for x in ["junior", "entry", "associate"]):
                    experience_level = "entry"
                elif any(x in title_lower for x in ["senior", "sr", "lead", "principal"]):
                    if "lead" in title_lower or "principal" in title_lower:
                        experience_level = "lead"
                    else:
                        experience_level = "senior"
                elif "mid" in title_lower:
                    experience_level = "mid"

                # Standardize company display name
                company_display = company.replace("toyotaresearchinstitute", "Toyota Research Institute").replace("_", " ").title()

                # Get description markup or text
                desc_content = item.get("descriptionPlain", description)

                matched_jobs.append(
                    JobCreate(
                        title=title,
                        company=company_display,
                        location=location,
                        is_remote=is_remote,
                        remote_type=remote_type,
                        experience_level=experience_level,
                        salary_min=None,
                        salary_max=None,
                        salary_currency=None,
                        description=desc_content,
                        requirements=list_text if list_text else None,
                        required_skills=[],
                        apply_url=apply_url,
                        source=f"{self.name} ({company_display})",
                        source_job_id=str(item.get("id")),
                        posted_date=posted_date,
                    )
                )

            return matched_jobs

        except Exception as e:
            logger.warning("Error fetching Lever board for company '%s': %s", company, e)
            return []

"""
Shomvob (সম্ভব) — Greenhouse Job Source.

Fetches job postings from public Greenhouse job boards of target tech companies.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
import httpx

from app.models.job import JobCreate
from app.sources.base import JobSource

logger = logging.getLogger(__name__)

# Representative list of tech companies hiring in AI, Embedded, Robotics, IoT, and Backend
GREENHOUSE_COMPANIES = [
    "spacex",
    "verkada",
    "skydio",
    "samsara",
    "nuro",
    "openai",
    "starry",
    "aurora",
    "dronedeploy",
    "standard",
]


class GreenhouseSource(JobSource):
    """Job source adapter for public Greenhouse company boards."""

    @property
    def name(self) -> str:
        return "Greenhouse"

    async def fetch_jobs(
        self, search_terms: list[str], max_results: int = 50
    ) -> list[JobCreate]:
        results: list[JobCreate] = []
        terms = [t.lower() for t in search_terms]

        # Use httpx with async gather to fetch all boards concurrently
        async with httpx.AsyncClient(timeout=12.0) as client:
            tasks = [
                self._fetch_company_jobs(client, company, terms)
                for company in GREENHOUSE_COMPANIES
            ]
            company_results = await asyncio.gather(*tasks, return_exceptions=True)

            for cr in company_results:
                if isinstance(cr, list):
                    results.extend(cr)
                elif isinstance(cr, Exception):
                    logger.warning("Greenhouse task failed with exception: %s", cr)

        # Deduplicate and limit
        seen_urls = set()
        deduped_results = []
        for job in results:
            if job.apply_url not in seen_urls:
                seen_urls.add(job.apply_url)
                deduped_results.append(job)

        logger.info(
            "Greenhouse source fetched %d unique jobs across %d companies",
            len(deduped_results),
            len(GREENHOUSE_COMPANIES),
        )
        return deduped_results[:max_results]

    async def _fetch_company_jobs(
        self, client: httpx.AsyncClient, company: str, terms: list[str]
    ) -> list[JobCreate]:
        # greenhouse boards public jobs API endpoint
        url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true"

        try:
            response = await client.get(url)
            if response.status_code != 200:
                logger.debug(
                    "Greenhouse board for company '%s' returned status code %d",
                    company,
                    response.status_code,
                )
                return []

            data = response.json()
            jobs = data.get("jobs", [])
            if not jobs:
                return []

            matched_jobs: list[JobCreate] = []

            for item in jobs:
                title = item.get("title", "")
                apply_url = item.get("absolute_url", "")
                content = item.get("content", "")  # Contains the HTML description
                location_data = item.get("location", {})
                location = location_data.get("name", "Remote" if "remote" in title.lower() else "USA")

                if not title or not apply_url:
                    continue

                # Filter by search terms
                text_to_search = f"{title} {content}".lower()
                matched = False
                for term in terms:
                    if term in text_to_search:
                        matched = True
                        break

                if not matched:
                    continue

                # Parse date
                posted_date = None
                updated_at_str = item.get("updated_at")
                if updated_at_str:
                    try:
                        # Greenhouse returns ISO dates
                        posted_date = datetime.fromisoformat(
                            updated_at_str.replace("Z", "+00:00")
                        )
                    except ValueError:
                        pass

                # Remote detection
                is_remote = "remote" in title.lower() or "remote" in location.lower()
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
                company_display = company.replace("_", " ").title()

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
                        description=content,
                        requirements=None,
                        required_skills=[],
                        apply_url=apply_url,
                        source=f"{self.name} ({company_display})",
                        source_job_id=str(item.get("id")),
                        posted_date=posted_date,
                    )
                )

            return matched_jobs

        except Exception as e:
            logger.warning(
                "Error fetching Greenhouse board for company '%s': %s", company, e
            )
            return []

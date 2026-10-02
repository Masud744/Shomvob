"""
Shomvob (সম্ভব) — RemoteOK Job Source.

Fetches remote jobs from the official RemoteOK API.
"""

from __future__ import annotations

import logging
from datetime import datetime
import httpx

from app.models.job import JobCreate
from app.sources.base import JobSource

logger = logging.getLogger(__name__)


class RemoteOKSource(JobSource):
    """Job source adapter for RemoteOK (https://remoteok.com/api)."""

    @property
    def name(self) -> str:
        return "RemoteOK"

    async def fetch_jobs(
        self, search_terms: list[str], max_results: int = 50
    ) -> list[JobCreate]:
        url = "https://remoteok.com/api"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code != 200:
                    logger.error(
                        "RemoteOK API returned status code %d", response.status_code
                    )
                    return []

                data = response.json()
                if not isinstance(data, list) or len(data) <= 1:
                    logger.warning("RemoteOK API returned empty or malformed list.")
                    return []

                # The first item is meta/legal info
                job_listings = data[1:]
                results: list[JobCreate] = []

                # Flatten search terms for easier comparison
                terms = [term.lower() for term in search_terms]

                for item in job_listings:
                    title = item.get("position", "")
                    company = item.get("company", "")
                    description = item.get("description", "")
                    tags = item.get("tags", [])
                    apply_url = item.get("url", "")

                    if not title or not apply_url:
                        continue

                    # Filter based on search terms
                    text_to_search = f"{title} {description} {' '.join(tags)}".lower()
                    matched = False
                    for term in terms:
                        if term in text_to_search:
                            matched = True
                            break

                    if not matched:
                        continue

                    # Parse posted date
                    posted_date = None
                    date_str = item.get("date")
                    if date_str:
                        try:
                            # RemoteOK returns ISO format timestamps
                            posted_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                        except ValueError:
                            pass

                    # Parse experience level from title / tags
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

                    # Normalize tags/skills
                    required_skills = [t.lower() for t in tags if t]

                    results.append(
                        JobCreate(
                            title=title,
                            company=company or "Unknown",
                            location=item.get("location") or "Remote",
                            is_remote=True,
                            remote_type="remote",
                            experience_level=experience_level,
                            salary_min=item.get("salary_min"),
                            salary_max=item.get("salary_max"),
                            salary_currency="USD",
                            description=description,
                            requirements=None,
                            required_skills=required_skills,
                            apply_url=apply_url,
                            source=self.name,
                            source_job_id=str(item.get("id")),
                            posted_date=posted_date,
                        )
                    )

                    if len(results) >= max_results:
                        break

                logger.info("RemoteOK source fetched %d jobs", len(results))
                return results

        except Exception as e:
            logger.error("Failed to fetch jobs from RemoteOK: %s", e, exc_info=True)
            return []

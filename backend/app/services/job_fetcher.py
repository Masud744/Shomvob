"""
Shomvob (সম্ভব) — Job Fetcher & Aggregator Orchestrator.

Concurrently executes all job sources, filters, classifies, and stores jobs in Supabase.
Can be executed as a standalone script for GitHub Actions.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime

from app.services.job_classifier import classify_job
from app.sources import GreenhouseSource, LeverSource, RemoteOKSource
from app.utils.supabase import get_supabase_admin

# Setup logging to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("app.services.job_fetcher")

# Complete list of targeted search terms
DEFAULT_SEARCH_TERMS = [
    "embedded",
    "firmware",
    "robotics",
    "iot",
    "hardware",
    "machine learning",
    "deep learning",
    "computer vision",
    "edge ai",
    "cybersecurity",
    "backend",
    "full stack",
]


async def run_job_fetcher(search_terms: list[str] | None = None) -> None:
    """Orchestrate the job fetching, classification, and insertion pipeline."""
    terms = search_terms or DEFAULT_SEARCH_TERMS
    logger.info("Starting job fetching pipeline for terms: %s", terms)

    # Initialize sources
    sources = [
        RemoteOKSource(),
        GreenhouseSource(),
        LeverSource(),
    ]

    # Concurrently fetch from all sources
    tasks = [source.fetch_jobs(terms, max_results=75) for source in sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    fetched_jobs = []
    for source, res in zip(sources, results):
        if isinstance(res, list):
            logger.info("Source '%s' successfully returned %d jobs", source.name, len(res))
            fetched_jobs.extend(res)
        elif isinstance(res, Exception):
            logger.error("Source '%s' raised an exception: %s", source.name, res, exc_info=True)

    if not fetched_jobs:
        logger.warning("No jobs fetched from any source. Exiting.")
        return

    logger.info("Total fetched jobs before processing & deduplication: %d", len(fetched_jobs))

    db = get_supabase_admin()
    successful_inserts = 0
    duplicate_count = 0

    for job in fetched_jobs:
        try:
            # 1. Classify the job to get category tags
            categories = classify_job(job.title, job.description or "", job.required_skills)
            if not categories:
                # If no categories matched, skip to keep listings highly relevant
                logger.debug("Skipping job '%s' - no targeted categories matched", job.title)
                continue

            # 2. Map data for PostgreSQL insert
            job_data = {
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "is_remote": job.is_remote,
                "remote_type": job.remote_type,
                "experience_level": job.experience_level,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "salary_currency": job.salary_currency,
                "description": job.description,
                "requirements": job.requirements,
                "required_skills": job.required_skills,
                "apply_url": job.apply_url,
                "source": job.source,
                "source_job_id": job.source_job_id,
                "posted_date": job.posted_date.isoformat() if job.posted_date else None,
                "is_active": True,
                "fetched_at": datetime.utcnow().isoformat(),
            }

            # 3. Insert job (Supabase table: jobs)
            # We use ON CONFLICT (apply_url) DO NOTHING to deduplicate
            # Since standard postgrest doesn't support easy raw on conflict inside supabase-py,
            # we check if job exists first or catch conflict errors, or let Supabase's unique index handle it.
            # supabase-py insert supports 'upsert' which acts as ON CONFLICT.
            insert_res = db.table("jobs").upsert(
                job_data,
                on_conflict="apply_url",
            ).execute()

            if insert_res.data:
                inserted_job = insert_res.data[0]
                job_id = inserted_job["id"]
                successful_inserts += 1

                # 4. Insert categories
                category_records = [
                    {
                        "job_id": job_id,
                        "category": cat,
                        "confidence": confidence,
                    }
                    for cat, confidence in categories
                ]

                # Bulk upsert categories
                if category_records:
                    db.table("job_categories").upsert(
                        category_records,
                        on_conflict="job_id,category",
                    ).execute()
            else:
                duplicate_count += 1

        except Exception as e:
            # Check if it was a duplicate / unique constraint violation
            error_str = str(e)
            if "duplicate key" in error_str or "violates unique constraint" in error_str:
                duplicate_count += 1
            else:
                logger.error("Failed to process job '%s' from %s: %s", job.title, job.source, e)

    logger.info(
        "Aggregation Pipeline Complete: Inserted %d new jobs. Skipped %d duplicates.",
        successful_inserts,
        duplicate_count,
    )


if __name__ == "__main__":
    asyncio.run(run_job_fetcher())

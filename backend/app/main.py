"""
Shomvob (সম্ভব) — Main FastAPI Application.

Entrypoint for the API server, configuring middleware, routers, and exception handlers.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import (
    applications,
    competitions,
    cover_letter,
    health,
    jobs,
    profile,
    resume,
    saved_jobs,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def _run_daily_cleanup():
    """Background task: run stale-job cleanup once per day on server startup."""
    from app.scripts.cleanup_jobs import main as cleanup_main
    while True:
        try:
            logger.info("Running scheduled job cleanup (older than %d days)...", 14)
            await asyncio.to_thread(cleanup_main)
        except Exception as exc:
            logger.error("Scheduled cleanup failed: %s", exc, exc_info=True)
        await asyncio.sleep(86400)


async def _run_scheduled_job_sync():
    """Background task: auto-sync jobs across multi-sources every 12 hours."""
    from app.services.job_scraper import sync_jobs
    # Wait 30 seconds after server boots to avoid contention during startup
    await asyncio.sleep(30)
    while True:
        try:
            logger.info("Running scheduled background multi-source job sync...")
            result = await sync_jobs()
            logger.info("Scheduled job sync finished: %s", result.get("message") if isinstance(result, dict) else result)
        except Exception as exc:
            logger.error("Scheduled job sync failed: %s", exc, exc_info=True)
        # Sleep for 12 hours (43,200 seconds)
        await asyncio.sleep(43200)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup and shutdown events."""
    logger.info("Starting up Shomvob API...")
    cleanup_task = None
    sync_task = None

    # In production (e.g. Render 512MB tier), daily ingestion and cleanup are offloaded
    # to GitHub Actions (daily-sync.yml) to ensure fast boot, zero health check timeouts,
    # and low RAM footprint. On-demand sync remains available via POST /api/v1/jobs/sync.
    if settings.enable_in_app_cron:
        logger.info("In-app cron worker enabled via ENABLE_IN_APP_CRON=true")
        cleanup_task = asyncio.create_task(_run_daily_cleanup())
        sync_task = asyncio.create_task(_run_scheduled_job_sync())
    else:
        logger.info("In-app background cron idle (managed externally via GitHub Actions)")

    yield

    if cleanup_task:
        cleanup_task.cancel()
    if sync_task:
        sync_task.cancel()
    for task in (cleanup_task, sync_task):
        if task:
            try:
                await task
            except asyncio.CancelledError:
                pass
    logger.info("Shutting down Shomvob API...")


# Initialize settings
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="A zero-cost AI-powered engineering career assistant backend API.",
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS middleware configuration
cors_origins = settings.allowed_origins
allow_all = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else cors_origins,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions to return a standardized JSON error response."""
    logger.error("Unhandled error occurred at %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Our engineering team has been notified."},
    )


# Include health check (unprefixed)
app.include_router(health.router)

# Include API Routers under /api/v1 prefix
api_prefix = "/api/v1"
app.include_router(jobs.router, prefix=api_prefix)
app.include_router(profile.router, prefix=api_prefix)
app.include_router(resume.router, prefix=api_prefix)
app.include_router(cover_letter.router, prefix=api_prefix)
app.include_router(applications.router, prefix=api_prefix)
app.include_router(saved_jobs.router, prefix=api_prefix)
app.include_router(competitions.router, prefix=api_prefix)


if __name__ == "__main__":
    import uvicorn
    # Local dev runner helper
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

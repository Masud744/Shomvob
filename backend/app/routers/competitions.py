from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response

from app.models.competition import CompetitionResponse, CompetitionCreate, CompetitionStats
from app.services.competition_storage import get_all_competitions, upsert_competition
from app.services.competition_scraper import sync_competitions
from app.services.cache_service import memory_cache, sync_throttler
from app.services.facebook_event_resolver import resolve_facebook_event_metadata

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/competitions", tags=["competitions"])


@router.get("", response_model=list[CompetitionResponse])
def list_competitions(
    response: Response,
    event_type: Optional[str] = Query(None, description="hackathon, datathon, project_showcase, poster_presentation, etc."),
    participation_mode: Optional[str] = Query(None, description="online, in_person, hybrid"),
    search: Optional[str] = Query(None, description="Search by keywords, title, or tech tags"),
    location: Optional[str] = Query(None, description="bangladesh, online, or all"),
):
    """
    List active tech competitions, hackathons, and showcases.
    Layer 1: Serves from RAM TTL cache (sub-millisecond latency).
    Layer 2: Falls back to persistent storage on cache miss.
    Layer 3: Injects HTTP Cache-Control for client browser edge caching.
    """
    cache_key = f"competitions:list:{event_type}:{participation_mode}:{search}:{location}"
    cached = memory_cache.get(cache_key)

    # Edge caching header (1 minute browser max-age, 5 minutes stale-while-revalidate)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"

    if cached is not None:
        logger.debug("Cache HIT for %s", cache_key)
        return cached

    logger.debug("Cache MISS for %s, fetching from storage", cache_key)
    items = get_all_competitions(
        event_type=event_type,
        participation_mode=participation_mode,
        search=search,
        location_filter=location,
    )

    # Store in RAM cache for 5 minutes (300 seconds)
    memory_cache.set(cache_key, items, ttl_seconds=300)
    return items


@router.get("/stats", response_model=CompetitionStats)
def get_stats(response: Response):
    """
    Aggregated stats for competitions hub banner.
    Cached in RAM for 5 minutes.
    """
    cache_key = "competitions:stats"
    cached = memory_cache.get(cache_key)

    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"

    if cached is not None:
        return cached

    items = get_all_competitions()
    total = len(items)
    online = len([i for i in items if i.get("participation_mode") in ("online", "hybrid")])
    bd_in_person = len([i for i in items if i.get("participation_mode") == "in_person"])
    hackathons = len([i for i in items if i.get("event_type") == "hackathon"])
    datathons = len([i for i in items if i.get("event_type") == "datathon"])
    showcase = len([i for i in items if i.get("event_type") == "project_showcase"])
    poster = len([i for i in items if i.get("event_type") == "poster_presentation"])

    stats_obj = CompetitionStats(
        total_active=total,
        online_count=online,
        bangladesh_in_person=bd_in_person,
        hackathons_count=hackathons,
        datathons_count=datathons,
        project_showcase_count=showcase,
        poster_presentation_count=poster,
    )

    memory_cache.set(cache_key, stats_obj, ttl_seconds=300)
    return stats_obj


@router.post("/sync")
def trigger_sync():
    """
    Manually trigger sync of active competitions from web feeds & verified tech hub catalog.
    Throttled: Can only be executed once every 10 minutes to protect external APIs.
    """
    can_run, remaining = sync_throttler.can_sync()
    if not can_run:
        mins = remaining // 60
        secs = remaining % 60
        time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
        return {
            "message": f"Events are up to date! Next live sync available in {time_str}.",
            "synced_count": 0,
            "cooldown_remaining": remaining,
            "is_throttled": True,
        }

    count = sync_competitions()
    sync_throttler.record_sync()

    # Invalidate all competition-related memory caches immediately
    invalidated = memory_cache.invalidate(prefix="competitions:")
    logger.info("Sync complete. Invalidated %d cached keys.", invalidated)

    return {
        "message": f"Successfully synchronized {count} live competitions!",
        "synced_count": count,
        "cooldown_remaining": 600,
        "is_throttled": False,
    }


@router.post("/submit", response_model=CompetitionResponse)
def submit_competition(data: CompetitionCreate):
    """
    Allow university tech clubs or organizers to submit a competition.
    Auto-enriches metadata if a Facebook event URL is provided.
    Instantly invalidates RAM cache so new submission appears right away.
    """
    comp = data.model_dump()
    url = comp.get("registration_url", "")
    if "facebook.com" in url:
        meta = resolve_facebook_event_metadata(url)
        if not comp.get("banner_url") and meta.get("banner_url"):
            comp["banner_url"] = meta["banner_url"]
        if not comp.get("description") and meta.get("description"):
            comp["description"] = meta["description"]
        comp["source"] = "facebook_events"

    saved = upsert_competition(comp)
    memory_cache.invalidate(prefix="competitions:")
    return saved

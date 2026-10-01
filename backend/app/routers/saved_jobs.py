"""
EngineerCopilot AI — Saved Jobs Router.

Endpoints for saving/unsaving jobs and viewing saved jobs list.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Body, HTTPException, status

from app.dependencies import CurrentUser
from app.models.application import SavedJobResponse, JobIdRequest
from app.utils.supabase import get_supabase_admin
from app.services.cache_service import memory_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/saved-jobs", tags=["saved-jobs"])

db = get_supabase_admin


@router.get("", response_model=list[SavedJobResponse])
def list_saved_jobs(user: CurrentUser):
    """Get all saved jobs for the current user."""
    cache_key = f"saved_jobs:list:{user.user_id}"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        return cached

    result = (
        db()
        .table("saved_jobs")
        .select("*, jobs(title, company, location, source)")
        .eq("user_id", user.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    items = result.data or []

    for item in items:
        job = item.pop("jobs", None) or {}
        item["job_title"] = job.get("title")
        item["job_company"] = job.get("company")
        item["job_location"] = job.get("location")
        item["job_source"] = job.get("source")

    memory_cache.set(cache_key, items, ttl_seconds=120)
    return items


@router.post("", response_model=SavedJobResponse, status_code=status.HTTP_201_CREATED)
def save_job(data: JobIdRequest, user: CurrentUser):
    """Save a job for later."""
    record = {
        "user_id": user.user_id,
        "job_id": data.job_id,
    }
    try:
        result = db().table("saved_jobs").insert(record).execute()
    except Exception as exc:
        if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail="Job is already saved",
            )
        raise HTTPException(status_code=500, detail=f"Failed to save job: {exc}")

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save job")

    row = result.data[0]
    memory_cache.invalidate(prefix=f"saved_jobs:list:{user.user_id}")
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "job_id": row["job_id"],
        "created_at": row["created_at"],
        "job_title": None,
        "job_company": None,
        "job_location": None,
        "job_source": None,
    }


@router.delete("/{saved_job_id}", status_code=status.HTTP_204_NO_CONTENT)
def unsave_job(saved_job_id: str, user: CurrentUser):
    """Remove a job from saved jobs."""
    db().table("saved_jobs").delete().eq("id", saved_job_id).eq("user_id", user.user_id).execute()
    memory_cache.invalidate(prefix=f"saved_jobs:list:{user.user_id}")
    return None

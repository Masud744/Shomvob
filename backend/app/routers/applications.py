"""
Shomvob (সম্ভব) — Applications Router.

Endpoints for application tracking with Kanban-style status management.
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import CurrentUser
from app.models.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStats,
    ApplicationUpdate,
)
from app.utils.supabase import get_supabase_admin
from app.services.cache_service import memory_cache

def _invalidate_user_apps_cache(user_id: str):
    memory_cache.invalidate(prefix=f"apps:list:{user_id}")
    memory_cache.invalidate(prefix=f"apps:stats:{user_id}")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/applications", tags=["applications"])

db = get_supabase_admin


def _format_app_item(item: dict, job_dict: dict | None = None) -> dict:
    job = job_dict or item.pop("jobs", None) or {}
    item["job_title"] = job.get("title")
    item["job_company"] = job.get("company")
    item["job_location"] = job.get("location")
    item["job_apply_url"] = job.get("apply_url")
    item["job_source"] = job.get("source")
    sal_min = job.get("salary_min")
    sal_max = job.get("salary_max")
    curr = job.get("salary_currency") or "BDT"
    if sal_min and sal_max:
        item["job_salary"] = f"{curr} {sal_min:,} - {sal_max:,}"
    elif sal_min:
        item["job_salary"] = f"{curr} {sal_min:,}+"
    elif sal_max:
        item["job_salary"] = f"Up to {curr} {sal_max:,}"
    else:
        item["job_salary"] = None
    return item


@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
):
    """Get all applications for the current user, with optional status filter."""
    cache_key = f"apps:list:{user.user_id}:{status_filter or 'all'}"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        return cached

    query = (
        db()
        .table("applications")
        .select("*, jobs(title, company, location, salary_min, salary_max, salary_currency, apply_url, source)")
        .eq("user_id", user.user_id)
        .order("updated_at", desc=True)
    )

    if status_filter:
        query = query.eq("status", status_filter)

    result = query.execute()
    items = result.data or []
    data = [_format_app_item(item) for item in items]
    memory_cache.set(cache_key, data, ttl_seconds=60)
    return data


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationCreate, user: CurrentUser):
    """
    Track a job application (platform job or manual external application).
    """
    job_id = data.job_id
    job_dict: dict = {}

    if not job_id:
        if not data.title or not data.company:
            raise HTTPException(
                status_code=400,
                detail="Job title and company name are required to track a manual application",
            )
        apply_url = data.apply_url.strip() if data.apply_url and data.apply_url.strip() else f"manual://{user.user_id}/{uuid.uuid4()}"
        new_job = {
            "title": data.title.strip(),
            "company": data.company.strip(),
            "location": data.location.strip() if data.location else "Dhaka, Bangladesh",
            "apply_url": apply_url,
            "source": "manual",
            "description": f"Manually tracked application: {data.title.strip()} at {data.company.strip()}",
            "is_active": True,
        }
        try:
            job_res = db().table("jobs").insert(new_job).execute()
            if not job_res.data:
                raise HTTPException(status_code=500, detail="Failed to create job record")
            job_dict = job_res.data[0]
            job_id = job_dict["id"]
        except Exception as exc:
            # If apply_url already exists, fetch that job
            existing = db().table("jobs").select("*").eq("apply_url", apply_url).execute()
            if existing.data:
                job_dict = existing.data[0]
                job_id = job_dict["id"]
            else:
                raise HTTPException(status_code=500, detail=f"Failed to create job: {exc}")
    else:
        # Fetch existing job info
        job_res = db().table("jobs").select("title, company, location, salary_min, salary_max, salary_currency, apply_url, source").eq("id", job_id).execute()
        if job_res.data:
            job_dict = job_res.data[0]

    record = {
        "user_id": user.user_id,
        "job_id": job_id,
        "status": data.status,
        "notes": data.notes,
    }
    if data.applied_date:
        record["applied_date"] = str(data.applied_date)

    try:
        result = db().table("applications").insert(record).execute()
    except Exception as exc:
        if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail="You have already tracked this job in your pipeline",
            )
        raise HTTPException(status_code=500, detail=f"Failed to track application: {exc}")

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to track application")
    
    app_data = result.data[0]
    _invalidate_user_apps_cache(user.user_id)
    return _format_app_item(app_data, job_dict)


@router.post("/seed-demo", response_model=list[ApplicationResponse])
def seed_demo_applications(user: CurrentUser):
    """
    Seed realistic Bangladesh & global tech company applications for quick evaluation.
    """
    demo_jobs = [
        {
            "title": "Senior Full-Stack Engineer (Node.js/React/AWS)",
            "company": "Brain Station 23",
            "location": "Dhaka (Hybrid)",
            "salary_min": 160000,
            "salary_max": 220000,
            "salary_currency": "BDT",
            "status": "interview",
            "notes": "Technical Round 1 scheduled with Principal Architect. Focus on event-driven architecture and Kafka.",
            "slug": "bs23-sr-fullstack",
        },
        {
            "title": "Backend Platform Engineer (Go & PostgreSQL)",
            "company": "ShopUp",
            "location": "Tejgaon, Dhaka",
            "salary_min": 140000,
            "salary_max": 190000,
            "salary_currency": "BDT",
            "status": "applied",
            "notes": "Applied with tailored resume highlighting microservices and distributed transaction handling.",
            "slug": "shopup-backend-go",
        },
        {
            "title": "Lead Frontend Engineer (Next.js / TypeScript)",
            "company": "Optimizely",
            "location": "Gulshan-2, Dhaka",
            "salary_min": 220000,
            "salary_max": 280000,
            "salary_currency": "BDT",
            "status": "offer",
            "notes": "Offer letter received! Excellent compensation package with healthcare and learning stipend.",
            "slug": "optimizely-lead-fe",
        },
        {
            "title": "Embedded & IoT Software Engineer (C++ / Python)",
            "company": "Walton Hi-Tech Industries",
            "location": "Dhaka / Gazipur",
            "salary_min": 90000,
            "salary_max": 130000,
            "salary_currency": "BDT",
            "status": "saved",
            "notes": "Researching smart device IoT protocols (MQTT, BLE). Need to tailor resume for firmware projects.",
            "slug": "walton-iot-embedded",
        },
        {
            "title": "DevOps / Site Reliability Engineer (Kubernetes)",
            "company": "Chaldal",
            "location": "Dhaka (Onsite)",
            "salary_min": 130000,
            "salary_max": 180000,
            "salary_currency": "BDT",
            "status": "assessment",
            "notes": "Take-home infrastructure as code challenge (Terraform + Helm charts). Submission deadline in 3 days.",
            "slug": "chaldal-devops-sre",
        },
    ]

    for demo in demo_jobs:
        apply_url = f"demo://{user.user_id}/{demo['slug']}"
        # Find or create job
        job_res = db().table("jobs").select("id").eq("apply_url", apply_url).execute()
        if job_res.data:
            j_id = job_res.data[0]["id"]
        else:
            new_j = db().table("jobs").insert({
                "title": demo["title"],
                "company": demo["company"],
                "location": demo["location"],
                "salary_min": demo["salary_min"],
                "salary_max": demo["salary_max"],
                "salary_currency": demo["salary_currency"],
                "apply_url": apply_url,
                "source": "manual_demo",
                "description": f"Demo application for {demo['title']} at {demo['company']}",
                "is_active": True,
            }).execute()
            if not new_j.data:
                continue
            j_id = new_j.data[0]["id"]

        # Check if user already has this application
        existing_app = db().table("applications").select("id").eq("user_id", user.user_id).eq("job_id", j_id).execute()
        if not existing_app.data:
            db().table("applications").insert({
                "user_id": user.user_id,
                "job_id": j_id,
                "status": demo["status"],
                "notes": demo["notes"],
                "applied_date": datetime.utcnow().isoformat(),
            }).execute()

    _invalidate_user_apps_cache(user.user_id)
    return list_applications(user=user)


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(application_id: str, data: ApplicationUpdate, user: CurrentUser):
    """Update application status or notes."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "applied_date" in update_data and update_data["applied_date"]:
        update_data["applied_date"] = str(update_data["applied_date"])

    result = (
        db()
        .table("applications")
        .update(update_data)
        .eq("id", application_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found")

    app_data = result.data[0]
    job_res = db().table("jobs").select("title, company, location, salary_min, salary_max, salary_currency, apply_url, source").eq("id", app_data["job_id"]).execute()
    job_dict = job_res.data[0] if job_res.data else {}

    _invalidate_user_apps_cache(user.user_id)
    return _format_app_item(app_data, job_dict)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: str, user: CurrentUser):
    """Delete an application."""
    db().table("applications").delete().eq("id", application_id).eq("user_id", user.user_id).execute()
    _invalidate_user_apps_cache(user.user_id)


@router.get("/stats", response_model=ApplicationStats)
def get_stats(user: CurrentUser):
    """Get application statistics for the dashboard."""
    cache_key = f"apps:stats:{user.user_id}"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        return cached

    result = (
        db()
        .table("applications")
        .select("status")
        .eq("user_id", user.user_id)
        .execute()
    )
    items = result.data or []

    stats = {
        "total": len(items),
        "saved": 0,
        "applied": 0,
        "assessment": 0,
        "interview": 0,
        "final_interview": 0,
        "offer": 0,
        "rejected": 0,
        "withdrawn": 0,
    }

    for item in items:
        s = item.get("status", "")
        if s in stats:
            stats[s] += 1

    memory_cache.set(cache_key, stats, ttl_seconds=60)
    return stats

"""
Shomvob (সম্ভব) — Profile Router.

CRUD endpoints for user profile, skills, education,
experience, projects, and certifications.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser
from app.models.user import (
    CertificationCreate,
    CertificationResponse,
    CertificationUpdate,
    EducationCreate,
    EducationResponse,
    EducationUpdate,
    ExperienceCreate,
    ExperienceResponse,
    ExperienceUpdate,
    ProfileResponse,
    ProfileUpdate,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    SkillCreate,
    SkillResponse,
)
from app.utils.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])

db = get_supabase_admin


# ── Profile ─────────────────────────────────────────────────

@router.get("", response_model=ProfileResponse)
def get_profile(user: CurrentUser):
    """Get the current user's profile."""
    result = db().table("profiles").select("*").eq("id", user.user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.put("", response_model=ProfileResponse)
def update_profile(data: ProfileUpdate, user: CurrentUser):
    """Update the current user's profile."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        db()
        .table("profiles")
        .update(update_data)
        .eq("id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


# ── Skills ──────────────────────────────────────────────────

@router.get("/skills", response_model=list[SkillResponse])
def get_skills(user: CurrentUser):
    """Get all skills for the current user."""
    result = (
        db()
        .table("user_skills")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def add_skill(data: SkillCreate, user: CurrentUser):
    """Add a skill to the current user's profile."""
    record = {**data.model_dump(exclude_none=True), "user_id": user.user_id}
    result = db().table("user_skills").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to add skill (may already exist)")
    return result.data[0]


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: str, user: CurrentUser):
    """Remove a skill from the current user's profile."""
    db().table("user_skills").delete().eq("id", skill_id).eq("user_id", user.user_id).execute()


# ── Education ───────────────────────────────────────────────

@router.get("/education", response_model=list[EducationResponse])
def get_education(user: CurrentUser):
    """Get all education entries for the current user."""
    result = (
        db()
        .table("user_education")
        .select("*")
        .eq("user_id", user.user_id)
        .order("start_date", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/education", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
def add_education(data: EducationCreate, user: CurrentUser):
    """Add an education entry."""
    record = {**data.model_dump(exclude_none=True), "user_id": user.user_id}
    # Convert date objects to strings for Supabase
    for key in ("start_date", "end_date"):
        if key in record and record[key] is not None:
            record[key] = str(record[key])
    result = db().table("user_education").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to add education")
    return result.data[0]


@router.put("/education/{education_id}", response_model=EducationResponse)
def update_education(education_id: str, data: EducationUpdate, user: CurrentUser):
    """Update an education entry."""
    update_data = data.model_dump(exclude_none=True)
    for key in ("start_date", "end_date"):
        if key in update_data and update_data[key] is not None:
            update_data[key] = str(update_data[key])
    result = (
        db()
        .table("user_education")
        .update(update_data)
        .eq("id", education_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Education entry not found")
    return result.data[0]


@router.delete("/education/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(education_id: str, user: CurrentUser):
    """Delete an education entry."""
    db().table("user_education").delete().eq("id", education_id).eq("user_id", user.user_id).execute()


# ── Experience ──────────────────────────────────────────────

@router.get("/experience", response_model=list[ExperienceResponse])
def get_experience(user: CurrentUser):
    """Get all experience entries for the current user."""
    result = (
        db()
        .table("user_experience")
        .select("*")
        .eq("user_id", user.user_id)
        .order("start_date", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/experience", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
def add_experience(data: ExperienceCreate, user: CurrentUser):
    """Add an experience entry."""
    record = {**data.model_dump(exclude_none=True), "user_id": user.user_id}
    for key in ("start_date", "end_date"):
        if key in record and record[key] is not None:
            record[key] = str(record[key])
    result = db().table("user_experience").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to add experience")
    return result.data[0]


@router.put("/experience/{experience_id}", response_model=ExperienceResponse)
def update_experience(experience_id: str, data: ExperienceUpdate, user: CurrentUser):
    """Update an experience entry."""
    update_data = data.model_dump(exclude_none=True)
    for key in ("start_date", "end_date"):
        if key in update_data and update_data[key] is not None:
            update_data[key] = str(update_data[key])
    result = (
        db()
        .table("user_experience")
        .update(update_data)
        .eq("id", experience_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Experience entry not found")
    return result.data[0]


@router.delete("/experience/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(experience_id: str, user: CurrentUser):
    """Delete an experience entry."""
    db().table("user_experience").delete().eq("id", experience_id).eq("user_id", user.user_id).execute()


# ── Projects ────────────────────────────────────────────────

@router.get("/projects", response_model=list[ProjectResponse])
def get_projects(user: CurrentUser):
    """Get all projects for the current user."""
    result = (
        db()
        .table("user_projects")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def add_project(data: ProjectCreate, user: CurrentUser):
    """Add a project."""
    record = {**data.model_dump(exclude_none=True), "user_id": user.user_id}
    for key in ("start_date", "end_date"):
        if key in record and record[key] is not None:
            record[key] = str(record[key])
    result = db().table("user_projects").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to add project")
    return result.data[0]


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, data: ProjectUpdate, user: CurrentUser):
    """Update a project."""
    update_data = data.model_dump(exclude_none=True)
    for key in ("start_date", "end_date"):
        if key in update_data and update_data[key] is not None:
            update_data[key] = str(update_data[key])
    result = (
        db()
        .table("user_projects")
        .update(update_data)
        .eq("id", project_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return result.data[0]


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, user: CurrentUser):
    """Delete a project."""
    db().table("user_projects").delete().eq("id", project_id).eq("user_id", user.user_id).execute()


# ── Certifications ──────────────────────────────────────────

@router.get("/certifications", response_model=list[CertificationResponse])
def get_certifications(user: CurrentUser):
    """Get all certifications for the current user."""
    result = (
        db()
        .table("user_certifications")
        .select("*")
        .eq("user_id", user.user_id)
        .order("issue_date", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/certifications", response_model=CertificationResponse, status_code=status.HTTP_201_CREATED)
def add_certification(data: CertificationCreate, user: CurrentUser):
    """Add a certification."""
    record = {**data.model_dump(exclude_none=True), "user_id": user.user_id}
    for key in ("issue_date", "expiry_date"):
        if key in record and record[key] is not None:
            record[key] = str(record[key])
    result = db().table("user_certifications").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to add certification")
    return result.data[0]


@router.put("/certifications/{cert_id}", response_model=CertificationResponse)
def update_certification(cert_id: str, data: CertificationUpdate, user: CurrentUser):
    """Update a certification."""
    update_data = data.model_dump(exclude_none=True)
    for key in ("issue_date", "expiry_date"):
        if key in update_data and update_data[key] is not None:
            update_data[key] = str(update_data[key])
    result = (
        db()
        .table("user_certifications")
        .update(update_data)
        .eq("id", cert_id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Certification not found")
    return result.data[0]


@router.delete("/certifications/{cert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certification(cert_id: str, user: CurrentUser):
    """Delete a certification."""
    db().table("user_certifications").delete().eq("id", cert_id).eq("user_id", user.user_id).execute()

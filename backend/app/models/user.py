"""
Shomvob (সম্ভব) — User Pydantic Models.

Defines request/response schemas for user profile, skills, education,
experience, projects, and certifications.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ── Profile ─────────────────────────────────────────────────

class ProfileBase(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = "Bangladesh"
    city: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    preferred_categories: list[str] = Field(default_factory=list)
    preferred_locations: list[str] = Field(default_factory=list)
    expected_salary_min: Optional[int] = None
    expected_salary_max: Optional[int] = None
    salary_currency: str = "BDT"
    employment_type: list[str] = Field(default_factory=lambda: ["full-time"])


class ProfileUpdate(ProfileBase):
    """Schema for updating a user profile."""
    pass


class ProfileResponse(ProfileBase):
    id: str
    email: str
    resume_file_path: Optional[str] = None
    resume_parsed_data: Optional[dict] = None
    onboarding_completed: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Skills ──────────────────────────────────────────────────

class SkillCreate(BaseModel):
    skill_name: str = Field(..., min_length=1, max_length=100)
    proficiency: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
    years_experience: Optional[float] = Field(None, ge=0, le=50)


class SkillResponse(SkillCreate):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Education ───────────────────────────────────────────────

class EducationCreate(BaseModel):
    institution: str = Field(..., min_length=1, max_length=200)
    degree: str = Field(..., min_length=1, max_length=200)
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    gpa: Optional[str] = None
    description: Optional[str] = None
    is_current: bool = False


class EducationUpdate(EducationCreate):
    """Schema for updating education."""
    pass


class EducationResponse(EducationCreate):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Experience ──────────────────────────────────────────────

class ExperienceCreate(BaseModel):
    company: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False
    description: Optional[str] = None
    technologies: list[str] = Field(default_factory=list)


class ExperienceUpdate(ExperienceCreate):
    """Schema for updating experience."""
    pass


class ExperienceResponse(ExperienceCreate):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Projects ────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    technologies: list[str] = Field(default_factory=list)
    url: Optional[str] = None
    github_url: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    highlights: list[str] = Field(default_factory=list)


class ProjectUpdate(ProjectCreate):
    """Schema for updating a project."""
    pass


class ProjectResponse(ProjectCreate):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Certifications ──────────────────────────────────────────

class CertificationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    issuing_organization: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None


class CertificationUpdate(CertificationCreate):
    """Schema for updating a certification."""
    pass


class CertificationResponse(CertificationCreate):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

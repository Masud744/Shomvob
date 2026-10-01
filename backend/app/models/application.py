"""
EngineerCopilot AI — Application & Resume Pydantic Models.

Defines schemas for application tracking, resume generation,
and cover letter generation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Applications ────────────────────────────────────────────

VALID_STATUSES = [
    "saved", "applied", "assessment", "interview",
    "final_interview", "offer", "rejected", "withdrawn",
]


class ApplicationCreate(BaseModel):
    job_id: Optional[str] = None
    # For manual / external jobs:
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = "Dhaka, Bangladesh"
    apply_url: Optional[str] = None
    salary: Optional[str] = None
    status: str = Field(default="saved", pattern=r"^(saved|applied|assessment|interview|final_interview|offer|rejected|withdrawn)$")
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern=r"^(saved|applied|assessment|interview|final_interview|offer|rejected|withdrawn)$")
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None
    resume_used: Optional[str] = None
    cover_letter_used: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    user_id: str
    job_id: str
    status: str
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None
    resume_used: Optional[str] = None
    cover_letter_used: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Joined job data (optional)
    job_title: Optional[str] = None
    job_company: Optional[str] = None
    job_location: Optional[str] = None
    job_salary: Optional[str] = None
    job_apply_url: Optional[str] = None
    job_source: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationStats(BaseModel):
    total: int = 0
    saved: int = 0
    applied: int = 0
    assessment: int = 0
    interview: int = 0
    final_interview: int = 0
    offer: int = 0
    rejected: int = 0
    withdrawn: int = 0


# ── Resume Generation ──────────────────────────────────────

class ResumeGenerateRequest(BaseModel):
    job_id: Optional[str] = None
    template_name: str = "ats_classic"
    custom_job_description: Optional[str] = None  # If no job_id, use raw text


class ResumeGenerateResponse(BaseModel):
    id: str
    template_name: str
    match_score: Optional[int] = None
    optimization_notes: Optional[str] = None
    pdf_url: Optional[str] = None
    tex_content: Optional[str] = None
    created_at: datetime


class ResumeParseResponse(BaseModel):
    """Result of resume parsing."""
    skills: list[str] = Field(default_factory=list)
    education: list[dict] = Field(default_factory=list)
    experience: list[dict] = Field(default_factory=list)
    projects: list[dict] = Field(default_factory=list)
    certifications: list[dict] = Field(default_factory=list)
    raw_text: str = ""


# ── Cover Letter ────────────────────────────────────────────

class CoverLetterGenerateRequest(BaseModel):
    job_id: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    tone: Optional[str] = "academic"
    custom_focus: Optional[str] = None
    provider: Optional[str] = "auto"  # "auto" | "groq" | "gemini" 


class CoverLetterPdfRequest(BaseModel):
    applicant_name: str
    contact_info: Optional[str] = ""
    date_str: Optional[str] = ""
    recipient_info: Optional[str] = ""
    subject: Optional[str] = ""
    body: str
    template: Optional[str] = "modern_minimal"
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None


class CoverLetterResponse(BaseModel):
    id: str
    content: str
    job_id: Optional[str] = None
    ai_model: str = "gemini"
    created_at: datetime

    class Config:
        from_attributes = True


# ── Saved Jobs ──────────────────────────────────────────────

class SavedJobResponse(BaseModel):
    id: str
    user_id: str
    job_id: str
    created_at: datetime
    job_title: Optional[str] = None
    job_company: Optional[str] = None
    job_location: Optional[str] = None
    job_source: Optional[str] = None


class JobIdRequest(BaseModel):
    job_id: str


# ── Bullet Point Enhancer ───────────────────────────────────

class BulletEnhanceRequest(BaseModel):
    bullet_point: str
    target_role: Optional[str] = None
    target_skills: Optional[list[str]] = Field(default_factory=list)


class BulletEnhanceResponse(BaseModel):
    original_bullet: str
    optimized_bullet: str
    impact_explanation: str
    alternatives: list[str] = Field(default_factory=list)

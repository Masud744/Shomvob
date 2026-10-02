"""
Shomvob (সম্ভব) — Job Pydantic Models.

Defines request/response schemas for jobs, job categories,
and search/filter parameters.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Job ─────────────────────────────────────────────────────

class JobBase(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    is_remote: bool = False
    remote_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    apply_url: str
    source: str
    source_job_id: Optional[str] = None
    posted_date: Optional[datetime] = None


class JobCreate(JobBase):
    """Schema for creating a job (used by source adapters)."""
    pass


class JobResponse(JobBase):
    id: str
    is_active: bool = True
    fetched_at: datetime
    created_at: datetime
    categories: list[JobCategoryResponse] = Field(default_factory=list)
    match_score: Optional[int] = None  # Populated when matched against a user

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Paginated job list response."""
    items: list[JobResponse]
    total: int
    limit: int
    offset: int


class JobSearchParams(BaseModel):
    """Query parameters for job search."""
    keyword: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    remote_only: bool = False
    experience_level: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    sort: str = Field(default="latest", pattern=r"^(latest|oldest|relevance)$")


# ── Job Category ────────────────────────────────────────────

class JobCategoryResponse(BaseModel):
    category: str
    confidence: float

    class Config:
        from_attributes = True


# ── Job Match ───────────────────────────────────────────────

class MatchRequest(BaseModel):
    """Request to match a user profile against a specific job."""
    job_id: str


class MatchScore(BaseModel):
    """Detailed match score breakdown."""
    overall_score: int = Field(..., ge=0, le=100)
    skill_match: int = Field(..., ge=0, le=100)
    project_match: int = Field(..., ge=0, le=100)
    education_match: int = Field(..., ge=0, le=100)
    location_match: int = Field(..., ge=0, le=100)
    explanation: list[str] = Field(default_factory=list)
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)


class MatchResponse(BaseModel):
    """Full match response with job data and scores."""
    job: JobResponse
    match: MatchScore
    overall_score: Optional[int] = None
    skill_match: Optional[int] = None
    project_match: Optional[int] = None
    education_match: Optional[int] = None
    location_match: Optional[int] = None
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    explanation: list[str] = Field(default_factory=list)


class CustomJobAnalyzeRequest(BaseModel):
    """Request to analyze an external or custom job description."""
    title: str
    company: Optional[str] = "Unknown"
    description: str
    location: Optional[str] = "Remote"
    apply_url: Optional[str] = None
    save_to_jobs: bool = True


class CustomJobAnalyzeResponse(BaseModel):
    """Response from analyzing a custom job description."""
    title: str
    company: str
    location: Optional[str] = None
    match: MatchScore
    job_id: Optional[str] = None
    saved_job_id: Optional[str] = None

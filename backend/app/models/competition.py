from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class CompetitionType(str, Enum):
    HACKATHON = "hackathon"
    DATATHON = "datathon"
    PROJECT_SHOWCASE = "project_showcase"
    POSTER_PRESENTATION = "poster_presentation"
    IDEATHON = "ideathon"
    CODING_CONTEST = "coding_contest"
    ROBOTICS_OLYMPIAD = "robotics_olympiad"


class ParticipationMode(str, Enum):
    ONLINE = "online"
    IN_PERSON = "in_person"
    HYBRID = "hybrid"


class CompetitionBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    organizer: str = Field(..., min_length=2, max_length=200)
    event_type: str = "hackathon"
    participation_mode: str = "online"  # online, in_person, hybrid
    venue_location: str = "Dhaka, Bangladesh"
    description: str
    eligibility: Optional[str] = "Open to university students and tech enthusiasts"
    prize_pool: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    event_date: Optional[datetime] = None
    registration_url: str
    banner_url: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    source: str = "bangladesh_tech_hub"
    social_proof: Optional[str] = None
    is_featured: bool = False


class CompetitionCreate(CompetitionBase):
    pass


class CompetitionResponse(CompetitionBase):
    id: str
    days_left: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompetitionStats(BaseModel):
    total_active: int
    online_count: int
    bangladesh_in_person: int
    hackathons_count: int
    datathons_count: int
    project_showcase_count: int
    poster_presentation_count: int

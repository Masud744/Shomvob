"""
Shomvob (সম্ভব) — Core Services Package.
"""

from __future__ import annotations

from app.services.ai_client import generate_cover_letter_text, optimize_resume_data
from app.services.job_classifier import classify_job
from app.services.job_fetcher import run_job_fetcher
from app.services.resume_parser import parse_resume_file

__all__ = [
    "generate_cover_letter_text",
    "optimize_resume_data",
    "classify_job",
    "run_job_fetcher",
    "parse_resume_file",
]

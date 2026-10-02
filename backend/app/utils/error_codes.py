"""
Shomvob (সম্ভব) — Structured Error Codes.

Centralized error code registry for consistent API responses.
"""

from __future__ import annotations

from enum import Enum


class ErrorCode(str, Enum):
    # Auth
    AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"

    # Profile
    PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND"
    PROFILE_UPDATE_FAILED = "PROFILE_UPDATE_FAILED"

    # Jobs
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    JOB_FETCH_FAILED = "JOB_FETCH_FAILED"
    JOB_DUPLICATE = "JOB_DUPLICATE"

    # Applications
    APPLICATION_NOT_FOUND = "APPLICATION_NOT_FOUND"
    APPLICATION_DUPLICATE = "APPLICATION_DUPLICATE"
    APPLICATION_INVALID_STATUS = "APPLICATION_INVALID_STATUS"

    # Resume
    RESUME_UPLOAD_FAILED = "RESUME_UPLOAD_FAILED"
    RESUME_PARSE_FAILED = "RESUME_PARSE_FAILED"
    RESUME_GENERATION_FAILED = "RESUME_GENERATION_FAILED"
    RESUME_FILE_TOO_LARGE = "RESUME_FILE_TOO_LARGE"
    RESUME_INVALID_TYPE = "RESUME_INVALID_TYPE"

    # Cover Letter
    COVER_LETTER_GENERATION_FAILED = "COVER_LETTER_GENERATION_FAILED"

    # Saved Jobs
    SAVED_JOB_DUPLICATE = "SAVED_JOB_DUPLICATE"
    SAVED_JOB_NOT_FOUND = "SAVED_JOB_NOT_FOUND"

    # AI
    AI_PROVIDER_UNAVAILABLE = "AI_PROVIDER_UNAVAILABLE"
    AI_RATE_LIMIT_EXCEEDED = "AI_RATE_LIMIT_EXCEEDED"

    # Generic
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"


ERROR_MESSAGES: dict[ErrorCode, str] = {
    ErrorCode.AUTH_TOKEN_MISSING: "Authorization token is missing.",
    ErrorCode.AUTH_TOKEN_EXPIRED: "Your session has expired. Please log in again.",
    ErrorCode.AUTH_TOKEN_INVALID: "Invalid authorization token.",

    ErrorCode.PROFILE_NOT_FOUND: "Profile not found. Complete your profile first.",
    ErrorCode.PROFILE_UPDATE_FAILED: "Failed to update profile.",

    ErrorCode.JOB_NOT_FOUND: "Job not found. It may have been removed.",
    ErrorCode.JOB_FETCH_FAILED: "Failed to fetch jobs. Please try again later.",
    ErrorCode.JOB_DUPLICATE: "This job is already in the database.",

    ErrorCode.APPLICATION_NOT_FOUND: "Application not found.",
    ErrorCode.APPLICATION_DUPLICATE: "You have already applied to this job.",
    ErrorCode.APPLICATION_INVALID_STATUS: "Invalid application status.",

    ErrorCode.RESUME_UPLOAD_FAILED: "Failed to upload resume. Please try again.",
    ErrorCode.RESUME_PARSE_FAILED: "Failed to parse resume. Ensure it's a valid PDF or DOCX.",
    ErrorCode.RESUME_GENERATION_FAILED: "Failed to generate resume. Please try again.",
    ErrorCode.RESUME_FILE_TOO_LARGE: "Resume file exceeds 5MB limit.",
    ErrorCode.RESUME_INVALID_TYPE: "Only PDF and DOCX files are accepted.",

    ErrorCode.COVER_LETTER_GENERATION_FAILED: "Failed to generate cover letter. Please try again.",

    ErrorCode.SAVED_JOB_DUPLICATE: "This job is already saved.",
    ErrorCode.SAVED_JOB_NOT_FOUND: "Saved job not found.",

    ErrorCode.AI_PROVIDER_UNAVAILABLE: "AI service is temporarily unavailable. Please try again.",
    ErrorCode.AI_RATE_LIMIT_EXCEEDED: "AI rate limit exceeded. Please wait a moment.",

    ErrorCode.INTERNAL_ERROR: "Something went wrong. Our team has been notified.",
    ErrorCode.VALIDATION_ERROR: "Invalid input provided.",
    ErrorCode.RESOURCE_NOT_FOUND: "Resource not found.",
}

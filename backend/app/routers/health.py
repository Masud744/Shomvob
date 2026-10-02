"""
Shomvob (সম্ভব) — Health Check Router.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """API health check endpoint."""
    return {"status": "ok", "service": "Shomvob API"}

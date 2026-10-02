"""
Shomvob (সম্ভব) — Job Source Base Class.

Defines the abstract interface for all legal, API-based job source adapters.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from app.models.job import JobCreate


class JobSource(ABC):
    """Abstract base class for all job source adapters."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the job source."""
        pass

    @abstractmethod
    async def fetch_jobs(
        self, search_terms: list[str], max_results: int = 50
    ) -> list[JobCreate]:
        """
        Fetch jobs from the source based on search terms.

        Args:
            search_terms: List of keywords to search for.
            max_results: Maximum number of results to return.

        Returns:
            List of JobCreate objects normalized from the source's data.
        """
        pass

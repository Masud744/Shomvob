"""
Shomvob (সম্ভব) — Application Configuration.

Loads settings from environment variables with sensible defaults.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Supabase ────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # ── AI Providers ────────────────────────────────────────
    gemini_api_key: str = ""
    groq_api_key: str = ""
    cerebras_api_key: str = ""

    # ── CORS ────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"

    # ── LaTeX ───────────────────────────────────────────────
    pdflatex_path: str = "pdflatex"

    # ── App ─────────────────────────────────────────────────
    app_name: str = "Shomvob API"
    debug: bool = False
    environment: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def allowed_origins(self) -> list[str]:
        """Allowed CORS origins parsed from comma-separated env var."""
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        origins.append(self.frontend_url)
        origins.append("http://localhost:3000")
        # Add production Vercel or Netlify URL if set
        vercel_url = os.getenv("VERCEL_URL")
        if vercel_url:
            origins.append(f"https://{vercel_url}")
        netlify_url = os.getenv("NETLIFY_URL") or os.getenv("URL")
        if netlify_url:
            if not netlify_url.startswith("http"):
                netlify_url = f"https://{netlify_url}"
            origins.append(netlify_url)
        return list(set(origins))


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()

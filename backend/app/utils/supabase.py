"""
Shomvob (সম্ভব) — Supabase Client Utility.

Provides both admin (service-role) and user-scoped Supabase clients.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import create_client, Client

from app.config import get_settings


@lru_cache()
def get_supabase_admin() -> Client:
    """
    Get a Supabase client using the service-role key.
    This bypasses RLS — use only for server-side operations
    like job fetching, classification, and admin tasks.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_client(access_token: str | None = None) -> Client:
    """
    Get a Supabase client using the anon key.
    If an access_token is provided, it sets the auth header
    so that RLS policies are applied for the authenticated user.
    """
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    if access_token:
        client.auth.set_session(access_token, "")
    return client

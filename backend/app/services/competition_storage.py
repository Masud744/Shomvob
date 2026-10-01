from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.utils.supabase import get_supabase_admin

logger = logging.getLogger(__name__)

_SUPABASE_TABLE_EXISTS: Optional[bool] = None

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
LOCAL_DB_FILE = os.path.join(DATA_DIR, "competitions.json")


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(LOCAL_DB_FILE):
        with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_local_competitions() -> list[dict]:
    _ensure_data_dir()
    try:
        with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Error reading local competitions: %s", e)
        return []


def _save_local_competitions(items: list[dict]):
    _ensure_data_dir()
    try:
        with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, default=str)
    except Exception as e:
        logger.error("Error saving local competitions: %s", e)


def compute_days_left(deadline_str: Optional[str | datetime]) -> Optional[int]:
    if not deadline_str:
        return None
    try:
        if isinstance(deadline_str, str):
            dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        else:
            dt = deadline_str
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = (dt - now).total_seconds()
        days = int(diff // 86400)
        return max(0, days)
    except Exception:
        return None


def get_all_competitions(
    event_type: Optional[str] = None,
    participation_mode: Optional[str] = None,
    search: Optional[str] = None,
    location_filter: Optional[str] = None,
) -> list[dict]:
    """
    Fetch competitions with dual-layer fallback: Supabase DB first, local storage if table missing.
    """
    global _SUPABASE_TABLE_EXISTS
    items: list[dict] = []
    use_local = True

    if _SUPABASE_TABLE_EXISTS is not False:
        try:
            db = get_supabase_admin()
            query = db.table("competitions").select("*")
            if event_type and event_type != "all":
                query = query.eq("event_type", event_type)
            if participation_mode and participation_mode != "all":
                query = query.eq("participation_mode", participation_mode)

            res = query.order("registration_deadline", desc=False).execute()
            if res.data is not None:
                items = res.data
                use_local = False
                _SUPABASE_TABLE_EXISTS = True
        except Exception as exc:
            _SUPABASE_TABLE_EXISTS = False
            use_local = True

    if use_local:
        raw_items = _load_local_competitions()
        items = raw_items
        if event_type and event_type != "all":
            items = [i for i in items if i.get("event_type") == event_type]
        if participation_mode and participation_mode != "all":
            items = [i for i in items if i.get("participation_mode") == participation_mode]

    # Search query filter
    if search:
        s = search.lower()
        items = [
            i for i in items
            if s in i.get("title", "").lower()
            or s in i.get("organizer", "").lower()
            or s in i.get("description", "").lower()
            or any(s in tag.lower() for tag in (i.get("tags") or []))
        ]

    # Location filter (e.g. Bangladesh in-person vs online)
    if location_filter == "bangladesh":
        items = [i for i in items if "bangladesh" in i.get("venue_location", "").lower() or i.get("participation_mode") == "in_person"]
    elif location_filter == "online":
        items = [i for i in items if i.get("participation_mode") in ("online", "hybrid")]

    # Calculate days_left and sort by urgency (closest deadline first)
    for it in items:
        it["days_left"] = compute_days_left(it.get("registration_deadline"))

    def sort_key(x):
        dl = x.get("days_left")
        return (dl is None, dl if dl is not None else 9999)

    items.sort(key=sort_key)
    return items


def upsert_competition(comp: dict) -> dict:
    """
    Upsert a competition into Supabase and local storage.
    """
    if "id" not in comp or not comp["id"]:
        comp["id"] = str(uuid.uuid4())
    comp["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "created_at" not in comp:
        comp["created_at"] = datetime.now(timezone.utc).isoformat()

    global _SUPABASE_TABLE_EXISTS
    if _SUPABASE_TABLE_EXISTS is not False:
        try:
            db = get_supabase_admin()
            db.table("competitions").upsert(comp).execute()
            _SUPABASE_TABLE_EXISTS = True
        except Exception as e:
            _SUPABASE_TABLE_EXISTS = False
            logger.debug("Could not upsert to Supabase: %s", e)

    # Always persist locally for offline/fallback reliability
    local_items = _load_local_competitions()
    existing_idx = next((i for i, x in enumerate(local_items) if x.get("id") == comp["id"] or x.get("title") == comp.get("title")), None)
    if existing_idx is not None:
        local_items[existing_idx] = {**local_items[existing_idx], **comp}
    else:
        local_items.append(comp)

    _save_local_competitions(local_items)
    return comp

from __future__ import annotations

import logging
import os
import re
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def resolve_facebook_event_metadata(url: str) -> Dict[str, Any]:
    """
    Attempts to extract metadata from a Facebook event URL.
    1. If FB_SESSION_COOKIE is available in environment, uses Playwright with authenticated session.
    2. Otherwise, performs regex and URL parsing to extract event IDs, slugs, and default metadata.
    """
    metadata: Dict[str, Any] = {
        "title": None,
        "organizer": None,
        "description": None,
        "banner_url": None,
        "social_proof": None,
        "registration_url": url,
    }

    # Extract event ID or slug from URL
    match_id = re.search(r"facebook\.com/events/(\d+)", url)
    event_id = match_id.group(1) if match_id else None

    # Check for optional FB session cookie in environment
    fb_cookie = os.getenv("FB_SESSION_COOKIE")
    if fb_cookie:
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 800},
                )

                # Parse c_user and xs from cookie string: "c_user=123; xs=abc"
                cookies = []
                for part in fb_cookie.split(";"):
                    if "=" in part:
                        k, v = part.strip().split("=", 1)
                        cookies.append({"name": k, "value": v, "domain": ".facebook.com", "path": "/"})

                if cookies:
                    context.add_cookies(cookies)

                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=12000)

                # Extract OG tags
                og_title = page.locator('meta[property="og:title"]').get_attribute("content")
                og_desc = page.locator('meta[property="og:description"]').get_attribute("content")
                og_image = page.locator('meta[property="og:image"]').get_attribute("content")

                if og_title and "Log in" not in og_title:
                    metadata["title"] = og_title
                if og_desc:
                    metadata["description"] = og_desc
                if og_image:
                    metadata["banner_url"] = og_image

                browser.close()
                logger.info(f"Successfully resolved FB metadata with session cookie for {url}")
                return metadata
        except Exception as e:
            logger.warning(f"Playwright authenticated FB resolution error: {e}")

    # Fallback heuristic: Extract human-readable slug from URL if present
    slug_match = re.search(r"facebook\.com/events/([a-zA-Z0-9_\.-]+)", url)
    if slug_match and not event_id:
        slug = slug_match.group(1).replace("-", " ").replace(".", " ").title()
        metadata["title"] = slug

    return metadata

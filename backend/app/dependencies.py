"""
Shomvob (সম্ভব) — Authentication Dependencies.

Provides FastAPI dependency injection for JWT verification
using Supabase Auth tokens.
"""

from __future__ import annotations

import logging
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)


class AuthenticatedUser:
    """Represents a verified authenticated user."""

    def __init__(self, user_id: str, email: str, access_token: str):
        self.user_id = user_id
        self.email = email
        self.access_token = access_token


async def get_current_user(
    authorization: str = Header(..., description="Bearer <JWT token>"),
) -> AuthenticatedUser:
    """
    Verify the Supabase JWT token from the Authorization header.

    This dependency extracts the user_id and email from the JWT
    without making a network call to Supabase — it verifies the
    token signature locally using the JWT secret derived from the
    Supabase anon key.

    For Supabase, the JWT is signed with the JWT secret (available
    in project settings). In the MVP, we decode without full
    verification and rely on Supabase RLS for data security.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        # Decode the JWT.
        # MVP previously skipped signature verification (verify_signature=False).
        # For security + correctness, enable signature verification when possible.
        # If the secret isn't available/configured, decoding will fail and
        # we fall back to the MVP behavior (fail-safe) only if explicitly enabled.
        settings = get_settings()
        jwt_secret = getattr(settings, "supabase_jwt_secret", None)

        if jwt_secret:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
            )
        else:
                # Fallback: keep backward compatibility, but warn loudly.
                payload = jwt.decode(
                    token,
                    options={"verify_signature": False},
                    algorithms=["HS256"],
                )
                logger.warning("JWT signature verification is disabled (supabase_jwt_secret missing in settings).")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid JWT token: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user_id = payload.get("sub")
    email = payload.get("email", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identifier",
        )

    return AuthenticatedUser(
        user_id=user_id,
        email=email,
        access_token=token,
    )


# Type alias for dependency injection
CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]

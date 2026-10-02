"""
Shomvob (সম্ভব) — AI Provider Manager.

Factory that initializes providers based on available API keys
and provides automatic fallback between providers.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.config import get_settings
from app.ai.base import BaseLLMProvider, LLMResponse

import threading

logger = logging.getLogger(__name__)

# Lazy-initialized singleton with thread lock
_manager: Optional["ProviderManager"] = None
_manager_lock = threading.Lock()


class ProviderManager:
    """Manages multiple LLM providers with automatic fallback."""

    def __init__(self):
        self.providers: list[BaseLLMProvider] = []
        settings = get_settings()

        # Register providers in priority order
        if settings.gemini_api_key:
            from app.ai.gemini import GeminiProvider
            self.providers.append(GeminiProvider(settings.gemini_api_key))
            logger.info("Registered Gemini provider")

        if settings.groq_api_key:
            from app.ai.groq import GroqProvider
            self.providers.append(GroqProvider(settings.groq_api_key))
            logger.info("Registered Groq provider")

        if not self.providers:
            logger.warning("No AI providers configured! AI features will be unavailable.")

    async def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        preferred_provider: str | None = None,
    ) -> LLMResponse:
        """
        Generate a completion with automatic fallback.
        
        Tries the preferred provider first (if specified), 
        then falls back through remaining providers in order.
        """
        providers = list(self.providers)

        # Move preferred provider to front
        if preferred_provider:
            providers.sort(
                key=lambda p: 0 if p.name == preferred_provider else 1
            )

        last_error = None
        for provider in providers:
            try:
                logger.info("Attempting completion with %s", provider.name)
                result = await provider.complete(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                logger.info(
                    "Completed with %s in %.0fms",
                    provider.name,
                    result.latency_ms,
                )
                return result
            except Exception as e:
                logger.warning(
                    "Provider %s failed: %s. Trying fallback...",
                    provider.name,
                    str(e),
                )
                last_error = e

        raise RuntimeError(
            f"All AI providers failed. Last error: {last_error}"
        )

    @property
    def available_providers(self) -> list[str]:
        """List of available provider names."""
        return [p.name for p in self.providers]


def get_ai_manager() -> ProviderManager:
    """Get the singleton AI provider manager (thread-safe)."""
    global _manager
    if _manager is None:
        with _manager_lock:
            if _manager is None:
                _manager = ProviderManager()
    return _manager

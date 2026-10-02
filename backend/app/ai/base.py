"""
Shomvob (সম্ভব) — Base LLM Provider.

Abstract base class defining the interface for all LLM providers.
"""

from __future__ import annotations

import time
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Standardized response from any LLM provider."""
    content: str
    model: str
    provider: str
    usage: dict = field(default_factory=dict)
    latency_ms: float = 0.0


class TokenBucket:
    """Simple token bucket rate limiter."""

    def __init__(self, max_tokens: int, refill_rate: float):
        """
        Args:
            max_tokens: Maximum number of tokens in the bucket.
            refill_rate: Tokens added per second.
        """
        self.max_tokens = max_tokens
        self.tokens = max_tokens
        self.refill_rate = refill_rate
        self.last_refill = time.monotonic()

    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens. Returns True if successful."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def wait_time(self) -> float:
        """Time in seconds to wait before a token is available."""
        if self.tokens >= 1:
            return 0.0
        return (1 - self.tokens) / self.refill_rate


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, name: str, rate_limit: TokenBucket | None = None):
        self.name = name
        self.rate_limit = rate_limit

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        """Generate a text completion."""
        ...

    async def _rate_limited_call(self, call_func, *args, **kwargs) -> LLMResponse:
        """Wrap a call with rate limiting."""
        if self.rate_limit:
            while not self.rate_limit.consume():
                wait = self.rate_limit.wait_time()
                logger.warning(
                    "Rate limit hit for %s, waiting %.1fs", self.name, wait
                )
                import asyncio
                await asyncio.sleep(wait)

        start = time.monotonic()
        result = await call_func(*args, **kwargs)
        result.latency_ms = (time.monotonic() - start) * 1000
        return result

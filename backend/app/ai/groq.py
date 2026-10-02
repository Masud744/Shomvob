"""
Shomvob (সম্ভব) — Groq Provider.

Uses the Groq API (OpenAI-compatible) for fast inference.
Free tier: 30 req/min on selected models.
"""

from __future__ import annotations

import logging
import httpx

from app.ai.base import BaseLLMProvider, LLMResponse, TokenBucket

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider(BaseLLMProvider):
    """Groq Cloud LLM provider (OpenAI-compatible API)."""

    def __init__(self, api_key: str, model: str = "qwen/qwen3.8-27b"):
        # Free tier: 30 requests per minute = 0.5 req/s
        super().__init__(
            name="groq",
            rate_limit=TokenBucket(max_tokens=30, refill_rate=0.5),
        )
        self.api_key = api_key
        self.model_name = model

    async def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        """Generate completion using Groq."""

        async def _call():
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model_name,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
                response.raise_for_status()
                data = response.json()

            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})

            return LLMResponse(
                content=content,
                model=self.model_name,
                provider="groq",
                usage={
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                },
            )

        return await self._rate_limited_call(_call)

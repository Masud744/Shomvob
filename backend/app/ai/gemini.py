"""
Shomvob (সম্ভব) — Google Gemini Provider.

Uses the google-generativeai SDK for Gemini 1.5 Flash (free tier: 15 req/min).
"""

from __future__ import annotations

import asyncio
import logging

import google.generativeai as genai

from app.ai.base import BaseLLMProvider, LLMResponse, TokenBucket

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    """Google Gemini 1.5 Flash LLM provider."""

    def __init__(self, api_key: str):
        # Free tier: 15 requests per minute = 0.25 req/s
        super().__init__(
            name="gemini",
            rate_limit=TokenBucket(max_tokens=15, refill_rate=0.25),
        )
        genai.configure(api_key=api_key, transport="rest")
        self.model = genai.GenerativeModel("gemini-2.5-flash")

    async def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        """Generate completion using Gemini."""

        async def _call():
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            is_json = "json" in (system_prompt + prompt).lower()

            config_kwargs = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            if is_json:
                config_kwargs["response_mime_type"] = "application/json"

            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self.model.generate_content,
                        full_prompt,
                        generation_config=genai.types.GenerationConfig(**config_kwargs),
                    ),
                    timeout=25.0,
                )
            except Exception as e:
                # If gemini-2.5-flash has an issue, fallback to gemini-2.5-flash-lite
                logger.warning("gemini-2.5-flash error (%s), trying gemini-2.5-flash-lite", e)
                fallback_model = genai.GenerativeModel("gemini-2.5-flash-lite")
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        fallback_model.generate_content,
                        full_prompt,
                        generation_config=genai.types.GenerationConfig(**config_kwargs),
                    ),
                    timeout=25.0,
                )

            usage = {}
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                usage = {
                    "prompt_tokens": getattr(response.usage_metadata, "prompt_token_count", 0),
                    "completion_tokens": getattr(response.usage_metadata, "candidates_token_count", 0),
                    "total_tokens": getattr(response.usage_metadata, "total_token_count", 0),
                }

            return LLMResponse(
                content=response.text,
                model="gemini-2.5-flash",
                provider="gemini",
                usage=usage,
            )

        return await self._rate_limited_call(_call)

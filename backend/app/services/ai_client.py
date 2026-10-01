"""
EngineerCopilot AI — AI Client Wrapper.

Provides high-performance, fault-tolerant dual-provider LLM orchestration
between Groq (Ultra-low latency LPU) and Google Gemini (Multimodal & Reasoning),
with automatic error-sensing failover, anti-AI humanization, and CV synthesis.
"""

from __future__ import annotations

import logging
import json
import asyncio
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def call_groq_api(prompt: str, system_instruction: str = "") -> tuple[str, str]:
    """
    Call Groq API using high-performance open-weights models (120B / 27B).
    """
    settings = get_settings()
    api_key = settings.groq_api_key

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    candidate_models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
    last_err = ""

    for model_name in candidate_models:
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.35,
            "max_tokens": 1400,
        }
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    if response.status_code == 200:
                        data = response.json()
                        content = data["choices"][0]["message"]["content"].strip()
                        return content, f"groq:{model_name}"
                    elif response.status_code in (429, 503):
                        logger.warning("Groq %s returned %d, retrying...", model_name, response.status_code)
                        await asyncio.sleep(1.0 * (attempt + 1))
                        continue
                    else:
                        last_err = f"Groq HTTP {response.status_code}: {response.text[:150]}"
                        break
            except Exception as e:
                last_err = str(e)
                await asyncio.sleep(0.8)

    raise RuntimeError(f"All Groq models failed: {last_err}")


async def call_gemini_api(prompt: str, system_instruction: str = "") -> tuple[str, str]:
    """
    Call the Gemini API with automatic model fallback and transient error retries.
    """
    settings = get_settings()
    api_key = settings.gemini_api_key

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [
                {"text": system_instruction}
            ]
        }

    candidate_models = ["gemini-2.5-flash", "gemini-flash-latest"]
    last_error_msg = ""

    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    if response.status_code == 200:
                        result = response.json()
                        candidates = result.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return parts[0].get("text", "").strip(), f"gemini:{model_name}"
                    elif response.status_code in (429, 503):
                        logger.warning(
                            "Gemini model %s returned %d (attempt %d). Retrying...",
                            model_name, response.status_code, attempt + 1
                        )
                        await asyncio.sleep(1.2 * (attempt + 1))
                        continue
                    else:
                        last_error_msg = f"{model_name} HTTP {response.status_code}: {response.text[:200]}"
                        break
            except Exception as ex:
                logger.warning("Error calling Gemini model %s: %s", model_name, ex)
                last_error_msg = str(ex)
                await asyncio.sleep(1.0)

    raise RuntimeError(f"All Gemini models failed: {last_error_msg}")


async def call_llm_with_failover(
    prompt: str,
    system_instruction: str = "",
    preferred_provider: str = "auto",
) -> tuple[str, str]:
    """
    Dual-provider failover engine between Groq and Gemini.
    """
    providers = []
    if preferred_provider == "groq":
        providers = [("groq", call_groq_api), ("gemini", call_gemini_api)]
    elif preferred_provider == "gemini":
        providers = [("gemini", call_gemini_api), ("groq", call_groq_api)]
    else:
        # Default Auto: Groq is extremely fast (sub-second LPU), Gemini is resilient fallback
        providers = [("groq", call_groq_api), ("gemini", call_gemini_api)]

    last_error = None
    for name, call_fn in providers:
        try:
            logger.info("Attempting LLM generation with provider: %s", name)
            content, engine_id = await call_fn(prompt, system_instruction)
            logger.info("Generation succeeded via %s", engine_id)
            return content, engine_id
        except Exception as e:
            logger.warning("Provider %s failed with: %s. Switching to alternative provider...", name, e)
            last_error = e

    raise RuntimeError(f"All AI providers (Groq and Gemini) failed. Last error: {last_error}")


def generate_cover_letter_text(
    job_title: str,
    company_name: str,
    job_description: str,
    user_context: dict,
    tone: str = "academic",
    custom_focus: str = "",
    provider: str = "auto",
) -> tuple[str, str]:
    """
    Generate an authentic, human-authored, academic/senior engineering cover letter.
    Deeply synthesizes the candidate CV and the job circular while strictly banning AI clichés.
    """
    tone_guidelines = {
        "academic": (
            "Write in an intellectually rigorous, scholarly yet pragmatic senior engineering tone. "
            "Use precise syntax, calm confidence, and concrete architectural evidence. "
            "Avoid hyperbole or corporate cheerleading. Speak from first-principles engineering experience."
        ),
        "technical": (
            "Write in a sharp, metric-focused style. Emphasize low-level systems, code quality, "
            "concurrency, testing methodologies, and quantifiable performance gains."
        ),
        "executive": (
            "Write with an architectural and strategic mindset. Emphasize system ownership, "
            "cross-functional delivery, technical trade-offs, and alignment with business objectives."
        ),
        "enthusiastic": (
            "Write with high-velocity builder passion, authentic curiosity for the domain, "
            "and hunger to solve difficult technical challenges rapidly."
        ),
    }.get(tone, "Write in an intellectually rigorous, human, and grounded senior engineering voice.")

    focus_instruction = f"- Candidate Specific Focus / Highlight: {custom_focus}" if custom_focus else ""

    candidate_name = (user_context.get("name") or "Applicant").strip()
    if candidate_name.lower() in ("none", ""):
        candidate_name = "Applicant"

    prompt = f"""
You are crafting an authentic, human-authored engineering cover letter that will be reviewed by senior software architects and engineering leaders.

============================================================
STRICT ANTI-AI BAN LIST (ZERO-TOLERANCE):
Do NOT use ANY of these robotic AI tropes, buzzwords, or filler phrases:
- "I was thrilled to see..." or "I am excited to apply..."
- "delve into" or "delving"
- "testament to"
- "spearhead" or "spearheaded"
- "tapestry"
- "seamlessly" or "seamless integration"
- "furthermore", "moreover", "in conclusion"
- "beacon"
- "pivotal"
- "plethora"
- "synergy" or "synergistic"
- "foster" or "fostering"
- "cutting-edge"
- "game-changer"
- "dynamic"
- "esteemed company/organization"
- "honed my skills"
- "fast-paced environment"
- "aligns perfectly with"
============================================================

1. TARGET JOB CIRCULAR:
- Position: {job_title}
- Company: {company_name}
- Job Description:
{job_description}

2. CANDIDATE AUTHENTIC DOSSIER & CV:
- Full Name: {candidate_name}
- Phone: {user_context.get("phone", "")}
- Email: {user_context.get("email", "")}
- Location: {user_context.get("location", "")}
- LinkedIn: {user_context.get("linkedin_url", "")}
- GitHub: {user_context.get("github_url", "")}
- Technical Stack: {", ".join(user_context.get("skills", []))}
- Verified Projects: {json.dumps(user_context.get("projects", []))}
- Experience: {json.dumps(user_context.get("experience", []))}
- Education & Research: {json.dumps(user_context.get("education", []))}
- Raw CV Details:
{user_context.get("resume_text", "")[:2200]}

{focus_instruction}

ANALYSIS & WRITING INSTRUCTIONS:
1. INTERNAL ANALYSIS:
   - First examine what technical challenges, architectural constraints, or stack requirements the job circular actually cares about.
   - Second, match these directly against the candidate genuine projects, published libraries, or academic coursework from the dossier.
   - Do NOT invent fake technologies. Use the candidate real project evidence (e.g. FreeRTOS task scheduling, ISR buffers, OTA rollback, microservices, specific APIs, or data telemetry).

2. TONE & STYLE:
   - Tone Directive: {tone_guidelines}
   - Human voice: Write with measured, mature sentence structures. Avoid exclamation marks.
   - Ground every statement in concrete technical reality.

3. STRUCTURE:
   - Output ONLY the salutation, 2-3 body paragraphs, and formal closing sign-off.
   - DO NOT output any top header, sender contact details, date, or subject line (the document layout template already renders them above).
   - Salutation: Begin with "Dear Hiring Team at {company_name}," or "Dear {company_name} Engineering Team,".
   - Paragraph 1: Direct, calm statement of candidacy for {job_title}, stating primary technical discipline and immediate relevance to the company engineering mission.
   - Paragraph 2: In-depth technical synthesis. Cite 1-2 specific projects or engineering problems from the candidate CV, explaining technical constraints, architectural choices made, and how that expertise directly solves the problems described in the job description.
   - Paragraph 3: Delivery philosophy, code craftsmanship, and how the candidate plans to contribute to the team technical roadmap.
   - Formal Sign-Off:
     Sincerely,
     {candidate_name}

4. FORMAT:
   - Plain text only. NO markdown asterisks (**bold**), NO bullet points, and NO bracketed placeholders.
"""

    system_instruction = (
        "You are a Distinguished Software Architect and Academic Engineering Evaluator. "
        "You write deeply articulate, grounded, human cover letters with zero AI clichés or fluff."
    )

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(
        call_llm_with_failover(
            prompt=prompt,
            system_instruction=system_instruction,
            preferred_provider=provider,
        )
    )


async def optimize_resume_data(
    user_context: dict,
    job_description: str,
) -> str:
    """
    Use dual-provider LLM to suggest resume improvements and keywords to add.
    """
    prompt = f"""
    Analyze the user profile against this job description and suggest optimizations.

    Job Description:
    {job_description}

    User Skills:
    {', '.join(user_context.get('skills', []))}

    User Experience:
    {json.dumps(user_context.get('experience', []))}

    Identify:
    1. Missing keywords from the job description.
    2. 3 actionable bullet point improvements for the experience section.
    3. A matching score (0 to 100) based on requirements.

    Return the result in a clean, professional markdown format.
    """

    system_instruction = "You are an ATS optimization system. Analyze resume data and suggest specific, legal, keyword optimizations to improve matching."

    text, _ = await call_llm_with_failover(prompt, system_instruction)
    return text

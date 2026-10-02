"""
Shomvob (সম্ভব) — AI Job Matching Engine.

Uses LLM to evaluate a candidate's profile against a Job Description.
"""

import json
import logging
import re
from typing import Dict, Any

from app.ai.manager import get_ai_manager

logger = logging.getLogger(__name__)

MATCHING_SYSTEM_PROMPT = """
You are an expert, HIGHLY STRICT technical recruiter determining if a candidate is genuinely qualified for a role. 
Your task is to analyze a candidate's profile and compare it critically against the provided Job Description.

You MUST return your analysis as a valid, parsable JSON object. Do NOT include markdown blocks, code fences, or any conversational text outside the JSON.

Expected JSON format:
{
  "overall_score": <int 0-100>,
  "skill_match": <int 0-100>,
  "project_match": <int 0-100>,
  "education_match": <int 0-100>,
  "location_match": <int 0-100>,
  "matching_skills": ["<string: skill from candidate profile that matches the JD>"],
  "missing_skills": ["<string: key skill or tool demanded by JD that candidate lacks>"],
  "explanation": [
    "<string: short 1-sentence brutally honest insight about skill overlap (or lack thereof)>",
    "<string: short 1-sentence brutally honest insight about project/experience relevance>",
    "<string: short 1-sentence insight about location/remote fit>"
  ]
}

Rules for Strict Scoring:
- Be brutally honest. DO NOT inflate scores just because both the job and candidate are in "IT" or "Software Engineering". 
- If the core job domain (e.g., Mobile App Development) does NOT match the candidate's core experience (e.g., Backend / AI), 'project_match' and 'skill_match' MUST score extremely low (10-30%), even if they share generic skills (like Git or Java).
- 90-100%: Perfect unicorn fit with exact matching core technologies and exact domain project experience.
- 70-89%: Strong fit, has the exact core domain experience but missing a few nice-to-have skills.
- 40-69%: Missing core domain experience but has highly transferable functional skills.
- 0-39%: Completely different domain (e.g. an AI/Backend Developer applying for a pure Mobile App role is a <30%).
- overall_score should strictly be a weighted average (Skills 45%, Projects 35%, Location 10%, Education 10%).
- Ensure valid JSON output without any markdown.
"""


async def generate_match_score(job: Dict[str, Any], profile: Dict[str, Any], skills: list, projects: list, education: list) -> Dict[str, Any]:
    """Generates a dynamic match score using AI."""
    
    # Construct Candidate Context
    candidate_context = f"""
CANDIDATE PROFILE
-----------------
Location: {profile.get('city')}, {profile.get('country')}
Preferred Locations: {', '.join(profile.get('preferred_locations', []))}

SKILLS:
{', '.join([s.get('skill_name', '') for s in skills]) if skills else 'None listed'}

PROJECTS/EXPERIENCE:
"""
    for p in projects:
        tech = ", ".join(p.get("technologies") or [])
        title = p.get("title") or "Project/Role"
        desc = p.get("description") or ""
        candidate_context += f"- {title}: Used: {tech}. {desc}\n"
        
    candidate_context += f"""
EDUCATION:
{', '.join([f"{e.get('degree')} in {e.get('field_of_study')}" for e in education]) if education else 'None listed'}
"""

    # Construct Job Context
    job_context = f"""
JOB POSTING
-----------
Title: {job.get('title')}
Company: {job.get('company')}
Location: {job.get('location')} (Remote: {job.get('is_remote')})
Required Skills: {', '.join(job.get('required_skills') or [])}

DESCRIPTION:
{job.get('description')}
"""

    prompt = f"{job_context}\n\n{candidate_context}\n\nEvaluate the match and return JSON."

    try:
        manager = get_ai_manager()
        # Prefer Gemini for reliable JSON output, fallback to Groq
        response = await manager.complete(
            prompt=prompt,
            system_prompt=MATCHING_SYSTEM_PROMPT,
            temperature=0.1,
            preferred_provider="gemini"
        )
        
        # Clean JSON markdown fences if the model ignored instructions
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        data = json.loads(content.strip())

        def clamp(val: Any, default: int = 50) -> int:
            try:
                return max(0, min(100, int(val)))
            except (TypeError, ValueError):
                return default

        return {
            "overall_score": clamp(data.get("overall_score"), 50),
            "skill_match": clamp(data.get("skill_match"), 50),
            "project_match": clamp(data.get("project_match"), 50),
            "education_match": clamp(data.get("education_match"), 50),
            "location_match": clamp(data.get("location_match"), 50),
            "matching_skills": [str(s) for s in data.get("matching_skills", []) if s],
            "missing_skills": [str(s) for s in data.get("missing_skills", []) if s],
            "explanation": data.get("explanation", ["AI match generated successfully."]),
        }

    except Exception as e:
        logger.error(f"AI Matching failed: {e}")

        candidate_skills_lower = {s.get("skill_name", "").lower() for s in skills}
        job_skills_lower = {s.lower() for s in (job.get("required_skills") or [])}
        job_text_lower = f"{job.get('title', '')} {job.get('description', '')}".lower()

        if job_skills_lower:
            overlap = len(candidate_skills_lower & job_skills_lower)
            skill_score = min(int((overlap / len(job_skills_lower)) * 100), 95)
            matched_skills_list = list(candidate_skills_lower & job_skills_lower)
            missing_skills_list = list(job_skills_lower - candidate_skills_lower)
        else:
            hits = [s for s in candidate_skills_lower if s and s in job_text_lower]
            overlap = len(hits)
            skill_score = min(overlap * 8, 70)
            matched_skills_list = hits
            missing_skills_list = []

        proj_hits = 0
        for p in projects:
            for tech in (p.get("technologies") or []):
                if tech.lower() in job_text_lower:
                    proj_hits += 1
        project_score = min(proj_hits * 10, 70)

        candidate_city = (profile.get("city") or "").lower()
        candidate_country = (profile.get("country") or "").lower()
        job_location_lower = (job.get("location") or "").lower()
        if job.get("is_remote"):
            location_score = 80
        elif candidate_city in job_location_lower or candidate_country in job_location_lower:
            location_score = 100
        else:
            location_score = 30

        overall = int(skill_score * 0.45 + project_score * 0.35 + location_score * 0.10 + 50 * 0.10)

        return {
            "overall_score": overall,
            "skill_match": skill_score,
            "project_match": project_score,
            "education_match": 50,
            "location_match": location_score,
            "matching_skills": matched_skills_list,
            "missing_skills": missing_skills_list,
            "explanation": [
                f"Heuristic match: {overlap} skill keyword(s) matched in job posting.",
                f"Project tech overlap: {proj_hits} technology match(es) found in job description.",
                "Location score estimated from profile city/country vs job location.",
            ],
        }

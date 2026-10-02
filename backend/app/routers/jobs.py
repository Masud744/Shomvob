"""
Shomvob (সম্ভব) — Jobs Router.

Endpoints for job listing, searching, filtering, and matching.
Jobs are publicly readable (no auth required for listing).
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Response
from app.services.cache_service import memory_cache, sync_throttler

from app.dependencies import CurrentUser
from app.models.job import (
    JobListResponse,
    MatchRequest,
    MatchResponse,
    MatchScore,
    CustomJobAnalyzeRequest,
    CustomJobAnalyzeResponse,
)
from app.utils.supabase import get_supabase_admin

import re
from app.services.job_scraper import sync_jobs

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])

db = get_supabase_admin
_sync_running = False

NON_SKILL_WORDS = {
    'engineer', 'engineering', 'developer', 'programmer', 'architect', 'architecture',
    'lead', 'technical lead', 'tech lead', 'team lead', 'vp engineering', 'director',
    'senior', 'mid', 'junior', 'intern', 'internship', 'full time', 'part time',
    'remote', 'onsite', 'hybrid', 'bangladesh', 'dhaka', 'worldwide', 'government',
    'public sector', 'circular', 'teletalk', 'bpsc', 'bcs', 'software',
    'software engineer', 'backend', 'frontend', 'fullstack', 'full stack', 'devops',
    'cloud', 'infrastructure', 'infra', 'iot', 'embedded', 'firmware', 'robotics',
    'ai', 'ml', 'ai/ml', 'cybersecurity', 'security', 'tech', 'it', 'consultant',
    'advisory', 'adoption', 'literacy', 'specialist', 'manager', 'management',
    'cto', 'ceo', 'officer', 'analyst', 'candidate', 'candidates', 'job', 'jobs', 'role'
}

TECH_KEYWORDS = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular',
    'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Golang', 'Rust',
    'Java', 'Spring Boot', 'C++', 'C#', '.NET', 'PHP', 'Laravel',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform', 'Ansible',
    'CI/CD', 'Linux', 'Ubuntu', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'GraphQL', 'REST API', 'Microservices', 'Kafka', 'RabbitMQ', 'Git',
    'PyTorch', 'TensorFlow', 'OpenCV', 'Scikit-Learn', 'LLM', 'NLP', 'RAG',
    'Embedded C', 'RTOS', 'STM32', 'ESP32', 'ARM', 'FPGA', 'PCB',
    'Solidity', 'Web3', 'Cybersecurity', 'Penetration Testing', 'SIEM',
    'SQL', 'Data Pipelines', 'ETL', 'Snowflake', 'BigQuery', 'Airflow', 'Tailwind CSS'
]

CAT_FALLBACKS = {
    'ai': ['Machine Learning', 'Python', 'LLMs', 'Model Evaluation'],
    'ml': ['PyTorch', 'TensorFlow', 'Python', 'Scikit-Learn'],
    'deep_learning': ['Deep Neural Networks', 'PyTorch', 'TensorFlow'],
    'computer_vision': ['OpenCV', 'PyTorch', 'Computer Vision'],
    'backend': ['REST APIs', 'PostgreSQL', 'Microservices', 'Docker'],
    'full_stack': ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    'devops': ['Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
    'cloud': ['AWS', 'Cloud Architecture', 'Kubernetes', 'Terraform'],
    'data_engineering': ['Data Pipelines', 'SQL', 'ETL', 'PostgreSQL'],
    'cybersecurity': ['Network Security', 'Penetration Testing', 'SIEM'],
    'embedded': ['Embedded C', 'RTOS', 'Firmware', 'Hardware Debugging'],
    'iot': ['IoT Protocols', 'MQTT', 'Embedded Systems', 'Edge Computing'],
    'robotics': ['ROS', 'C++', 'Control Systems'],
    'government': ['Public Administration', 'Official Protocols', 'Civil Service'],
}

def estimate_salary(source: str, location: str, experience_level: str, is_remote: bool) -> tuple[int, int, str]:
    loc = (location or "").lower()
    is_bd = any(k in loc for k in ["bangladesh", "dhaka", "bd", "chittagong", "chattogram", "sylhet", "rajshahi", "khulna"]) or source == "BD Govt Jobs" or source == "Bdjobs"
    is_govt = source == "BD Govt Jobs"
    level = (experience_level or "mid").lower()

    if is_govt:
        # Bangladesh National Pay Scale (Grade 9-10 Assistant Engineer)
        return (22000, 53060, "৳")
    
    if is_bd and not is_remote:
        # Bangladesh Local Tech Market (Monthly BDT)
        if "lead" in level:
            return (150000, 260000, "৳")
        elif "senior" in level:
            return (90000, 160000, "৳")
        elif "entry" in level:
            return (30000, 48000, "৳")
        else:
            return (50000, 95000, "৳")
    else:
        # Global Remote / International (Annual USD)
        if "lead" in level:
            return (130000, 190000, "$")
        elif "senior" in level:
            return (95000, 150000, "$")
        elif "entry" in level:
            return (45000, 75000, "$")
        else:
            return (70000, 115000, "$")

def infer_experience_level(title: str, description: str = "") -> str:
    t = f"{title} {description}".lower()
    if any(k in t for k in ["lead", "architect", "principal", "head", "director", "vp", "staff"]):
        return "lead"
    if any(k in t for k in ["senior", "sr.", "sr ", "experienced", "5+ years", "6+ years", "7+ years"]):
        return "senior"
    if any(k in t for k in ["junior", "jr.", "jr ", "entry", "trainee", "intern", "fresh", "graduate"]):
        return "entry"
    return "mid"

def sanitize_and_extract_skills(raw_skills: list, title: str, description: str, requirements: str, categories: list) -> list[str]:
    seen = set()
    cleaned = []
    
    # 1. Clean raw skills
    for s in (raw_skills or []):
        if not s or not isinstance(s, str):
            continue
        trimmed = s.strip()
        norm = trimmed.lower()
        if len(trimmed) < 2 or norm in NON_SKILL_WORDS:
            continue
        if norm not in seen:
            seen.add(norm)
            cleaned.append(trimmed.title() if len(trimmed) > 3 else trimmed.upper())

    # 2. Extract technical skills from text if needed
    if len(cleaned) < 3:
        combined = f"{title} {description} {requirements}".lower()
        for kw in TECH_KEYWORDS:
            pattern = r'(?:\b|_)' + re.escape(kw.lower()) + r'(?:\b|_)'
            if re.search(pattern, combined):
                norm = kw.lower()
                if norm not in seen:
                    seen.add(norm)
                    cleaned.append(kw)
                    if len(cleaned) >= 5:
                        break

    # 3. Inject category fallbacks if still low
    if len(cleaned) < 2:
        for c in categories:
            cat_name = (c.get("category") if isinstance(c, dict) else str(c)).lower()
            if cat_name in CAT_FALLBACKS:
                for def_s in CAT_FALLBACKS[cat_name]:
                    norm = def_s.lower()
                    if norm not in seen:
                        seen.add(norm)
                        cleaned.append(def_s)
                        if len(cleaned) >= 4:
                            break
            if len(cleaned) >= 3:
                break

    return cleaned[:6]


@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks):
    """Trigger the background job scraper to fetch latest engineering jobs."""
    global _sync_running
    if _sync_running:
        return {"status": "in_progress", "message": "Job sync is already active in the background."}

    can_sync, remaining = sync_throttler.can_sync()
    if not can_sync:
        return {
            "status": "throttled",
            "message": f"Job sync was run recently. Please wait {remaining // 60}m {remaining % 60}s before syncing again to prevent rate-limiting."
        }

    sync_throttler.record_sync()

    async def _do_sync():
        global _sync_running
        _sync_running = True
        try:
            await sync_jobs()
            invalidated = memory_cache.invalidate(prefix="jobs:")
            logger.info("Job sync finished. Invalidated %d cached items", invalidated)
        except Exception as exc:
            logger.error("Background job sync failed: %s", exc)
        finally:
            _sync_running = False

    background_tasks.add_task(_do_sync)
    return {"status": "started", "message": "Job sync started in background. New jobs will appear shortly."}


@router.get("/sync/status")
def get_sync_status():
    global _sync_running
    return {"is_syncing": _sync_running}


@router.get("/sources")
def get_job_sources(response: Response):
    """Get all unique job sources with their active job counts."""
    cache_key = "jobs:sources"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=180, stale-while-revalidate=600"
        return cached

    res = db().table("jobs").select("source").eq("is_active", True).execute()
    from collections import Counter
    counts = Counter([r["source"] for r in (res.data or []) if r.get("source")])
    data = [{"source": k, "count": v} for k, v in counts.most_common()]
    memory_cache.set(cache_key, data, ttl_seconds=600)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=180, stale-while-revalidate=600"
    return data


@router.get("", response_model=JobListResponse)
def list_jobs(
    response: Response,
    keyword: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    source: Optional[str] = None,
    remote_only: bool = False,
    experience_level: Optional[str] = None,
    limit: int = Query(default=30, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    sort: str = Query(default="latest", pattern=r"^(latest|oldest)$"),
):
    """
    List jobs with optional filtering.
    Cached in RAM with TTL 180s for ultra-low latency (<2ms).
    """
    cache_key = f"jobs:list:{keyword or ''}:{location or ''}:{category or ''}:{source or ''}:{remote_only}:{experience_level or ''}:{limit}:{offset}:{sort}"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=180"
        return cached
    card_fields = (
        "id, title, company, location, is_remote, remote_type, "
        "experience_level, salary_min, salary_max, salary_currency, "
        "description, requirements, "
        "required_skills, apply_url, source, source_job_id, posted_date, "
        "is_active, fetched_at, created_at, job_categories(category, confidence)"
    )
    query = db().table("jobs").select(card_fields, count="exact")
    query = query.eq("is_active", True)

    if keyword:
        # Use PostgreSQL text search on title, company, description, and requirements
        query = query.or_(f"title.ilike.%{keyword}%,company.ilike.%{keyword}%,description.ilike.%{keyword}%,requirements.ilike.%{keyword}%")
    if location:
        loc_clean = location.lower().strip()
        if loc_clean in ("bangladesh", "bd", "dhaka"):
            query = query.or_(
                "location.ilike.%bangladesh%,"
                "location.ilike.%dhaka%,"
                "location.ilike.%chittagong%,"
                "location.ilike.%chattogram%,"
                "location.ilike.%sylhet%,"
                "location.ilike.%rajshahi%,"
                "location.ilike.%khulna%,"
                "location.ilike.%mymensingh%,"
                "location.ilike.%gazipur%"
            )
        else:
            query = query.ilike("location", f"%{location}%")
    if source:
        query = query.eq("source", source)
    if remote_only:
        query = query.eq("is_remote", True)

    # Sorting
    if sort == "oldest":
        query = query.order("fetched_at", desc=False)
    else:
        query = query.order("fetched_at", desc=True)

    # Pagination
    query = query.range(offset, offset + limit - 1)

    result = query.execute()

    # If category filter is set, filter in Python (join-based filtering)
    items = result.data or []
    if category:
        items = [
            job for job in items
            if any(c.get("category") == category for c in (job.get("job_categories") or []))
        ]

    # Deduplicate by apply_url, keeping the most recently fetched entry
    seen_urls: dict[str, dict] = {}
    for job in items:
        url = job.get("apply_url", "")
        if url not in seen_urls or (job.get("fetched_at") or "") > (seen_urls[url].get("fetched_at") or ""):
            seen_urls[url] = job

    items = list(seen_urls.values())

    # Map categories and enrich skills + experience level
    enriched_items = []
    for item in items:
        cats = item.pop("job_categories", []) or []
        item["categories"] = cats

        # Infer experience level if not set
        if not item.get("experience_level"):
            item["experience_level"] = infer_experience_level(
                item.get("title", ""),
                item.get("description", "") or ""
            ).capitalize()

        # Populate salary estimation if missing
        if not item.get("salary_min"):
            s_min, s_max, s_curr = estimate_salary(
                item.get("source", ""),
                item.get("location", "") or "",
                item.get("experience_level", "") or "",
                bool(item.get("is_remote"))
            )
            item["salary_min"] = s_min
            item["salary_max"] = s_max
            item["salary_currency"] = s_curr

        # Sanitize required_skills
        raw_skills = item.get("required_skills") or []
        title = item.get("title", "")
        desc = item.get("description", "") or ""
        reqs = item.get("requirements", "") or ""
        item["required_skills"] = sanitize_and_extract_skills(raw_skills, title, desc, reqs, cats)

        # Filter by experience level if requested
        if experience_level:
            target_exp = experience_level.lower().strip()
            item_exp = (item.get("experience_level") or "").lower().strip()
            if target_exp not in item_exp and item_exp not in target_exp:
                continue

        enriched_items.append(item)

    items = enriched_items
    result_data = {
        "items": items,
        "total": len(items),
        "limit": limit,
        "offset": offset,
    }
    memory_cache.set(cache_key, result_data, ttl_seconds=180)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=180"
    return result_data


@router.get("/categories")
def get_categories(response: Response):
    """Get all available job categories with counts."""
    cache_key = "jobs:categories"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
        return cached

    result = db().table("job_categories").select("category").execute()
    categories = {}
    for row in (result.data or []):
        cat = row.get("category", "")
        categories[cat] = categories.get(cat, 0) + 1
    data = {
        "categories": [
            {"name": k, "count": v, "display_name": k.replace("_", " ").title()}
            for k, v in sorted(categories.items(), key=lambda x: x[1], reverse=True)
        ]
    }
    memory_cache.set(cache_key, data, ttl_seconds=600)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return data


# Duplicate get_sources replaced by cached get_job_sources above


@router.get("/{job_id}")
def get_job(job_id: str, response: Response):
    """Get a single job by ID."""
    cache_key = f"jobs:detail:{job_id}"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
        return cached

    result = (
        db()
        .table("jobs")
        .select("*, job_categories(category, confidence)")
        .eq("id", job_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data
    cats = job.pop("job_categories", []) or []
    job["categories"] = cats
    if not job.get("experience_level"):
        job["experience_level"] = infer_experience_level(
            job.get("title", ""),
            job.get("description", "") or ""
        ).capitalize()
    if not job.get("salary_min"):
        s_min, s_max, s_curr = estimate_salary(
            job.get("source", ""),
            job.get("location", "") or "",
            job.get("experience_level", "") or "",
            bool(job.get("is_remote"))
        )
        job["salary_min"] = s_min
        job["salary_max"] = s_max
        job["salary_currency"] = s_curr
    raw_skills = job.get("required_skills") or []
    job["required_skills"] = sanitize_and_extract_skills(
        raw_skills, job.get("title", ""), job.get("description", "") or "", job.get("requirements", "") or "", cats
    )
    memory_cache.set(cache_key, job, ttl_seconds=600)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return job


def _get_user_candidate_context(user_id: str):
    """Fetch user profile, skills, projects, and education for AI matching."""
    profile = db().table("profiles").select("*").eq("id", user_id).single().execute()
    skills = db().table("user_skills").select("skill_name").eq("user_id", user_id).execute()
    projects = db().table("user_projects").select("technologies").eq("user_id", user_id).execute()
    education = db().table("user_education").select("field_of_study, degree").eq("user_id", user_id).execute()

    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found. Complete your profile first.")

    parsed = profile.data.get("resume_parsed_data") or {}

    skill_list = skills.data or []
    if not skill_list and parsed.get("skills"):
        raw_skills = parsed.get("skills")
        if isinstance(raw_skills, list) and len(raw_skills) > 0 and isinstance(raw_skills[0], str):
            skill_list = [{"skill_name": s} for s in raw_skills]
        elif isinstance(raw_skills, list) and len(raw_skills) > 0 and isinstance(raw_skills[0], dict):
            skill_list = [{"skill_name": s.get("skill_name", str(s))} for s in raw_skills]

    project_list = projects.data or []
    if not project_list and (parsed.get("experience") or parsed.get("projects")):
        project_list = []
        for exp in (parsed.get("experience") or []):
            techs = exp.get("technologies") or []
            desc = exp.get("description") or ""
            project_list.append({"technologies": techs, "description": desc, "title": exp.get("title", "")})
        for proj in (parsed.get("projects") or []):
            techs = proj.get("technologies") or []
            desc = proj.get("description") or ""
            project_list.append({"technologies": techs, "description": desc, "title": proj.get("title", "")})

    edu_list = education.data or []
    if not edu_list and parsed.get("education"):
        edu_list = parsed["education"]

    return profile.data, skill_list, project_list, edu_list


async def _perform_job_match(job_id: str, user_id: str) -> dict:
    """Core logic to match a job against a candidate profile."""
    # Fetch job
    job_result = (
        db()
        .table("jobs")
        .select("*, job_categories(category, confidence)")
        .eq("id", job_id)
        .single()
        .execute()
    )
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    job = job_result.data
    job["categories"] = job.pop("job_categories", []) or []

    profile_data, skill_list, project_list, edu_list = _get_user_candidate_context(user_id)

    # Calculate match scores via True AI
    from app.ai.matcher import generate_match_score
    ai_match = await generate_match_score(
        job=job,
        profile=profile_data,
        skills=skill_list,
        projects=project_list,
        education=edu_list,
    )

    if ai_match:
        return {
            "job": job,
            "match": ai_match,
            "overall_score": ai_match.get("overall_score", 0),
            "skill_match": ai_match.get("skill_match", 0),
            "project_match": ai_match.get("project_match", 0),
            "education_match": ai_match.get("education_match", 0),
            "location_match": ai_match.get("location_match", 0),
            "matching_skills": ai_match.get("matching_skills", []),
            "missing_skills": ai_match.get("missing_skills", []),
            "explanation": ai_match.get("explanation", []),
        }

    # FALLBACK to heuristic if AI fails
    user_skills = {s.get("skill_name", "").lower() for s in skill_list if s.get("skill_name")}
    job_skills = {s.lower() for s in (job.get("required_skills") or []) if s}

    if user_skills or job_skills:
        intersection = user_skills & job_skills
        union = user_skills | job_skills
        skill_score = int((len(intersection) / len(union)) * 100) if union else 0
    else:
        skill_score = 50

    user_tech = set()
    for p in project_list:
        user_tech.update(t.lower() for t in (p.get("technologies") or []))
    if user_tech and job_skills:
        tech_overlap = user_tech & job_skills
        project_score = int((len(tech_overlap) / max(len(job_skills), 1)) * 100)
    else:
        project_score = 40

    education_score = 50
    job_desc = (job.get("description") or "").lower()
    for edu in edu_list:
        field = (edu.get("field_of_study") or "").lower()
        if field and any(word in job_desc for word in field.split()):
            education_score = 80
            break

    location_score = 50
    preferred_locations = [loc.lower() for loc in (profile_data.get("preferred_locations") or [])]
    job_location = (job.get("location") or "").lower()
    if job.get("is_remote"):
        location_score = 90
    elif any(loc in job_location for loc in preferred_locations):
        location_score = 100
    elif profile_data.get("country", "").lower() in job_location:
        location_score = 70

    overall = int(skill_score * 0.40 + project_score * 0.25 + education_score * 0.15 + location_score * 0.20)

    matched_skills = sorted(list(user_skills & job_skills))
    missing_skills = sorted(list(job_skills - user_skills))

    explanation = []
    if matched_skills:
        matched_str = ", ".join(matched_skills[:5])
        explanation.append(f"{skill_score}% skill overlap: {matched_str}")
    else:
        explanation.append(f"{skill_score}% skill match (add more skills to improve)")
    explanation.append(f"{project_score}% project relevance")
    if job.get("is_remote"):
        explanation.append("Remote position matches your preferences")
    elif location_score >= 70:
        explanation.append(f"Location '{job.get('location')}' matches your preferences")

    heuristic_match = {
        "overall_score": min(overall, 100),
        "skill_match": skill_score,
        "project_match": project_score,
        "education_match": education_score,
        "location_match": location_score,
        "matching_skills": matched_skills,
        "missing_skills": missing_skills,
        "explanation": explanation,
    }

    return {
        "job": job,
        "match": heuristic_match,
        "overall_score": heuristic_match["overall_score"],
        "skill_match": heuristic_match["skill_match"],
        "project_match": heuristic_match["project_match"],
        "education_match": heuristic_match["education_match"],
        "location_match": heuristic_match["location_match"],
        "matching_skills": matched_skills,
        "missing_skills": missing_skills,
        "explanation": explanation,
    }


@router.post("/{job_id}/match", response_model=MatchResponse)
async def match_job_by_path(job_id: str, user: CurrentUser):
    """Calculate match score using job_id path parameter."""
    return await _perform_job_match(job_id, user.user_id)


@router.post("/match", response_model=MatchResponse)
async def match_job(
    user: CurrentUser,
    data: Optional[MatchRequest] = None,
    job_id: Optional[str] = Query(default=None),
):
    """
    Calculate match score between the current user's profile and a job.
    Accepts job_id in body { job_id: "..." } or query parameter ?job_id=...
    """
    target_id = (data.job_id if data else None) or job_id
    if not target_id:
        raise HTTPException(status_code=400, detail="job_id is required either in request body or query parameter")
    return await _perform_job_match(target_id, user.user_id)



@router.post("/analyze", response_model=CustomJobAnalyzeResponse)
async def analyze_custom_job(data: CustomJobAnalyzeRequest, user: CurrentUser):
    """
    Analyze any external job description (e.g. pasted from LinkedIn or BDjobs)
    against the candidate's profile to extract match scores, missing skills, and insights.
    """
    profile_data, skill_list, project_list, edu_list = _get_user_candidate_context(user.user_id)

    custom_job = {
        "title": data.title,
        "company": data.company or "Unknown",
        "description": data.description,
        "location": data.location or "Remote",
        "is_remote": "remote" in (data.location or "").lower() or True,
        "required_skills": [],
    }

    from app.ai.matcher import generate_match_score
    ai_match = await generate_match_score(
        job=custom_job,
        profile=profile_data,
        skills=skill_list,
        projects=project_list,
        education=edu_list,
    )

    job_id = None
    saved_job_id = None

    if data.save_to_jobs:
        try:
            import uuid
            new_id = str(uuid.uuid4())
            custom_apply_url = data.apply_url or f"https://custom-job.local/{new_id}"

            insert_data = {
                "id": new_id,
                "title": data.title,
                "company": data.company or "External Opportunity",
                "location": data.location or "Remote",
                "is_remote": "remote" in (data.location or "").lower() or True,
                "description": data.description,
                "apply_url": custom_apply_url,
                "source": "Custom",
                "is_active": True,
            }
            res = db().table("jobs").upsert(insert_data, on_conflict="apply_url").execute()
            if res.data:
                job_id = res.data[0]["id"]
                save_res = db().table("saved_jobs").upsert({
                    "user_id": user.user_id,
                    "job_id": job_id
                }).execute()
                if save_res.data:
                    saved_job_id = save_res.data[0]["id"]
        except Exception as e:
            logger.warning(f"Could not save custom job to database: {e}")

    return CustomJobAnalyzeResponse(
        title=data.title,
        company=data.company or "External Opportunity",
        location=data.location,
        match=MatchScore(**ai_match),
        job_id=job_id,
        saved_job_id=saved_job_id,
    )


@router.get("/recommendations/for-me")
def get_recommendations(user: CurrentUser, limit: int = Query(default=10, ge=1, le=50)):
    """
    Get job recommendations for the current user.
    Returns jobs sorted by match score.
    """
    # Fetch user profile and skills
    profile = db().table("profiles").select("*").eq("id", user.user_id).single().execute()
    skills = db().table("user_skills").select("skill_name").eq("user_id", user.user_id).execute()
    
    parsed = profile.data.get("resume_parsed_data") or {}
    skill_list = skills.data or []
    if not skill_list and parsed.get("skills"):
        raw_skills = parsed.get("skills")
        if isinstance(raw_skills, list) and len(raw_skills) > 0 and isinstance(raw_skills[0], str):
            skill_list = [{"skill_name": s} for s in raw_skills]
        elif isinstance(raw_skills, list) and len(raw_skills) > 0 and isinstance(raw_skills[0], dict):
            skill_list = [{"skill_name": s.get("skill_name", str(s))} for s in raw_skills]

    user_skills = [s.get("skill_name", "").lower() for s in skill_list]

    if not user_skills:
        # Fallback: return latest jobs
        result = (
            db()
            .table("jobs")
            .select("*, job_categories(category, confidence)")
            .eq("is_active", True)
            .order("fetched_at", desc=True)
            .limit(limit)
            .execute()
        )
        items = result.data or []
        for item in items:
            item["categories"] = item.pop("job_categories", []) or []
            item["match_score"] = None
        return {"items": items, "message": "Add skills to your profile for personalized recommendations"}

    # Fetch jobs that have overlapping skills
    # Use contains filter for array overlap
    result = (
        db()
        .table("jobs")
        .select("*, job_categories(category, confidence)")
        .eq("is_active", True)
        .order("fetched_at", desc=True)
        .limit(200)  # Fetch more, then rank
        .execute()
    )

    items = result.data or []
    scored = []
    for item in items:
        item["categories"] = item.pop("job_categories", []) or []
        job_skills = {s.lower() for s in (item.get("required_skills") or [])}
        if job_skills:
            overlap = len(set(user_skills) & job_skills)
            score = int((overlap / len(job_skills)) * 100)
        else:
            score = 30  # Low default for jobs with no listed skills
        item["match_score"] = score
        scored.append(item)

    # Sort by match score descending
    scored.sort(key=lambda x: x.get("match_score", 0), reverse=True)

    return {"items": scored[:limit]}

"""
Shomvob (সম্ভব) — Resume Router.

Endpoints for resume upload, parsing, and ATS-optimized generation.
"""

from __future__ import annotations

import io
import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Response

from app.dependencies import CurrentUser
from app.models.application import (
    ResumeGenerateRequest,
    ResumeGenerateResponse,
    ResumeParseResponse,
    BulletEnhanceRequest,
    BulletEnhanceResponse,
)
from app.services.resume_parser import parse_resume_file
from app.utils.resume_pdf import generate_ats_resume_pdf, ResumeContext

from app.utils.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/resume", tags=["resume"])

db = get_supabase_admin

from datetime import datetime, timezone
from pydantic import BaseModel

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_RESUMES_ALLOWED = 5


class SelectActiveResumeRequest(BaseModel):
    resume_id: str


def _extract_resumes_from_profile(profile: dict) -> tuple[list[dict], Optional[str]]:
    raw_parsed = profile.get("resume_parsed_data") or {}
    file_path = profile.get("resume_file_path")

    resumes_list = []
    active_id = None

    if isinstance(raw_parsed, dict) and "_resumes_list" in raw_parsed:
        resumes_list = list(raw_parsed.get("_resumes_list") or [])
        active_id = raw_parsed.get("_active_resume_id")
    elif file_path or raw_parsed:
        base_name = file_path.split("/")[-1] if file_path else "master_resume.pdf"
        item_id = "resume-1"
        resumes_list = [{
            "id": item_id,
            "name": "Primary Resume",
            "file_name": base_name,
            "file_path": file_path,
            "uploaded_at": profile.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "parsed": raw_parsed if isinstance(raw_parsed, dict) else {},
        }]
        active_id = item_id

    return resumes_list, active_id


@router.post("/upload")
async def upload_resume(
    user: CurrentUser,
    file: UploadFile = File(...),
    label: Optional[str] = Form(None),
):
    """
    Upload a resume file (PDF or DOCX).
    Supports up to 5 resumes per user with active resume switching.
    """
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    is_pdf = filename.endswith(".pdf") or "pdf" in content_type
    is_docx = filename.endswith(".docx") or "word" in content_type or "officedocument" in content_type

    if not (is_pdf or is_docx):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are accepted (.pdf, .docx)",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    file_ext = "pdf" if is_pdf else "docx"

    # Fetch current profile to check resume count
    res = db().table("profiles").select(
        "id, resume_file_path, resume_parsed_data, updated_at"
    ).eq("id", user.user_id).single().execute()
    profile = res.data or {}
    resumes_list, _ = _extract_resumes_from_profile(profile)

    if len(resumes_list) >= MAX_RESUMES_ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_RESUMES_ALLOWED} resumes allowed. Please remove an existing resume before uploading a new one.",
        )

    new_id = str(uuid.uuid4())
    storage_path = f"{user.user_id}/resumes/{new_id}.{file_ext}"

    try:
        client = db()
        client.storage.from_("resumes").upload(
            storage_path,
            content,
            file_options={"content-type": file.content_type},
        )
    except Exception as exc:
        logger.error("Storage upload failed: %s", exc)

    # Parse the resume
    try:
        parsed = await parse_resume_file(content, file_ext)
        parsed_dict = parsed.model_dump() if parsed else {}
    except Exception as exc:
        logger.warning("Resume parsing failed: %s", exc)
        parsed = None
        parsed_dict = {}

    # Deactivate existing resumes, set new one as active
    for r in resumes_list:
        r["is_active"] = False

    clean_label = (label or file.filename or f"Resume {len(resumes_list) + 1}").rsplit(".", 1)[0][:45]

    new_item = {
        "id": new_id,
        "name": clean_label,
        "file_name": file.filename or f"resume.{file_ext}",
        "file_path": storage_path,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "parsed": parsed_dict,
    }
    resumes_list.append(new_item)

    updated_parsed_data = {
        **parsed_dict,
        "_resumes_list": resumes_list,
        "_active_resume_id": new_id,
    }

    db().table("profiles").update({
        "resume_file_path": storage_path,
        "resume_parsed_data": updated_parsed_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user.user_id).execute()

    # Sync parsed skills to user_skills
    if parsed and parsed.skills:
        for skill_name in parsed.skills[:30]:
            try:
                db().table("user_skills").upsert({
                    "user_id": user.user_id,
                    "skill_name": skill_name.strip()
                }, on_conflict="user_id,skill_name").execute()
            except Exception:
                pass

    return {
        "message": "Resume uploaded successfully",
        "resume_id": new_id,
        "file_path": storage_path,
        "parsed": parsed_dict,
        "resumes_count": len(resumes_list),
    }


@router.post("/select-active")
def select_active_resume(req: SelectActiveResumeRequest, user: CurrentUser):
    """Switch user's active resume among the up to 5 uploaded resumes."""
    res = db().table("profiles").select(
        "id, resume_file_path, resume_parsed_data, updated_at"
    ).eq("id", user.user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = res.data
    resumes_list, _ = _extract_resumes_from_profile(profile)

    target = None
    for r in resumes_list:
        if r.get("id") == req.resume_id:
            r["is_active"] = True
            target = r
        else:
            r["is_active"] = False

    if not target:
        raise HTTPException(status_code=404, detail="Resume not found")

    target_parsed = target.get("parsed") or {}
    updated_parsed_data = {
        **target_parsed,
        "_resumes_list": resumes_list,
        "_active_resume_id": target["id"],
    }

    db().table("profiles").update({
        "resume_file_path": target.get("file_path"),
        "resume_parsed_data": updated_parsed_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user.user_id).execute()

    # Auto sync skills of the newly selected active resume
    if target_parsed.get("skills"):
        for skill_name in target_parsed["skills"][:30]:
            try:
                db().table("user_skills").upsert({
                    "user_id": user.user_id,
                    "skill_name": skill_name.strip()
                }, on_conflict="user_id,skill_name").execute()
            except Exception:
                pass

    return {
        "message": f"Switched active resume to '{target.get('name')}'",
        "active_resume_id": target["id"],
    }


@router.delete("/{resume_id}")
def delete_resume(resume_id: str, user: CurrentUser):
    """Delete an uploaded resume. If active, switches to next available resume."""
    res = db().table("profiles").select(
        "id, resume_file_path, resume_parsed_data, updated_at"
    ).eq("id", user.user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = res.data
    resumes_list, _ = _extract_resumes_from_profile(profile)

    target = next((r for r in resumes_list if r.get("id") == resume_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Resume not found")

    resumes_list = [r for r in resumes_list if r.get("id") != resume_id]

    if target.get("file_path"):
        try:
            db().storage.from_("resumes").remove([target["file_path"]])
        except Exception:
            pass

    new_active = None
    if resumes_list:
        new_active = next((r for r in resumes_list if r.get("is_active")), resumes_list[0])
        new_active["is_active"] = True
        for r in resumes_list:
            if r != new_active:
                r["is_active"] = False

    new_parsed = new_active.get("parsed") if new_active else {}
    updated_parsed_data = {
        **new_parsed,
        "_resumes_list": resumes_list,
        "_active_resume_id": new_active.get("id") if new_active else None,
    } if resumes_list else None

    db().table("profiles").update({
        "resume_file_path": new_active.get("file_path") if new_active else None,
        "resume_parsed_data": updated_parsed_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user.user_id).execute()

    return {"message": "Resume deleted successfully"}


@router.get("/current")
def get_current_resume(user: CurrentUser):
    """Fetch current user's uploaded master resumes list and active parsed content."""
    res = db().table("profiles").select("*").eq("id", user.user_id).single().execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = res.data
    resumes_list, active_id = _extract_resumes_from_profile(profile)

    resumes_response = []
    active_resume = None

    for r in resumes_list:
        dl_url = None
        if r.get("file_path"):
            try:
                signed = db().storage.from_("resumes").create_signed_url(r["file_path"], 3600)
                dl_url = signed.get("signedURL")
            except Exception:
                pass
        
        is_act = bool(r.get("is_active")) or (r.get("id") == active_id)
        if is_act and not active_resume:
            active_resume = r

        resumes_response.append({
            "id": r.get("id"),
            "name": r.get("name") or "Resume",
            "file_name": r.get("file_name") or "resume.pdf",
            "file_path": r.get("file_path"),
            "download_url": dl_url,
            "uploaded_at": r.get("uploaded_at"),
            "is_active": is_act,
            "skills_count": len(r.get("parsed", {}).get("skills", [])),
            "roles_count": len(r.get("parsed", {}).get("experience", [])),
            "projects_count": len(r.get("parsed", {}).get("projects", [])),
        })

    # Fallback active resume
    if not active_resume and resumes_list:
        active_resume = resumes_list[0]

    active_parsed = active_resume.get("parsed") if active_resume else (
        profile.get("resume_parsed_data") if isinstance(profile.get("resume_parsed_data"), dict) and "_resumes_list" not in profile.get("resume_parsed_data") else None
    )
    active_file = active_resume.get("file_path") if active_resume else profile.get("resume_file_path")
    active_dl_url = next((item["download_url"] for item in resumes_response if item["id"] == (active_resume.get("id") if active_resume else None)), None)

    return {
        "has_resume": bool(len(resumes_response) > 0 or active_file or active_parsed),
        "active_resume_id": active_resume.get("id") if active_resume else None,
        "resumes": resumes_response,
        "file_path": active_file,
        "download_url": active_dl_url,
        "parsed": active_parsed,
        "profile": {
            "name": profile.get("full_name"),
            "email": profile.get("email"),
            "phone": profile.get("phone"),
            "location": f"{profile.get('city') or ''}, {profile.get('country') or ''}".strip(", "),
            "linkedin": profile.get("linkedin_url"),
            "github": profile.get("github_url"),
            "portfolio": profile.get("portfolio_url"),
            "preferred_categories": profile.get("preferred_categories") or [],
            "preferred_locations": profile.get("preferred_locations") or [],
            "expected_salary_min": profile.get("expected_salary_min"),
            "expected_salary_max": profile.get("expected_salary_max"),
            "salary_currency": profile.get("salary_currency") or "BDT",
            "employment_type": profile.get("employment_type") or [],
        },
        "updated_at": profile.get("updated_at"),
    }


@router.post("/enhance-bullet", response_model=BulletEnhanceResponse)
async def enhance_bullet_point(data: BulletEnhanceRequest, user: CurrentUser):
    """
    Transform a rough resume bullet point into the high-impact Google XYZ formula:
    'Accomplished [X], as measured by [Y], by doing [Z]'.
    """
    raw_bullet = data.bullet_point.strip()
    if not raw_bullet:
        raise HTTPException(status_code=400, detail="Bullet point cannot be empty")

    prompt = f"""
    You are an elite Silicon Valley Tech Recruiter and Resume Coach.
    A software engineer provided this rough bullet point from their resume:
    "{raw_bullet}"

    Target Role: {data.target_role or "Software Engineer"}
    Target Skills to Highlight: {', '.join(data.target_skills) if data.target_skills else "General engineering best practices"}

    Transform this bullet point using the Google XYZ Formula:
    "Accomplished [X] as measured by [Y], by doing [Z]"

    Guidelines:
    1. Start with a strong action verb (Architected, Engineered, Optimized, Spearheaded, Implemented).
    2. Include realistic engineering metrics (e.g. latency reduced by 35%, throughput increased to 10k RPS, test coverage improved by 40%, cut cloud costs by $2k/mo).
    3. State the technical implementation details (tools, libraries, patterns).
    4. Provide 1 primary recommendation and 2 diverse alternatives.

    Return ONLY a valid JSON object matching this schema:
    {{
      "original_bullet": "{raw_bullet}",
      "optimized_bullet": "<string: best Google XYZ bullet point>",
      "impact_explanation": "<string: 1-2 sentences on why this improves ATS score and catches hiring managers' attention>",
      "alternatives": [
        "<string: alternative option 1>",
        "<string: alternative option 2>"
      ]
    }}
    """

    system_prompt = "You are a professional resume optimization assistant. Return strict JSON only without markdown code fences."

    try:
        from app.ai.manager import get_ai_manager
        manager = get_ai_manager()
        resp = await manager.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            preferred_provider="gemini",
        )
        content = resp.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        parsed_json = json.loads(content.strip())
        return BulletEnhanceResponse(
            original_bullet=raw_bullet,
            optimized_bullet=parsed_json.get("optimized_bullet", raw_bullet),
            impact_explanation=parsed_json.get("impact_explanation", "Rewritten with strong metrics and actionable verbs."),
            alternatives=parsed_json.get("alternatives", []),
        )
    except Exception as exc:
        logger.error("AI bullet enhancement failed: %s", exc)
        action_verb = "Architected and delivered"
        fallback_bullet = f"{action_verb} {raw_bullet.lower().rstrip('.')}, improving operational efficiency and system reliability by 25%."
        return BulletEnhanceResponse(
            original_bullet=raw_bullet,
            optimized_bullet=fallback_bullet,
            impact_explanation="Reframed with active verbs and quantifiable outcome metrics.",
            alternatives=[
                f"Optimized {raw_bullet.lower().rstrip('.')}, cutting latency and resource overhead by 30%.",
                f"Spearheaded implementation of {raw_bullet.lower().rstrip('.')}, accelerating feature delivery cycle by 2 weeks."
            ],
        )


@router.post("/parse", response_model=ResumeParseResponse)
async def parse_resume(file: UploadFile = File(...), user: CurrentUser = None):
    """
    Parse a resume file and return structured data without storing.
    """
    if file.content_type not in ("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    file_ext = "pdf" if "pdf" in file.content_type else "docx"

    try:
        return await parse_resume_file(content, file_ext)
    except Exception as exc:
        logger.error("Resume parsing failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {exc}")


@router.get("/templates")
def get_templates(response: Response):
    """List available resume templates with client caching."""
    response.headers["Cache-Control"] = "public, max-age=3600"
    from app.utils.resume_pdf import list_templates as templates_fn
    return {"templates": templates_fn()}


@router.post("/generate", response_model=ResumeGenerateResponse)
def generate_resume(data: ResumeGenerateRequest, user: CurrentUser):
    """
    Generate an ATS-optimized resume as PDF.

    Uses the user's profile data + a specific job description
    to create a tailored resume.
    """
    # Fetch user profile
    profile = db().table("profiles").select("*").eq("id", user.user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Fetch user data
    skills = db().table("user_skills").select("*").eq("user_id", user.user_id).execute()
    education = db().table("user_education").select("*").eq("user_id", user.user_id).order("start_date", desc=True).execute()
    experience = db().table("user_experience").select("*").eq("user_id", user.user_id).order("start_date", desc=True).execute()
    projects = db().table("user_projects").select("*").eq("user_id", user.user_id).order("created_at", desc=True).execute()
    certifications = db().table("user_certifications").select("*").eq("user_id", user.user_id).execute()

    # Fetch job if specified
    job_data = None
    if data.job_id:
        job_result = db().table("jobs").select("*").eq("id", data.job_id).single().execute()
        job_data = job_result.data

    # Build resume context (handle NULL DB values gracefully)
    ctx = ResumeContext(
        name=profile.data.get("full_name") or "",
        email=profile.data.get("email") or "",
        phone=profile.data.get("phone") or "",
        location=f"{profile.data.get('city') or ''}, {profile.data.get('country') or ''}".strip(", "),
        linkedin=profile.data.get("linkedin_url") or "",
        github=profile.data.get("github_url") or "",
        portfolio=profile.data.get("portfolio_url") or "",
        skills=[s.get("skill_name", "") for s in (skills.data or [])],
        experience=[
            {
                "title": e.get("title") or "",
                "company": e.get("company") or "",
                "location": e.get("location") or "",
                "description": e.get("description") or "",
                "technologies": e.get("technologies") or [],
                "dates": f"{e.get('start_date', '') or ''} - {e.get('end_date', '') or 'Present'}",
            }
            for e in (experience.data or [])
        ],
        projects=[
            {
                "title": p.get("title") or "",
                "description": p.get("description") or "",
                "technologies": p.get("technologies") or [],
            }
            for p in (projects.data or [])
        ],
        education=[
            {
                "institution": e.get("institution") or "",
                "degree": e.get("degree") or "",
                "field_of_study": e.get("field_of_study") or "",
                "start_date": str(e.get("start_date")) if e.get("start_date") else "",
                "end_date": str(e.get("end_date")) if e.get("end_date") else "",
            }
            for e in (education.data or [])
        ],
        certifications=[
            {
                "name": c.get("name") or "",
                "issuing_organization": c.get("issuing_organization") or "",
                "issue_date": str(c.get("issue_date")) if c.get("issue_date") else "",
            }
            for c in (certifications.data or [])
        ],
        title=job_data.get("title", "") if job_data else (data.custom_job_description or "")[:60],
    )

    # Generate PDF using FPDF2
    try:
        pdf_bytes = generate_ats_resume_pdf(ctx, template=data.template_name)
    except Exception as exc:
        logger.error("PDF generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    pdf_url = None
    if pdf_bytes:
        pdf_filename = f"{user.user_id}/generated/{uuid.uuid4().hex[:8]}.pdf"
        try:
            db().storage.from_("generated-pdfs").upload(
                pdf_filename,
                pdf_bytes,
                file_options={"content-type": "application/pdf"},
            )
            pdf_url = pdf_filename
        except Exception as exc:
            logger.warning("PDF upload failed: %s", exc)

    # Store record
    record = {
        "user_id": user.user_id,
        "job_id": data.job_id,
        "template_name": data.template_name,
        "resume_data": ctx.__dict__,
        "pdf_file_path": pdf_url,
    }

    result = db().table("generated_resumes").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save generated resume")

    row = result.data[0]
    return {
        "id": row["id"],
        "template_name": row["template_name"],
        "match_score": row.get("match_score"),
        "optimization_notes": row.get("optimization_notes"),
        "pdf_url": pdf_url,
        "tex_content": None,
        "created_at": row["created_at"],
    }


@router.get("/generated")
def list_generated(user: CurrentUser):
    """List all generated resumes for the current user."""
    result = (
        db()
        .table("generated_resumes")
        .select("id, template_name, match_score, pdf_file_path, created_at")
        .eq("user_id", user.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": result.data or []}


@router.get("/generated/{resume_id}/download")
def download_resume(resume_id: str, user: CurrentUser):
    """Get download URL for a generated resume PDF."""
    result = (
        db()
        .table("generated_resumes")
        .select("pdf_file_path, tex_content")
        .eq("id", resume_id)
        .eq("user_id", user.user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    pdf_path = result.data.get("pdf_file_path")
    if not pdf_path:
        # Return .tex content if PDF was not generated
        return {
            "type": "tex",
            "content": result.data.get("tex_content", ""),
        }

    # Generate signed URL
    try:
        url = db().storage.from_("generated-pdfs").create_signed_url(pdf_path, 3600)
        return {"type": "pdf", "url": url.get("signedURL", "")}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {exc}")

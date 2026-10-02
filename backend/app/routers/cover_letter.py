"""
Shomvob (সম্ভব) — Cover Letter Router.

Endpoints for AI-powered cover letter generation.
"""

from __future__ import annotations

import logging
import hashlib
import re
from app.services.cache_service import memory_cache

from fastapi import APIRouter, HTTPException

from app.dependencies import CurrentUser
from app.models.application import CoverLetterGenerateRequest, CoverLetterResponse, CoverLetterPdfRequest
from fastapi.responses import Response
from datetime import datetime
from app.services.ai_client import generate_cover_letter_text
from app.utils.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cover-letter", tags=["cover-letter"])

db = get_supabase_admin


@router.post("/generate", response_model=CoverLetterResponse)
def generate_cover_letter(data: CoverLetterGenerateRequest, user: CurrentUser):
    """
    Generate a tailored cover letter using the user profile & CV dossier
    with dual-provider AI (Groq + Gemini failover) and deep context synthesis.
    """
    # Fetch user profile
    profile = db().table("profiles").select("*").eq("id", user.user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    pdata = profile.data or {}
    parsed_resume = pdata.get("resume_parsed_data") if isinstance(pdata.get("resume_parsed_data"), dict) else {}
    raw_cv_text = parsed_resume.get("raw_text", "")

    # Helper regex for fallback contact extraction from CV
    def _extract(pattern: str, text: str) -> str:
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else ""

    # Prioritize authentic CV email and contact details
    cv_email = _extract(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", raw_cv_text)
    email = cv_email or pdata.get("email") or user.email or ""
    phone = _extract(r"(\+?\d{1,4}[\s-]?(?:\(?\d{1,4}\)?)?[\s-]?\d{3,4}[\s-]?\d{3,4})", raw_cv_text) or pdata.get("phone")
    city = pdata.get("city") or "Dhaka"
    country = pdata.get("country") or "Bangladesh"
    location = f"{city}, {country}" if city else country
    linkedin = pdata.get("linkedin_url") or _extract(r"(linkedin\.com/in/[a-zA-Z0-9_-]+)", raw_cv_text)
    github = pdata.get("github_url") or _extract(r"(github\.com/[a-zA-Z0-9_-]+)", raw_cv_text)

    # Fetch user data for personalization
    skills = db().table("user_skills").select("skill_name").eq("user_id", user.user_id).execute()
    experience = db().table("user_experience").select("company, title, description").eq("user_id", user.user_id).limit(4).execute()
    projects = db().table("user_projects").select("title, description, technologies").eq("user_id", user.user_id).limit(4).execute()

    # Fetch job details if job_id provided
    job_title = data.job_title or ""
    company_name = data.company_name or ""
    job_description = data.job_description or ""

    if data.job_id:
        job_result = db().table("jobs").select("*").eq("id", data.job_id).single().execute()
        if job_result.data:
            job_title = job_result.data.get("title", job_title)
            company_name = job_result.data.get("company", company_name)
            job_description = job_result.data.get("description", job_description)

    if not job_title and not company_name:
        raise HTTPException(
            status_code=400,
            detail="Either job_id or (job_title + company_name) must be provided",
        )

    # Candidate Name
    cand_name = (pdata.get("full_name") or "").strip()
    if not cand_name or cand_name.lower() == "none":
        cand_name = (user.email or "Applicant").split("@")[0].replace(".", " ").replace("_", " ").title()

    # Comprehensive candidate dossier synthesized directly from authentic profile + CV
    user_context = {
        "name": cand_name,
        "email": email,
        "phone": phone,
        "location": location,
        "linkedin_url": linkedin,
        "github_url": github,
        "skills": [s["skill_name"] for s in (skills.data or [])] or parsed_resume.get("skills", []),
        "experience": experience.data or parsed_resume.get("experience", []),
        "projects": projects.data or parsed_resume.get("projects", []),
        "education": parsed_resume.get("education", []),
        "resume_text": raw_cv_text,
    }

    # Check cache for identical generation query to save AI API quotas
    cache_str = f"{user.user_id}:{job_title}:{company_name}:{job_description[:300]}:{getattr(data, 'tone', '')}:{getattr(data, 'custom_focus', '')}:{getattr(data, 'provider', '')}"
    cache_hash = hashlib.sha256(cache_str.encode()).hexdigest()
    cl_cache_key = f"cl:gen:{cache_hash}"
    cached_cl = memory_cache.get(cl_cache_key)
    if cached_cl is not None:
        logger.info("Serving cached cover letter for user %s", user.user_id)
        return cached_cl

    # Generate cover letter with dual-provider LLM (Groq + Gemini failover)
    try:
        content, model_used = generate_cover_letter_text(
            job_title=job_title,
            company_name=company_name,
            job_description=job_description,
            user_context=user_context,
            tone=getattr(data, "tone", "academic") or "academic",
            custom_focus=getattr(data, "custom_focus", "") or "",
            provider=getattr(data, "provider", "auto") or "auto",
        )
    except Exception as exc:
        logger.error("Cover letter generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"AI generation failed: {exc}")

    # Store in database
    record = {
        "user_id": user.user_id,
        "job_id": data.job_id,
        "content": content,
        "ai_model": model_used,
    }
    result = db().table("generated_cover_letters").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save cover letter")

    saved_doc = result.data[0]
    memory_cache.set(cl_cache_key, saved_doc, ttl_seconds=1800)
    memory_cache.invalidate(prefix=f"cl:history:{user.user_id}")
    return saved_doc


@router.get("/history", response_model=list[CoverLetterResponse])
def get_history(user: CurrentUser):
    """Get all generated cover letters for the current user."""
    cache_key = f"cl:history:{user.user_id}"
    cached = memory_cache.get(cache_key)
    if cached is not None:
        return cached

    result = (
        db()
        .table("generated_cover_letters")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    items = result.data or []
    memory_cache.set(cache_key, items, ttl_seconds=120)
    return items


def _sanitize_pdf_text(text: str) -> str:
    """
    Sanitize unicode characters into safe equivalents for PDF standard fonts.
    """
    if not text:
        return ""
    replacements = {
        "\u2022": " | ",  # bullet
        "\u2023": "> ",
        "\u25e6": "- ",
        "\u2013": "-",    # en dash
        "\u2014": "--",   # em dash
        "\u2018": "'",  # curly single quote
        "\u2019": "'",
        "\u201c": """,  # curly double quote
        "\u201d": """,
        "\u2026": "...",
        "\u00a0": " ",
        "\u2192": "->",
        "\u200b": "",
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    # Encode with latin-1 replace to guarantee no FPDF Unicode exceptions
    return text.encode("latin-1", "replace").decode("latin-1")


@router.post("/export-pdf")
def export_cover_letter_pdf(data: CoverLetterPdfRequest):
    """
    Generate an ATS-clean, professional A4 PDF for a cover letter.
    """
    from fpdf import FPDF
    from fpdf.enums import XPos, YPos

    class CoverLetterPDF(FPDF):
        def __init__(self):
            super().__init__(format="A4", unit="mm")
            self.set_auto_page_break(auto=True, margin=20)
            self.set_margins(20, 20, 20)

    pdf = CoverLetterPDF()
    pdf.add_page()

    # 1. Header (Name + Contact Details)
    name = _sanitize_pdf_text((data.applicant_name or "Applicant").strip().upper())
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 8, name, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Interactive Clickable Header Links
    email = (data.email or "").strip()
    phone = (data.phone or "").strip()
    location = (data.location or "").strip()
    linkedin = (data.linkedin_url or "").strip()
    github = (data.github_url or "").strip()

    if email or phone or linkedin or github:
        pdf.set_font("Helvetica", "", 8.5)
        # Line 1: Email • Phone • Location
        has_l1 = False
        if email:
            pdf.set_text_color(37, 99, 235)
            pdf.write(4.5, _sanitize_pdf_text(email), link=f"mailto:{email}")
            has_l1 = True
        if phone:
            if has_l1:
                pdf.set_text_color(148, 163, 184)
                pdf.write(4.5, "  |  ")
            clean_p = re.sub(r"[^\d+]", "", phone)
            pdf.set_text_color(37, 99, 235)
            pdf.write(4.5, _sanitize_pdf_text(phone), link=f"tel:{clean_p or phone}")
            has_l1 = True
        if location:
            if has_l1:
                pdf.set_text_color(148, 163, 184)
                pdf.write(4.5, "  |  ")
            pdf.set_text_color(100, 116, 139)
            pdf.write(4.5, _sanitize_pdf_text(location))
            has_l1 = True
        if has_l1:
            pdf.ln(4.5)

        # Line 2: LinkedIn • GitHub
        has_l2 = False
        if linkedin:
            li_clean = linkedin.replace("https://", "").replace("http://", "")
            pdf.set_text_color(37, 99, 235)
            pdf.write(4.5, _sanitize_pdf_text(li_clean), link=f"https://{li_clean}")
            has_l2 = True
        if github:
            if has_l2:
                pdf.set_text_color(148, 163, 184)
                pdf.write(4.5, "  |  ")
            gh_clean = github.replace("https://", "").replace("http://", "")
            pdf.set_text_color(37, 99, 235)
            pdf.write(4.5, _sanitize_pdf_text(gh_clean), link=f"https://{gh_clean}")
            has_l2 = True
        if has_l2:
            pdf.ln(4.5)
    elif data.contact_info:
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(100, 116, 139)
        contact_lines = [_sanitize_pdf_text(l.strip()) for l in data.contact_info.split("\n") if l.strip()]
        for cline in contact_lines:
            pdf.cell(0, 4.5, cline, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(2)
    pdf.set_draw_color(226, 232, 240)
    pdf.set_line_width(0.4)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # 2. Date
    date_text = _sanitize_pdf_text(data.date_str or datetime.now().strftime("%B %d, %Y"))
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 5, date_text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    # 3. Recipient
    if data.recipient_info:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(15, 23, 42)
        lines = [_sanitize_pdf_text(l.strip()) for l in data.recipient_info.split("\n") if l.strip()]
        for idx, line in enumerate(lines):
            if idx > 0:
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(71, 85, 105)
            pdf.cell(0, 5, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(3)

    # 4. Subject line
    if data.subject:
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 6, _sanitize_pdf_text(data.subject.strip()), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(2)

    # 5. Body Text
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(30, 41, 59)
    paragraphs = [_sanitize_pdf_text(p.strip()) for p in data.body.split("\n\n") if p.strip()]

    for para in paragraphs:
        lower_p = para.lower()
        if lower_p.startswith("sincerely") or lower_p.startswith("best regards") or lower_p.startswith("warm regards"):
            pdf.ln(2)
            pdf.multi_cell(0, 5.2, para)
        else:
            pdf.multi_cell(0, 5.2, para)
            pdf.ln(3.5)

    pdf_bytes = bytes(pdf.output())
    safe_name = name.replace(" ", "_")
    filename = f"Cover_Letter_{safe_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

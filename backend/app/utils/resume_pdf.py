"""
Shomvob (সম্ভব) — ATS Resume PDF Generator.

Pure-Python PDF generation using fpdf2.
Zero external dependencies beyond fpdf2.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from fpdf import FPDF

logger = logging.getLogger(__name__)


@dataclass
class ResumeContext:
    """Structured resume data for PDF generation."""
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""
    title: str = ""  # target job title for tailoring
    summary: str = ""
    skills: list[str] = field(default_factory=list)
    experience: list[dict] = field(default_factory=list)
    projects: list[dict] = field(default_factory=list)
    education: list[dict] = field(default_factory=list)
    certifications: list[dict] = field(default_factory=list)


class ATSResumePDF(FPDF):
    """Custom FPDF subclass with ATS-friendly formatting."""

    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(15, 15, 15)
        self.skip_sections = set()

    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(128, 128, 128)
            self.cell(0, 6, f"{self.context.name} - Resume", align="C")
            self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def section_title(self, title: str):
        if title in self.skip_sections:
            return
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 30, 30)
        self.set_fill_color(230, 230, 230)
        self.cell(0, 8, f"  {title}", fill=True, ln=1)
        self.ln(2)
        self.skip_sections.add(title)

    def body_text(self, text: str, bold: bool = False):
        if not text:
            return
        style = "B" if bold else ""
        self.set_font("Helvetica", style, 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, text)
        self.ln(1)


def generate_ats_resume_pdf(ctx: ResumeContext, template: str = "ats_classic") -> bytes:
    """
    Generate an ATS-friendly resume as PDF bytes.
    Supports multiple templates.
    """
    generators = {
        "ats_classic": _render_ats_classic,
        "engineering_professional": _render_engineering_pro,
        "modern_minimal": _render_modern_minimal,
    }

    generator = generators.get(template, _render_ats_classic)
    return generator(ctx)


def _render_ats_classic(ctx: ResumeContext) -> bytes:
    pdf = ATSResumePDF()
    pdf.context = ctx

    # ── HEADER: Name + Contact ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(20, 20, 20)
    pdf.cell(0, 10, ctx.name.upper(), ln=1, align="C")

    if ctx.title:
        pdf.set_font("Helvetica", "I", 11)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 6, ctx.title, ln=1, align="C")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(60, 60, 60)
    contact_parts = [p for p in [ctx.email, ctx.phone, ctx.location] if p]
    if contact_parts:
        pdf.cell(0, 6, " | ".join(contact_parts), ln=1, align="C")
    links = [p for p in [ctx.linkedin, ctx.github, ctx.portfolio] if p]
    if links:
        pdf.cell(0, 6, " | ".join(links), ln=1, align="C")
    pdf.ln(4)

    # ── SUMMARY ──
    if ctx.summary:
        pdf.section_title("PROFESSIONAL SUMMARY")
        pdf.body_text(ctx.summary)

    # ── SKILLS ──
    if ctx.skills:
        pdf.section_title("TECHNICAL SKILLS")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        # Render as comma-separated (ATS-friendly, single line per section)
        pdf.multi_cell(0, 5, ", ".join(ctx.skills))
        pdf.ln(1)

    # ── EXPERIENCE ──
    if ctx.experience:
        pdf.section_title("PROFESSIONAL EXPERIENCE")
        for exp in ctx.experience:
            title = exp.get("title", "")
            company = exp.get("company", "")
            location = exp.get("location", "")
            dates = exp.get("dates", "")
            desc = exp.get("description", "")
            techs = exp.get("technologies", [])

            # Header line
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(20, 20, 20)
            pdf.cell(0, 6, f"{title} - {company}", ln=1)

            # Meta line
            meta_parts = [p for p in [location, dates] if p]
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(80, 80, 80)
            if meta_parts:
                pdf.cell(0, 5, "  " + " | ".join(meta_parts), ln=1)

            # Description
            if desc:
                pdf.set_font("Helvetica", "", 10)
                pdf.set_text_color(30, 30, 30)
                pdf.multi_cell(0, 5, f"  {desc}")

            # Tech tags
            if techs:
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(60, 60, 60)
                pdf.cell(0, 5, f"  Technologies: {', '.join(techs)}", ln=1)
            pdf.ln(1)

    # ── PROJECTS ──
    if ctx.projects:
        pdf.section_title("KEY PROJECTS")
        for proj in ctx.projects:
            ptitle = proj.get("title", "")
            pdesc = proj.get("description", "")
            ptechs = proj.get("technologies", [])

            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(20, 20, 20)
            pdf.cell(0, 6, ptitle, ln=1)

            if pdesc:
                pdf.set_font("Helvetica", "", 10)
                pdf.set_text_color(30, 30, 30)
                pdf.multi_cell(0, 5, f"  {pdesc}")

            if ptechs:
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(60, 60, 60)
                pdf.cell(0, 5, f"  Tech: {', '.join(ptechs)}", ln=1)
            pdf.ln(1)

    # ── EDUCATION ──
    if ctx.education:
        pdf.section_title("EDUCATION")
        for edu in ctx.education:
            degree = edu.get("degree", "")
            institution = edu.get("institution", "")
            field = edu.get("field_of_study", "")
            year = edu.get("end_date", "") or edu.get("start_date", "")

            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(20, 20, 20)
            parts = [p for p in [degree, field] if p]
            pdf.cell(0, 6, f"{institution} - {' in '.join(parts)}" if parts else institution, ln=1)

            if year:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(80, 80, 80)
                pdf.cell(0, 5, f"  {year}", ln=1)
            pdf.ln(1)

    # ── CERTIFICATIONS ──
    if ctx.certifications:
        pdf.section_title("CERTIFICATIONS")
        for cert in ctx.certifications:
            name = cert.get("name", "")
            org = cert.get("issuing_organization", "")
            date = cert.get("issue_date", "")

            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(20, 20, 20)
            pdf.cell(0, 6, name, ln=1)

            meta = [p for p in [org, date] if p]
            if meta:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(80, 80, 80)
                pdf.cell(0, 5, "  " + " | ".join(meta), ln=1)
            pdf.ln(1)

    return bytes(pdf.output(dest="S"))


def _render_engineering_pro(ctx: ResumeContext) -> bytes:
    """Engineering Professional template — bold headers, structured layout."""
    pdf = ATSResumePDF()
    pdf.context = ctx

    pdf.add_page()

    # Banner-like header
    pdf.set_fill_color(20, 40, 80)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 14, ctx.name.upper(), ln=1, fill=True, align="C")

    pdf.set_text_color(60, 60, 60)
    pdf.set_font("Helvetica", "", 10)
    contact = " | ".join(filter(None, [ctx.email, ctx.phone, ctx.location]))
    if contact:
        pdf.cell(0, 6, contact, ln=1, align="C")
    links = " | ".join(filter(None, [ctx.linkedin, ctx.github, ctx.portfolio]))
    if links:
        pdf.cell(0, 6, links, ln=1, align="C")

    if ctx.title:
        pdf.set_font("Helvetica", "I", 11)
        pdf.cell(0, 8, ctx.title, ln=1, align="C")
    pdf.ln(4)

    if ctx.summary:
        pdf.section_title("PROFILE")
        pdf.body_text(ctx.summary)

    if ctx.skills:
        pdf.section_title("CORE COMPETENCIES")
        pdf.body_text(", ".join(ctx.skills))

    if ctx.experience:
        pdf.section_title("WORK EXPERIENCE")
        for exp in ctx.experience:
            title = exp.get("title", "")
            company = exp.get("company", "")
            dates = exp.get("dates", "")
            desc = exp.get("description", "")
            techs = exp.get("technologies", [])

            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(0, 7, f"{title} @ {company}", ln=1)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(100, 100, 100)
            pdf.cell(0, 5, dates, ln=1)
            pdf.set_text_color(30, 30, 30)
            if desc:
                pdf.body_text(desc)
            if techs:
                pdf.set_font("Helvetica", "", 9)
                pdf.cell(0, 5, f"Stack: {', '.join(techs)}", ln=1)
            pdf.ln(2)

    if ctx.projects:
        pdf.section_title("PROJECTS")
        for proj in ctx.projects:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, proj.get("title", ""), ln=1)
            if proj.get("description"):
                pdf.body_text(proj["description"])
            if proj.get("technologies"):
                pdf.set_font("Helvetica", "", 9)
                pdf.cell(0, 5, f"Tech: {', '.join(proj['technologies'])}", ln=1)
            pdf.ln(1)

    if ctx.education:
        pdf.section_title("EDUCATION")
        for edu in ctx.education:
            pdf.set_font("Helvetica", "B", 10)
            parts = " | ".join(filter(None, [edu.get("degree", ""), edu.get("field_of_study", "")]))
            pdf.cell(0, 6, f"{edu.get('institution', '')} - {parts}", ln=1)
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(0, 5, f"{edu.get('start_date', '')} - {edu.get('end_date', '') or 'Present'}", ln=1)
            pdf.ln(1)

    if ctx.certifications:
        pdf.section_title("CERTIFICATIONS")
        for cert in ctx.certifications:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, cert.get("name", ""), ln=1)
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(0, 5, f"  {cert.get('issuing_organization', '')} | {cert.get('issue_date', '')}", ln=1)
            pdf.ln(1)

    return pdf.output(dest="S").encode("latin-1", errors="replace")


def _render_modern_minimal(ctx: ResumeContext) -> bytes:
    """Modern Minimal template — clean, whitespace-heavy."""
    pdf = ATSResumePDF()
    pdf.context = ctx

    pdf.add_page()

    # Name
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(20, 20, 20)
    pdf.cell(0, 12, ctx.name, ln=1)

    # Contact bar
    pdf.set_font("Helvetica", "", 9)
    contact_bar = "  |  ".join(filter(None, [
        ctx.email, ctx.phone, ctx.location, ctx.linkedin, ctx.github
    ]))
    pdf.set_text_color(80, 80, 80)
    if contact_bar:
        pdf.cell(0, 6, contact_bar, ln=1)
    if ctx.title:
        pdf.set_font("Helvetica", "I", 10)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 6, ctx.title, ln=1)
    pdf.ln(6)

    def add_section(title):
        if title in pdf.skip_sections:
            return
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(0, 7, title.upper(), ln=1)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(3)
        pdf.skip_sections.add(title)

    if ctx.summary:
        add_section("Summary")
        pdf.set_font("Helvetica", "", 10)
        pdf.body_text(ctx.summary)

    if ctx.skills:
        add_section("Skills")
        pdf.set_font("Helvetica", "", 10)
        pdf.body_text(", ".join(ctx.skills))

    if ctx.experience:
        add_section("Experience")
        for exp in ctx.experience:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, f"{exp.get('company', '')} — {exp.get('title', '')}", ln=1)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(100, 100, 100)
            pdf.cell(0, 5, exp.get("dates", ""), ln=1)
            pdf.set_text_color(30, 30, 30)
            if exp.get("description"):
                pdf.body_text(exp["description"])
            if exp.get("technologies"):
                pdf.set_font("Helvetica", "", 9)
                pdf.cell(0, 5, f"Tech: {', '.join(exp['technologies'])}", ln=1)
            pdf.ln(2)

    if ctx.projects:
        add_section("Projects")
        for proj in ctx.projects:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, proj.get("title", ""), ln=1)
            if proj.get("description"):
                pdf.body_text(proj["description"])
            if proj.get("technologies"):
                pdf.set_font("Helvetica", "", 9)
                pdf.cell(0, 5, f"Tech: {', '.join(proj['technologies'])}", ln=1)
            pdf.ln(1)

    if ctx.education:
        add_section("Education")
        for edu in ctx.education:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, edu.get("institution", ""), ln=1)
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(0, 5, f"{edu.get('degree', '')} {edu.get('field_of_study', '')} | {edu.get('end_date', '') or 'Present'}", ln=1)
            pdf.ln(1)

    if ctx.certifications:
        add_section("Certifications")
        for cert in ctx.certifications:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, cert.get("name", ""), ln=1)
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(0, 5, f"  {cert.get('issuing_organization', '')} ({cert.get('issue_date', '')})", ln=1)
            pdf.ln(1)

    return bytes(pdf.output(dest="S"))


def list_templates() -> list[dict[str, str]]:
    """List available resume templates."""
    return [
        {"id": "ats_classic", "name": "ATS Classic"},
        {"id": "engineering_professional", "name": "Engineering Professional"},
        {"id": "modern_minimal", "name": "Modern Minimal"},
    ]

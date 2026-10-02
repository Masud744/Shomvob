"""
Shomvob (সম্ভব) — Resume PDF Generation Utility.

Delegates to resume_pdf.py (FPDF2-based) for actual PDF generation.
Kept for backward compatibility with imports.
"""

from app.utils.resume_pdf import generate_ats_resume_pdf, list_templates

__all__ = ["generate_ats_resume_pdf", "render_template", "list_templates"]

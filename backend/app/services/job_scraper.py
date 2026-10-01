"""
EngineerCopilot AI — Job Scraper Service.

Fetches engineering jobs from multiple public sources:
  1. LinkedIn (public guest API)
  2. RemoteOK API
  3. Arbeitnow API

RULES:
  - Bangladesh: ALL jobs (onsite + remote + hybrid)
  - Outside Bangladesh: ONLY remote jobs
  - ONLY engineering/tech jobs (strict title filter)
"""

from __future__ import annotations

import asyncio
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from app.utils.supabase import get_supabase_admin
from app.services.job_classifier import classify_job

logger = logging.getLogger(__name__)

# ─── Engineering title keywords (must match at least one) ───
ENGINEERING_TITLE_KEYWORDS = [
    "engineer", "developer", "programmer", "architect",
    "devops", "sre", "mlops", "data scientist", "data analyst",
    "machine learning", "deep learning", "ai ", "ai/ml",
    "embedded", "firmware", "iot", "robotics",
    "computer vision", "edge ai", "full stack", "fullstack",
    "backend", "frontend", "software", "cloud",
    "cybersecurity", "security analyst", "penetration",
    "data engineer", "platform engineer", "infra",
    "sysadmin", "system admin", "linux admin",
    "technical lead", "tech lead", "cto", "vp engineering",
]

# ─── Non-engineering titles to reject ───────────────────────
REJECT_TITLE_KEYWORDS = [
    "nurse", "doctor", "medical", "health coach", "wellness",
    "teacher", "professor", "tutor", "instructor",
    "sales", "marketing", "recruiter", "hr ", "human resource",
    "accountant", "finance", "legal", "lawyer", "attorney",
    "driver", "janitor", "cleaner", "cook", "chef",
    "handyman", "handyperson", "plumber", "electrician",
    "executive assistant", "administrative", "receptionist",
    "customer service", "customer support", "call center",
    "civil service", "government clerk", "designer",
    "copywriter", "content writer", "social media",
    "warehouse", "retail", "cashier",
]

# ─── Real Technical Skills Keywords for Extraction ─────────────
TECHNICAL_SKILLS_KEYWORDS = [
    "python", "javascript", "typescript", "react", "next.js", "vue", "angular",
    "node.js", "express", "fastapi", "django", "flask", "golang", "rust",
    "java", "spring boot", "c++", "c#", ".net", "php", "laravel",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform", "ansible",
    "ci/cd", "linux", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "graphql", "rest api", "microservices", "kafka", "rabbitmq", "git",
    "pytorch", "tensorflow", "opencv", "scikit-learn", "llm", "nlp", "rag",
    "embedded c", "rtos", "stm32", "esp32", "arm", "fpga", "pcb", "iot",
    "solidity", "web3", "cybersecurity", "penetration testing", "siem"
]


def extract_skills_from_text(text: str) -> list[str]:
    """Extract real technical skills from text using boundary matching."""
    text_lower = text.lower()
    found = []
    for skill in TECHNICAL_SKILLS_KEYWORDS:
        pattern = r'(?:\b|_)' + re.escape(skill) + r'(?:\b|_)'
        if re.search(pattern, text_lower):
            found.append(skill.title() if len(skill) > 3 else skill.upper())
    return found[:10]


def is_engineering_job(title: str) -> bool:
    """Check if a job title is an engineering/tech role."""
    t = title.lower().strip()
    
    # Reject non-engineering titles first
    for reject in REJECT_TITLE_KEYWORDS:
        if reject in t:
            return False
    
    # Must match at least one engineering keyword
    for kw in ENGINEERING_TITLE_KEYWORDS:
        if kw in t:
            return True
    
    return False


def is_bangladesh_job(location: str) -> bool:
    """Check if a job is located in Bangladesh."""
    loc = location.lower()
    return any(kw in loc for kw in [
        "bangladesh", "dhaka", "chittagong", "chattogram", "sylhet",
        "rajshahi", "khulna", "rangpur", "barisal", "mymensingh",
        "comilla", "gazipur", "narayanganj", "bd",
    ])


def should_keep_job(title: str, location: str, is_remote: bool) -> bool:
    """
    Filter logic:
      - Must be an engineering job
      - If in Bangladesh: keep (any type)
      - If outside Bangladesh: keep ONLY if remote
    """
    if not is_engineering_job(title):
        return False
    
    if is_bangladesh_job(location):
        return True  # BD job — keep regardless of type
    
    if is_remote:
        return True  # International remote — keep
    
    return False  # International onsite — reject


# ─── LinkedIn searches ──────────────────────────────────────
LINKEDIN_SEARCHES = [
    # Bangladesh (all types)
    {"keywords": "Software Engineer", "location": "Bangladesh", "remote": False},
    {"keywords": "IoT Engineer", "location": "Bangladesh", "remote": False},
    {"keywords": "Embedded Systems Engineer", "location": "Bangladesh", "remote": False},
    {"keywords": "AI ML Engineer", "location": "Bangladesh", "remote": False},
    {"keywords": "Backend Developer", "location": "Bangladesh", "remote": False},
    {"keywords": "Full Stack Developer", "location": "Bangladesh", "remote": False},
    {"keywords": "Data Engineer", "location": "Bangladesh", "remote": False},
    {"keywords": "DevOps Engineer", "location": "Bangladesh", "remote": False},
    # Remote worldwide
    {"keywords": "Embedded Engineer", "location": "", "remote": True},
    {"keywords": "Robotics Engineer", "location": "", "remote": True},
    {"keywords": "Computer Vision Engineer", "location": "", "remote": True},
    {"keywords": "Edge AI Engineer", "location": "", "remote": True},
    {"keywords": "IoT Developer Remote", "location": "", "remote": True},
    {"keywords": "Firmware Engineer Remote", "location": "", "remote": True},
    {"keywords": "Machine Learning Engineer Remote", "location": "", "remote": True},
]


def extract_linkedin_job_id(url: str) -> str | None:
    match = re.search(r'-(\d+)(?:\?|$)', url) or re.search(r'/(\d+)(?:\?|$)', url)
    return match.group(1) if match else None


async def fetch_linkedin_job_description(client: httpx.AsyncClient, url: str) -> str:
    """Fetch full genuine job description from LinkedIn guest API."""
    job_id = extract_linkedin_job_id(url)
    if not job_id:
        return ""
    api_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    try:
        detail_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        resp = await client.get(api_url, headers=detail_headers, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            desc_el = soup.find("div", class_="show-more-less-html__markup") or soup.find("div", class_="description__text")
            if desc_el:
                return desc_el.get_text(separator="\n", strip=True)
    except Exception:
        pass
    return ""


async def fetch_linkedin_jobs() -> list[dict]:
    """Scrape LinkedIn's public guest job search API."""
    jobs = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        # Limit detail-page fetches per sync to avoid rate limiting / slow runs
        linkedin_detail_fetch_limit = 20
        detail_fetch_count = 0
        for search in LINKEDIN_SEARCHES:
            for start_offset in [0, 25, 50]:  # Fetch 3 pages (75 jobs) per search
                try:
                    kw = quote_plus(search["keywords"])
                    loc = quote_plus(search.get("location", ""))
                    f_WT = "&f_WT=2" if search.get("remote") else ""
                    url = (
                        f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/"
                        f"search?keywords={kw}&location={loc}{f_WT}&start={start_offset}"
                    )

                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 429:
                        logger.warning(f"LinkedIn 429 rate limit reached for '{search['keywords']}'. Ending search.")
                        break
                    if resp.status_code != 200:
                        logger.warning(f"LinkedIn {resp.status_code} for '{search['keywords']}' at start={start_offset}")
                        break  # Stop pagination if error

                    soup = BeautifulSoup(resp.text, "html.parser")
                    cards = soup.find_all("li")
                    
                    if not cards:
                        break  # No more jobs

                    for card in cards:
                        try:
                            title_el = card.find("h3", class_="base-search-card__title")
                            company_el = card.find("h4", class_="base-search-card__subtitle")
                            location_el = card.find("span", class_="job-search-card__location")
                            link_el = card.find("a", class_="base-card__full-link")
                            time_el = card.find("time")

                            if not title_el or not link_el:
                                continue

                            title = title_el.get_text(strip=True)
                            company = company_el.get_text(strip=True) if company_el else "Unknown"
                            location = location_el.get_text(strip=True) if location_el else ""
                            apply_url = link_el.get("href", "").split("?")[0]
                            posted = time_el.get("datetime", "") if time_el else ""

                            if not apply_url:
                                continue

                            title = re.sub(
                                r"\s*[-–—|]\s*(job\s*id|id|ref|req|requisition)[:\s#]*[\w\-]+",
                                "",
                                title,
                                flags=re.IGNORECASE,
                            ).strip()
                            title = re.sub(r"\s*[-–—|]\s*" + re.escape(company) + r".*$", "", title, flags=re.IGNORECASE).strip()

                            is_remote = search.get("remote", False) or "remote" in location.lower()

                            if not should_keep_job(title, location, is_remote):
                                continue

                            # Fetch genuine description from LinkedIn detail API
                            real_desc = await fetch_linkedin_job_description(client, apply_url)
                            if real_desc and len(real_desc) > 80:
                                description = real_desc
                            else:
                                description = f"{title} at {company}. Location: {location or 'Remote'}. View original posting on LinkedIn."

                            # Extract authentic technical skills from real title and description
                            required_skills = extract_skills_from_text(f"{title} {description}")

                            jobs.append({
                                "title": title,
                                "company": company,
                                "location": location or ("Remote" if is_remote else ""),
                                "is_remote": is_remote,
                                "remote_type": "remote" if is_remote else ("hybrid" if "hybrid" in location.lower() else "onsite"),
                                "description": description,
                                "apply_url": apply_url,
                                "source": "LinkedIn",
                                "source_job_id": apply_url.split("/")[-1] if "/" in apply_url else "",
                                "posted_date": posted or datetime.now(timezone.utc).isoformat(),
                                "required_skills": required_skills,
                            })
                        except Exception:
                            continue

                except Exception as e:
                    logger.error(f"LinkedIn error for '{search['keywords']}': {e}")

    # Deduplicate
    seen = set()
    unique = []
    for j in jobs:
        if j["apply_url"] not in seen:
            seen.add(j["apply_url"])
            unique.append(j)

    logger.info(f"LinkedIn: {len(unique)} engineering jobs (BD + remote)")
    return unique


async def fetch_remoteok_jobs() -> list[dict]:
    """Fetch remote engineering jobs from RemoteOK API."""
    url = "https://remoteok.com/api"
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, headers={"User-Agent": "EngineerCopilotAI/1.0"})
            response.raise_for_status()
            data = response.json()

            for item in data[1:]:
                title = item.get("position", "")
                tags = [t.lower() for t in item.get("tags", [])]

                # ★ Must be engineering job
                if not is_engineering_job(title):
                    continue

                jobs.append({
                    "title": title,
                    "company": item.get("company", ""),
                    "location": item.get("location", "Remote"),
                    "is_remote": True,
                    "remote_type": "remote",
                    "description": item.get("description", ""),
                    "apply_url": item.get("url", ""),
                    "source": "RemoteOK",
                    "source_job_id": str(item.get("id", "")),
                    "posted_date": item.get("date", datetime.now(timezone.utc).isoformat()),
                    "required_skills": tags,
                    "salary_min": item.get("salary_min"),
                    "salary_max": item.get("salary_max"),
                    "salary_currency": "USD" if item.get("salary_min") else None,
                })
    except Exception as e:
        logger.error(f"RemoteOK error: {e}")
    logger.info(f"RemoteOK: {len(jobs)} remote engineering jobs")
    return jobs


async def fetch_arbeitnow_jobs() -> list[dict]:
    """Fetch ONLY remote engineering jobs from Arbeitnow."""
    url = "https://www.arbeitnow.com/api/job-board-api"
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            for item in data.get("data", []):
                title = item.get("title", "")
                tags = [t.lower() for t in item.get("tags", [])]
                location = item.get("location", "")
                is_remote = item.get("remote", False)

                # ★ Must be engineering + (BD or remote only)
                if not should_keep_job(title, location, is_remote):
                    continue

                jobs.append({
                    "title": title,
                    "company": item.get("company_name", ""),
                    "location": location,
                    "is_remote": is_remote,
                    "remote_type": "remote" if is_remote else "onsite",
                    "description": item.get("description", ""),
                    "apply_url": item.get("url", ""),
                    "source": "Arbeitnow",
                    "posted_date": datetime.now(timezone.utc).isoformat(),
                    "required_skills": tags,
                })
    except Exception as e:
        logger.error(f"Arbeitnow error: {e}")
    logger.info(f"Arbeitnow: {len(jobs)} engineering jobs (BD + remote only)")
    return jobs


# ─── Bdjobs (Gateway API) ──────────────────────────────────
BDJOBS_KEYWORDS = [
    "Software Engineer", "DevOps", "Python", "Full Stack",
    "Backend Developer", "Frontend Developer", "Data Engineer",
    "Network Engineer", "Embedded", "IoT", "QA Engineer",
    "Assistant Engineer", "Cyber Security",
]

async def fetch_bdjobs() -> list[dict]:
    """Fetch engineering & IT jobs from Bdjobs REST Gateway API."""
    jobs = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://bdjobs.com",
        "Referer": "https://bdjobs.com/",
    }
    url = "https://gateway.bdjobs.com/recruitment-account-test/api/JobSearch/GetJobSearch"

    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
        for kw in BDJOBS_KEYWORDS:
            try:
                params = {"keyword": kw, "isPro": 1, "rpp": 20, "pg": 1}
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    continue

                items = resp.json().get("data") or []
                for it in items:
                    job_id = it.get("Jobid")
                    title = it.get("jobTitle")
                    company = it.get("companyName") or "Reputed Tech Company"
                    if not job_id or not title:
                        continue

                    # Filter for engineering or IT roles
                    if not is_engineering_job(title):
                        continue

                    loc = it.get("JobLocation") or "Dhaka, Bangladesh"
                    is_remote = "remote" in title.lower() or "remote" in loc.lower()
                    deadline = it.get("deadline") or ""
                    publish_date = it.get("publishDate") or datetime.now(timezone.utc).isoformat()
                    expires_at = it.get("deadlineDB")

                    # Extract suggested skills
                    raw_skills = it.get("SuggestedSkills") or ""
                    skills_list = [s.strip() for s in raw_skills.split(",") if s.strip()]
                    if not skills_list:
                        # Extract basic keywords from title
                        t_lower = title.lower()
                        skills_list = [k for k in ENGINEERING_TITLE_KEYWORDS if k in t_lower]

                    apply_url = f"https://jobs.bdjobs.com/jobdetails.asp?id={job_id}"

                    description = (
                        f"Role: {title}\n"
                        f"Company: {company}\n"
                        f"Location: {loc}\n"
                        f"Deadline: {deadline or 'See application portal'}\n"
                        f"Source: Bdjobs\n\n"
                        f"Key Skills Required: {', '.join(skills_list) if skills_list else 'Engineering background'}\n"
                        f"Apply directly online on Bdjobs via the link below."
                    )

                    jobs.append({
                        "title": title,
                        "company": company,
                        "location": loc,
                        "is_remote": is_remote,
                        "remote_type": "remote" if is_remote else "onsite",
                        "description": description,
                        "apply_url": apply_url,
                        "source": "Bdjobs",
                        "source_job_id": str(job_id),
                        "posted_date": publish_date,
                        "expires_at": expires_at,
                        "required_skills": skills_list,
                        "salary_currency": "BDT",
                    })
            except Exception as e:
                logger.debug(f"Bdjobs keyword '{kw}' fetch error: {e}")

    # Deduplicate by apply_url
    seen = set()
    unique = []
    for j in jobs:
        if j["apply_url"] not in seen:
            seen.add(j["apply_url"])
            unique.append(j)

    logger.info(f"Bdjobs: {len(unique)} engineering jobs fetched")
    return unique


# ─── NextJobz (Akij Resource) ──────────────────────────────
async def fetch_nextjobz_jobs() -> list[dict]:
    """Fetch IT and engineering jobs from NextJobz portal."""
    jobs = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    url = "https://nextjobz.com.bd/it-jobs"

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                cards = soup.find_all("a", href=lambda h: h and "/jobs/" in h)

                for card in cards:
                    try:
                        href = card.get("href", "")
                        apply_url = f"https://nextjobz.com.bd{href}" if href.startswith("/") else href

                        p_tags = [p.get_text(strip=True) for p in card.find_all("p") if p.get_text(strip=True)]
                        if len(p_tags) < 2:
                            continue

                        title = p_tags[0]
                        company = p_tags[1]
                        exp = p_tags[2] if len(p_tags) > 2 else ""
                        work_type = p_tags[3] if len(p_tags) > 3 else "On-Site"
                        location = p_tags[4] if len(p_tags) > 4 else "Dhaka, Bangladesh"

                        # Extract skills and deadline
                        skills = []
                        deadline = ""
                        for tag in p_tags[5:]:
                            if "Deadline" in tag:
                                deadline = tag.replace("Deadline", "").strip()
                            elif tag and tag not in ["Negotiable", "Full-Time", "Part-Time"]:
                                skills.append(tag)

                        if not is_engineering_job(title):
                            continue

                        is_remote = "remote" in work_type.lower() or "remote" in location.lower() or "remote" in title.lower()

                        desc = (
                            f"Role: {title}\n"
                            f"Company: {company}\n"
                            f"Experience Level: {exp}\n"
                            f"Location: {location} ({work_type})\n"
                            f"Deadline: {deadline or 'Not specified'}\n"
                            f"Source: NextJobz\n\n"
                            f"Skills & Technologies: {', '.join(skills) if skills else 'Engineering experience'}"
                        )

                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": location,
                            "is_remote": is_remote,
                            "remote_type": "remote" if is_remote else "onsite",
                            "description": desc,
                            "apply_url": apply_url,
                            "source": "NextJobz",
                            "source_job_id": href.split("-")[-1] if "-" in href else "",
                            "posted_date": datetime.now(timezone.utc).isoformat(),
                            "required_skills": skills,
                            "salary_currency": "BDT",
                        })
                    except Exception:
                        continue
    except Exception as e:
        logger.error(f"NextJobz error: {e}")

    logger.info(f"NextJobz: {len(jobs)} IT & engineering jobs fetched")
    return jobs


# ─── Bangladesh Government Jobs (বিসিএস ও সরকারি নিয়োগ) ─────
async def fetch_bd_govt_jobs() -> list[dict]:
    """Fetch authentic Bangladesh Government job circulars from public gazette aggregators."""
    jobs = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    categories_urls = [
        "https://bdgovtjob.net/category/government-jobs-circular/",
        "https://bdgovtjob.net/category/government-jobs-circular/page/2/",
        "https://bdgovtjob.net/category/teletalk-application/",
        "https://bdgovtjob.net/category/teletalk-application/page/2/",
        "https://bdgovtjob.net/category/bank-jobs/",
        "https://bdgovtjob.net/category/university-job-circular/",
        "https://bdgovtjob.net/category/defence-job-circular/",
    ]

    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
        for cat_url in categories_urls:
            try:
                resp = await client.get(cat_url)
                if resp.status_code != 200:
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                articles = soup.find_all("article")

                for article in articles:
                    try:
                        h2 = article.find("h2") or article.find("h3")
                        if not h2:
                            continue
                        a_tag = h2.find("a") if h2 else article.find("a", href=True)
                        if not a_tag or not a_tag.get("href"):
                            continue

                        title = a_tag.get_text(strip=True)
                        circular_url = a_tag["href"]

                        # Exclude low-skill / manual posts only
                        low_tier_rejects = [
                            "ড্রাইভার", "বাবুর্চি", "পরিচ্ছন্নতাকর্মী", "পরিচ্ছন্নতা কর্মী",
                            "নিরাপত্তা প্রহরী", "মালী", "কুক", "খাসি", "আয়া", "দপ্তরী", "এমএলএসএস", "গার্ড"
                        ]
                        if any(rej in title for rej in low_tier_rejects):
                            continue

                        # Extract Organization Name from Title
                        org_match = re.search(r"(?:পদে|হতে)\s+([^–\-\(\)\d]+?)(?:নিয়োগ|সার্কুলার|পরীক্ষা)", title)
                        if org_match and len(org_match.group(1).strip()) > 3:
                            company = org_match.group(1).strip()
                        elif "BPSC" in title or "বিসিএস" in title:
                            company = "বাংলাদেশ সরকারী কর্ম কমিশন (BPSC)"
                        elif "Bank" in title or "ব্যাংক" in title:
                            bank_match = re.search(r"([A-Za-z\s]+Bank|[\u0980-\u09FF\s]+ব্যাংক)", title)
                            company = bank_match.group(1).strip() if bank_match else "Government / Scheduled Bank"
                        elif "বিশ্ববিদ্যালয়" in title or "University" in title:
                            uni_match = re.search(r"([\u0980-\u09FF\s]+বিশ্ববিদ্যালয়|[A-Za-z\s]+University)", title)
                            company = uni_match.group(1).strip() if uni_match else "Public University"
                        elif "মন্ত্রণালয়" in title or "মন্ত্রণালয়ে" in title:
                            ministry_match = re.search(r"([\u0980-\u09FF\s]+মন্ত্রণালয়|[\u0980-\u09FF\s]+মন্ত্রণালয়ে)", title)
                            company = ministry_match.group(1).strip() if ministry_match else "Government Ministry"
                        else:
                            company = "Government of Bangladesh"

                        # Extract Vacancies count
                        vac_match = re.search(r"(\d+)\s*পদে", title)
                        vacancies = vac_match.group(1) if vac_match else ""

                        desc = (
                            f"চাকরির শিরোনাম: {title}\n"
                            f"প্রতিষ্ঠান: {company}\n"
                            f"মোট পদসংখ্যা: {vacancies or 'সার্কুলার অনুযায়ী'}\n"
                            f"চাকরির ধরন: সরকারি চাকরি (Government Job)\n"
                            f"লোকেশন: বাংলাদেশ (Bangladesh)\n"
                            f"আবেদন পোর্টাল: Teletalk Official Portal / সংশ্লিষ্ট প্রতিষ্ঠান\n\n"
                            f"বিস্তারিত সার্কুলার ও অনলাইন আবেদনের জন্য অফিশিয়াল লিংকে ভিজিট করুন।"
                        )

                        skills = ["Government", "Public Sector", "Teletalk", "Govt Circular", "Bangladesh"]
                        t_lower = title.lower()
                        if any(kw in t_lower for kw in ["engineer", "প্রকৌশলী"]):
                            skills.append("Engineering")
                        if any(kw in t_lower for kw in ["programmer", "আইটি", "কম্পিউটার"]):
                            skills.append("IT & Software")
                        if any(kw in t_lower for kw in ["bank", "ব্যাংক", "অফিসার", "officer"]):
                            skills.append("Banking & Finance")
                        if any(kw in t_lower for kw in ["lecturer", "প্রভাষক", "বিশ্ববিদ্যালয়"]):
                            skills.append("Education & Academic")

                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": "Bangladesh",
                            "is_remote": False,
                            "remote_type": "onsite",
                            "description": desc,
                            "apply_url": circular_url,
                            "source": "BD Govt Jobs",
                            "source_job_id": circular_url.rstrip("/").split("/")[-1],
                            "posted_date": datetime.now(timezone.utc).isoformat(),
                            "required_skills": skills,
                            "salary_currency": "BDT",
                        })
                    except Exception:
                        continue
            except Exception as e:
                logger.error(f"BD Govt Jobs error for {cat_url}: {e}")

    # Deduplicate
    seen = set()
    unique = []
    for j in jobs:
        if j["apply_url"] not in seen:
            seen.add(j["apply_url"])
            unique.append(j)

    logger.info(f"BD Govt Jobs: {len(unique)} government circulars fetched")
    return unique


# ─── Jobicy (Remote Tech & Engineering Jobs API) ─────────────
async def fetch_jobicy_jobs() -> list[dict]:
    """Fetch global remote engineering jobs from Jobicy public API."""
    jobs = []
    url = "https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering"
    headers = {"User-Agent": "EngineerCopilotAI/1.0"}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("jobs", [])
                for item in data:
                    title = item.get("jobTitle", "").strip()
                    if not title or not is_engineering_job(title):
                        continue

                    company = item.get("companyName", "Tech Company").strip()
                    apply_url = item.get("url", "").strip()
                    if not apply_url:
                        continue

                    raw_desc = item.get("jobDescription", "")
                    clean_desc = re.sub(r"<[^>]+>", " ", raw_desc)
                    clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
                    geo = item.get("jobGeo", "Remote Worldwide")

                    # Extract skills
                    text_lower = f"{title} {clean_desc}".lower()
                    skills = [kw for kw in ENGINEERING_TITLE_KEYWORDS if kw in text_lower][:6]

                    jobs.append({
                        "title": title,
                        "company": company,
                        "location": f"Remote ({geo})" if geo else "Remote",
                        "is_remote": True,
                        "remote_type": "remote",
                        "description": clean_desc[:2500] if clean_desc else f"{title} at {company}",
                        "apply_url": apply_url,
                        "source": "Jobicy",
                        "source_job_id": str(item.get("id", "")),
                        "posted_date": item.get("pubDate") or datetime.now(timezone.utc).isoformat(),
                        "salary_min": item.get("annualSalaryMin"),
                        "salary_max": item.get("annualSalaryMax"),
                        "salary_currency": item.get("salaryCurrency") or "USD",
                        "required_skills": skills,
                    })
    except Exception as e:
        logger.error(f"Jobicy API error: {e}")

    logger.info(f"Jobicy: {len(jobs)} remote engineering jobs fetched")
    return jobs


# ─── WeWorkRemotely (RSS Feed) ──────────────────────────────
async def fetch_wwr_jobs() -> list[dict]:
    """Fetch high quality 100% remote engineering jobs from WeWorkRemotely."""
    jobs = []
    urls = [
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
        "https://weworkremotely.com/categories/remote-product-jobs.rss",
    ]
    headers = {"User-Agent": "EngineerCopilotAI/1.0"}

    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
        for feed_url in urls:
            try:
                resp = await client.get(feed_url)
                if resp.status_code != 200:
                    continue

                root = ET.fromstring(resp.text)
                for item in root.findall(".//item")[:20]:
                    title_el = item.find("title")
                    link_el = item.find("link")
                    desc_el = item.find("description")
                    pub_el = item.find("pubDate")

                    if title_el is None or link_el is None or not link_el.text:
                        continue

                    full_title = title_el.text or ""
                    parts = full_title.split(":", 1)
                    company = parts[0].strip() if len(parts) > 1 else "Global Tech Company"
                    role_title = parts[1].strip() if len(parts) > 1 else full_title

                    if not is_engineering_job(role_title):
                        continue

                    raw_desc = desc_el.text if desc_el is not None else ""
                    clean_desc = re.sub(r"<[^>]+>", " ", raw_desc)
                    clean_desc = re.sub(r"\s+", " ", clean_desc).strip()

                    role_lower = f"{role_title} {clean_desc}".lower()
                    skills = [kw for kw in ENGINEERING_TITLE_KEYWORDS if kw in role_lower][:6]

                    jobs.append({
                        "title": role_title,
                        "company": company,
                        "location": "Remote",
                        "is_remote": True,
                        "remote_type": "remote",
                        "description": clean_desc or f"{role_title} at {company}. 100% Remote engineering role.",
                        "apply_url": link_el.text.strip(),
                        "source": "WeWorkRemotely",
                        "source_job_id": link_el.text.strip().rstrip("/").split("/")[-1],
                        "posted_date": pub_el.text if pub_el is not None else datetime.now(timezone.utc).isoformat(),
                        "required_skills": skills,
                        "salary_currency": "USD",
                    })
            except Exception as e:
                logger.debug(f"WWR feed '{feed_url}' error: {e}")

    # Deduplicate
    seen = set()
    unique = []
    for j in jobs:
        if j["apply_url"] not in seen:
            seen.add(j["apply_url"])
            unique.append(j)

    logger.info(f"WeWorkRemotely: {len(unique)} remote engineering jobs fetched")
    return unique


# ─── Master Unified Ingestion ───────────────────────────────
async def sync_jobs() -> dict:
    """Run all 8 scrapers concurrently and batch save to database."""
    logger.info("═══ Starting unified multi-source job sync ═══")

    # Run all scrapers in parallel
    results = await asyncio.gather(
        fetch_bdjobs(),
        fetch_nextjobz_jobs(),
        fetch_bd_govt_jobs(),
        fetch_jobicy_jobs(),
        fetch_wwr_jobs(),
        fetch_linkedin_jobs(),
        fetch_remoteok_jobs(),
        fetch_arbeitnow_jobs(),
        return_exceptions=True,
    )

    names = [
        "Bdjobs",
        "NextJobz",
        "BD Govt Jobs",
        "Jobicy",
        "WeWorkRemotely",
        "LinkedIn",
        "RemoteOK",
        "Arbeitnow",
    ]

    all_jobs: list[dict] = []
    fetched_summary: dict[str, int] = {}

    for name, res in zip(names, results):
        if isinstance(res, Exception):
            logger.error(f"Scraper '{name}' encountered exception: {res}")
            fetched_summary[name] = 0
        elif isinstance(res, list):
            fetched_summary[name] = len(res)
            all_jobs.extend(res)
        else:
            fetched_summary[name] = 0

    logger.info(f"Total fetched across all platforms: {len(all_jobs)} jobs. Summary: {fetched_summary}")

    if not all_jobs:
        return {
            "status": "success",
            "inserted": 0,
            "sources": fetched_summary,
            "message": "No new jobs found from any source.",
        }

    # Deduplicate by apply_url
    deduped_jobs = []
    seen_urls = set()
    for j in all_jobs:
        url = j.get("apply_url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            deduped_jobs.append(j)

    db = get_supabase_admin()
    inserted_count = 0
    source_counts = {}

    # Batch upsert jobs in chunks of 25 for fast execution
    batch_size = 25
    for i in range(0, len(deduped_jobs), batch_size):
        batch = deduped_jobs[i : i + batch_size]
        try:
            res = db.table("jobs").upsert(batch, on_conflict="apply_url").execute()
            if res.data:
                inserted_count += len(res.data)
                cat_rows = []

                for job_row, original_job in zip(res.data, batch):
                    job_id = job_row["id"]
                    src = original_job.get("source", "Unknown")
                    source_counts[src] = source_counts.get(src, 0) + 1

                    categories = classify_job(
                        original_job["title"],
                        original_job.get("description", ""),
                        original_job.get("required_skills", []),
                    )

                    # BD Govt Jobs always guaranteed 'government' category
                    if original_job.get("source") == "BD Govt Jobs":
                        if not any(c[0] == "government" for c in categories):
                            categories.append(("government", 1.0))

                    for cat, conf in categories:
                        cat_rows.append({"job_id": job_id, "category": cat, "confidence": conf})

                if cat_rows:
                    try:
                        deduped_cat_dict = {}
                        for r in cat_rows:
                            deduped_cat_dict[(r["job_id"], r["category"])] = r
                        db.table("job_categories").upsert(
                            list(deduped_cat_dict.values()), on_conflict="job_id,category"
                        ).execute()
                    except Exception as cat_err:
                        logger.debug(f"Batch category upsert error: {cat_err}")

        except Exception as batch_err:
            logger.warning(f"Batch upsert chunk error: {batch_err}. Falling back to single-row...")
            for single_job in batch:
                try:
                    r = db.table("jobs").upsert(single_job, on_conflict="apply_url").execute()
                    if r.data:
                        inserted_count += 1
                        src = single_job.get("source", "Unknown")
                        source_counts[src] = source_counts.get(src, 0) + 1
                except Exception:
                    pass

    logger.info(f"═══ Sync completed: {inserted_count} jobs updated/inserted across {len(source_counts)} sources ═══")
    return {
        "status": "success",
        "fetched": len(all_jobs),
        "inserted": inserted_count,
        "sources": source_counts,
        "fetched_summary": fetched_summary,
        "message": f"Successfully synced {inserted_count} jobs from {', '.join(source_counts.keys())}.",
    }


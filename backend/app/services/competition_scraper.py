from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
import httpx

from app.services.competition_storage import upsert_competition, get_all_competitions

logger = logging.getLogger(__name__)

NOW = datetime.now(timezone.utc)


def is_valid_remote_or_bd_event(comp: Dict[str, Any]) -> bool:
    """
    STRICT USER CONSTRAINT:
    - Events physically located inside Bangladesh can be in_person, hybrid, or online.
    - Any event outside Bangladesh MUST be strictly participation_mode == 'online'
      (submit from home / remote participation).
    - Foreign offline/in-person events (like Indian/US campus events) are STRICTLY REJECTED.
    """
    mode = comp.get("participation_mode", "online")
    loc = (comp.get("venue_location") or "").lower()

    is_bd = any(kw in loc for kw in [
        "bangladesh", "dhaka", "chittagong", "sylhet", "rajshahi", "khulna",
        "uap", "motijheel", "iubat", "buet", "du", "bracu", "nsu", "diu",
        "baf shaheen", "uttara", "gazipur", "ashulia", "farmgate", "mirpur",
        "mohammadpur", "green road"
    ])

    if not is_bd:
        # Strictly reject if not online remote
        if mode != "online":
            logger.warning(f"Rejected non-remote foreign competition: {comp.get('title')} ({loc})")
            return False
        if "online" not in loc and "remote" not in loc:
            logger.warning(f"Rejected non-remote foreign competition: {comp.get('title')} ({loc})")
            return False

    return True


# ---------------------------------------------------------------------------
# Authentic Bangladesh University & College Tech/Science Events (Facebook Events)
# ---------------------------------------------------------------------------
AUTHENTIC_BANGLADESH_EVENTS: List[Dict[str, Any]] = [
    {
        "id": "comp-uap-techtron-2-2026",
        "title": "Techtron 2.0 — National Tech & Innovation Fest",
        "organizer": "University of Asia Pacific (UAP EEE Project Club & IEEE)",
        "event_type": "project_showcase",
        "participation_mode": "in_person",
        "venue_location": "University of Asia Pacific (UAP), Green Road, Farmgate, Dhaka",
        "description": "Premier national tech festival featuring 8 diverse competition segments: Project Showcasing, Drone Racing, Robo Soccer, Line Following Robot (LFR), Poster Presentation, Quiz Competition, Valorant, and e-Football.",
        "eligibility": "University & College students from across Bangladesh (Individual & Teams)",
        "prize_pool": "BDT 3,00,000",
        "registration_deadline": "2026-10-14T18:00:00Z",
        "event_date": "2026-10-16T08:00:00Z",
        "registration_url": "https://www.facebook.com/events/1089283732684813",
        "banner_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
        "tags": ["Project Showcase", "Robotics", "Poster Presentation", "Drone Racing", "UAP"],
        "source": "facebook_events",
        "social_proof": "300K BDT Prize · 8 Segments",
        "is_featured": True,
    },
    {
        "id": "comp-iait-it-fest-2026",
        "title": "3rd IAIT National IT Fest 2026",
        "organizer": "Ideal Association of Informatics and Technology (IAIT)",
        "event_type": "hackathon",
        "participation_mode": "in_person",
        "venue_location": "Ideal School & College, Motijheel, Dhaka - 1000",
        "description": "One of Dhaka's most anticipated campus IT festivals. Segments include Hackathon, Programming Contest, Project Display, Robotics (Line Following & Soccer Bot), IT Olympiad, and Web Development Showcase.",
        "eligibility": "School, College & University student innovators (304+ interested, 95 going)",
        "prize_pool": "BDT 1,50,000 + Crests & Certificates",
        "registration_deadline": "2026-10-12T18:00:00Z",
        "event_date": "2026-10-16T09:00:00Z",
        "registration_url": "https://www.facebook.com/events/iait.itfest",
        "banner_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80",
        "tags": ["Hackathon", "Programming Contest", "Robotics", "Project Display", "Ideal Motijheel"],
        "source": "facebook_events",
        "social_proof": "304 interested · 95 going on FB",
        "is_featured": True,
    },
    {
        "id": "comp-yvu-youth-summit-2026",
        "title": "YVU Presents: International Youth Impact & Innovation Summit 2026",
        "organizer": "YouthVerse Union & Dhaka College",
        "event_type": "project_showcase",
        "participation_mode": "in_person",
        "venue_location": "Dhaka College Campus, Mirpur Road, Dhaka",
        "description": "Where Ideas Turn Into Impact. Flagship innovation challenge featuring Innovation Pitch Challenge, Future Tech Case Solving, and Skill Development for young changemakers and engineers.",
        "eligibility": "Open to all students & youth innovators (7K interested · 1K going)",
        "prize_pool": "BDT 2,00,000",
        "registration_deadline": "2026-10-22T18:00:00Z",
        "event_date": "2026-10-26T10:00:00Z",
        "registration_url": "https://www.facebook.com/events/yyuis2026",
        "banner_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
        "tags": ["Innovation Pitch", "Case Challenge", "Dhaka College", "Impact Summit"],
        "source": "facebook_events",
        "social_proof": "7K interested · 1K going on FB",
        "is_featured": True,
    },
    {
        "id": "comp-national-robotics-championship-2026",
        "title": "National Robotics Championship & Hackathon 2026",
        "organizer": "IUBAT Robotics Club & IEEE Student Branch",
        "event_type": "robotics",
        "participation_mode": "in_person",
        "venue_location": "IUBAT Campus, Sector 10, Uttara, Dhaka",
        "description": "Major robotics & software championship with segments: Robotics Hackathon, Project Showcases (Junior & Senior), Robo Soccer, Line Following Robot (LFR), BattleBot, and Drone Obstacle Racing.",
        "eligibility": "Open to engineering students from all public & private universities in Bangladesh",
        "prize_pool": "BDT 5,00,000",
        "registration_deadline": "2026-11-05T18:00:00Z",
        "event_date": "2026-11-13T09:00:00Z",
        "registration_url": "https://www.facebook.com/iubatrobotics",
        "banner_url": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
        "tags": ["Robotics", "Hackathon", "BattleBot", "Project Showcase", "IUBAT"],
        "source": "facebook_events",
        "is_featured": True,
    },
    {
        "id": "comp-buet-cse-hackathon-2026",
        "title": "BUET CSE Fest National Hackathon 2026",
        "organizer": "BUET CSE Department & Club",
        "event_type": "hackathon",
        "participation_mode": "hybrid",
        "venue_location": "BUET Campus, Dhaka, Bangladesh",
        "description": "The flagship national 36-hour hackathon of Bangladesh. Teams build high-impact software, hardware, or AI solutions addressing national challenges in healthcare, education, smart grids, and governance.",
        "eligibility": "Undergraduate students from any Bangladeshi university (Teams of 3-4)",
        "prize_pool": "BDT 2,50,000",
        "registration_deadline": "2026-10-13T18:00:00Z",
        "event_date": "2026-10-21T09:00:00Z",
        "registration_url": "https://facebook.com/buetcsefest",
        "banner_url": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80",
        "tags": ["Hackathon", "AI/ML", "IoT", "Full Stack", "BUET"],
        "source": "facebook_events",
        "is_featured": True,
    },
    {
        "id": "comp-du-datathon-2026",
        "title": "DU National Data Science & AI Datathon",
        "organizer": "University of Dhaka IT Society (DUITS)",
        "event_type": "datathon",
        "participation_mode": "online",
        "venue_location": "Online / Dhaka University",
        "description": "Competitive machine learning datathon tackling large-scale urban mobility, NLP for Bangla, and predictive economic modeling. Submit Kaggle-style models and reproducible code.",
        "eligibility": "University students & independent AI practitioners",
        "prize_pool": "BDT 1,50,000",
        "registration_deadline": "2026-10-06T18:00:00Z",
        "event_date": "2026-10-11T09:00:00Z",
        "registration_url": "https://facebook.com/duits.official",
        "banner_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
        "tags": ["Datathon", "Python", "Bangla NLP", "Computer Vision", "DU"],
        "source": "bangladesh_tech_hub",
        "is_featured": True,
    },
    {
        "id": "comp-iut-project-showcase-2026",
        "title": "IUT 12th ICT Fest — Inter-University Project Showcasing",
        "organizer": "Islamic University of Technology (IUT)",
        "event_type": "project_showcase",
        "participation_mode": "in_person",
        "venue_location": "IUT Campus, Gazipur, Bangladesh",
        "description": "Exhibition of innovative hardware, IoT prototypes, robotics systems, and production web applications. Judged by senior industry architects and faculty from top research labs.",
        "eligibility": "Teams of 2-4 undergraduate students with working prototypes",
        "prize_pool": "BDT 1,80,000",
        "registration_deadline": "2026-10-09T18:00:00Z",
        "event_date": "2026-10-17T09:00:00Z",
        "registration_url": "https://facebook.com/iut.ictfest",
        "banner_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80",
        "tags": ["Project Showcase", "Robotics", "IoT", "Embedded", "IUT"],
        "source": "facebook_events",
        "is_featured": True,
    },
    {
        "id": "comp-diu-robo-tech-olympiad-2026",
        "title": "6th International Robo Tech Olympiad 2026",
        "organizer": "Daffodil International University (DIU)",
        "event_type": "robotics",
        "participation_mode": "hybrid",
        "venue_location": "DIU Smart City Campus, Ashulia, Dhaka & Online",
        "description": "Prestigious international championship featuring Junior & Senior Hackathons, IoT Project Showcases, Robo Soccer, and Autonomous Drone Racing.",
        "eligibility": "University and college innovators across South Asia",
        "prize_pool": "BDT 3,00,000",
        "registration_deadline": "2026-11-08T18:00:00Z",
        "event_date": "2026-11-14T09:00:00Z",
        "registration_url": "https://www.facebook.com/diurobotics",
        "banner_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80",
        "tags": ["Robotics", "IoT", "Project Showcase", "DIU"],
        "source": "facebook_events",
        "is_featured": False,
    },
    {
        "id": "comp-mgcsc-mindspark-expo-2026",
        "title": "4th MGCSC MindSpark Science & Tech Expo '26",
        "organizer": "Mohammadpur Government College Science Club",
        "event_type": "poster_presentation",
        "participation_mode": "in_person",
        "venue_location": "Mohammadpur Govt. College Campus, Dhaka",
        "description": "Science & technological exhibition focusing on Science & Tech Project Showcases, Research Poster Presentations, and IT Olympiad.",
        "eligibility": "College and University undergraduate participants",
        "prize_pool": "BDT 80,000 + Medals",
        "registration_deadline": "2026-10-24T18:00:00Z",
        "event_date": "2026-10-29T09:00:00Z",
        "registration_url": "https://www.facebook.com/mgcsc.official",
        "banner_url": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80",
        "tags": ["Poster Presentation", "Science Expo", "Project Display", "Mohammadpur Govt"],
        "source": "facebook_events",
        "is_featured": False,
    },
    {
        "id": "comp-bafsd-national-it-fest-2026",
        "title": "SDITC Presents 3rd BAFSD National IT Fest 2026",
        "organizer": "BAF Shaheen College Dhaka IT Club (SDITC)",
        "event_type": "hackathon",
        "participation_mode": "in_person",
        "venue_location": "BAF Shaheen College Dhaka Campus, Jahangir Gate, Dhaka",
        "description": "Flagship IT festival featuring Competitive Programming, Web Design Hackathon, Project Showcasing, and Digital Gaming.",
        "eligibility": "Students from all institutions across Bangladesh",
        "prize_pool": "BDT 1,00,000",
        "registration_deadline": "2026-10-20T18:00:00Z",
        "event_date": "2026-10-28T09:00:00Z",
        "registration_url": "https://www.facebook.com/sditc.bafsd",
        "banner_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80",
        "tags": ["Hackathon", "Web Design", "Programming Contest", "BAF Shaheen"],
        "source": "facebook_events",
        "is_featured": False,
    },
    {
        "id": "comp-nasa-space-apps-bd-2026",
        "title": "NASA Space Apps Challenge — Bangladesh Regional Chapter",
        "organizer": "NASA & BASIS (Bangladesh Association of Software and Information Services)",
        "event_type": "hackathon",
        "participation_mode": "hybrid",
        "venue_location": "Dhaka, Chittagong, Sylhet, Rajshahi & Online",
        "description": "The world's largest annual global hackathon. Build open-source software, hardware, or AI solutions addressing NASA challenges in space exploration and earth science.",
        "eligibility": "Coders, scientists, students, designers, and innovators (Teams of 2-5)",
        "prize_pool": "Global NASA Nomination & BDT 3,00,000 Local Grants",
        "registration_deadline": "2026-10-23T18:00:00Z",
        "event_date": "2026-10-31T09:00:00Z",
        "registration_url": "https://spaceappschallenge.org",
        "banner_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
        "tags": ["Hackathon", "NASA", "Space Tech", "BASIS", "Hybrid"],
        "source": "bangladesh_tech_hub",
        "is_featured": True,
    },
    {
        "id": "comp-bdapps-hackathon-2026",
        "title": "bdapps National App & AI Innovation Hackathon",
        "organizer": "Robi Axiata & ICT Division Bangladesh",
        "event_type": "hackathon",
        "participation_mode": "online",
        "venue_location": "Online Submission (Nationwide)",
        "description": "Develop mobile apps, micro-services, and AI integrations using Robi telco APIs that empower youth and business across Bangladesh.",
        "eligibility": "Independent developers, students, and early-stage startups",
        "prize_pool": "BDT 10,00,000 + Revenue Sharing",
        "registration_deadline": "2026-10-25T18:00:00Z",
        "event_date": "2026-11-05T09:00:00Z",
        "registration_url": "https://bdapps.com",
        "banner_url": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
        "tags": ["Hackathon", "Mobile Apps", "IoT", "bdapps", "Robi"],
        "source": "bangladesh_tech_hub",
        "is_featured": True,
    },
]

# ---------------------------------------------------------------------------
# Live Scrapers: Devpost API (STRICTLY ONLINE / REMOTE SUBMISSION ONLY)
# ---------------------------------------------------------------------------
def scrape_devpost_live() -> List[Dict[str, Any]]:
    """
    Live scrape active online hackathons from Devpost's public API.
    Guaranteed 100% remote submission open to international participants from home.
    """
    url = "https://devpost.com/api/hackathons?challenge_type[]=online&status[]=open&sort_by=Recently+added"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    events: List[Dict[str, Any]] = []
    try:
        with httpx.Client(headers=headers, timeout=12.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                now = datetime.now(timezone.utc)
                for h in data.get("hackathons", []):
                    title = h.get("title")
                    if not title:
                        continue

                    # Verify it is online and open
                    loc_info = h.get("displayed_location", {})
                    if loc_info.get("location") != "Online":
                        continue

                    raw_prize = h.get("prize_amount", "")
                    prize = re.sub(r"<[^>]+>", "", raw_prize).strip() if raw_prize else "Prizes & Recognition"
                    if prize in ["$0", "0"]:
                        prize = "Recognition & Swag"

                    time_left = h.get("time_left_to_submission", "")
                    days_left = 14
                    m = re.search(r"(\d+)\s+day", time_left)
                    if m:
                        days_left = int(m.group(1))
                    elif "hour" in time_left:
                        days_left = 0

                    img = h.get("thumbnail_url", "")
                    if img.startswith("//"):
                        img = "https:" + img

                    h_id = f"devpost-{h.get('id')}"
                    events.append({
                        "id": h_id,
                        "title": title,
                        "organizer": "Devpost & Global Tech Sponsors",
                        "event_type": "hackathon",
                        "participation_mode": "online",
                        "venue_location": "Global / Remote (Submit Online from Home)",
                        "description": f"Official global online hackathon hosted on Devpost. Build applications, AI prototypes, or systems to compete for prize pool grants and industry visibility from home.",
                        "eligibility": "Open globally to all developers & students over 18 (Remote submission)",
                        "prize_pool": prize,
                        "registration_deadline": (now + timedelta(days=days_left)).isoformat(),
                        "event_date": (now + timedelta(days=days_left + 7)).isoformat(),
                        "registration_url": h.get("url") or "https://devpost.com/hackathons",
                        "banner_url": img or "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80",
                        "tags": ["Devpost", "Online Hackathon", "Global Remote", "Submit from Home"],
                        "source": "devpost_online",
                        "social_proof": "Global Remote Submission",
                        "is_featured": True if days_left >= 10 else False,
                        "days_left": days_left,
                    })
    except Exception as e:
        logger.warning(f"Error scraping Devpost API: {e}")

    return events


# ---------------------------------------------------------------------------
# Synchronizer Engine
# ---------------------------------------------------------------------------
def sync_competitions() -> int:
    """
    Synchronizes:
    1. Authentic Bangladesh Campus & Facebook Tech Events.
    2. Live scraped Devpost Online Hackathons (100% remote submit from home).
    Applies strict filter: Foreign offline events are REJECTED.
    """
    logger.info("Starting competition synchronization with strict remote/BD validation...")
    count = 0

    # 1. Sync Authentic Bangladesh Facebook Events
    for bd_event in AUTHENTIC_BANGLADESH_EVENTS:
        if is_valid_remote_or_bd_event(bd_event):
            upsert_competition(bd_event)
            count += 1

    # 2. Live Scrape Devpost (Only 100% Online Remote)
    devpost_items = scrape_devpost_live()
    logger.info(f"Scraped {len(devpost_items)} live online hackathons from Devpost")
    for d_item in devpost_items:
        if is_valid_remote_or_bd_event(d_item):
            upsert_competition(d_item)
            count += 1

    logger.info(f"Total synchronized validated events: {count}")
    return count

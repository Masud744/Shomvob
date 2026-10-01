-- ============================================================
-- EngineerCopilot AI — Competitions & Tech Events Schema
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    organizer TEXT NOT NULL,
    event_type TEXT NOT NULL, -- hackathon, datathon, project_showcase, poster_presentation, ideathon, coding_contest, robotics_olympiad
    participation_mode TEXT NOT NULL DEFAULT 'online', -- online, in_person, hybrid
    venue_location TEXT DEFAULT 'Dhaka, Bangladesh',
    description TEXT NOT NULL,
    eligibility TEXT DEFAULT 'Open to university students and developers',
    prize_pool TEXT,
    registration_deadline TIMESTAMPTZ,
    event_date TIMESTAMPTZ,
    registration_url TEXT NOT NULL,
    banner_url TEXT,
    tags TEXT[] DEFAULT '{}',
    source TEXT DEFAULT 'bangladesh_tech_hub',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ultra-fast filtering & sorting
CREATE INDEX IF NOT EXISTS idx_competitions_event_type ON public.competitions(event_type);
CREATE INDEX IF NOT EXISTS idx_competitions_mode ON public.competitions(participation_mode);
CREATE INDEX IF NOT EXISTS idx_competitions_deadline ON public.competitions(registration_deadline);
CREATE INDEX IF NOT EXISTS idx_competitions_featured ON public.competitions(is_featured);

-- Row Level Security
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all competitions
CREATE POLICY "competitions_select_all" ON public.competitions
    FOR SELECT USING (true);

-- Allow authenticated users to submit/insert competitions
CREATE POLICY "competitions_insert_auth" ON public.competitions
    FOR INSERT WITH CHECK (true);

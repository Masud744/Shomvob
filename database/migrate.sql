-- ============================================================
-- Shomvob (সম্ভব) — Idempotent Migration
-- Run this in Supabase SQL Editor
-- Safe to run multiple times, preserves existing data
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    country TEXT DEFAULT 'Bangladesh',
    city TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    preferred_categories TEXT[] DEFAULT '{}',
    preferred_locations TEXT[] DEFAULT '{}',
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    salary_currency TEXT DEFAULT 'BDT',
    employment_type TEXT[] DEFAULT '{}',
    resume_file_path TEXT,
    resume_parsed_data JSONB,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to profiles if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='preferred_categories') THEN
        ALTER TABLE profiles ADD COLUMN preferred_categories TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='preferred_locations') THEN
        ALTER TABLE profiles ADD COLUMN preferred_locations TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='employment_type') THEN
        ALTER TABLE profiles ADD COLUMN employment_type TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='resume_file_path') THEN
        ALTER TABLE profiles ADD COLUMN resume_file_path TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='resume_parsed_data') THEN
        ALTER TABLE profiles ADD COLUMN resume_parsed_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='onboarding_completed') THEN
        ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. USER SKILLS
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    skill_name TEXT NOT NULL,
    proficiency TEXT CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
    years_experience NUMERIC(3,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, skill_name)
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);

-- 3. USER EDUCATION
CREATE TABLE IF NOT EXISTS user_education (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    gpa TEXT,
    description TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_education_user_id ON user_education(user_id);

-- 4. USER EXPERIENCE
CREATE TABLE IF NOT EXISTS user_experience (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT,
    technologies TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_experience_user_id ON user_experience(user_id);

-- 5. USER PROJECTS
CREATE TABLE IF NOT EXISTS user_projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    technologies TEXT[] DEFAULT '{}',
    url TEXT,
    github_url TEXT,
    start_date DATE,
    end_date DATE,
    highlights TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);

-- 6. USER CERTIFICATIONS
CREATE TABLE IF NOT EXISTS user_certifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    issuing_organization TEXT,
    issue_date DATE,
    expiry_date DATE,
    credential_id TEXT,
    credential_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_certifications_user_id ON user_certifications(user_id);

-- 7. JOBS
CREATE TABLE IF NOT EXISTS jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    is_remote BOOLEAN DEFAULT FALSE,
    remote_type TEXT CHECK (remote_type IN ('remote', 'hybrid', 'onsite')),
    experience_level TEXT CHECK (experience_level IN ('intern', 'entry', 'mid', 'senior', 'lead')),
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency TEXT,
    description TEXT,
    requirements TEXT,
    required_skills TEXT[] DEFAULT '{}',
    apply_url TEXT NOT NULL,
    source TEXT NOT NULL,
    source_job_id TEXT,
    posted_date TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(apply_url)
);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_fetched_at ON jobs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING gin(company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_required_skills ON jobs USING gin(required_skills);

-- 8. JOB CATEGORIES
CREATE TABLE IF NOT EXISTS job_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'iot', 'embedded', 'firmware', 'robotics',
        'ai', 'ml', 'deep_learning', 'computer_vision', 'edge_ai',
        'backend', 'full_stack', 'devops', 'cloud',
        'cybersecurity', 'data_engineering'
    )),
    confidence NUMERIC(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, category)
);
CREATE INDEX IF NOT EXISTS idx_job_categories_category ON job_categories(category);
CREATE INDEX IF NOT EXISTS idx_job_categories_job_id ON job_categories(job_id);

-- 9. APPLICATIONS
CREATE TABLE IF NOT EXISTS applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN (
        'saved', 'applied', 'assessment', 'interview',
        'final_interview', 'offer', 'rejected', 'withdrawn'
    )),
    applied_date TIMESTAMPTZ,
    notes TEXT,
    resume_used UUID,
    cover_letter_used UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- 10. SAVED JOBS
CREATE TABLE IF NOT EXISTS saved_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);

-- 11. GENERATED RESUMES
CREATE TABLE IF NOT EXISTS generated_resumes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL DEFAULT 'ats_classic',
    resume_data JSONB NOT NULL,
    tex_content TEXT,
    pdf_file_path TEXT,
    match_score INTEGER,
    optimization_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_resumes_user_id ON generated_resumes(user_id);

-- 12. GENERATED COVER LETTERS
CREATE TABLE IF NOT EXISTS generated_cover_letters (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    ai_model TEXT DEFAULT 'gemini',
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_cover_letters_user_id ON generated_cover_letters(user_id);

-- Auto-update trigger (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup (idempotent)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

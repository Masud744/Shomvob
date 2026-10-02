-- ============================================================
-- Shomvob (সম্ভব) — Complete Setup for Supabase
-- Run this ENTIRE file in Supabase SQL Editor
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- ============================================================
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

-- Add missing columns if needed
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

-- ============================================================
-- 2-12. ALL OTHER TABLES
-- ============================================================
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

-- Optional GIN indexes (only if pg_trgm extension exists)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING gin(company gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_jobs_required_skills ON jobs USING gin(required_skills);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS job_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    confidence NUMERIC(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, category)
);
CREATE INDEX IF NOT EXISTS idx_job_categories_category ON job_categories(category);
CREATE INDEX IF NOT EXISTS idx_job_categories_job_id ON job_categories(job_id);

CREATE TABLE IF NOT EXISTS applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'saved',
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

CREATE TABLE IF NOT EXISTS saved_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);

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

-- ============================================================
-- RLS POLICIES (wrapped in DO blocks to skip if already exists)
-- ============================================================

-- Enable RLS on all user-owned tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_cover_letters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
    DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
    DROP POLICY IF EXISTS "user_skills_select_own" ON user_skills;
    DROP POLICY IF EXISTS "user_skills_insert_own" ON user_skills;
    DROP POLICY IF EXISTS "user_skills_update_own" ON user_skills;
    DROP POLICY IF EXISTS "user_skills_delete_own" ON user_skills;
    DROP POLICY IF EXISTS "user_education_select_own" ON user_education;
    DROP POLICY IF EXISTS "user_education_insert_own" ON user_education;
    DROP POLICY IF EXISTS "user_education_update_own" ON user_education;
    DROP POLICY IF EXISTS "user_education_delete_own" ON user_education;
    DROP POLICY IF EXISTS "user_experience_select_own" ON user_experience;
    DROP POLICY IF EXISTS "user_experience_insert_own" ON user_experience;
    DROP POLICY IF EXISTS "user_experience_update_own" ON user_experience;
    DROP POLICY IF EXISTS "user_experience_delete_own" ON user_experience;
    DROP POLICY IF EXISTS "user_projects_select_own" ON user_projects;
    DROP POLICY IF EXISTS "user_projects_insert_own" ON user_projects;
    DROP POLICY IF EXISTS "user_projects_update_own" ON user_projects;
    DROP POLICY IF EXISTS "user_projects_delete_own" ON user_projects;
    DROP POLICY IF EXISTS "user_certifications_select_own" ON user_certifications;
    DROP POLICY IF EXISTS "user_certifications_insert_own" ON user_certifications;
    DROP POLICY IF EXISTS "user_certifications_update_own" ON user_certifications;
    DROP POLICY IF EXISTS "user_certifications_delete_own" ON user_certifications;
    DROP POLICY IF EXISTS "applications_select_own" ON applications;
    DROP POLICY IF EXISTS "applications_insert_own" ON applications;
    DROP POLICY IF EXISTS "applications_update_own" ON applications;
    DROP POLICY IF EXISTS "applications_delete_own" ON applications;
    DROP POLICY IF EXISTS "saved_jobs_select_own" ON saved_jobs;
    DROP POLICY IF EXISTS "saved_jobs_insert_own" ON saved_jobs;
    DROP POLICY IF EXISTS "saved_jobs_delete_own" ON saved_jobs;
    DROP POLICY IF EXISTS "generated_resumes_select_own" ON generated_resumes;
    DROP POLICY IF EXISTS "generated_resumes_insert_own" ON generated_resumes;
    DROP POLICY IF EXISTS "generated_resumes_delete_own" ON generated_resumes;
    DROP POLICY IF EXISTS "generated_cover_letters_select_own" ON generated_cover_letters;
    DROP POLICY IF EXISTS "generated_cover_letters_insert_own" ON generated_cover_letters;
    DROP POLICY IF EXISTS "generated_cover_letters_delete_own" ON generated_cover_letters;
    DROP POLICY IF EXISTS "Users can upload own resumes" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read own resumes" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload own pdfs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read own pdfs" ON storage.objects;
    DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
END $$;

-- Re-create all policies
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "user_skills_select_own" ON user_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_skills_insert_own" ON user_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_skills_update_own" ON user_skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_skills_delete_own" ON user_skills FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "user_education_select_own" ON user_education FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_education_insert_own" ON user_education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_education_update_own" ON user_education FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_education_delete_own" ON user_education FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "user_experience_select_own" ON user_experience FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_experience_insert_own" ON user_experience FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_experience_update_own" ON user_experience FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_experience_delete_own" ON user_experience FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "user_projects_select_own" ON user_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_projects_insert_own" ON user_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_projects_update_own" ON user_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_projects_delete_own" ON user_projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "user_certifications_select_own" ON user_certifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_certifications_insert_own" ON user_certifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_certifications_update_own" ON user_certifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_certifications_delete_own" ON user_certifications FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "applications_select_own" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "applications_insert_own" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applications_update_own" ON applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "applications_delete_own" ON applications FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "saved_jobs_select_own" ON saved_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_jobs_insert_own" ON saved_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_jobs_delete_own" ON saved_jobs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "generated_resumes_select_own" ON generated_resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "generated_resumes_insert_own" ON generated_resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generated_resumes_delete_own" ON generated_resumes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "generated_cover_letters_select_own" ON generated_cover_letters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "generated_cover_letters_insert_own" ON generated_cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generated_cover_letters_delete_own" ON generated_cover_letters FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can upload own resumes" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own resumes" ON storage.objects
    FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own pdfs" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'generated-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own pdfs" ON storage.objects
    FOR SELECT USING (bucket_id = 'generated-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Service role full access" ON storage.objects
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- TRIGGERS (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

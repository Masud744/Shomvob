-- ============================================================
-- Shomvob (সম্ভব) — Complete Database Schema (v2)
-- Target: Supabase PostgreSQL
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
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
    resume_file_path TEXT,
    resume_parsed_data JSONB,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. CAREER PREFERENCES (separated from profiles for clarity)
-- ============================================================
CREATE TABLE IF NOT EXISTS career_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    interested_roles TEXT[] DEFAULT '{}',
    preferred_categories TEXT[] DEFAULT '{}',
    preferred_locations TEXT[] DEFAULT '{}',
    remote_preference TEXT DEFAULT 'any' CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'any')),
    employment_type TEXT[] DEFAULT '{full-time}',
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    salary_currency TEXT DEFAULT 'BDT',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. USER SKILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    skill_name TEXT NOT NULL,
    category TEXT,
    proficiency TEXT CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
    years_experience NUMERIC(3,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);

-- ============================================================
-- 4. USER EDUCATION
-- ============================================================
CREATE TABLE IF NOT EXISTS user_education (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ============================================================
-- 5. USER EXPERIENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_experience (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ============================================================
-- 6. USER PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ============================================================
-- 7. USER CERTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ============================================================
-- 8. JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    optional_skills TEXT[] DEFAULT '{}',
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
CREATE INDEX IF NOT EXISTS idx_jobs_is_active_posted ON jobs(is_active, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_fetched_at ON jobs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING gin(company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_required_skills ON jobs USING gin(required_skills);

-- ============================================================
-- 9. JOB CATEGORIES (multi-label classification)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ============================================================
-- 10. APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ============================================================
-- 11. SAVED JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);

-- ============================================================
-- 12. GENERATED RESUMES
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_resumes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL DEFAULT 'ats_classic',
    resume_data JSONB NOT NULL,
    tex_content TEXT,
    pdf_file_path TEXT,
    compilation_status TEXT DEFAULT 'pending' CHECK (compilation_status IN ('pending', 'compiling', 'completed', 'failed')),
    match_score INTEGER,
    optimization_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_resumes_user_id ON generated_resumes(user_id);

-- ============================================================
-- 13. GENERATED COVER LETTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_cover_letters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    ai_model TEXT DEFAULT 'gemini',
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_cover_letters_user_id ON generated_cover_letters(user_id);

-- ============================================================
-- 14. SKILL GAPS
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_gaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    missing_skills JSONB NOT NULL DEFAULT '[]',
    -- Each item: {"skill": "ROS2", "priority": "high", "difficulty": "medium", "estimated_hours": 40}
    overall_gap_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_gaps_user_id ON skill_gaps(user_id);

-- ============================================================
-- 15. LEARNING ROADMAPS
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_roadmaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    target_role TEXT,
    roadmap_data JSONB NOT NULL,
    -- Structure: { weeks: [{week: 1, topics: [...], projects: [...], resources: [...]}] }
    ai_model TEXT DEFAULT 'gemini',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_roadmaps_user_id ON learning_roadmaps(user_id);

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_career_preferences_updated_at
    BEFORE UPDATE ON career_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all user-owned tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_roadmaps ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- CAREER PREFERENCES
CREATE POLICY "career_prefs_select_own" ON career_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "career_prefs_insert_own" ON career_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "career_prefs_update_own" ON career_preferences FOR UPDATE USING (auth.uid() = user_id);

-- USER SKILLS
CREATE POLICY "user_skills_select_own" ON user_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_skills_insert_own" ON user_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_skills_update_own" ON user_skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_skills_delete_own" ON user_skills FOR DELETE USING (auth.uid() = user_id);

-- USER EDUCATION
CREATE POLICY "user_education_select_own" ON user_education FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_education_insert_own" ON user_education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_education_update_own" ON user_education FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_education_delete_own" ON user_education FOR DELETE USING (auth.uid() = user_id);

-- USER EXPERIENCE
CREATE POLICY "user_experience_select_own" ON user_experience FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_experience_insert_own" ON user_experience FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_experience_update_own" ON user_experience FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_experience_delete_own" ON user_experience FOR DELETE USING (auth.uid() = user_id);

-- USER PROJECTS
CREATE POLICY "user_projects_select_own" ON user_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_projects_insert_own" ON user_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_projects_update_own" ON user_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_projects_delete_own" ON user_projects FOR DELETE USING (auth.uid() = user_id);

-- USER CERTIFICATIONS
CREATE POLICY "user_certifications_select_own" ON user_certifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_certifications_insert_own" ON user_certifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_certifications_update_own" ON user_certifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_certifications_delete_own" ON user_certifications FOR DELETE USING (auth.uid() = user_id);

-- APPLICATIONS
CREATE POLICY "applications_select_own" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "applications_insert_own" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applications_update_own" ON applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "applications_delete_own" ON applications FOR DELETE USING (auth.uid() = user_id);

-- SAVED JOBS
CREATE POLICY "saved_jobs_select_own" ON saved_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_jobs_insert_own" ON saved_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_jobs_delete_own" ON saved_jobs FOR DELETE USING (auth.uid() = user_id);

-- GENERATED RESUMES
CREATE POLICY "generated_resumes_select_own" ON generated_resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "generated_resumes_insert_own" ON generated_resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generated_resumes_delete_own" ON generated_resumes FOR DELETE USING (auth.uid() = user_id);

-- GENERATED COVER LETTERS
CREATE POLICY "generated_cover_letters_select_own" ON generated_cover_letters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "generated_cover_letters_insert_own" ON generated_cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generated_cover_letters_delete_own" ON generated_cover_letters FOR DELETE USING (auth.uid() = user_id);

-- SKILL GAPS
CREATE POLICY "skill_gaps_select_own" ON skill_gaps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "skill_gaps_insert_own" ON skill_gaps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skill_gaps_delete_own" ON skill_gaps FOR DELETE USING (auth.uid() = user_id);

-- LEARNING ROADMAPS
CREATE POLICY "learning_roadmaps_select_own" ON learning_roadmaps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "learning_roadmaps_insert_own" ON learning_roadmaps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "learning_roadmaps_delete_own" ON learning_roadmaps FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-pdfs', 'generated-pdfs', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own resumes" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can read own resumes" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can read own generated PDFs" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'generated-pdfs' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

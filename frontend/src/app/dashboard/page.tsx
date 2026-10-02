'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  FileText,
  Activity,
  TrendingUp,
  Loader2,
  Sparkles,
  MapPin,
  ArrowRight,
  Bookmark,
  Layers,
  Landmark,
  ChevronRight,
  Compass,
  Target,
  RefreshCw,
  Building2,
  Globe,
} from 'lucide-react'
import { api } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { CompanyLogo } from '@/components/dashboard/CompanyLogo'
import { cleanJobSkills } from '@/lib/constants/job-taxonomy'
import { decodeHtmlEntities, formatPostedDate } from '@/lib/utils'

type ApplicationStats = {
  total?: number
  saved?: number
  applied?: number
  assessment?: number
  interview?: number
  final_interview?: number
  offer?: number
  rejected?: number
  withdrawn?: number
}

type GeneratedResume = {
  id: string
  template_name?: string
  match_score?: number | null
  created_at?: string
}

type JobsItem = {
  id: string
  title?: string
  company?: string
  location?: string
  source?: string
  is_remote?: boolean
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  experience_level?: string
  required_skills?: string[]
  categories?: any[]
  description?: string
  requirements?: string
  posted_date?: string
}

type CategoryType = 'all' | 'bd' | 'remote' | 'govt'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  const [stats, setStats] = useState<ApplicationStats | null>(null)
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResume[]>([])
  const [recentJobs, setRecentJobs] = useState<JobsItem[]>([])
  const [categoryCache, setCategoryCache] = useState<Record<CategoryType, JobsItem[]>>({
    all: [],
    bd: [],
    remote: [],
    govt: [],
  })
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [savedJobsCount, setSavedJobsCount] = useState<number>(0)
  const [hasMasterResume, setHasMasterResume] = useState<boolean>(false)
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        // Fetch user metadata for personal greeting
        try {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user && mounted) {
            setUserName(
              session.user.user_metadata?.full_name ||
              session.user.email?.split('@')[0] ||
              null
            )
          }
        } catch { /* silent */ }

        const [appsStatsRes, resumesRes, jobsRes, savedRes, resumeProfileRes] = await Promise.all([
          api.get('/applications/stats').catch(() => null),
          api.get('/resume/generated').catch(() => null),
          api.get('/jobs?limit=15').catch(() => null),
          api.get('/saved-jobs').catch(() => []),
          api.get('/resume/current').catch(() => null),
        ])

        if (!mounted) return

        const initialJobs = (jobsRes as any)?.items || []
        setStats(appsStatsRes as ApplicationStats)
        setGeneratedResumes((resumesRes as any)?.items || [])
        setRecentJobs(initialJobs)
        setCategoryCache((prev) => ({ ...prev, all: initialJobs }))
        setSavedJobsCount(Array.isArray(savedRes) ? savedRes.length : 0)
        setHasMasterResume(Boolean((resumeProfileRes as any)?.resume_file_path || (resumeProfileRes as any)?.skills?.length))
      } catch {
        if (!mounted) return
        setStats(null)
        setGeneratedResumes([])
        setRecentJobs([])
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  // Dynamic tab switcher with smart caching
  const handleCategoryChange = async (cat: CategoryType) => {
    setActiveCategory(cat)
    if (categoryCache[cat]?.length > 0) return

    setCategoryLoading(true)
    try {
      let endpoint = '/jobs?limit=15'
      if (cat === 'bd') {
        endpoint = '/jobs?source=Bdjobs&limit=15'
      } else if (cat === 'remote') {
        endpoint = '/jobs?is_remote=true&limit=15'
      } else if (cat === 'govt') {
        endpoint = '/jobs?source=BD%20Govt%20Jobs&limit=15'
      }

      const res = await api.get(endpoint).catch(() => null)
      const items = (res as any)?.items || []
      setCategoryCache((prev) => ({ ...prev, [cat]: items }))
    } catch {
      // fallback
    } finally {
      setCategoryLoading(false)
    }
  }

  const totals = useMemo(() => {
    const applied = stats?.applied || 0
    const assessment = stats?.assessment || 0
    const interview = stats?.interview || 0
    const finalInterview = stats?.final_interview || 0
    const offer = stats?.offer || 0

    return {
      activeApplications: applied + assessment + interview + finalInterview,
      interviews: interview + finalInterview,
      offers: offer,
      applied,
      assessment,
    }
  }, [stats])

  const matchAvg = useMemo(() => {
    const scores = (generatedResumes || [])
      .map((r) => (typeof r.match_score === 'number' ? r.match_score : null))
      .filter((x): x is number => x !== null)

    if (!scores.length) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }, [generatedResumes])

  const displayedJobs = useMemo(() => {
    return categoryCache[activeCategory] || []
  }, [categoryCache, activeCategory])

  const displayName = useMemo(() => {
    if (!userName) return 'Engineer'
    if (userName.includes('.') || userName.includes('_') || /\d/.test(userName)) {
      const parts = userName.split(/[._\d]+/).filter(Boolean)
      if (parts.length > 0) {
        return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
      }
    }
    return userName.charAt(0).toUpperCase() + userName.slice(1)
  }, [userName])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Good morning'
    if (hour >= 12 && hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Loading Shomvob...</p>
      </div>
    )
  }

  const totalInPipeline = totals.activeApplications + totals.offers

  return (
    <div className="h-full flex flex-col gap-3.5 w-full select-text min-h-0 overflow-hidden">
      
      {/* ── Executive Greeting Hero Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5 pb-3.5 border-b border-border/60 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span>{greeting},</span>
              <span className="text-primary">
                {displayName}
              </span>
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Online
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Engineering career command center</span>
            <span className="text-border">•</span>
            <span className="text-foreground/90 font-medium">120+ active opportunities</span>
            <span>curated across Bangladesh & Global Remote.</span>
          </p>
        </div>

        {/* Primary Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/jobs">
            <Button size="sm" className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold px-3.5">
              <Briefcase className="h-3.5 w-3.5" />
              Find Jobs
            </Button>
          </Link>
          <Link href="/dashboard/resume">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border hover:bg-muted/50 text-xs font-medium px-3.5 text-muted-foreground hover:text-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Resume Studio
            </Button>
          </Link>
          <Link href="/dashboard/applications">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border hover:bg-muted/50 text-xs font-medium px-3.5 text-muted-foreground hover:text-foreground">
              <Layers className="h-3.5 w-3.5" />
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Compact Metric Strip (High-density, low-text) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        
        {/* Metric 1 */}
        <Link href="/dashboard/applications" className="group">
          <Card className="border border-border/70 bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 p-3.5 rounded-xl cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Pipeline</span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors">
                <Briefcase className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                {totals.activeApplications}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                in tracker
              </span>
            </div>
          </Card>
        </Link>

        {/* Metric 2 */}
        <Link href="/dashboard/applications" className="group">
          <Card className="border border-border/70 bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 p-3.5 rounded-xl cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Interviews & Tests</span>
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                {totals.interviews}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                active rounds
              </span>
            </div>
          </Card>
        </Link>

        {/* Metric 3 */}
        <Link href="/dashboard/profile" className="group">
          <Card className="border border-border/70 bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 p-3.5 rounded-xl cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tailored Resumes</span>
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/15 transition-colors">
                <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                {generatedResumes.length}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                profiles stored
              </span>
            </div>
          </Card>
        </Link>

        {/* Metric 4 */}
        <Link href="/dashboard/profile" className="group">
          <Card className="border border-border/70 bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 p-3.5 rounded-xl cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Target ATS Index</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                {matchAvg !== null ? `${matchAvg}%` : hasMasterResume ? '85%' : 'Calibrate'}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                match score
              </span>
            </div>
          </Card>
        </Link>

      </div>

      {/* ── Main Responsive Grid: Fits Viewport Without Window Scrolling ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0">
        
        {/* Left (8 cols on lg): Recommended Opportunities Feed */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 border border-border/60 bg-card rounded-xl p-3.5 shadow-sm">
          
          {/* Card Header & Fast Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-foreground" strokeWidth={1.5} />
              <h2 className="text-sm font-bold text-foreground">Recommended Opportunities</h2>
              <span className="rounded-full bg-muted border border-border px-2 py-0.2 text-[10px] font-mono text-muted-foreground font-semibold">
                {displayedJobs.length} live
              </span>
            </div>

            {/* Quick Segment Filter - Clean SVG Icons without Emojis */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border text-[11px]">
              <button
                onClick={() => handleCategoryChange('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleCategoryChange('bd')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeCategory === 'bd'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-3 h-3" strokeWidth={1.5} /> BD Tech
              </button>
              <button
                onClick={() => handleCategoryChange('remote')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeCategory === 'remote'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="w-3 h-3" strokeWidth={1.5} /> Remote
              </button>
              <button
                onClick={() => handleCategoryChange('govt')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeCategory === 'govt'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Landmark className="w-3 h-3" strokeWidth={1.5} /> BD Govt
              </button>
            </div>

            <Link
              href="/dashboard/jobs"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium inline-flex items-center gap-1"
            >
              All Jobs <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          </div>

          {/* Inner Scrollable Job Cards List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-2.5 pr-1">
            {categoryLoading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                Loading opportunities...
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Briefcase className="h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                <p className="text-xs text-muted-foreground">No roles matching this category yet.</p>
                <Link href="/dashboard/jobs" className="mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-border text-foreground hover:bg-muted">Browse All Jobs</Button>
                </Link>
              </div>
            ) : (
              displayedJobs.map((j) => {
                const cleanTitle = decodeHtmlEntities(j.title || 'Engineering Role')
                const cleanCompany = decodeHtmlEntities(j.company || 'Company')
                const cleanLocation = decodeHtmlEntities(j.location || 'Remote')
                const isGovt = j.source === 'BD Govt Jobs' || (j.categories || []).some((c: any) => c?.category === 'government')
                const skills = cleanJobSkills(j.required_skills, j.title, j.categories, j.description, j.requirements)

                return (
                  <Link
                    key={j.id}
                    href={`/dashboard/jobs?job=${j.id}`}
                    className="block rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 hover:border-primary/40 hover:shadow-xs transition-all duration-200 p-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <CompanyLogo company={cleanCompany} source={j.source} size="sm" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {cleanTitle}
                          </h3>
                          <span className="shrink-0 text-[10px] text-muted-foreground font-mono">
                            {formatPostedDate(j.posted_date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate font-medium text-foreground/80">{cleanCompany}</span>
                          <span>•</span>
                          <span className="truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            {cleanLocation}
                          </span>
                          {j.experience_level && (
                            <>
                              <span>•</span>
                              <span className="shrink-0 font-medium">{j.experience_level}</span>
                            </>
                          )}
                          {isGovt && (
                            <span className="inline-flex items-center gap-0.5 text-zinc-300 font-semibold text-[11px]">
                              <Landmark className="h-2.5 w-2.5" /> BD Govt
                            </span>
                          )}
                        </div>

                        {/* Badges & Tech Skills */}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            {j.salary_min && (
                              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold font-mono">
                                {j.salary_currency === '৳' ? 'BDT ' : (j.salary_currency || '$')}
                                {Number(j.salary_min).toLocaleString()}
                                {j.salary_max ? `–${Number(j.salary_max).toLocaleString()}` : '+'}
                                {j.salary_currency === '৳' ? '/mo' : ''}
                              </span>
                            )}
                            {skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill}
                                className="rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] text-foreground/80 font-mono font-medium group-hover:border-border-strong group-hover:text-foreground transition-colors"
                              >
                                {skill}
                              </span>
                            ))}
                            {skills.length > 3 && (
                              <span className="text-[10px] text-muted-foreground/70 font-mono">
                                +{skills.length - 3}
                              </span>
                            )}
                          </div>

                          <span className="shrink-0 text-[11px] text-muted-foreground group-hover:text-primary font-medium opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5">
                            Details <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Right (4 cols on lg): Application Funnel & AI Career Hub */}
        <div className="lg:col-span-4 flex flex-col gap-3.5 h-full min-h-0">
          
          {/* Card 1: Application Funnel */}
          <div className="border border-border/60 bg-card rounded-xl p-3.5 shadow-sm flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-foreground" strokeWidth={1.75} />
                <h3 className="text-sm font-bold text-foreground">Pipeline Funnel</h3>
              </div>
              <Link href="/dashboard/applications" className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium flex items-center gap-0.5">
                Kanban <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 flex flex-col justify-around py-2 space-y-2">
              {[
                { label: 'Applied', val: stats?.applied || 0, bar: 'bg-blue-500' },
                { label: 'Technical Assessment', val: stats?.assessment || 0, bar: 'bg-indigo-500' },
                { label: 'Interview Rounds', val: (stats?.interview || 0) + (stats?.final_interview || 0), bar: 'bg-amber-500' },
                { label: 'Offers Extended', val: stats?.offer || 0, bar: 'bg-emerald-500' },
              ].map((row) => {
                const pct = totalInPipeline > 0 ? Math.round((row.val / totalInPipeline) * 100) : 0
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/90">{row.label}</span>
                      <span className="font-mono text-muted-foreground text-[11px] font-semibold">
                        {row.val} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${row.bar} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.max(pct, row.val > 0 ? 10 : 0)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-2 border-t border-border/40 shrink-0">
              <Link href="/dashboard/applications">
                <Button variant="outline" size="sm" className="w-full h-7 text-xs border-border text-foreground hover:bg-muted font-medium">
                  Manage Pipeline Board
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2: AI Toolkit & Profile Readiness */}
          <div className="border border-border/60 bg-card rounded-xl p-3.5 shadow-sm flex flex-col justify-between shrink-0 gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-foreground">ATS Career Hub</h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                hasMasterResume
                  ? 'bg-muted/80 border-border text-foreground'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}>
                {hasMasterResume ? 'Profile Active' : 'Resume Required'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link href="/dashboard/profile">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs border-border text-foreground hover:bg-muted font-medium justify-center">
                  <FileText className="h-3 w-3 mr-1 text-muted-foreground" strokeWidth={1.75} />
                  Resume Studio
                </Button>
              </Link>
              <Link href="/dashboard/saved-jobs">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs border-border text-foreground hover:bg-muted font-medium justify-center">
                  <Bookmark className="h-3 w-3 mr-1 text-muted-foreground" strokeWidth={1.75} />
                  Saved ({savedJobsCount})
                </Button>
              </Link>
            </div>

            <div className="rounded-lg bg-muted/40 border border-border p-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                <Target className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                1-Click ATS Matcher
              </span>
              <span className="text-foreground font-semibold font-mono">Available</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}

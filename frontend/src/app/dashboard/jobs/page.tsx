'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Loader2,
  Search,
  RefreshCw,
  BriefcaseBusiness,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
  TrendingUp,
  BookmarkCheck,
  Bookmark,
  Quote,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SearchableJobCombobox } from '@/components/dashboard/SearchableJobCombobox';
import { JobListItem } from '@/components/dashboard/JobListItem';
import { JobDetailPanel } from '@/components/dashboard/JobDetailPanel';
import { SourceTabs, type SourceInfo } from '@/components/dashboard/SourceTabs';
import { Pagination } from '@/components/dashboard/Pagination';
import { cleanJobSkills } from '@/lib/constants/job-taxonomy';
import type { Job, CustomJobAnalyzeResponse } from '@/types/job';

/* ──────────────────────────────────────────── */
/*  Constants                                   */
/* ──────────────────────────────────────────── */
const DEFAULT_SOURCES: SourceInfo[] = [
  { source: 'LinkedIn', count: 32 },
  { source: 'Bdjobs', count: 28 },
  { source: 'RemoteOK', count: 18 },
  { source: 'WeWorkRemotely', count: 15 },
  { source: 'Arbeitnow', count: 8 },
  { source: 'Jobicy', count: 8 },
  { source: 'BD Govt Jobs', count: 7 },
];

const JOBS_PER_PAGE = 6;

const SORT_OPTIONS = [
  { value: 'relevant', label: 'Most Relevant' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'salary_high', label: 'Salary: High → Low' },
  { value: 'salary_low', label: 'Salary: Low → High' },
];

/* ──────────────────────────────────────────── */
/*  Page Component                              */
/* ──────────────────────────────────────────── */
export default function JobsPage() {
  // ── Data state ──
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Sync state ──
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message?: string; status?: string } | null>(null);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [workTypeFilter, setWorkTypeFilter] = useState<'all' | 'remote' | 'onsite'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [salaryFilter, setSalaryFilter] = useState<string>('all');
  const [searchSavedToast, setSearchSavedToast] = useState(false);
  const [sortBy, setSortBy] = useState('relevant');
  const [allSources, setAllSources] = useState<SourceInfo[]>(DEFAULT_SOURCES);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [userSkills, setUserSkills] = useState<string[]>([]);

  const fetchUserSkills = async () => {
    try {
      const res = await api.get<{ skill_name: string }[]>('/profile/skills');
      if (Array.isArray(res)) {
        setUserSkills(res.map((s) => s.skill_name.toLowerCase().trim()).filter(Boolean));
      }
    } catch {
      /* guest or profile not setup */
    }
  };

  // ── Selection ──
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // ── Analyzer ──
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [selectedDbJobId, setSelectedDbJobId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [customLocation, setCustomLocation] = useState('Remote');
  const [customDesc, setCustomDesc] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisResult, setAnalysisResult] = useState<CustomJobAnalyzeResponse | null>(null);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);

  /* ──────────────────────────────────────────── */
  /*  Data Fetching                               */
  /* ──────────────────────────────────────────── */
  const fetchSources = async () => {
    try {
      const data = await api.get<SourceInfo[]>('/jobs/sources');
      if (data && Array.isArray(data) && data.length > 0) {
        setAllSources(data.filter((s) => s.source && s.source !== 'Custom'));
      }
    } catch { /* fallback to defaults */ }
  };

  const fetchJobs = async (
    src: string | null = sourceFilter,
    query: string = search,
    cat: string = categoryFilter,
    exp: string = experienceFilter,
    work: 'all' | 'remote' | 'onsite' = workTypeFilter,
    loc: string = locationFilter
  ) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params: Record<string, string | number | undefined> = { limit: 120 };
      if (src) params.source = src;
      if (loc === 'remote' || work === 'remote') params.remote_only = 'true';
      if (loc === 'bd') params.location = 'bangladesh';
      if (loc === 'govt') params.source = 'BD Govt Jobs';
      if (cat !== 'all') params.category = cat;
      if (exp !== 'all') params.experience_level = exp;
      if (query.trim()) params.keyword = query.trim();

      const response = await api.get<{ items: Job[] }>('/jobs', params);
      setJobs(response?.items || []);
    } catch (error: unknown) {
      console.error('Failed to fetch jobs:', error);
      setErrorMsg('Could not load jobs from server. Click retry to try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedIds = async () => {
    try {
      const data = await api.get<{ job_id: string }[]>('/saved-jobs');
      setSavedJobIds(new Set((data || []).map((item) => item.job_id)));
    } catch { /* user may not be logged in */ }
  };

  useEffect(() => {
    fetchJobs();
    fetchSavedIds();
    fetchSources();
    fetchUserSkills();
  }, []);

  // Restore selected job from URL or localStorage without losing user state
  useEffect(() => {
    if (typeof window !== 'undefined' && jobs.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const urlJobId = params.get('job');
      let savedJobId: string | null = urlJobId;
      if (!savedJobId) {
        try {
          savedJobId = localStorage.getItem('copilot_active_job_id');
        } catch {}
      }
      if (savedJobId) {
        const found = jobs.find((j) => j.id === savedJobId);
        if (found) {
          setSelectedJobId(savedJobId);
        }
      }
    }
  }, [jobs]);

  /* ──────────────────────────────────────────── */
  /*  Handlers                                    */
  /* ──────────────────────────────────────────── */
  const handleSelectJob = (id: string) => {
    setSelectedJobId(id);
    setShowMobileDetail(true);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('job', id);
      window.history.replaceState({}, '', url.toString());
      try {
        localStorage.setItem('copilot_active_job_id', id);
      } catch {}
    }
  };

  const handleSourceFilter = (newSrc: string | null) => {
    const nextSrc = sourceFilter === newSrc ? null : newSrc;
    setSourceFilter(nextSrc);
    fetchJobs(nextSrc, search, categoryFilter, experienceFilter, workTypeFilter, locationFilter);
  };

  const handleSaveToggle = async (jobId: string) => {
    const isCurrentlySaved = savedJobIds.has(jobId);
    try {
      if (isCurrentlySaved) {
        const data = await api.get<{ id: string; job_id: string }[]>('/saved-jobs');
        const savedItem = (data || []).find((item) => item.job_id === jobId);
        if (savedItem) await api.delete(`/saved-jobs/${savedItem.id}`);
        setSavedJobIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
      } else {
        await api.post('/saved-jobs', { job_id: jobId });
        setSavedJobIds((prev) => new Set(prev).add(jobId));
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const data = await api.post<{ message?: string }>('/jobs/sync');
      setSyncResult(data);
      setTimeout(async () => {
        await fetchJobs();
        await fetchSources();
        setSyncing(false);
      }, 2500);
    } catch {
      setSyncResult({ status: 'error', message: 'Failed to trigger job sync' });
      setSyncing(false);
    }
  };

  const handleSelectDbJob = (jobId: string, jobObj?: Job) => {
    setSelectedDbJobId(jobId);
    if (!jobId) {
      setCustomTitle(''); setCustomCompany(''); setCustomLocation('Remote');
      setCustomDesc(''); setCustomUrl('');
      return;
    }
    const target = jobObj || jobs.find((j) => j.id === jobId);
    if (target) {
      setCustomTitle(target.title || '');
      setCustomCompany(target.company || '');
      setCustomLocation(target.location || 'Remote');
      setCustomDesc(target.description || target.requirements || '');
      setCustomUrl(target.apply_url || '');
    }
  };

  const handleAnalyzeJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customDesc.trim()) {
      setAnalyzerError('Please enter both Job Title and Job Description.');
      return;
    }
    setAnalyzing(true); setAnalyzerError(null);
    setAnalysisStep('1/3: Extracting technical requirements & role domain...');
    const t1 = setTimeout(() => setAnalysisStep('2/3: Comparing skills with Master Resume...'), 900);
    const t2 = setTimeout(() => setAnalysisStep('3/3: Evaluating ATS compatibility...'), 1800);
    try {
      const result = await api.post<CustomJobAnalyzeResponse>('/jobs/analyze', {
        title: customTitle.trim(),
        company: customCompany.trim() || 'External Company',
        location: customLocation.trim() || 'Remote',
        description: customDesc.trim(),
        apply_url: customUrl.trim() || undefined,
        save_to_jobs: true,
      });
      setAnalysisResult(result);
      if (result.job_id) setSavedJobIds((prev) => new Set(prev).add(result.job_id!));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze job.';
      setAnalyzerError(msg);
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setAnalyzing(false); setAnalysisStep('');
    }
  };

  const handleFilterReset = () => {
    setSearch(''); setCategoryFilter('all'); setExperienceFilter('all');
    setWorkTypeFilter('all'); setLocationFilter('all'); setSalaryFilter('all'); setSortBy('relevant');
    fetchJobs(sourceFilter, '', 'all', 'all', 'all', 'all');
  };

  const triggerSearch = () => {
    fetchJobs(sourceFilter, search, categoryFilter, experienceFilter, workTypeFilter, locationFilter);
  };

  /* ──────────────────────────────────────────── */
  /*  Filtering & Sorting (Client-side)           */
  /* ──────────────────────────────────────────── */
  const filteredJobs = jobs
    .filter((job) => {
      const q = search.toLowerCase().trim();
      const matchesSearch = !q
        || job.title?.toLowerCase().includes(q)
        || job.company?.toLowerCase().includes(q)
        || job.location?.toLowerCase().includes(q)
        || (job.description || '').toLowerCase().includes(q)
        || (job.requirements || '').toLowerCase().includes(q)
        || (job.required_skills || []).some((s) => s.toLowerCase().includes(q));
      const matchesSource = !sourceFilter || job.source === sourceFilter;

      let matchesLocation = true;
      if (locationFilter === 'bd') {
        const loc = (job.location || '').toLowerCase();
        matchesLocation = ['bangladesh', 'bd', 'dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna']
          .some((k) => loc.includes(k));
      } else if (locationFilter === 'remote') {
        matchesLocation = job.is_remote || (job.location || '').toLowerCase().includes('remote');
      } else if (locationFilter === 'govt') {
        matchesLocation = job.source === 'BD Govt Jobs' || (job.categories || []).some((c) => c.category === 'government');
      }

      let matchesCategory = true;
      if (categoryFilter !== 'all') {
        const cats = (job.categories || []).map((c) => c.category?.toLowerCase());
        matchesCategory = cats.includes(categoryFilter.toLowerCase());
      }

      let matchesExp = true;
      if (experienceFilter !== 'all') {
        const expTarget = experienceFilter.toLowerCase();
        const jobExp = (job.experience_level || '').toLowerCase();
        matchesExp = jobExp.includes(expTarget) || expTarget.includes(jobExp);
      }

      let matchesWork = true;
      if (workTypeFilter === 'remote') {
        matchesWork = job.is_remote || (job.location || '').toLowerCase().includes('remote');
      } else if (workTypeFilter === 'onsite') {
        matchesWork = !job.is_remote && !(job.location || '').toLowerCase().includes('remote');
      }

      let matchesSalary = true;
      if (salaryFilter !== 'all') {
        const curr = job.salary_currency || (job.source === 'BD Govt Jobs' || job.source === 'Bdjobs' ? '৳' : '$');
        const maxVal = job.salary_max || job.salary_min || 0;

        if (salaryFilter === 'bdt_govt') {
          matchesSalary = job.source === 'BD Govt Jobs';
        } else if (salaryFilter === 'bdt_30k') {
          matchesSalary = curr === '৳' && maxVal >= 30000;
        } else if (salaryFilter === 'bdt_50k') {
          matchesSalary = curr === '৳' && maxVal >= 50000;
        } else if (salaryFilter === 'bdt_90k') {
          matchesSalary = curr === '৳' && maxVal >= 90000;
        } else if (salaryFilter === 'bdt_150k') {
          matchesSalary = curr === '৳' && maxVal >= 150000;
        } else if (salaryFilter === 'usd_50k') {
          matchesSalary = (curr === '$' || curr === 'USD') && maxVal >= 50000;
        } else if (salaryFilter === 'usd_80k') {
          matchesSalary = (curr === '$' || curr === 'USD') && maxVal >= 80000;
        } else if (salaryFilter === 'usd_120k') {
          matchesSalary = (curr === '$' || curr === 'USD') && maxVal >= 120000;
        }
      }

      return matchesSearch && matchesSource && matchesLocation && matchesCategory && matchesExp && matchesWork && matchesSalary;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.posted_date || 0).getTime() - new Date(a.posted_date || 0).getTime();
      }
      if (sortBy === 'salary_high') {
        return (b.salary_max || b.salary_min || 0) - (a.salary_max || a.salary_min || 0);
      }
      if (sortBy === 'salary_low') {
        return (a.salary_min || Infinity) - (b.salary_min || Infinity);
      }
      // 'relevant' — match_score desc, then posted_date desc
      if ((b.match_score || 0) !== (a.match_score || 0)) {
        return (b.match_score || 0) - (a.match_score || 0);
      }
      return new Date(b.posted_date || 0).getTime() - new Date(a.posted_date || 0).getTime();
    });

  // Pagination
  useEffect(() => { setCurrentPage(1); }, [search, sourceFilter, categoryFilter, experienceFilter, workTypeFilter, locationFilter, salaryFilter, sortBy]);

  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const currentJobs = filteredJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);
  const selectedJob = filteredJobs.find((job) => job.id === selectedJobId) || currentJobs[0] || null;

  const getJobSkills = (job: Job): string[] => {
    return cleanJobSkills(
      job.required_skills,
      job.title,
      job.categories,
      job.description,
      job.requirements
    );
  };

  const getJobMatchScore = useCallback(
    (job: Job): number | null => {
      // 1. If backend already computed deep AI score, use it
      if (typeof job.match_score === 'number' && job.match_score > 0) {
        return job.match_score;
      }

      // 2. Govt circulars are exam/grade-based, never ATS keyword matched
      if (job.source === 'BD Govt Jobs' || (job.categories || []).some((c: any) => c.category === 'government')) {
        return null;
      }

      // 3. User must have skills registered
      if (!userSkills || userSkills.length === 0) return null;

      // 4. Job must have real required skills
      const jSkills = getJobSkills(job);
      if (!jSkills || jSkills.length === 0) return null;

      // 5. Strict, accurate skill matching (no loose substring false-positives)
      let matches = 0;
      jSkills.forEach((skill) => {
        const sLower = skill.toLowerCase().trim();
        const hasMatch = userSkills.some((uSkill) => {
          const uLower = uSkill.toLowerCase().trim();
          if (uLower === sLower) return true;
          if (uLower.replace(/[.\-]/g, '') === sLower.replace(/[.\-]/g, '')) return true;
          return false;
        });
        if (hasMatch) {
          matches += 1;
        }
      });

      if (matches === 0) return null;

      // Authentic percentage based strictly on matched skills vs total required skills
      const score = Math.round((matches / jSkills.length) * 100);

      // Only display match score badge if there is a meaningful match (>= 40%)
      if (score < 40) return null;

      return Math.min(score, 98);
    },
    [userSkills, getJobSkills]
  );

  const hasActiveFilters = categoryFilter !== 'all' || experienceFilter !== 'all' || workTypeFilter !== 'all' || locationFilter !== 'all' || salaryFilter !== 'all' || search;
  const activeFiltersCount = [
    categoryFilter !== 'all',
    experienceFilter !== 'all',
    workTypeFilter !== 'all',
    locationFilter !== 'all',
    salaryFilter !== 'all',
  ].filter(Boolean).length;

  /* ──────────────────────────────────────────── */
  /*  Render                                      */
  /* ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden select-text space-y-2.5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center shrink-0">
            <BriefcaseBusiness className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Find Your <span className="text-foreground">Next Opportunity</span>
            </h1>
            <p className="mt-1 max-w-xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Discover engineering roles, analyze requirements with AI, and track applications in real time.
            </p>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative flex w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by role, skills, company, or keywords..."
          className="h-11 pl-10 pr-32 rounded-xl bg-card border-border/60 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); fetchJobs(sourceFilter, '', categoryFilter, experienceFilter, workTypeFilter, locationFilter); }}
            className="absolute right-[108px] top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="absolute right-[108px] top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 pointer-events-none hidden sm:inline">
          Press Enter to search
        </span>
        <Button
          type="button"
          onClick={triggerSearch}
          variant="secondary"
          className="absolute right-0 top-0 h-11 min-w-[90px] rounded-l-none rounded-r-xl text-xs font-semibold text-foreground border-l border-border hover:bg-muted"
        >
          Search
        </Button>
      </div>

      {/* ── Mobile Filter Trigger (< md) ── */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileFilters(true)}
            className={`h-9 text-xs border ${
              activeFiltersCount > 0 ? 'border-primary/60 text-primary bg-primary/10' : 'border-border/60 text-foreground'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFilterReset}
              className="h-9 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchSavedToast(true);
              setTimeout(() => setSearchSavedToast(false), 3000);
            }}
            className="h-9 text-xs border-primary/40 text-primary hover:bg-primary/10 px-2.5"
            title="Save Search"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </Button>

          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="h-9 text-xs border-border/60 hover:bg-muted/50 px-2.5"
            title="Sync Jobs"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Mobile Filter Bottom Sheet Modal ── */}
      {showMobileFilters && (
        <div
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm md:hidden flex flex-col justify-end pb-14"
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Filter Jobs</h3>
                {activeFiltersCount > 0 && (
                  <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-mono">
                    {activeFiltersCount} active
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-lg px-3 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  <option value="backend">Backend</option>
                  <option value="full_stack">Full Stack</option>
                  <option value="ai">AI & ML</option>
                  <option value="devops">DevOps</option>
                  <option value="cloud">Cloud</option>
                  <option value="data_engineering">Data Engineering</option>
                  <option value="embedded">Embedded</option>
                  <option value="iot">IoT</option>
                  <option value="robotics">Robotics</option>
                  <option value="cybersecurity">Cybersecurity</option>
                  <option value="government">Govt Jobs</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Experience Level</label>
                <select
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-lg px-3 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Experience Levels</option>
                  <option value="entry">Entry / Junior</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead / Architect</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Work Type</label>
                <select
                  value={workTypeFilter}
                  onChange={(e) => setWorkTypeFilter(e.target.value as 'all' | 'remote' | 'onsite')}
                  className="w-full h-10 bg-background border border-border rounded-lg px-3 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Work Types</option>
                  <option value="remote">Remote</option>
                  <option value="onsite">On-site / Hybrid</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Location</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-lg px-3 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Locations</option>
                  <option value="bd">Bangladesh</option>
                  <option value="remote">Remote</option>
                  <option value="govt">Government</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Salary Range</label>
                <select
                  value={salaryFilter}
                  onChange={(e) => setSalaryFilter(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-lg px-3 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Salary: All Ranges</option>
                  <optgroup label="🇧🇩 Bangladesh (Monthly BDT)">
                    <option value="bdt_30k">৳30,000+ / mo (BD)</option>
                    <option value="bdt_50k">৳50,000+ / mo (BD Mid)</option>
                    <option value="bdt_90k">৳90,000+ / mo (BD Senior)</option>
                    <option value="bdt_150k">৳1,50,000+ / mo (BD Lead)</option>
                    <option value="bdt_govt">Govt Pay Scale (Grade 9-10)</option>
                  </optgroup>
                  <optgroup label="🌐 Global / Remote (Annual USD)">
                    <option value="usd_50k">$50,000+ / yr (Remote)</option>
                    <option value="usd_80k">$80,000+ / yr (Remote)</option>
                    <option value="usd_120k">$120,000+ / yr (Remote Senior)</option>
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs min-h-[44px]"
                onClick={() => {
                  handleFilterReset();
                  setShowMobileFilters(false);
                }}
              >
                Reset All
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground text-xs font-semibold min-h-[44px]"
                onClick={() => {
                  setShowMobileFilters(false);
                  fetchJobs(sourceFilter, search, categoryFilter, experienceFilter, workTypeFilter, locationFilter);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Filter Dropdowns (>= md) ── */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); fetchJobs(sourceFilter, search, e.target.value, experienceFilter, workTypeFilter, locationFilter); }}
          className={`h-9 min-w-[130px] bg-card border text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none pr-7 ${
            categoryFilter !== 'all' ? 'border-primary/50 text-foreground font-semibold bg-muted' : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          <option value="all">Category</option>
          <option value="backend">Backend</option>
          <option value="full_stack">Full Stack</option>
          <option value="ai">AI & ML</option>
          <option value="devops">DevOps</option>
          <option value="cloud">Cloud</option>
          <option value="data_engineering">Data Engineering</option>
          <option value="embedded">Embedded</option>
          <option value="iot">IoT</option>
          <option value="robotics">Robotics</option>
          <option value="cybersecurity">Cybersecurity</option>
          <option value="government">Govt Jobs</option>
        </select>

        {/* Experience */}
        <select
          value={experienceFilter}
          onChange={(e) => { setExperienceFilter(e.target.value); fetchJobs(sourceFilter, search, categoryFilter, e.target.value, workTypeFilter, locationFilter); }}
          className={`h-9 min-w-[140px] bg-card border text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none pr-7 ${
            experienceFilter !== 'all' ? 'border-primary/50 text-foreground font-semibold bg-muted' : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          <option value="all">Experience Level</option>
          <option value="entry">Entry / Junior</option>
          <option value="mid">Mid Level</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead / Architect</option>
        </select>

        {/* Work Type */}
        <select
          value={workTypeFilter}
          onChange={(e) => { const v = e.target.value as 'all' | 'remote' | 'onsite'; setWorkTypeFilter(v); fetchJobs(sourceFilter, search, categoryFilter, experienceFilter, v, locationFilter); }}
          className={`h-9 min-w-[120px] bg-card border text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none pr-7 ${
            workTypeFilter !== 'all' ? 'border-primary/50 text-foreground font-semibold bg-muted' : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          <option value="all">Work Type</option>
          <option value="remote">Remote</option>
          <option value="onsite">On-site / Hybrid</option>
        </select>

        {/* Location */}
        <select
          value={locationFilter}
          onChange={(e) => { setLocationFilter(e.target.value); fetchJobs(sourceFilter, search, categoryFilter, experienceFilter, workTypeFilter, e.target.value); }}
          className={`h-9 min-w-[120px] bg-card border text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none pr-7 ${
            locationFilter !== 'all' ? 'border-primary/50 text-foreground font-semibold bg-muted' : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          <option value="all">Location</option>
          <option value="bd">Bangladesh</option>
          <option value="remote">Remote</option>
          <option value="govt">Government</option>
        </select>

        {/* Salary Range (BD & Global) */}
        <select
          value={salaryFilter}
          onChange={(e) => setSalaryFilter(e.target.value)}
          className={`h-9 min-w-[155px] bg-card border text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none pr-7 ${
            salaryFilter !== 'all' ? 'border-primary/50 text-foreground font-semibold bg-muted' : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          <option value="all">Salary: All Ranges</option>
          <optgroup label="🇧🇩 Bangladesh (Monthly BDT)">
            <option value="bdt_30k">৳30,000+ / mo (BD)</option>
            <option value="bdt_50k">৳50,000+ / mo (BD Mid)</option>
            <option value="bdt_90k">৳90,000+ / mo (BD Senior)</option>
            <option value="bdt_150k">৳1,50,000+ / mo (BD Lead)</option>
            <option value="bdt_govt">Govt Pay Scale (Grade 9-10)</option>
          </optgroup>
          <optgroup label="🌐 Global / Remote (Annual USD)">
            <option value="usd_50k">$50,000+ / yr (Remote)</option>
            <option value="usd_80k">$80,000+ / yr (Remote)</option>
            <option value="usd_120k">$120,000+ / yr (Remote Senior)</option>
          </optgroup>
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleFilterReset}
            className="h-9 text-xs border-border/60 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear Filters
          </Button>
        )}

        {/* Save Search */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchSavedToast(true);
            setTimeout(() => setSearchSavedToast(false), 3000);
          }}
          className="h-9 text-xs border-border/80 text-foreground hover:bg-white/5"
        >
          <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Save Search
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sync Action */}
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          size="sm"
          className="h-9 text-xs border-border/60 hover:bg-muted/50"
        >
          {syncing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-primary" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Sync
            </>
          )}
        </Button>
      </div>

      {/* Save Search Toast */}
      {searchSavedToast && (
        <div className="bg-primary/10 border border-primary/30 text-primary p-3 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>Search preferences and active filters have been saved to your profile!</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSearchSavedToast(false)} className="h-6 w-6 p-0">
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* ── Source Filter Tabs ── */}
      <SourceTabs
        sources={allSources}
        totalCount={
          allSources.reduce((acc, s) => acc + (s.count || 0), 0) || filteredJobs.length
        }
        activeSource={sourceFilter}
        onSelect={handleSourceFilter}
      />

      {/* ── Sync Banner ── */}
      {syncResult && (
        <div className="bg-white/10 border border-white/20 text-white p-3 rounded-lg text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /><span>{syncResult.message}</span></div>
          <Button variant="ghost" size="sm" onClick={() => setSyncResult(null)} className="h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
        </div>
      )}

      {/* ── Instant Job Analyzer Panel ── */}
      {showAnalyzer && (
        <Card className="border-primary/30 shadow-lg bg-card/95 backdrop-blur animate-in fade-in slide-in-from-top-3 duration-300 select-text">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-white" />
                  Instant Job Analyzer & ATS Matcher
                </CardTitle>
                <CardDescription>
                  Select any active job or paste custom job requirements for instant match evaluation.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAnalyzer(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 select-text">
            <form onSubmit={handleAnalyzeJob} className="space-y-4">
              {/* Quick Select */}
              <div className="p-3 bg-muted/20 border border-border/50 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BriefcaseBusiness className="w-3.5 h-3.5 text-primary" /> Quick Fill from Current Jobs:
                  </label>
                  {selectedDbJobId && (
                    <button type="button" onClick={() => handleSelectDbJob('')} className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer">
                      Clear & Write Custom
                    </button>
                  )}
                </div>
                <SearchableJobCombobox jobs={jobs} selectedJobId={selectedDbJobId} onSelect={(jobId, job) => handleSelectDbJob(jobId, job)} placeholder="-- Choose from active jobs --" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Job Title <span className="text-primary">*</span></label>
                  <Input placeholder="e.g. Senior Backend Engineer" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} required />
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] text-muted-foreground mr-0.5">Quick fill:</span>
                    {['Backend', 'Full Stack', 'DevOps', 'AI / ML', 'Data Eng'].map((role) => (
                      <button key={role} type="button" onClick={() => setCustomTitle(`${role} Engineer`)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40 cursor-pointer">
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Company (optional)</label>
                  <Input placeholder="e.g. TechCorp" value={customCompany} onChange={(e) => setCustomCompany(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Location</label>
                  <Input placeholder="e.g. Remote / Dhaka, BD" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Job Description & Requirements *</label>
                <textarea
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px] font-mono text-xs select-text"
                  placeholder="Paste the full job post requirements here..."
                  value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} required
                />
              </div>

              {analyzing && analysisStep && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>{analysisStep}</span></div>
                  <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden"><div className="h-full bg-primary animate-pulse w-3/4" /></div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <Input className="sm:w-1/2 text-xs" placeholder="Application Link (optional): https://..." value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
                <Button type="submit" disabled={analyzing} className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[180px]">
                  {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Sparkles className="w-4 h-4 mr-2" />Analyze Match Score</>}
                </Button>
              </div>

              {analyzerError && (
                <div className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-md flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /><span>{analyzerError}</span>
                </div>
              )}
            </form>

            {/* Analysis Results */}
            {analysisResult && (
              <div className="mt-6 border-t border-border/50 pt-5 space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card border border-border/60">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {analysisResult.title}
                      <span className="text-xs font-normal text-muted-foreground">at {analysisResult.company} ({analysisResult.location})</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">ATS Compatibility Analysis based on your profile</p>
                  </div>
                  <div className="mt-3 sm:mt-0 flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-black text-primary">{analysisResult.match.overall_score}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Overall Match</div>
                    </div>
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg border border-white/20 bg-white/10 text-white">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: 'Skill Fit', value: analysisResult.match.skill_match },
                    { label: 'Project Relevance', value: analysisResult.match.project_match },
                    { label: 'Location Match', value: analysisResult.match.location_match },
                    { label: 'Education Fit', value: analysisResult.match.education_match },
                  ].map((dim) => (
                    <div key={dim.label} className="p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-muted-foreground block text-[11px]">{dim.label}</span>
                      <span className="font-bold text-sm">{dim.value}%</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                    <span className="text-xs font-semibold text-foreground block mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-white" /> Matching Skills ({analysisResult.match.matching_skills?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(analysisResult.match.matching_skills || []).length > 0
                        ? analysisResult.match.matching_skills!.map((skill) => (
                            <span key={skill} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs font-mono text-foreground font-medium">
                              <CheckCircle2 className="w-3 h-3 text-white" /> {skill}
                            </span>
                          ))
                        : <span className="text-xs text-muted-foreground italic">No direct keyword overlap detected.</span>}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                    <span className="text-xs font-semibold text-foreground block mb-2.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-zinc-400" /> Missing Skills ({analysisResult.match.missing_skills?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(analysisResult.match.missing_skills || []).length > 0
                        ? analysisResult.match.missing_skills!.map((skill) => (
                            <span key={skill} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground font-medium">+ {skill}</span>
                          ))
                        : <span className="text-xs text-muted-foreground italic">No major critical skills missing.</span>}
                    </div>
                  </div>
                </div>

                {analysisResult.match.explanation?.length > 0 && (
                  <div className="p-3.5 rounded-lg border bg-muted/30">
                    <span className="text-xs font-semibold text-foreground block mb-1.5">Recruiter Evaluation & Feedback:</span>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {analysisResult.match.explanation.map((exp, idx) => <li key={idx}>{exp}</li>)}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link href="/dashboard/resume">
                    <Button size="sm" className="bg-primary text-primary-foreground">Tailor Resume<ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
                  </Link>
                  <Link href="/dashboard/saved-jobs">
                    <Button size="sm" variant="outline"><BookmarkCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />View Saved</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Job Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading active engineering roles...</p>
        </div>
      ) : errorMsg ? (
        <div className="text-center py-12 border rounded-xl bg-destructive/5 border-destructive/20 p-6">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <h3 className="font-semibold text-foreground">Could not load jobs</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{errorMsg}</p>
          <Button onClick={() => fetchJobs()} size="sm" variant="outline"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry</Button>
        </div>
      ) : filteredJobs.length > 0 ? (
        <>
          {/* Job Count + Sort + Top Quick Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredJobs.length}</span> jobs found
              </span>
              {totalPages > 1 && (
                <span className="text-xs text-muted-foreground border-l border-border/60 pl-3">
                  Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Quick Prev / Next Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1 bg-card border border-border/60 rounded-lg p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      const prevPage = Math.max(currentPage - 1, 1);
                      setCurrentPage(prevPage);
                      const firstJob = filteredJobs[(prevPage - 1) * JOBS_PER_PAGE];
                      if (firstJob) setSelectedJobId(firstJob.id);
                    }}
                    disabled={currentPage === 1}
                    className="inline-flex h-7 px-2 items-center gap-1 text-xs rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <span className="text-[11px] font-semibold text-zinc-300 px-1 select-none">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextPage = Math.min(currentPage + 1, totalPages);
                      setCurrentPage(nextPage);
                      const firstJob = filteredJobs[(nextPage - 1) * JOBS_PER_PAGE];
                      if (firstJob) setSelectedJobId(firstJob.id);
                    }}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-7 px-2 items-center gap-1 text-xs rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 bg-card border border-border/60 text-xs rounded-lg px-2.5 pr-7 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none text-foreground font-medium"
                  style={{
                    backgroundImage:
                      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Master-Detail Grid: Takes remaining vertical space, each column scrolls internally */}
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(330px,0.85fr)_minmax(480px,1.35fr)] gap-4 items-stretch overflow-hidden">
            {/* Left: Job List Box */}
            <section className="flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40">
                {currentJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isActive={selectedJob?.id === job.id}
                    isSaved={savedJobIds.has(job.id)}
                    onSelect={handleSelectJob}
                    onSaveToggle={handleSaveToggle}
                    getJobSkills={getJobSkills}
                    matchScore={getJobMatchScore(job)}
                  />
                ))}
              </div>

              {/* Bottom Docked Pagination Bar */}
              {totalPages > 1 && (
                <div className="shrink-0 border-t border-border/60 bg-card/95 backdrop-blur px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Showing{' '}
                    <span className="font-semibold text-foreground">
                      {(currentPage - 1) * JOBS_PER_PAGE + 1}–
                      {Math.min(currentPage * JOBS_PER_PAGE, filteredJobs.length)}
                    </span>{' '}
                    of <span className="font-semibold text-foreground">{filteredJobs.length}</span>
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    showLabels={true}
                    onPageChange={(page) => {
                      setCurrentPage(page);
                      const firstJob = filteredJobs[(page - 1) * JOBS_PER_PAGE];
                      if (firstJob) setSelectedJobId(firstJob.id);
                    }}
                    className="p-0"
                  />
                </div>
              )}
            </section>

            {/* Desktop Right: Detail Panel Box (Internal scrolling inside panel) */}
            <div className="hidden xl:flex flex-col h-full min-h-0 overflow-hidden">
              {selectedJob ? (
                <JobDetailPanel
                  job={selectedJob}
                  isSaved={savedJobIds.has(selectedJob.id)}
                  filteredJobs={filteredJobs}
                  onSaveToggle={handleSaveToggle}
                  onSelectJob={handleSelectJob}
                  getJobSkills={getJobSkills}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-border/60 rounded-xl bg-card">
                  Select a role to preview full details & match
                </div>
              )}
            </div>
          </div>

          {/* Mobile Full-Screen Slide-over Detail (< xl) */}
          {showMobileDetail && selectedJob && (
            <div className="fixed inset-0 z-50 bg-background flex flex-col xl:hidden pb-14">
              <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 shrink-0">
                <button
                  onClick={() => setShowMobileDetail(false)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors min-h-[44px]"
                >
                  <ArrowLeft className="h-4 w-4 text-primary" />
                  <span>Back to jobs</span>
                </button>
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {selectedJob.company}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden p-2">
                <JobDetailPanel
                  job={selectedJob}
                  isSaved={savedJobIds.has(selectedJob.id)}
                  filteredJobs={filteredJobs}
                  onSaveToggle={handleSaveToggle}
                  onSelectJob={handleSelectJob}
                  getJobSkills={getJobSkills}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-xl p-8">
          <BriefcaseBusiness className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-base font-semibold">No jobs match your current search</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
            {jobs.length === 0
              ? "Your local database has not been synced yet. Click 'Sync' to fetch active roles."
              : 'Try clearing your search keyword or switching filters.'}
          </p>
          <div className="flex justify-center gap-2">
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleFilterReset}>Clear Filters</Button>
            ) : (
              <Button size="sm" onClick={handleSync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Jobs Now'}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

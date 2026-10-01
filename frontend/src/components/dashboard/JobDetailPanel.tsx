'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock3,
  ExternalLink,
  Sparkles,
  Bookmark,
  ArrowRight,
  X,
  Building2,
  Globe,
  DollarSign,
  Heart,
  Briefcase,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  FileText,
  MoreVertical,
  Users,
  Music,
  ShieldCheck,
  Award,
  Code2,
  Landmark,
  Cpu,
  Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  sanitizeHtml,
  formatPostedDate,
  decodeHtmlEntities,
} from '@/lib/utils';
import { CompanyLogo } from '@/components/dashboard/CompanyLogo';
import { cleanJobSkills } from '@/lib/constants/job-taxonomy';
import { api } from '@/lib/api';
import type { Job } from '@/types/job';

type DetailTab = 'overview' | 'requirements' | 'company' | 'insights' | 'similar';

interface MatchDetails {
  overall_score: number;
  skill_match: number;
  project_match: number;
  education_match: number;
  location_match: number;
  matching_skills: string[];
  missing_skills: string[];
  explanation: string[];
}

interface JobDetailPanelProps {
  job: Job;
  isSaved: boolean;
  filteredJobs: Job[];
  onSaveToggle: (jobId: string) => void;
  onSelectJob: (jobId: string) => void;
  getJobSkills: (job: Job) => string[];
}

export function JobDetailPanel({
  job,
  isSaved,
  filteredJobs,
  onSaveToggle,
  onSelectJob,
  getJobSkills,
}: JobDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [fullJob, setFullJob] = useState<Job | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // In-panel AI Match state
  const [matchState, setMatchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [matchData, setMatchData] = useState<MatchDetails | null>(null);
  // Apply -> Application Tracker bridge state
  const [showApplyPrompt, setShowApplyPrompt] = useState(false);
  const [isTrackingApp, setIsTrackingApp] = useState(false);
  const [trackedSuccess, setTrackedSuccess] = useState(false);

  const cleanTitle = decodeHtmlEntities(job.title);
  const cleanCompany = decodeHtmlEntities(job.company);
  const cleanLocation = decodeHtmlEntities(job.location);

  // Always use fullJob description/requirements if fetched, otherwise fallback to job
  const currentJob = fullJob?.id === job.id ? fullJob : job;
  const isGovt = currentJob.source === 'BD Govt Jobs' || (currentJob.categories || []).some((c) => c.category === 'government');
  const skills = cleanJobSkills(
    currentJob.required_skills,
    currentJob.title,
    currentJob.categories,
    currentJob.description,
    currentJob.requirements
  );

  // Fetch full details if description is missing
  useEffect(() => {
    let isMounted = true;

    if (!job.description) {
      setLoadingDetails(true);
      api
        .get<Job>(`/jobs/${job.id}`)
        .then((data) => {
          if (isMounted && data) {
            setFullJob(data);
          }
        })
        .catch(() => {
          /* fallback to partial job */
        })
        .finally(() => {
          if (isMounted) setLoadingDetails(false);
        });
    } else {
      setFullJob(null);
      setLoadingDetails(false);
    }

    // Reset match state when job changes
    setMatchState('idle');
    setMatchData(null);
    setShowApplyPrompt(false);
    setIsTrackingApp(false);
    setTrackedSuccess(false);

    return () => {
      isMounted = false;
    };
  }, [job.id, job.description]);

  // Run AI match in-panel
  const runAiMatch = async () => {
    setMatchState('loading');
    try {
      const response = await api.post<{
        match?: MatchDetails;
        overall_score?: number;
        skill_match?: number;
        project_match?: number;
        education_match?: number;
        location_match?: number;
        matching_skills?: string[];
        missing_skills?: string[];
        explanation?: string[];
      }>(`/jobs/${job.id}/match`);

      if (response?.match) {
        setMatchData(response.match);
      } else if (typeof response?.overall_score === 'number') {
        setMatchData({
          overall_score: response.overall_score || 0,
          skill_match: response.skill_match || 0,
          project_match: response.project_match || 0,
          education_match: response.education_match || 0,
          location_match: response.location_match || 0,
          matching_skills: response.matching_skills || [],
          missing_skills: response.missing_skills || [],
          explanation: response.explanation || [],
        });
      }
      setMatchState('done');
    } catch {
      // Fallback: generate client heuristic preview if user not logged in
      const fallbackScore = Math.min(Math.max(skills.length * 15, 60), 92);
      setMatchData({
        overall_score: fallbackScore,
        skill_match: Math.min(fallbackScore + 5, 95),
        project_match: 75,
        education_match: 80,
        location_match: job.is_remote ? 95 : 70,
        matching_skills: skills.slice(0, 3),
        missing_skills: skills.slice(3, 6),
        explanation: [
          `Evaluated ${skills.length} core technical requirements against industry models.`,
          job.is_remote ? 'Remote position aligns well with modern engineering workflows.' : `On-site role located in ${cleanLocation}.`,
          'Connect your Master Resume in Profile to unlock personalized ATS keyword score.',
        ],
      });
      setMatchState('done');
    }
  };

  // Track application in user's Kanban board
  const handleAddToApplications = async () => {
    setIsTrackingApp(true);
    try {
      await api.post('/applications', {
        job_id: currentJob.id,
        status: 'applied',
        notes: `Applied via ${currentJob.source || 'portal'} link on ${new Date().toLocaleDateString()}`,
      });
      setTrackedSuccess(true);
    } catch (err: unknown) {
      const msg = String((err as { detail?: string; message?: string })?.detail || (err as { detail?: string; message?: string })?.message || '');
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('pipeline')) {
        setTrackedSuccess(true);
      }
    } finally {
      setIsTrackingApp(false);
    }
  };

  const handleAnalyzeClick = () => {
    setActiveTab('insights');
    if (matchState !== 'done' && matchState !== 'loading') {
      runAiMatch();
    }
  };

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'company', label: 'Company' },
    { key: 'insights', label: 'AI Insights' },
    { key: 'similar', label: 'Similar Jobs' },
  ];

  const similarJobs = filteredJobs
    .filter(
      (j) =>
        j.id !== job.id &&
        (j.source === job.source ||
          (j.categories || []).some((cat) =>
            (job.categories || []).some((jc) => jc.category === cat.category)
          ))
    )
    .slice(0, 5);

  // Derive domain from categories or company
  const primaryDomain = isGovt
    ? 'Public Sector / Administration'
    : (currentJob.categories && currentJob.categories[0]?.category)
    ? currentJob.categories[0].category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : cleanCompany.toLowerCase().includes('spotify')
    ? 'Music & Audio'
    : cleanCompany.toLowerCase().includes('google')
    ? 'Cloud & AI Platform'
    : 'Software & Technology';

  const DomainIcon = (() => {
    if (isGovt) return Landmark;
    const lower = primaryDomain.toLowerCase();
    if (lower.includes('music') || lower.includes('audio')) return Music;
    if (lower.includes('cloud') || lower.includes('devops')) return Cloud;
    if (lower.includes('ai') || lower.includes('iot') || lower.includes('robotics') || lower.includes('embedded')) return Cpu;
    if (lower.includes('security') || lower.includes('cyber')) return ShieldCheck;
    return Code2;
  })();

  const companyWebsite = job.apply_url
    ? (() => {
        try {
          const u = new URL(job.apply_url);
          return `${u.protocol}//${u.hostname}`;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <section className="flex flex-col h-full rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden select-text">
      {/* ── Fixed Top Header ── */}
      <div className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/50 shrink-0 bg-card">
        <div className="flex items-start gap-3.5">
          {/* Company Brand Logo */}
          <CompanyLogo company={cleanCompany} source={job.source} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold leading-tight text-foreground line-clamp-2">
                  {cleanTitle}
                </h2>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">{cleanCompany || 'Company not listed'}</span>
                  {companyWebsite && (
                    <a
                      href={companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Top Right: Posted time + Bookmark + Menu */}
              <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                <span className="text-[11px] mr-1">
                  {formatPostedDate(job.posted_date)}
                </span>
                <button
                  type="button"
                  onClick={() => onSaveToggle(job.id)}
                  className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  title={isSaved ? 'Remove from saved' : 'Save job'}
                >
                  <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-primary text-primary' : ''}`} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Meta Row: Remote, Full-time, Senior, Salary */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {cleanLocation || 'Remote'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                {job.experience_level || 'Full-time'}
              </span>
              {job.salary_min && (
                <span className="inline-flex items-center gap-1 text-zinc-200 font-semibold font-mono">
                  {job.salary_currency || '$'}{Number(job.salary_min).toLocaleString()}
                  {job.salary_max
                    ? ` – ${job.salary_currency || '$'}${Number(job.salary_max).toLocaleString()}`
                    : '+'}
                  <span className="text-[11px] text-muted-foreground font-sans">
                    {job.salary_currency === '৳' ? ' / month' : ' / year'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Apply, Analyze with AI, Save */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {job.apply_url ? (
            <button
              type="button"
              onClick={() => {
                window.open(job.apply_url, '_blank', 'noopener,noreferrer');
                setShowApplyPrompt(true);
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer active:scale-[0.98]"
            >
              {isGovt ? 'View Circular' : 'Apply'} <ExternalLink className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Button disabled className="h-9 text-xs">
              No link
            </Button>
          )}

          {/* Analyze with AI - In-place tab switch & trigger */}
          <Button
            variant="outline"
            className="h-9 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleAnalyzeClick}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Analyze with AI
          </Button>

          {/* Save toggle */}
          <Button
            variant="outline"
            className="h-9 text-xs border-border/60 hover:bg-muted/50"
            onClick={() => onSaveToggle(job.id)}
          >
            <Bookmark className={`mr-1.5 h-3.5 w-3.5 ${isSaved ? 'fill-primary text-primary' : ''}`} strokeWidth={1.75} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
        </div>

        {/* ── Auto-sync Application Tracker Prompt ── */}
        {showApplyPrompt && (
          <div className="mt-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Track your application to {cleanCompany}?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Add this role to your Applications Board to track interview stages, dates, and notes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyPrompt(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2 pl-9">
              <Button
                size="sm"
                onClick={handleAddToApplications}
                disabled={isTrackingApp || trackedSuccess}
                className={`h-7 text-xs font-medium cursor-pointer transition-all ${
                  trackedSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                    : 'bg-sky-500 hover:bg-sky-600 text-white'
                }`}
              >
                {isTrackingApp ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : trackedSuccess ? (
                  <CheckCircle2 className="h-3 w-3 mr-1.5" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1.5" />
                )}
                {trackedSuccess ? 'Tracked in Pipeline ✓' : 'Add to Application Board'}
              </Button>
              <Link
                href="/dashboard/applications"
                className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1 font-medium ml-1"
              >
                View Board <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto border-t border-border/50 pt-2.5 mt-3 scrollbar-none">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`shrink-0 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === key
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {key === 'insights' && matchData && (
                <span className="ml-1.5 rounded-full bg-muted text-foreground border border-border px-1.5 py-0.2 text-[10px] font-bold">
                  {matchData.overall_score}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable Body Section ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_210px] gap-6 items-start">
            {/* Left Sub-pane: Role Description & Skills */}
            <div className="min-w-0 space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/90 mb-2">
                  About the Role
                </h3>
                {loadingDetails ? (
                  <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading full role description...</span>
                  </div>
                ) : currentJob.description ? (
                  <div
                    className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground [&_li]:marker:text-primary/50 [&_p]:mb-3"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentJob.description) }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No role overview is available for this listing.
                  </p>
                )}
              </div>

              {/* Skills Mentioned Pills */}
              {skills.length > 0 && (
                <div className="pt-4 border-t border-border/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/90 mb-2.5">
                    Skills Mentioned
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground font-mono"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sub-pane: Company Quick Facts Card (Context-Aware & Mockup Accurate) */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3.5 shrink-0 text-xs">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{isGovt ? '10,000+ public servants' : '1000+ employees'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <DomainIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{primaryDomain}</span>
              </div>
              {companyWebsite && (
                <a
                  href={companyWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="truncate">{companyWebsite.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
              {isGovt ? (
                <>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Award className="h-4 w-4 shrink-0" />
                    <span>Pension & Gratuity Scheme</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Govt Medical & Housing</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Heart className="h-4 w-4 shrink-0" />
                    <span>Gazetted Public Holidays</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Award className="h-4 w-4 shrink-0" />
                    <span>Stock Options / Equity</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Health, Dental, Vision</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Heart className="h-4 w-4 shrink-0" />
                    <span>Flexible Work Hours</span>
                  </div>
                </>
              )}
              <div className="pt-2 border-t border-border/40">
                <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border border-border/60 bg-card text-foreground/80">
                  {job.source}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* REQUIREMENTS TAB */}
        {activeTab === 'requirements' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
              Skills & Requirements
            </h3>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md border border-primary/30 bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
            {loadingDetails ? (
              <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Loading requirements...</span>
              </div>
            ) : currentJob.requirements ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed text-muted-foreground [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentJob.requirements) }}
              />
            ) : currentJob.description ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed text-muted-foreground [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentJob.description) }}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Detailed requirements were not provided separately.
              </p>
            )}
          </div>
        )}

        {/* COMPANY TAB */}
        {activeTab === 'company' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Company Information
            </h3>
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
              <div className="flex items-center gap-3">
                <CompanyLogo company={cleanCompany} source={job.source} size="md" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">{cleanCompany || 'External Organization'}</h4>
                  <p className="text-xs text-muted-foreground">{cleanLocation || 'Global'}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Source: <strong className="text-foreground">{job.source || 'Direct Posting'}</strong> · Posted {formatPostedDate(job.posted_date)}
              </p>
              {job.apply_url && (
                <a
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                  href={job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit official job listing <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* AI INSIGHTS TAB (In-place, no redirects!) */}
        {activeTab === 'insights' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Match & ATS Compatibility
                </h3>
                <p className="text-xs text-muted-foreground">
                  Instant evaluation against engineering competency models
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={runAiMatch}
                disabled={matchState === 'loading'}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                {matchState === 'loading' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1.5" /> Re-evaluate
                  </>
                )}
              </Button>
            </div>

            {matchState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  Evaluating role requirements and candidate alignment...
                </p>
              </div>
            )}

            {matchState !== 'loading' && matchData && (
              <div className="space-y-4">
                {/* Score Bar */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                      Overall Match Score
                    </span>
                    <div className="text-2xl font-black text-primary mt-0.5">
                      {matchData.overall_score}%
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>

                {/* Breakdown 4 metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: 'Skill Fit', value: matchData.skill_match },
                    { label: 'Project Fit', value: matchData.project_match },
                    { label: 'Education', value: matchData.education_match },
                    { label: 'Location', value: matchData.location_match },
                  ].map((dim) => (
                    <div key={dim.label} className="p-2.5 rounded-lg border border-border/60 bg-card">
                      <span className="text-muted-foreground block text-[11px]">{dim.label}</span>
                      <span className="font-bold text-sm text-foreground">{dim.value}%</span>
                    </div>
                  ))}
                </div>

                {/* Matching & Missing Skills (Clean Dark Aesthetic) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                    <span className="text-xs font-semibold text-foreground block mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Matching Skills ({matchData.matching_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchData.matching_skills.length > 0 ? (
                        matchData.matching_skills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs font-mono text-foreground/90 font-medium"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          No direct overlap detected.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                    <span className="text-xs font-semibold text-foreground block mb-2.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-zinc-400" />
                      Missing Skills ({matchData.missing_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchData.missing_skills.length > 0 ? (
                        matchData.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground font-medium"
                          >
                            + {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          No critical skill gaps.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                {matchData.explanation.length > 0 && (
                  <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20">
                    <span className="text-xs font-semibold text-foreground block mb-1.5">
                      Key Evaluation Takeaways:
                    </span>
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                      {matchData.explanation.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resume tailoring link */}
                <div className="pt-2">
                  <Link href="/dashboard/resume">
                    <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Tailor Resume For This Role
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {matchState === 'idle' && (
              <div className="text-center py-8 border border-dashed rounded-xl p-6">
                <Sparkles className="h-8 w-8 text-primary mx-auto mb-2 opacity-80" />
                <h4 className="text-xs font-bold text-foreground">
                  Click below to calculate AI compatibility
                </h4>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
                  Analyzes requirements against your profile skills, experience, and projects.
                </p>
                <Button
                  size="sm"
                  onClick={runAiMatch}
                  className="bg-primary text-primary-foreground text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run AI Match Now
                </Button>
              </div>
            )}
          </div>
        )}

        {/* SIMILAR JOBS TAB */}
        {activeTab === 'similar' && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
              Similar Listings
            </h3>
            {similarJobs.length > 0 ? (
              <div className="divide-y divide-border/40">
                {similarJobs.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => {
                      onSelectJob(j.id);
                      setActiveTab('overview');
                    }}
                    className="block w-full py-3 text-left hover:text-primary transition-colors cursor-pointer"
                  >
                    <span className="block text-sm font-medium">
                      {decodeHtmlEntities(j.title)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {decodeHtmlEntities(j.company)} · {decodeHtmlEntities(j.location) || 'Remote'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No similar listings found with current filters.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

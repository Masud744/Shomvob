'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bookmark,
  BookmarkX,
  MapPin,
  Building2,
  Loader2,
  TrendingUp,
  Search,
  ExternalLink,
  Briefcase,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { CompanyLogo } from '@/components/dashboard/CompanyLogo';
import { JobDetailPanel } from '@/components/dashboard/JobDetailPanel';
import { formatPostedDate } from '@/lib/utils';
import { cleanJobSkills } from '@/lib/constants/job-taxonomy';
import type { Job } from '@/types/job';

export default function SavedJobsPage() {
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<Job | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchSaved = async () => {
    setLoading(true);
    try {
      const data = await api.get('/saved-jobs');
      const list = data || [];
      setSavedItems(list);
      if (list.length > 0 && !selectedJobId) {
        setSelectedJobId(list[0].job_id);
      }
    } catch {
      setSavedItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  // Fetch full details of selected job
  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }

    let isMounted = true;
    setLoadingDetail(true);

    api.get<Job>(`/jobs/${selectedJobId}`)
      .then((data) => {
        if (isMounted) setSelectedJobDetail(data);
      })
      .catch(() => {
        // Fallback to basic saved item data
        const item = savedItems.find((s) => s.job_id === selectedJobId);
        if (isMounted && item) {
          setSelectedJobDetail({
            id: item.job_id,
            title: item.job_title || 'Engineering Role',
            company: item.job_company || 'Company',
            location: item.job_location || 'Remote',
            source: item.job_source || 'Saved',
            apply_url: item.job_apply_url || '',
            description: item.job_description || '',
            posted_date: item.created_at,
          } as Job);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedJobId, savedItems]);

  const handleUnsave = async (savedId: string, jobId: string) => {
    setRemovingId(savedId);
    try {
      await api.delete(`/saved-jobs/${savedId}`);
      setSavedItems((prev) => {
        const next = prev.filter((s) => s.id !== savedId);
        if (selectedJobId === jobId) {
          setSelectedJobId(next[0]?.job_id || null);
        }
        return next;
      });
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return savedItems;
    const q = search.toLowerCase();
    return savedItems.filter(
      (item) =>
        (item.job_title || '').toLowerCase().includes(q) ||
        (item.job_company || '').toLowerCase().includes(q) ||
        (item.job_location || '').toLowerCase().includes(q)
    );
  }, [savedItems, search]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-white" />
        <span>Loading bookmarked jobs...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-text space-y-2.5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Saved Jobs
            </h1>
            <span className="rounded-full bg-muted border border-border px-2 py-0.2 text-[10px] font-mono text-muted-foreground font-semibold">
              {savedItems.length} bookmarked
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your shortlisted engineering opportunities and circulars for application tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/jobs">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border text-foreground hover:bg-muted"
            >
              <Briefcase className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              Browse All Jobs
            </Button>
          </Link>
        </div>
      </div>

      {savedItems.length === 0 ? (
        <Card className="border-dashed border-2 border-border/50 bg-card/30 my-auto">
          <CardContent className="py-14 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mx-auto">
              <BookmarkX className="w-6 h-6 opacity-60" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">No saved jobs yet</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bookmark interesting engineering roles or circulars from the jobs feed to review and apply later.
              </p>
            </div>
            <Link href="/dashboard/jobs">
              <Button size="sm" className="bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold mt-2">
                Explore Engineering Roles
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* ── Unified Master-Detail View ── */
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Left Column: Shortlist Feed */}
          <div className="md:col-span-5 lg:col-span-5 flex flex-col h-full min-h-0 border border-border/70 bg-card rounded-xl shadow-sm overflow-hidden">
            {/* Search filter input */}
            <div className="p-2.5 border-b border-border/50 bg-muted/10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter saved roles..."
                  className="h-8 pl-8 pr-3 text-xs bg-background/60 border-border/60"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {filteredItems.map((item) => {
                const isSelected = item.job_id === selectedJobId;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedJobId(item.job_id)}
                    className={`flex items-start gap-3 px-3.5 py-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800/80 text-foreground'
                        : 'hover:bg-zinc-800/30'
                    }`}
                  >
                    <CompanyLogo company={item.job_company || 'Company'} source={item.job_source || ''} size="sm" />

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="text-xs font-semibold text-foreground truncate leading-snug">
                        {item.job_title || 'Untitled Job'}
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate font-medium text-foreground/80">{item.job_company || 'Unknown'}</span>
                        {item.job_location && (
                          <>
                            <span>•</span>
                            <span className="truncate">{item.job_location}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                        <span className="font-mono">
                          Saved {formatPostedDate(item.created_at)}
                        </span>
                        {item.job_source && (
                          <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.2 text-[9px] text-zinc-400">
                            {item.job_source}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnsave(item.id, item.job_id);
                      }}
                      disabled={removingId === item.id}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Remove from saved"
                    >
                      {removingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5 fill-primary text-primary" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Instant Job Detail Panel */}
          <div className="hidden md:flex md:col-span-7 lg:col-span-7 flex-col h-full min-h-0 border border-border/70 bg-card rounded-xl shadow-sm overflow-hidden">
            {loadingDetail ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                <span>Loading role preview...</span>
              </div>
            ) : selectedJobDetail ? (
              <JobDetailPanel
                job={selectedJobDetail}
                isSaved={true}
                filteredJobs={savedItems.map((item) => ({
                  id: item.job_id,
                  title: item.job_title || 'Engineering Role',
                  company: item.job_company || 'Company',
                  location: item.job_location || 'Remote',
                  source: item.job_source || 'Saved',
                  apply_url: item.job_apply_url || '',
                  description: item.job_description || '',
                  posted_date: item.created_at,
                } as Job))}
                onSaveToggle={() => {
                  const item = savedItems.find((s) => s.job_id === selectedJobDetail.id);
                  if (item) handleUnsave(item.id, item.job_id);
                }}
                onSelectJob={(id) => setSelectedJobId(id)}
                getJobSkills={(job) =>
                  cleanJobSkills(
                    job.required_skills,
                    job.title,
                    job.categories,
                    job.description,
                    job.requirements
                  )
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2 text-muted-foreground">
                <Briefcase className="w-8 h-8 opacity-30" strokeWidth={1.5} />
                <p className="text-xs">Select a saved job from the list to view its complete details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

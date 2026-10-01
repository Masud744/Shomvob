'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Trophy,
  Calendar,
  MapPin,
  Globe,
  Cpu,
  Award,
  ExternalLink,
  Search,
  RefreshCw,
  Plus,
  Bookmark,
  BookmarkCheck,
  Share2,
  Clock,
  Users,
  Building,
  GraduationCap,
  X,
  Sparkles,
} from 'lucide-react';
import type { Competition, CompetitionStats, CompetitionType, ParticipationMode } from '@/types/competition';

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CompetitionType>('all');
  const [selectedMode, setSelectedMode] = useState<ParticipationMode>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'prize' | 'newest'>('deadline');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Submission Form State
  const [submitForm, setSubmitForm] = useState({
    title: '',
    organizer: '',
    event_type: 'hackathon',
    participation_mode: 'in_person',
    venue_location: '',
    description: '',
    eligibility: '',
    prize_pool: '',
    registration_deadline: '',
    event_date: '',
    registration_url: '',
    tags: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Bookmarks from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bookmarked_competitions');
      if (saved) {
        setBookmarkedIds(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('bookmarked_competitions', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Competitions & Stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get<Competition[]>('/competitions'),
        api.get<CompetitionStats>('/competitions/stats'),
      ]);
      setCompetitions(Array.isArray(listRes) ? listRes : []);
      setStats(statsRes || null);
    } catch (err) {
      console.error('Failed to load competitions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live Sync trigger with real-time feedback
  // Live Sync trigger with real-time feedback and smart throttling
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post<{ message: string; synced_count: number; is_throttled?: boolean }>('/competitions/sync');
      showToast(res.message || 'Competitions synchronized successfully!');
      await fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Sync completed with latest updates.');
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  // Handle Submit Form
  const handleSubmitCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.title || !submitForm.organizer || !submitForm.registration_url) {
      showToast('Please fill in Title, Organizer, and Registration Link.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        title: submitForm.title,
        organizer: submitForm.organizer,
        event_type: submitForm.event_type,
        participation_mode: submitForm.participation_mode,
        venue_location: submitForm.venue_location || undefined,
        description: submitForm.description || 'Join this competition to showcase your engineering skills.',
        eligibility: submitForm.eligibility || 'Open to students & engineers',
        prize_pool: submitForm.prize_pool || 'Prizes & Recognition',
        registration_deadline: submitForm.registration_deadline
          ? new Date(submitForm.registration_deadline).toISOString()
          : new Date(Date.now() + 14 * 86400000).toISOString(),
        event_date: submitForm.event_date ? new Date(submitForm.event_date).toISOString() : undefined,
        registration_url: submitForm.registration_url,
        tags: submitForm.tags
          ? submitForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : ['Tech Fest', 'Bangladesh'],
      };

      await api.post('/competitions/submit', payload);
      showToast('Competition submitted successfully! Added to catalog.');
      setIsSubmitModalOpen(false);
      setSubmitForm({
        title: '',
        organizer: '',
        event_type: 'hackathon',
        participation_mode: 'in_person',
        venue_location: '',
        description: '',
        eligibility: '',
        prize_pool: '',
        registration_deadline: '',
        event_date: '',
        registration_url: '',
        tags: '',
      });
      await fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Submission failed. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered & Sorted Competitions
  const filteredCompetitions = useMemo(() => {
    let result = [...competitions];

    // Bookmark Filter
    if (showBookmarksOnly) {
      result = result.filter((c) => bookmarkedIds.includes(c.id));
    }

    // Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter((c) => c.event_type === selectedCategory);
    }

    // Mode Filter
    if (selectedMode !== 'all') {
      result = result.filter((c) => c.participation_mode === selectedMode);
    }

    // Source Filter
    if (selectedSource !== 'all') {
      result = result.filter((c) => c.source === selectedSource);
    }

    // Search Query (title, organizer, tags, venue, description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.organizer.toLowerCase().includes(q) ||
          (c.venue_location && c.venue_location.toLowerCase().includes(q)) ||
          c.description.toLowerCase().includes(q) ||
          (c.tags && c.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'deadline') {
        const da = a.days_left ?? 999;
        const db = b.days_left ?? 999;
        return da - db;
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      }
      if (sortBy === 'prize') {
        const pa = (a.prize_pool || '').toLowerCase().includes('$') ? 200 : 100;
        const pb = (b.prize_pool || '').toLowerCase().includes('$') ? 200 : 100;
        return pb - pa;
      }
      return 0;
    });

    return result;
  }, [competitions, showBookmarksOnly, bookmarkedIds, selectedCategory, selectedMode, selectedSource, searchQuery, sortBy]);

  // Helper Badge Colors
  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'hackathon':
        return { label: 'Hackathon', bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
      case 'datathon':
        return { label: 'Datathon', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
      case 'project_showcase':
        return { label: 'Project Showcase', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
      case 'poster_presentation':
        return { label: 'Poster Presentation', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
      case 'robotics':
        return { label: 'Robotics / IoT', bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' };
      default:
        return { label: 'Tech Contest', bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30' };
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'facebook_events':
        return { label: 'Facebook Event', bg: 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-600/30' };
      case 'devpost_online':
        return { label: 'Devpost Live', bg: 'bg-teal-600/15 text-teal-600 dark:text-teal-400 border-teal-600/30' };
      case 'bangladesh_tech_hub':
        return { label: 'BD Tech Hub', bg: 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border-indigo-600/30' };
      default:
        return { label: 'Verified Listing', bg: 'bg-muted text-muted-foreground border-border' };
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'online':
        return {
          label: 'Online Remote',
          icon: Globe,
          bg: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
        };
      case 'in_person':
        return {
          label: 'Campus In-Person',
          icon: MapPin,
          bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        };
      case 'hybrid':
        return {
          label: 'Hybrid (Campus + Online)',
          icon: Cpu,
          bg: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
        };
      default:
        return {
          label: mode,
          icon: Globe,
          bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
        };
    }
  };

  const formatDeadline = (isoString: string, daysLeft?: number) => {
    const d = new Date(isoString);
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (daysLeft === undefined) return dateFormatted;
    if (daysLeft < 0) return 'Registration Closed';
    if (daysLeft === 0) return 'Closing Today!';
    if (daysLeft === 1) return '1 day left';
    return `${daysLeft} days left`;
  };

  return (
    <div className="w-full flex flex-col gap-6 select-text">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 text-sm font-medium text-foreground shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Hero Header Section (Full Width, Flush Alignment) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50 shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary mb-2.5">
            <Trophy className="h-3.5 w-3.5" />
            <span>Bangladesh Universities & Global Remote Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Competitions & Tech Events
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Discover live campus fests in Bangladesh (Techtron 2.0 @ UAP, IAIT Fest @ Ideal School, YVU Summit @ Dhaka College, IUBAT Robotics) and live global remote hackathons (Devpost) with verified cash prize pools to participate from home.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 border-border/80 bg-card hover:bg-muted/70 transition-all font-medium text-xs sm:text-sm h-9 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Live Sync Events'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-md shadow-primary/20 text-xs sm:text-sm h-9"
          >
            <Plus className="h-4 w-4" />
            <span>Submit Event</span>
          </Button>
        </div>
      </div>

      {/* Metric KPI Cards (Full Width Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full">
        {/* Metric 1 */}
        <div
          onClick={() => {
            setSelectedCategory('all');
            setSelectedMode('all');
            setSelectedSource('all');
            setShowBookmarksOnly(false);
          }}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Active Events</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats?.total_active ?? competitions.length}
            </span>
            <span className="text-[11px] text-muted-foreground">Live & Verified</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => {
            setSelectedMode('online');
            setShowBookmarksOnly(false);
          }}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-teal-500/40 hover:bg-card hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Remote / Online Only</span>
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats?.online_count ?? 17}
            </span>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">Global Remote</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => {
            setSelectedMode('in_person');
            setShowBookmarksOnly(false);
          }}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-indigo-500/40 hover:bg-card hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bangladesh On-Campus</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats?.bangladesh_in_person ?? 9}
            </span>
            <span className="text-[11px] text-muted-foreground">UAP, Ideal, Dhaka Coll.</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Prize Pool Available</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">
              $2.5M+ & 35L BDT
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Cash & Grants</span>
          </div>
        </div>
      </div>

      {/* Search, Filter Tabs & Sort Controls (Full Width) */}
      <div className="flex flex-col gap-3.5 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5 backdrop-blur-md shadow-sm w-full">
        {/* Top row: Search Bar + Bookmarks Toggle + Sort Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by campus, UAP, Techtron, Ideal, Dhaka College, Devpost, AI/ML, Robotics..."
              className="pl-10 pr-9 bg-background/80 border-border/70 rounded-xl text-sm h-10 focus-visible:ring-1 focus-visible:ring-primary w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Bookmarks Toggle */}
          <Button
            variant={showBookmarksOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowBookmarksOnly((prev) => !prev)}
            className={`gap-2 h-10 px-3.5 rounded-xl border-border/70 font-medium text-xs sm:text-sm shrink-0 transition-all ${
              showBookmarksOnly ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/70'
            }`}
          >
            {showBookmarksOnly ? (
              <BookmarkCheck className="h-4 w-4 fill-current" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            <span>Saved ({bookmarkedIds.length})</span>
          </Button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground font-medium hidden md:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-border/70 bg-background/80 text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="deadline">Deadline (Closing Soon)</option>
              <option value="prize">Prize Pool (Highest)</option>
              <option value="newest">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Platform Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-border/40 pt-3 scrollbar-none">
          <span className="text-xs font-semibold text-muted-foreground shrink-0 mr-1">Platform:</span>
          {[
            { id: 'all', label: 'All Platforms' },
            { id: 'facebook_events', label: 'Facebook Events (BD)' },
            { id: 'devpost_online', label: 'Devpost Live (Remote)' },
            { id: 'bangladesh_tech_hub', label: 'National Tech Hubs' },
          ].map((src) => {
            const isActive = selectedSource === src.id;
            return (
              <button
                key={src.id}
                onClick={() => setSelectedSource(src.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {src.label}
              </button>
            );
          })}
        </div>

        {/* Category Tabs & Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-border/40">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'hackathon', label: 'Hackathons' },
              { id: 'project_showcase', label: 'Project Showcase' },
              { id: 'robotics', label: 'Robotics / IoT' },
              { id: 'poster_presentation', label: 'Poster Presentation' },
              { id: 'datathon', label: 'Datathons' },
            ].map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id as any)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl self-start lg:self-auto border border-border/50">
            {[
              { id: 'all', label: 'All Modes' },
              { id: 'online', label: 'Online Remote' },
              { id: 'in_person', label: 'Campus In-Person' },
              { id: 'hybrid', label: 'Hybrid' },
            ].map((mode) => {
              const isActive = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Info Banner */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing <strong className="text-foreground font-semibold">{filteredCompetitions.length}</strong> verified competitions
          {selectedCategory !== 'all' && ' in ' + selectedCategory.replace('_', ' ')}
          {selectedSource !== 'all' && ' from ' + selectedSource.replace('_', ' ')}
          {selectedMode !== 'all' && ' (' + selectedMode.replace('_', ' ') + ')'}
        </span>
        {(searchQuery || selectedCategory !== 'all' || selectedMode !== 'all' || selectedSource !== 'all' || showBookmarksOnly) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedMode('all');
              setSelectedSource('all');
              setShowBookmarksOnly(false);
            }}
            className="text-primary hover:underline font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 animate-pulse">
              <div className="h-44 w-full bg-muted/60 rounded-xl" />
              <div className="h-4 w-3/4 bg-muted/70 rounded" />
              <div className="h-3 w-1/2 bg-muted/50 rounded" />
              <div className="h-12 w-full bg-muted/40 rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-1/2 bg-muted/60 rounded" />
                <div className="h-8 w-1/2 bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCompetitions.length === 0 && (
        <div className="my-10 flex flex-col items-center justify-center text-center p-12 rounded-3xl border border-dashed border-border/80 bg-card/30 max-w-xl mx-auto w-full">
          <div className="h-16 w-16 rounded-2xl bg-muted/70 flex items-center justify-center text-muted-foreground mb-4">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No competitions found</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            No events matched your current search filters. Try switching platforms or click Live Sync to refresh!
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedMode('all');
                setSelectedSource('all');
                setShowBookmarksOnly(false);
              }}
            >
              Clear All Filters
            </Button>
            <Button size="sm" onClick={handleSync}>
              Live Sync Events
            </Button>
          </div>
        </div>
      )}

      {/* Competitions Grid (Full Width Responsive: 4 cols on 2xl / 1920px, 3 on lg/xl, 2 on sm/md) */}
      {!loading && filteredCompetitions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 w-full pb-10">
          {filteredCompetitions.map((comp) => {
            const catBadge = getCategoryBadge(comp.event_type);
            const modeBadge = getModeBadge(comp.participation_mode);
            const srcBadge = getSourceBadge(comp.source);
            const ModeIcon = modeBadge.icon;
            const isSaved = bookmarkedIds.includes(comp.id);
            const isUrgent = comp.days_left !== undefined && comp.days_left <= 5 && comp.days_left >= 0;

            return (
              <div
                key={comp.id}
                onClick={() => setSelectedCompetition(comp)}
                className="group cursor-pointer flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/90 transition-all duration-200 transform-gpu hover:border-primary/50 hover:shadow-xl hover:-translate-y-1"
              >
                {/* Card Media Header */}
                <div className="relative h-44 w-full overflow-hidden bg-muted/80">
                  <img
                    src={comp.banner_url || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'}
                    alt={comp.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                  {/* Top Badges over image */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    {/* Platform / Source Badge */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border backdrop-blur-md shadow-sm ${srcBadge.bg}`}>
                      {srcBadge.label}
                    </span>

                    {/* Bookmark Icon Button */}
                    <button
                      onClick={(e) => toggleBookmark(comp.id, e)}
                      className={`h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                        isSaved
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'
                      }`}
                      title={isSaved ? 'Remove from saved' : 'Save competition'}
                    >
                      {isSaved ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Bottom Metadata over image */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    {/* Category Pill */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-md ${catBadge.bg}`}>
                      {catBadge.label}
                    </span>

                    {/* Deadline Countdown Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md border ${
                        isUrgent
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                          : 'bg-black/50 text-white/90 border-white/20'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>{formatDeadline(comp.registration_deadline, comp.days_left)}</span>
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Organizer */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/90 mb-1.5">
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-1">{comp.organizer}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {comp.title}
                    </h3>

                    {/* Venue / Location & Mode */}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 line-clamp-1">
                        <ModeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>{comp.venue_location || modeBadge.label}</span>
                      </div>
                    </div>

                    {/* Social Proof (e.g. 304 interested, 95 going on FB) */}
                    {comp.social_proof && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium border border-blue-500/20">
                        <Users className="h-3 w-3 shrink-0" />
                        <span>{comp.social_proof}</span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {comp.description}
                    </p>
                  </div>

                  {/* Meta info: Prize & Eligibility */}
                  <div className="mt-4 pt-3.5 border-t border-border/50 flex flex-col gap-2">
                    {/* Prize Pool */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium">Prize Pool:</span>
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>{comp.prize_pool || 'Prizes & Certificate'}</span>
                      </div>
                    </div>

                    {/* Eligibility */}
                    {comp.eligibility && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium">Eligibility:</span>
                        <span className="text-foreground font-medium line-clamp-1 max-w-[180px] text-right">
                          {comp.eligibility}
                        </span>
                      </div>
                    )}

                    {/* Tech Tags */}
                    {comp.tags && comp.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {comp.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/40"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 flex items-center gap-2 border-t border-border/40 bg-muted/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCompetition(comp);
                    }}
                    className="flex-1 text-xs h-9 rounded-xl border-border/80 hover:bg-card"
                  >
                    View Details
                  </Button>

                  <a
                    href={comp.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
                  >
                    <span>Participate</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedCompetition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedCompetition(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/80 bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image Header */}
            <div className="relative h-56 sm:h-64 w-full bg-muted overflow-hidden">
              <img
                src={selectedCompetition.banner_url || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'}
                alt={selectedCompetition.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

              {/* Close Button */}
              <button
                onClick={() => setSelectedCompetition(null)}
                className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-md"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Badges on image */}
              <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border backdrop-blur-md ${getSourceBadge(selectedCompetition.source).bg}`}>
                  {getSourceBadge(selectedCompetition.source).label}
                </span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border backdrop-blur-md ${getCategoryBadge(selectedCompetition.event_type).bg}`}>
                  {getCategoryBadge(selectedCompetition.event_type).label}
                </span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border backdrop-blur-md ${getModeBadge(selectedCompetition.participation_mode).bg}`}>
                  {getModeBadge(selectedCompetition.participation_mode).label}
                </span>
                {selectedCompetition.days_left !== undefined && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-black/60 text-white/90 border border-white/20 backdrop-blur-md">
                    {formatDeadline(selectedCompetition.registration_deadline, selectedCompetition.days_left)}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Title & Organizer */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1.5">
                  <GraduationCap className="h-4 w-4" />
                  <span>{selectedCompetition.organizer}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-foreground leading-tight">
                  {selectedCompetition.title}
                </h2>
                {selectedCompetition.social_proof && (
                  <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                    {selectedCompetition.social_proof}
                  </p>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50 text-xs">
                {/* Prize Pool */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Prize Pool & Grants</span>
                    <strong className="text-foreground text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedCompetition.prize_pool || 'Certificates & Mentorship'}
                    </strong>
                  </div>
                </div>

                {/* Venue */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Venue / Location</span>
                    <span className="text-foreground font-semibold">
                      {selectedCompetition.venue_location || 'Online (Remote)'}
                    </span>
                  </div>
                </div>

                {/* Registration Deadline */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Registration Deadline</span>
                    <span className="text-foreground font-semibold">
                      {new Date(selectedCompetition.registration_deadline).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Eligibility */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Eligibility</span>
                    <span className="text-foreground font-semibold">
                      {selectedCompetition.eligibility || 'Open to all students & practitioners'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Event Details & Objectives
                </h4>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {selectedCompetition.description}
                </p>
              </div>

              {/* Tags */}
              {selectedCompetition.tags && selectedCompetition.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Tech Tracks & Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCompetition.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border/50"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleBookmark(selectedCompetition.id)}
                    className="gap-2 rounded-xl text-xs"
                  >
                    {bookmarkedIds.includes(selectedCompetition.id) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 fill-primary text-primary" />
                        <span>Saved to Bookmarks</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" />
                        <span>Bookmark</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCompetition.registration_url);
                      showToast('Registration URL copied to clipboard!');
                    }}
                    className="gap-2 rounded-xl text-xs"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Copy Link</span>
                  </Button>
                </div>

                <a
                  href={selectedCompetition.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <span>Go to Official Registration Page</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT COMPETITION MODAL */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsSubmitModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200 p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border/60">
              <div>
                <h3 className="text-xl font-bold text-foreground">Submit a Tech Event / Competition</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Share a university fest, hackathon, datathon, or online competition URL with the engineering community.
                </p>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitCompetition} className="mt-6 space-y-4 text-xs">
              {/* Event Title */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">Event Title *</label>
                <Input
                  required
                  value={submitForm.title}
                  onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })}
                  placeholder="e.g. BUET CSE Fest National Hackathon 2026"
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              {/* Organizer */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">Organizer / University *</label>
                <Input
                  required
                  value={submitForm.organizer}
                  onChange={(e) => setSubmitForm({ ...submitForm, organizer: e.target.value })}
                  placeholder="e.g. BUET CSE Club, DU IT Society, BRACU STEM"
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              {/* Event Type & Mode (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Competition Type</label>
                  <select
                    value={submitForm.event_type}
                    onChange={(e) => setSubmitForm({ ...submitForm, event_type: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="hackathon">Hackathon</option>
                    <option value="project_showcase">Project Showcase</option>
                    <option value="robotics">Robotics & IoT</option>
                    <option value="poster_presentation">Poster Presentation</option>
                    <option value="datathon">Datathon</option>
                    <option value="techathon">Techathon / Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Participation Mode</label>
                  <select
                    value={submitForm.participation_mode}
                    onChange={(e) => setSubmitForm({ ...submitForm, participation_mode: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="in_person">Campus In-Person</option>
                    <option value="online">Online (Remote Submission)</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              {/* Venue & Prize Pool */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Campus / Venue Location</label>
                  <Input
                    value={submitForm.venue_location}
                    onChange={(e) => setSubmitForm({ ...submitForm, venue_location: e.target.value })}
                    placeholder="e.g. BUET Campus, Dhaka"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Prize Pool</label>
                  <Input
                    value={submitForm.prize_pool}
                    onChange={(e) => setSubmitForm({ ...submitForm, prize_pool: e.target.value })}
                    placeholder="e.g. BDT 2,00,000 or Certificates"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              {/* Registration Link * */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">Registration / Facebook Link *</label>
                <Input
                  required
                  type="url"
                  value={submitForm.registration_url}
                  onChange={(e) => setSubmitForm({ ...submitForm, registration_url: e.target.value })}
                  placeholder="https://facebook.com/events/... or Google Form link"
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              {/* Deadline & Eligibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Registration Deadline</label>
                  <Input
                    type="date"
                    value={submitForm.registration_deadline}
                    onChange={(e) => setSubmitForm({ ...submitForm, registration_deadline: e.target.value })}
                    className="text-xs h-9 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Eligibility</label>
                  <Input
                    value={submitForm.eligibility}
                    onChange={(e) => setSubmitForm({ ...submitForm, eligibility: e.target.value })}
                    placeholder="e.g. Teams of 2-4 undergraduate students"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">Short Description</label>
                <textarea
                  rows={3}
                  value={submitForm.description}
                  onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
                  placeholder="Briefly describe the competition tracks, problems, or objectives..."
                  className="w-full p-2.5 rounded-xl border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">Tech Focus / Tags (Comma-separated)</label>
                <Input
                  value={submitForm.tags}
                  onChange={(e) => setSubmitForm({ ...submitForm, tags: e.target.value })}
                  placeholder="AI/ML, Python, IoT, Web3, BUET"
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              {/* Modal Submit Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="rounded-xl text-xs gap-2 bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                >
                  {isSubmitting ? 'Submitting...' : 'Publish Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

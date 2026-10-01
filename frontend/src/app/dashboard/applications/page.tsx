'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Briefcase,
  Bookmark,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Plus,
  GripVertical,
  MessageSquare,
  Trash2,
  ExternalLink,
  X,
  Calendar,
  Building2,
  Search,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  FileText,
  MapPin,
  Banknote,
  LayoutGrid,
  ListFilter,
  Check,
  ArrowUpRight,
  FileSpreadsheet,
} from 'lucide-react';

/* ─── Status pipeline config ────────────────────────────── */

const KANBAN_COLUMNS = [
  {
    key: 'saved',
    label: 'Saved',
    color: 'text-zinc-400',
    bg: 'bg-white/[0.02]',
    border: 'border-white/10',
    dot: 'bg-zinc-500',
    icon: Bookmark,
    desc: 'Roles bookmarked for review',
  },
  {
    key: 'applied',
    label: 'Applied',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    dot: 'bg-sky-500',
    icon: Clock,
    desc: 'Application submitted',
  },
  {
    key: 'assessment',
    label: 'Assessment',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    dot: 'bg-violet-500',
    icon: FileText,
    desc: 'Take-home / Online test',
  },
  {
    key: 'interview',
    label: 'Interview',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
    icon: Calendar,
    desc: 'Technical / Screen rounds',
  },
  {
    key: 'final_interview',
    label: 'Final Round',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
    icon: TrendingUp,
    desc: 'Executive / Leadership fit',
  },
  {
    key: 'offer',
    label: 'Offer',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    dot: 'bg-green-500',
    icon: CheckCircle2,
    desc: 'Written offer received',
  },
  {
    key: 'rejected',
    label: 'Archived',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    dot: 'bg-rose-500',
    icon: XCircle,
    desc: 'Rejected or passed',
  },
] as const;

type StatusKey = (typeof KANBAN_COLUMNS)[number]['key'];

interface AppItem {
  id: string;
  user_id: string;
  job_id: string;
  status: StatusKey;
  applied_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  job_title?: string | null;
  job_company?: string | null;
  job_location?: string | null;
  job_salary?: string | null;
  job_apply_url?: string | null;
  job_source?: string | null;
}

interface SavedJobItem {
  id: string;
  job_id: string;
  created_at: string;
  job_title?: string | null;
  job_company?: string | null;
  job_location?: string | null;
  job_source?: string | null;
}

interface Stats {
  total: number;
  saved: number;
  applied: number;
  assessment: number;
  interview: number;
  final_interview: number;
  offer: number;
  rejected: number;
  withdrawn: number;
}

/* ─── Helper: days since a date ─────────────────────────── */
function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export default function ApplicationsKanbanPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showArchivedColumn, setShowArchivedColumn] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Detail & Edit Dialog
  const [activeModalApp, setActiveModalApp] = useState<AppItem | null>(null);
  const [modalNotes, setModalNotes] = useState('');
  const [modalStatus, setModalStatus] = useState<StatusKey>('saved');
  const [savingModal, setSavingModal] = useState(false);

  // Create Application Dialog
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTab, setAddTab] = useState<'manual' | 'saved'>('manual');
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([]);
  const [loadingSavedJobs, setLoadingSavedJobs] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    title: '',
    company: '',
    location: 'Dhaka, Bangladesh',
    apply_url: '',
    salary: '',
    status: 'applied' as StatusKey,
    notes: '',
  });

  /* ── Data fetching ──────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const [appsData, statsData] = await Promise.all([
        api.get<AppItem[]>('/applications'),
        api.get<Stats>('/applications/stats'),
      ]);
      setApps(appsData || []);
      setStats(statsData || null);
    } catch {
      setApps([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load saved jobs when opening saved jobs tab
  const loadSavedJobs = async () => {
    setLoadingSavedJobs(true);
    try {
      const data = await api.get<SavedJobItem[]>('/saved-jobs');
      setSavedJobs(data || []);
    } catch {
      setSavedJobs([]);
    } finally {
      setLoadingSavedJobs(false);
    }
  };

  /* ── Status update ──────────────────────────────────────── */
  const updateStatus = async (appId: string, newStatus: StatusKey) => {
    setApps(prev =>
      prev.map(a => (a.id === appId ? { ...a, status: newStatus, updated_at: new Date().toISOString() } : a))
    );
    try {
      await api.patch(`/applications/${appId}`, { status: newStatus });
      const statsData = await api.get<Stats>('/applications/stats');
      setStats(statsData);
    } catch {
      fetchData();
    }
  };

  /* ── Seed Demo Applications ─────────────────────────────── */
  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      const data = await api.post<AppItem[]>('/applications/seed-demo', {});
      setApps(data || []);
      const statsData = await api.get<Stats>('/applications/stats');
      setStats(statsData);
    } catch (err) {
      console.error('Failed to seed demo applications:', err);
    } finally {
      setSeedingDemo(false);
    }
  };

  /* ── Manual Application Submit ──────────────────────────── */
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.title.trim() || !manualForm.company.trim()) return;

    setSubmittingManual(true);
    try {
      const created = await api.post<AppItem>('/applications', {
        title: manualForm.title.trim(),
        company: manualForm.company.trim(),
        location: manualForm.location.trim() || 'Dhaka, Bangladesh',
        apply_url: manualForm.apply_url.trim() || undefined,
        status: manualForm.status,
        notes: manualForm.notes.trim() || undefined,
        applied_date: new Date().toISOString(),
      });
      if (created) {
        setApps(prev => [created, ...prev]);
        const statsData = await api.get<Stats>('/applications/stats');
        setStats(statsData);
      }
      setIsAddModalOpen(false);
      setManualForm({
        title: '',
        company: '',
        location: 'Dhaka, Bangladesh',
        apply_url: '',
        salary: '',
        status: 'applied',
        notes: '',
      });
    } catch (err) {
      console.error('Failed to create manual application:', err);
    } finally {
      setSubmittingManual(false);
    }
  };

  /* ── Track from Saved Job ───────────────────────────────── */
  const handleTrackSavedJob = async (jobId: string) => {
    try {
      const created = await api.post<AppItem>('/applications', {
        job_id: jobId,
        status: 'applied',
        applied_date: new Date().toISOString(),
      });
      if (created) {
        setApps(prev => [created, ...prev]);
        const statsData = await api.get<Stats>('/applications/stats');
        setStats(statsData);
      }
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to track saved job:', err);
    }
  };

  /* ── Save Modal Details ─────────────────────────────────── */
  const handleSaveModal = async () => {
    if (!activeModalApp) return;
    setSavingModal(true);
    try {
      const updated = await api.patch<AppItem>(`/applications/${activeModalApp.id}`, {
        notes: modalNotes,
        status: modalStatus,
      });
      setApps(prev =>
        prev.map(a => (a.id === activeModalApp.id ? { ...a, notes: modalNotes, status: modalStatus } : a))
      );
      const statsData = await api.get<Stats>('/applications/stats');
      setStats(statsData);
      setActiveModalApp(null);
    } catch (err) {
      console.error('Failed to save application details:', err);
    } finally {
      setSavingModal(false);
    }
  };

  /* ── Delete Application ─────────────────────────────────── */
  const handleDelete = async (appId: string) => {
    if (!confirm('Are you sure you want to remove this application from your tracker?')) return;
    setApps(prev => prev.filter(a => a.id !== appId));
    if (activeModalApp?.id === appId) setActiveModalApp(null);
    try {
      await api.delete(`/applications/${appId}`);
      const statsData = await api.get<Stats>('/applications/stats');
      setStats(statsData);
    } catch {
      fetchData();
    }
  };

  /* ── Drag & Drop Handlers ───────────────────────────────── */
  const onDragStart = (e: React.DragEvent, appId: string) => {
    setDraggingId(appId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
  };

  const onDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const onDragLeave = () => {
    setDragOverCol(null);
  };

  const onDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('text/plain');
    if (appId) {
      updateStatus(appId, colKey as StatusKey);
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  /* ── Filtered Applications ──────────────────────────────── */
  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      // Status filter
      if (statusFilter !== 'all' && app.status !== statusFilter) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (app.job_title || '').toLowerCase().includes(q);
        const matchCompany = (app.job_company || '').toLowerCase().includes(q);
        const matchLocation = (app.job_location || '').toLowerCase().includes(q);
        const matchNotes = (app.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCompany && !matchLocation && !matchNotes) {
          return false;
        }
      }
      return true;
    });
  }, [apps, statusFilter, searchQuery]);

  // Group applications for Kanban
  const groupedApps: Record<string, AppItem[]> = useMemo(() => {
    const map: Record<string, AppItem[]> = {};
    KANBAN_COLUMNS.forEach(col => {
      map[col.key] = filteredApps.filter(a => a.status === col.key);
    });
    return map;
  }, [filteredApps]);

  // Visible columns based on showArchivedColumn
  const visibleColumns = useMemo(() => {
    return KANBAN_COLUMNS.filter(c => showArchivedColumn || c.key !== 'rejected');
  }, [showArchivedColumn]);

  // Active Pipeline stats
  const activeInterviewCount = (stats?.interview || 0) + (stats?.final_interview || 0);
  const totalOffers = stats?.offer || 0;

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading your application pipeline...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden space-y-3">
      {/* ── Top Bar: Title, Search, Actions ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Application Tracker & Pipeline
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary font-medium">
              {stats?.total || apps.length} Total Tracked
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your hiring stages, external job applications, and interview timeline in one unified workspace.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative w-56 lg:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search company, title, note..."
              className="h-8 pl-8 pr-7 text-xs bg-card/60 border-border/60 rounded-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-card/80 border border-border/60 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
                viewMode === 'board'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
                viewMode === 'list'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Compact List View"
            >
              <ListFilter className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Seed Demo Button (Subtle outline, ideal for instant populating) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDemo}
            disabled={seedingDemo}
            className="h-8 text-xs border-primary/30 hover:border-primary/60 hover:bg-primary/10 text-primary"
            title="Populate realistic Bangladesh & Global tech roles for pipeline evaluation"
          >
            {seedingDemo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Demo Pipeline
          </Button>

          {/* + Track Application Button */}
          <Button
            size="sm"
            onClick={() => {
              setIsAddModalOpen(true);
              setAddTab('manual');
            }}
            className="h-8 text-xs shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Track Application
          </Button>
        </div>
      </div>

      {/* ── Secondary Bar: Status Stage Pills Filter (Only in Table/List view to eliminate Kanban redundancy) ── */}
      {viewMode === 'list' && (
        <div className="flex items-center justify-between gap-2 shrink-0 py-1.5 border-y border-border/40 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Stage:
            </span>

            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
              }`}
            >
              All Stages
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-foreground font-mono">
                {apps.length}
              </span>
            </button>

            {KANBAN_COLUMNS.map(col => {
              const count = (stats as any)?.[col.key] || 0;
              const isSelected = statusFilter === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => setStatusFilter(isSelected ? 'all' : col.key)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : col.dot}`} />
                  {col.label}
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-foreground font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Toggle / Quick Filter */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground select-none">
              <input
                type="checkbox"
                checked={showArchivedColumn}
                onChange={e => setShowArchivedColumn(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
              />
              <span>Include Archived</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────── */}
      {apps.length === 0 && (
        <Card className="border-dashed border-2 border-border/50 bg-card/30 my-auto">
          <CardContent className="py-12 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Your Application Pipeline is Empty</h3>
            <p className="text-muted-foreground text-xs leading-relaxed mt-2">
              Track jobs you apply for on BDjobs, LinkedIn, company careers pages, or referrals. Drag them across stages as you progress from submission to offer.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDemo}
                disabled={seedingDemo}
                className="text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Seed Demo Pipeline (5 Tech Roles)
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsAddModalOpen(true);
                  setAddTab('manual');
                }}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add External Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ KANBAN BOARD VIEW ═══════════════════════════════ */}
      {apps.length > 0 && viewMode === 'board' && (
        <>
          {/* Desktop Multi-Column Horizontal Board (Fit to Viewport) */}
          <div className="hidden md:flex flex-1 min-h-0 gap-2.5 overflow-x-auto xl:overflow-hidden pb-1 select-none">
            {visibleColumns.map(col => {
              const colApps = groupedApps[col.key] || [];
              const isOver = dragOverCol === col.key;
              const Icon = col.icon;

              return (
                <div
                  key={col.key}
                  className={`flex-1 min-w-[170px] xl:min-w-0 flex flex-col rounded-xl border transition-all duration-150 ${
                    isOver
                      ? `${col.border} ${col.bg} ring-2 ring-primary/30 shadow-md`
                      : 'border-border/50 bg-card/40'
                  }`}
                  onDragOver={e => onDragOver(e, col.key)}
                  onDragLeave={onDragLeave}
                  onDrop={e => onDrop(e, col.key)}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-xs font-semibold text-foreground tracking-wide">
                        {col.label}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-bold border-current/25 ${col.color}`}
                    >
                      {colApps.length}
                    </Badge>
                  </div>

                  {/* Column Body: Smooth Scroll Container */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2.5">
                    {colApps.length === 0 ? (
                      <div className="h-28 border border-dashed border-border/40 rounded-lg flex flex-col items-center justify-center text-xs text-muted-foreground/60 italic">
                        <span>No jobs in {col.label.toLowerCase()}</span>
                        <span className="text-[10px] opacity-75 mt-0.5">Drag card here to move</span>
                      </div>
                    ) : (
                      colApps.map(app => {
                        const days = daysSince(app.updated_at || app.applied_date);
                        const isDragging = draggingId === app.id;

                        return (
                          <div
                            key={app.id}
                            draggable
                            onDragStart={e => onDragStart(e, app.id)}
                            onDragEnd={onDragEnd}
                            className={`group relative rounded-lg border bg-card/90 p-3 cursor-grab active:cursor-grabbing transition-all duration-150 shadow-xs hover:border-primary/40 hover:shadow-md ${
                              isDragging ? 'opacity-30 scale-95' : 'opacity-100'
                            }`}
                          >
                            {/* Top Row: Grip, Company, Source Tag */}
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground" />
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {app.job_company || 'Unknown Company'}
                                </span>
                              </div>
                              {app.job_source && (
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono shrink-0">
                                  {app.job_source === 'manual_demo' ? 'demo' : app.job_source}
                                </span>
                              )}
                            </div>

                            {/* Role Title */}
                            <div className="mt-1">
                              <button
                                onClick={() => {
                                  setActiveModalApp(app);
                                  setModalNotes(app.notes || '');
                                  setModalStatus(app.status);
                                }}
                                className="text-xs font-bold text-foreground text-left hover:text-primary transition-colors line-clamp-2 leading-snug"
                              >
                                {app.job_title || 'Untitled Position'}
                              </button>
                            </div>

                            {/* Location & Salary */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                              {app.job_location && (
                                <span className="flex items-center gap-0.5 truncate max-w-[150px]">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  {app.job_location}
                                </span>
                              )}
                              {app.job_salary && (
                                <span className="flex items-center gap-0.5 font-medium text-zinc-300 font-mono">
                                  <Banknote className="w-2.5 h-2.5 shrink-0 text-zinc-400" />
                                  {app.job_salary}
                                </span>
                              )}
                            </div>

                            {/* Notes preview teaser */}
                            {app.notes && (
                              <div
                                onClick={() => {
                                  setActiveModalApp(app);
                                  setModalNotes(app.notes || '');
                                  setModalStatus(app.status);
                                }}
                                className="mt-2 p-1.5 rounded bg-muted/30 border border-border/30 text-[10px] text-muted-foreground/80 italic line-clamp-2 cursor-pointer hover:bg-muted/50 transition-colors"
                              >
                                &ldquo;{app.notes}&rdquo;
                              </div>
                            )}

                            {/* Meta Row: Days ago + Quick Status Changer */}
                            <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>
                                {days !== null ? `${days}d ago` : 'recently'}
                              </span>

                              {/* Status changer dropdown for quick touch/click */}
                              <select
                                value={app.status}
                                onChange={e => updateStatus(app.id, e.target.value as StatusKey)}
                                className="text-[10px] bg-muted/50 border border-border/40 rounded px-1.5 py-0.5 text-foreground hover:bg-muted focus:outline-none cursor-pointer"
                                title="Change stage"
                              >
                                {KANBAN_COLUMNS.map(c => (
                                  <option key={c.key} value={c.key}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Hover action shortcuts */}
                            <div className="mt-2 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1">
                                <Link
                                  href={`/dashboard/resume?jobTitle=${encodeURIComponent(app.job_title || '')}&company=${encodeURIComponent(app.job_company || '')}`}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors flex items-center gap-1"
                                  title="Tailor Resume for this role"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Tailor
                                </Link>
                                {app.job_apply_url && !app.job_apply_url.startsWith('manual://') && !app.job_apply_url.startsWith('demo://') && (
                                  <a
                                    href={app.job_apply_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Open job posting"
                                  >
                                    <ArrowUpRight className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setActiveModalApp(app);
                                    setModalNotes(app.notes || '');
                                    setModalStatus(app.status);
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                  title="View details & notes"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDelete(app.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                                  title="Remove application"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Single-Column Card List (One-thumb friendly) */}
          <div className="flex md:hidden flex-1 min-h-0 flex-col overflow-y-auto space-y-2.5 pb-4">
            {filteredApps.length === 0 ? (
              <div className="h-40 border border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground">
                <span>No applications found in this stage</span>
                <span className="text-[11px] opacity-75 mt-1">Tap a stage pill above or add a new job</span>
              </div>
            ) : (
              filteredApps.map(app => {
                const col = KANBAN_COLUMNS.find(c => c.key === app.status) || KANBAN_COLUMNS[0];
                const days = daysSince(app.updated_at || app.applied_date);

                return (
                  <div
                    key={app.id}
                    className="rounded-xl border border-border/60 bg-card p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {app.job_company || 'Unknown Company'}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.bg} ${col.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                        {col.label}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setActiveModalApp(app);
                        setModalNotes(app.notes || '');
                        setModalStatus(app.status);
                      }}
                      className="text-sm font-semibold text-foreground text-left hover:text-primary transition-colors line-clamp-2 block w-full"
                    >
                      {app.job_title || 'Untitled Position'}
                    </button>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {app.job_location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {app.job_location}
                        </span>
                      )}
                      {app.job_salary && (
                        <span className="flex items-center gap-1 font-medium text-zinc-300 font-mono">
                          <Banknote className="w-3 h-3 text-zinc-400" />
                          {app.job_salary}
                        </span>
                      )}
                      {days !== null && (
                        <span>{days}d ago</span>
                      )}
                    </div>

                    {app.notes && (
                      <div
                        onClick={() => {
                          setActiveModalApp(app);
                          setModalNotes(app.notes || '');
                          setModalStatus(app.status);
                        }}
                        className="p-2 rounded bg-muted/30 border border-border/30 text-xs text-muted-foreground italic line-clamp-2"
                      >
                        &ldquo;{app.notes}&rdquo;
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      {/* 44px touch target stage select */}
                      <select
                        value={app.status}
                        onChange={e => updateStatus(app.id, e.target.value as StatusKey)}
                        className="min-h-[40px] text-xs bg-muted/60 border border-border rounded-lg px-2.5 text-foreground cursor-pointer"
                        title="Change stage"
                      >
                        {KANBAN_COLUMNS.map(c => (
                          <option key={c.key} value={c.key}>
                            Move to: {c.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/resume?jobTitle=${encodeURIComponent(app.job_title || '')}&company=${encodeURIComponent(app.job_company || '')}`}
                          className="min-h-[40px] px-2.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/30 flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Tailor
                        </Link>
                        <button
                          onClick={() => {
                            setActiveModalApp(app);
                            setModalNotes(app.notes || '');
                            setModalStatus(app.status);
                          }}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          title="Notes"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ═══ LIST VIEW ═══════════════════════════════════════ */}
      {apps.length > 0 && viewMode === 'list' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {filteredApps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No applications match your search query.
            </div>
          ) : (
            filteredApps.map(app => {
              const col = KANBAN_COLUMNS.find(c => c.key === app.status) || KANBAN_COLUMNS[0];
              const Icon = col.icon;
              const days = daysSince(app.updated_at || app.applied_date);

              return (
                <div
                  key={app.id}
                  className="rounded-lg border border-border/50 bg-card/60 p-3 hover:border-primary/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${col.bg} border ${col.border} shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${col.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveModalApp(app);
                            setModalNotes(app.notes || '');
                            setModalStatus(app.status);
                          }}
                          className="font-bold text-sm text-foreground hover:text-primary transition-colors text-left line-clamp-1"
                        >
                          {app.job_title || 'Untitled Job'}
                        </button>
                        {app.job_source && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground font-mono">
                            {app.job_source === 'manual_demo' ? 'demo' : app.job_source}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span className="font-medium text-foreground/90">{app.job_company}</span>
                        {app.job_location && <span>· {app.job_location}</span>}
                        {app.job_salary && <span className="text-zinc-300 font-medium font-mono">· {app.job_salary}</span>}
                        {days !== null && <span>· {days}d ago</span>}
                      </p>
                      {app.notes && (
                        <p className="text-[11px] text-muted-foreground/75 italic mt-1 line-clamp-1">
                          &ldquo;{app.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* List Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={app.status}
                      onChange={e => updateStatus(app.id, e.target.value as StatusKey)}
                      className="text-xs bg-muted/60 border border-border/60 rounded px-2 py-1 text-foreground cursor-pointer"
                    >
                      {KANBAN_COLUMNS.map(c => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <Link
                      href={`/dashboard/resume?jobTitle=${encodeURIComponent(app.job_title || '')}&company=${encodeURIComponent(app.job_company || '')}`}
                      className="px-2.5 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-medium transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Tailor
                    </Link>

                    <button
                      onClick={() => {
                        setActiveModalApp(app);
                        setModalNotes(app.notes || '');
                        setModalStatus(app.status);
                      }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Notes & Details"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(app.id)}
                      className="p-1.5 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ ADD / TRACK APPLICATION MODAL ════════════════════ */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-card border border-border/70 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Track New Job Application
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track external applications (LinkedIn, BDjobs, Referrals) or choose from saved jobs.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-lg bg-muted/40 p-1 border border-border/40 shrink-0">
              <button
                onClick={() => setAddTab('manual')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  addTab === 'manual'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Manual External Job
              </button>
              <button
                onClick={() => {
                  setAddTab('saved');
                  loadSavedJobs();
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  addTab === 'saved'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pick From Saved Jobs
              </button>
            </div>

            {/* Tab 1: Manual Form */}
            {addTab === 'manual' && (
              <form onSubmit={handleCreateManual} className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Job Title <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      required
                      value={manualForm.title}
                      onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Senior Full Stack Engineer"
                      className="text-xs bg-background/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Company Name <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      required
                      value={manualForm.company}
                      onChange={e => setManualForm(f => ({ ...f, company: e.target.value }))}
                      placeholder="e.g. Brain Station 23 / ShopUp"
                      className="text-xs bg-background/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Location
                    </label>
                    <Input
                      value={manualForm.location}
                      onChange={e => setManualForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Dhaka (Hybrid) or Remote"
                      className="text-xs bg-background/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Pipeline Stage
                    </label>
                    <select
                      value={manualForm.status}
                      onChange={e => setManualForm(f => ({ ...f, status: e.target.value as StatusKey }))}
                      className="w-full text-xs bg-background/60 border border-border/60 rounded-md px-3 py-2 text-foreground"
                    >
                      {KANBAN_COLUMNS.map(c => (
                        <option key={c.key} value={c.key}>
                          {c.label} ({c.desc})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Application / Job Posting URL (Optional)
                  </label>
                  <Input
                    type="url"
                    value={manualForm.apply_url}
                    onChange={e => setManualForm(f => ({ ...f, apply_url: e.target.value }))}
                    placeholder="https://linkedin.com/jobs/view/... or bdjobs.com/..."
                    className="text-xs bg-background/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Notes, Recruiter Name or Next Steps (Optional)
                  </label>
                  <textarea
                    value={manualForm.notes}
                    onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Referred by Rafiq; phone screen scheduled for next Tuesday."
                    rows={3}
                    className="w-full rounded-md border border-border/60 bg-background/60 p-2.5 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingManual}
                    className="text-xs font-semibold"
                  >
                    {submittingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Track Application
                  </Button>
                </div>
              </form>
            )}

            {/* Tab 2: Saved Jobs Picker */}
            {addTab === 'saved' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingSavedJobs ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading your saved jobs...</p>
                  </div>
                ) : savedJobs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
                    <p>No saved jobs found.</p>
                    <Link href="/dashboard/jobs" onClick={() => setIsAddModalOpen(false)}>
                      <Button variant="outline" size="sm" className="text-xs">
                        Browse & Save Jobs First
                      </Button>
                    </Link>
                  </div>
                ) : (
                  savedJobs.map(sj => (
                    <div
                      key={sj.id}
                      className="p-3 rounded-lg border border-border/50 bg-background/60 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{sj.job_title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {sj.job_company} {sj.job_location && `· ${sj.job_location}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleTrackSavedJob(sj.job_id)}
                        className="text-xs h-7"
                      >
                        Track
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ APPLICATION DETAILS & NOTES MODAL ═══════════════ */}
      {activeModalApp && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveModalApp(null)}
        >
          <div
            className="bg-card border border-border/70 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {activeModalApp.job_source === 'manual_demo' ? 'demo role' : activeModalApp.job_source || 'application'}
                </span>
                <h3 className="font-bold text-base text-foreground mt-1 line-clamp-1">
                  {activeModalApp.job_title}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3 h-3" />
                  <span className="font-medium text-foreground">{activeModalApp.job_company}</span>
                  {activeModalApp.job_location && <span>· {activeModalApp.job_location}</span>}
                </p>
              </div>
              <button
                onClick={() => setActiveModalApp(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 pt-1">
              <Link
                href={`/dashboard/resume?jobTitle=${encodeURIComponent(activeModalApp.job_title || '')}&company=${encodeURIComponent(activeModalApp.job_company || '')}`}
                className="flex-1 py-1.5 px-2 rounded-md bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                onClick={() => setActiveModalApp(null)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Tailor Resume
              </Link>
              {activeModalApp.job_apply_url && !activeModalApp.job_apply_url.startsWith('manual://') && !activeModalApp.job_apply_url.startsWith('demo://') && (
                <a
                  href={activeModalApp.job_apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-md bg-muted/60 hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 border border-border/60 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Posting
                </a>
              )}
            </div>

            {/* Stage Selector */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Pipeline Stage
              </label>
              <select
                value={modalStatus}
                onChange={e => setModalStatus(e.target.value as StatusKey)}
                className="w-full text-xs bg-background/60 border border-border/60 rounded-md px-3 py-2 text-foreground font-medium"
              >
                {KANBAN_COLUMNS.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.desc})
                  </option>
                ))}
              </select>
            </div>

            {/* Notes Textarea */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Interview Notes & Recruiter Contacts
              </label>
              <textarea
                value={modalNotes}
                onChange={e => setModalNotes(e.target.value)}
                placeholder="Log interview dates, questions asked, follow-up emails, or salary negotiation details..."
                rows={4}
                className="w-full rounded-md border border-border/60 bg-background/60 p-2.5 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <button
                onClick={() => handleDelete(activeModalApp.id)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveModalApp(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveModal}
                  disabled={savingModal}
                  className="text-xs font-semibold"
                >
                  {savingModal ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

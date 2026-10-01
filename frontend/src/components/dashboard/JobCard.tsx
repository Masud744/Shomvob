"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  MapPin,
  DollarSign,
  ExternalLink,
  CalendarDays,
  Bookmark,
  Copy,
  Check,
  Landmark,
} from 'lucide-react';
import {
  getCategoryLabel,
  getCategoryBadgeClass,
  getSourceBadge,
  cleanJobSkills,
} from '@/lib/constants/job-taxonomy';

export function JobCard({
  job,
  isSaved,
  onSaveToggle,
}: {
  job: any;
  isSaved?: boolean;
  onSaveToggle?: (jobId: string) => void;
}) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const {
          data: { session },
        } = await createClient().auth.getSession();
        setIsLoggedIn(!!session);
      } catch {
        setIsLoggedIn(false);
      }
    };
    check();
  }, []);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSaveToggle) return;
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    onSaveToggle(job.id || job.job_id || '');
  };

  const handleCopyTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (job?.title) {
      navigator.clipboard.writeText(job.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const hasValidMatchScore =
    typeof job.match_score === 'number' &&
    !isNaN(job.match_score) &&
    job.match_score > 0;

  const isGovt = job.source === 'BD Govt Jobs';
  const sourceInfo = getSourceBadge(job.source);

  // Clean and deduplicate skills
  const cleanedSkills = cleanJobSkills(job.required_skills, job.title, job.categories);
  const primaryCategory = job.categories?.find((cat: any) => (cat.confidence ?? 0) >= 0.3);

  // Strict badge budget (Maximum 3 pills on the card to maintain pristine hierarchy)
  const showRemote = Boolean(job.is_remote);
  const showCategory = Boolean(primaryCategory);
  const maxSkillPills = Math.max(1, 3 - (showRemote ? 1 : 0) - (showCategory ? 1 : 0));
  const visibleSkills = cleanedSkills.slice(0, maxSkillPills);
  const remainingSkillsCount = cleanedSkills.length - visibleSkills.length;

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow group select-text border-border/60 bg-card rounded-xl">
      <CardHeader className="pb-3 select-text">
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 group/title">
              <Link
                href={`/dashboard/jobs/${job.id}`}
                draggable={false}
                className="font-semibold text-base leading-snug hover:text-primary transition-colors cursor-pointer select-text line-clamp-2"
              >
                {job.title}
              </Link>
              <button
                type="button"
                onClick={handleCopyTitle}
                className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground rounded flex-shrink-0"
                title="Copy job title to clipboard"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center text-xs text-muted-foreground gap-3 select-text">
              <span className="flex items-center gap-1 text-foreground/90 font-medium">
                <Building2 className="w-3.5 h-3.5 text-indigo-400/90" strokeWidth={1.75} />
                {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-500/90" strokeWidth={1.75} />
                {job.location || 'Remote'}
              </span>
            </div>
          </div>

          {/* Match Score or Source Badge */}
          {hasValidMatchScore ? (
            <span
              className={`flex-shrink-0 font-semibold text-[11px] rounded-full px-2.5 py-0.5 border ${
                job.match_score >= 70
                  ? 'text-foreground bg-primary/10 border-primary/25'
                  : 'text-muted-foreground bg-muted/60 border-border'
              }`}
            >
              {job.match_score}% Match
            </span>
          ) : (
            <span
              className={`flex-shrink-0 text-[10px] font-semibold tracking-wider uppercase rounded-full px-2.5 py-0.5 flex items-center gap-1 ${isGovt ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-muted/60 border-border text-foreground"}`}
            >
              {isGovt && <Landmark className="w-3 h-3" strokeWidth={1.75} />}
              {sourceInfo.label}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-4 flex-grow select-text">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground select-text">
            <span className="flex items-center gap-1 font-medium text-foreground font-mono">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" strokeWidth={1.75} />
              {job.salary_min
                ? `${job.salary_currency || '$'}${job.salary_min.toLocaleString()} - ${
                    job.salary_max ? job.salary_max.toLocaleString() : '+'
                  }`
                : 'Undisclosed'}
            </span>
            {job.posted_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/70" strokeWidth={1.75} />
                {formatDate(job.posted_date)}
              </span>
            )}
          </div>

          {/* Balanced, Clean Tag Row (Taito.ai monochrome pills) */}
          <div className="flex flex-wrap items-center gap-1.5 select-text">
            {showRemote && (
              <span className="rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-400">
                Remote
              </span>
            )}

            {showCategory && primaryCategory && (
              <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-medium text-foreground">
                {getCategoryLabel(primaryCategory.category)}
              </span>
            )}

            {visibleSkills.map((skill: string) => (
              <span
                key={skill}
                className="rounded-full bg-muted/40 border border-border px-2 py-0.5 text-[10px] font-mono text-muted-foreground select-text"
              >
                {skill}
              </span>
            ))}

            {remainingSkillsCount > 0 && (
              <span className="text-[10px] text-muted-foreground font-medium pl-1">
                +{remainingSkillsCount} more
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <div className="mt-auto pt-3 pb-3 px-6 border-t border-border/40 flex items-center gap-2">
        <Link
          href={`/dashboard/jobs/${job.id}`}
          className="flex items-center justify-center flex-1 h-9 rounded-lg border border-border bg-muted/40 text-foreground text-xs font-medium hover:bg-muted transition-colors"
        >
          View & Match
        </Link>

        {job.apply_url && (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-9 px-3.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            title="Open application link in new tab"
          >
            {isGovt ? 'Circular' : 'Apply'}{' '}
            <ExternalLink className="w-3 h-3 ml-1.5" strokeWidth={1.75} />
          </a>
        )}

        {onSaveToggle && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleSaveClick}
            title={isSaved ? 'Unsave job' : 'Save job'}
            className="h-9 w-9 flex-shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-primary text-primary' : ''}`} strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </Card>
  );
}


'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showLabels?: boolean;
}

/**
 * Generates a page range array with ellipsis markers.
 * Example: [1, 2, 3, 4, 5, '...', 12]
 */
function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  if (current <= 4) {
    // Near start: [1, 2, 3, 4, 5, ..., total]
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  } else if (current >= total - 3) {
    // Near end: [1, ..., total-4, total-3, total-2, total-1, total]
    pages.push(1);
    pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    // Middle: [1, ..., current-1, current, current+1, ..., total]
    pages.push(1);
    pages.push('...');
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  }

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showLabels = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageRange(currentPage, totalPages);

  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Pagination">
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className={cn(
          'inline-flex h-8 items-center justify-center rounded-lg border border-border/70 text-xs font-medium transition-colors px-2.5 gap-1',
          currentPage === 1
            ? 'text-muted-foreground/30 border-border/30 cursor-not-allowed'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer active:scale-95'
        )}
        aria-label="Previous page"
        title="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {showLabels && <span className="hidden sm:inline">Prev</span>}
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page, idx) =>
          page === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex h-8 w-6 items-center justify-center text-xs text-muted-foreground select-none"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                'inline-flex h-8 min-w-[32px] px-2 items-center justify-center rounded-lg text-xs font-medium transition-all cursor-pointer',
                page === currentPage
                  ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border border-transparent hover:border-zinc-700/60'
              )}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className={cn(
          'inline-flex h-8 items-center justify-center rounded-lg border border-border/70 text-xs font-medium transition-colors px-2.5 gap-1',
          currentPage === totalPages
            ? 'text-muted-foreground/30 border-border/30 cursor-not-allowed'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer active:scale-95'
        )}
        aria-label="Next page"
        title="Next page"
      >
        {showLabels && <span className="hidden sm:inline">Next</span>}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}

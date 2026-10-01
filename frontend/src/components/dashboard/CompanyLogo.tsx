'use client';

import { useState } from 'react';
import { getCompanyLogoUrl } from '@/lib/utils';
import { Landmark, BriefcaseBusiness, Globe } from 'lucide-react';

interface CompanyLogoProps {
  company?: string;
  source?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CompanyLogo({ company = '', source = '', size = 'md', className = '' }: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);
  const cleanName = (company || '').trim().toLowerCase();
  const initial = (company || 'J').charAt(0).toUpperCase();

  const sizeClasses = {
    sm: 'h-8 w-8 rounded-lg text-xs',
    md: 'h-10 w-10 rounded-lg text-sm',
    lg: 'h-12 w-12 rounded-xl text-lg',
  }[size];

  // ── High-Fidelity Vector Brand Logos ──
  if (cleanName.includes('spotify')) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-[#1DB954] text-black ${sizeClasses} ${className}`}>
        <svg className="w-3/5 h-3/5 fill-black" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424a.625.625 0 0 1-.86.208c-2.355-1.439-5.32-1.765-8.812-.968a.624.624 0 1 1-.278-1.218c3.824-.874 7.108-.5 9.742 1.118a.626.626 0 0 1 .208.86zm1.224-2.724a.782.782 0 0 1-1.077.258c-2.695-1.657-6.805-2.136-9.993-1.168a.782.782 0 0 1-.453-1.498c3.642-1.105 8.188-.574 11.265 1.331a.782.782 0 0 1 .258 1.077zm.105-2.835C14.689 8.94 8.71 8.74 5.253 9.79a.937.937 0 1 1-.546-1.792c3.98-1.208 10.607-.98 14.437 1.295a.938.938 0 0 1-1.23 1.572z"/>
        </svg>
      </div>
    );
  }

  if (cleanName.includes('google') || cleanName.includes('alphabet')) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-white border border-border/80 shadow-sm ${sizeClasses} ${className}`}>
        <svg className="w-3/5 h-3/5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
      </div>
    );
  }

  if (cleanName.includes('microsoft')) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-[#2f2f2f] border border-border/80 ${sizeClasses} ${className}`}>
        <div className="grid grid-cols-2 gap-1 w-3/5 h-3/5">
          <div className="bg-[#f25022] rounded-[1px]" />
          <div className="bg-[#7fba00] rounded-[1px]" />
          <div className="bg-[#00a4ef] rounded-[1px]" />
          <div className="bg-[#ffb900] rounded-[1px]" />
        </div>
      </div>
    );
  }

  if (cleanName.includes('nvidia')) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-black border border-white/20 ${sizeClasses} ${className}`}>
        <svg className="w-3/5 h-3/5 fill-white" viewBox="0 0 24 24">
          <path d="M7.74 7.21c.88 0 1.63.75 1.63 1.63v7.32c0 .88-.75 1.63-1.63 1.63H4.63C3.75 17.79 3 17.04 3 16.16V8.84c0-.88.75-1.63 1.63-1.63h3.11zm11.63 0c.88 0 1.63.75 1.63 1.63v7.32c0 .88-.75 1.63-1.63 1.63h-3.11c-.88 0-1.63-.75-1.63-1.63V8.84c0-.88.75-1.63 1.63-1.63h3.11zm-5.81 0c.88 0 1.63.75 1.63 1.63v7.32c0 .88-.75 1.63-1.63 1.63h-3.11c-.88 0-1.63-.75-1.63-1.63V8.84c0-.88.75-1.63 1.63-1.63h3.11z"/>
        </svg>
      </div>
    );
  }

  if (cleanName.includes('canonical') || cleanName.includes('ubuntu')) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-white/10 border border-white/20 text-white ${sizeClasses} ${className}`}>
        <svg className="w-3/5 h-3/5 fill-white" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2.5"/>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="6" cy="15.5" r="1.8" />
          <circle cx="18" cy="15.5" r="1.8" />
        </svg>
      </div>
    );
  }

  const isGovt = cleanName.includes('government') || cleanName.includes('bangladesh') || cleanName.includes('govt') || source === 'BD Govt Jobs';

  // ── Try Clearbit Logo if available ──
  const logoUrl = getCompanyLogoUrl(company);
  if (logoUrl && !imgError && !isGovt && source !== 'LinkedIn' && source !== 'Bdjobs') {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-white border border-border/60 overflow-hidden ${sizeClasses} ${className}`}>
        <img
          src={logoUrl}
          alt={company}
          className="h-full w-full object-contain p-1.5"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // ── Source / Platform Logos ──
  if (isGovt) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-[#006a4e] border border-[#006a4e] ${sizeClasses} ${className}`}>
        <div className="relative flex items-center justify-center w-full h-full">
          <div className="absolute w-3/5 h-3/5 bg-[#f42a41] rounded-full" />
          <Landmark className="relative z-10 w-[45%] h-[45%] text-white" strokeWidth={2.5} />
        </div>
      </div>
    );
  }

  if (source === 'LinkedIn' || cleanName.includes('linkedin')) {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-[#0A66C2] text-white ${sizeClasses} ${className}`}>
        <svg className="w-[55%] h-[55%] fill-white" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </div>
    );
  }

  if (source === 'Bdjobs') {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-[#007338] text-white ${sizeClasses} ${className}`}>
        <BriefcaseBusiness className="w-3/5 h-3/5" />
      </div>
    );
  }

  if (source === 'RemoteOK' || source === 'WeWorkRemotely' || source === 'Jobicy') {
    return (
      <div className={`flex items-center justify-center shrink-0 bg-indigo-500 text-white ${sizeClasses} ${className}`}>
        <Globe className="w-[55%] h-[55%]" />
      </div>
    );
  }

  // ── Curated Monochrome Palette (Taito.ai style: high-contrast dark neutral tones) ──
  const AVATAR_PALETTES = [
    'bg-zinc-800 text-zinc-100 border-zinc-700/60',
    'bg-neutral-800 text-neutral-100 border-neutral-700/60',
    'bg-stone-800 text-stone-100 border-stone-700/60',
    'bg-slate-800 text-slate-100 border-slate-700/60',
    'bg-zinc-900 text-white border-zinc-700/80',
    'bg-zinc-800/90 text-zinc-200 border-zinc-600/50',
  ];
  // Deterministic hash: same company → same color every time
  const hash = (company || 'J').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];

  return (
    <div
      className={`flex items-center justify-center shrink-0 border font-semibold ${palette} ${sizeClasses} ${className}`}
    >
      <span>{initial}</span>
    </div>
  );
}

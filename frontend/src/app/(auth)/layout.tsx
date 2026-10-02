import React from 'react'
import Link from 'next/link'
import { Briefcase, Sparkles, Trophy, CheckCircle2, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen w-full bg-background grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden">
      
      {/* ── Left Column: SaaS Showcase (Deep Dark Minimalist Theme inspired by Landing Hero) ── */}
      <div className="relative hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between p-8 xl:p-14 border-r border-border/40 bg-background overflow-hidden">
        
        {/* Soft, Diffused Single-Source Blue Ambient Glow (Exact match to Landing Page) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/20 blur-[130px] rounded-full pointer-events-none" />

        {/* Top Header: Brand Logo & Status Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/shombhob-brand-white.png"
              alt="সম্ভব"
              className="h-8 w-auto object-contain hidden dark:block transition-transform group-hover:scale-105"
            />
            <img
              src="/shombhob-brand-black.png"
              alt="সম্ভব"
              className="h-8 w-auto object-contain block dark:hidden transition-transform group-hover:scale-105"
            />
          </Link>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-secondary/60 border border-border/50 text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Engineering Career Platform
          </span>
        </div>

        {/* Center Content: Clean Typography & Solid-Accent Showcase */}
        <div className="relative z-10 my-auto py-10 max-w-xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.2]">
              Accelerate your engineering journey with{' '}
              <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                AI precision.
              </span>
            </h1>
            <p className="text-sm xl:text-base text-muted-foreground leading-relaxed">
              Find high-impact roles across Bangladesh tech leaders and global remote engineering teams. Build ATS-optimized LaTeX resumes, generate tailored cover letters, and track every interview in one command center.
            </p>
          </div>

          {/* Unified, Dark Developer-Grade Feature Cards (Consistent Slate / Primary Accents) */}
          <div className="grid gap-3">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/40 transition-all duration-200 group shadow-sm backdrop-blur-sm">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary group-hover:scale-105 transition-transform">
                <Briefcase className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs xl:text-sm font-semibold text-foreground flex items-center gap-2">
                  Curated Engineering Roles
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 border border-border/60 px-1.5 py-0.5 rounded">700+ live</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Full-stack, Embedded/IoT, AI/ML, and DevOps jobs from Chaldal, Pathao, Brain Station 23, and global remote teams.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/40 transition-all duration-200 group shadow-sm backdrop-blur-sm">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary group-hover:scale-105 transition-transform">
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs xl:text-sm font-semibold text-foreground flex items-center gap-2">
                  ATS Resume & LaTeX Studio
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 border border-border/60 px-1.5 py-0.5 rounded">Instant Match</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Calculate keyword alignment scores, polish bullet points with action verbs, and compile clean PDF resumes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/40 transition-all duration-200 group shadow-sm backdrop-blur-sm">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary group-hover:scale-105 transition-transform">
                <Trophy className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs xl:text-sm font-semibold text-foreground flex items-center gap-2">
                  Competitions & Hackathons Hub
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 border border-border/60 px-1.5 py-0.5 rounded">Real-time</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Live sync of national university tech fests, BUET/DU/IUT contests, and Devpost global hackathons.
                </p>
              </div>
            </div>
          </div>

          {/* Social Proof Stats */}
          <div className="flex items-center gap-6 pt-2 text-xs text-muted-foreground border-t border-border/30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Free for Bangladeshi Engineers</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Verified Employer Postings</span>
            </div>
          </div>
        </div>

        {/* Bottom Testimonial */}
        <div className="relative z-10 pt-4 border-t border-border/30">
          <p className="text-xs italic text-muted-foreground leading-relaxed">
            &ldquo;সম্ভব completely transformed my job hunt. The ATS keyword scoring and tailored LaTeX resumes helped me land a Senior Systems role without fighting noise on generic job boards.&rdquo;
          </p>
          <p className="mt-1 text-[11px] font-semibold text-foreground/90">
            — Tariq M., Systems & Embedded Engineer
          </p>
        </div>
      </div>

      {/* ── Right Column: Dynamic Form Container (Full on mobile, 6 or 5 cols on lg) ── */}
      <div className="relative lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-4 sm:p-8 lg:p-12 min-h-screen bg-background">
        
        {/* Soft Ambient Glow on Right Side */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />

        {/* Top Navigation Row: ThemeToggle + Home Link */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-md mx-auto mb-6 shrink-0">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            ← Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Center: Auth Form Container */}
        <div className="relative z-10 my-auto w-full max-w-md mx-auto">
          {children}
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 mt-6 text-center text-xs text-muted-foreground shrink-0">
          <p>© {new Date().getFullYear()} সম্ভব (Shomvob). All rights reserved.</p>
        </div>

      </div>

    </div>
  )
}

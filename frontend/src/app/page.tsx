import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Bot, Code, Cpu, Database, Server, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center px-4">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <Image
                src="/shombhob-brand-white.png"
                alt="সম্ভব"
                width={160}
                height={32}
                priority
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <nav className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Get Started Free
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2 max-w-3xl">
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                  সম্ভব — AI Career Platform for{' '}
                  <span className="text-white underline decoration-white/30 decoration-2 underline-offset-8">
                    Engineering
                  </span>
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mt-6">
                  Zero-cost, AI-powered platform for IoT, Robotics, Embedded, AI/ML, and Full Stack engineers to land their dream roles. Get matched, optimize resumes, and auto-generate tailored cover letters.
                </p>
              </div>
              <div className="space-x-4 pt-6">
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group"
                >
                  Start Your Journey
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/dashboard/jobs"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Browse Jobs
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 border-t border-border/40">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm text-primary font-medium mb-2">
                  Engineered for Engineers
                </div>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Supercharge Your Job Search
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  We built specialized tools designed specifically for technical roles, skipping the generic advice.
                </p>
              </div>
            </div>
            
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 md:gap-12">
              <div className="flex flex-col justify-center space-y-4 rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 group">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Smart ATS Resumes</h3>
                <p className="text-muted-foreground">
                  Our LaTeX-powered engine takes your profile and the job description, analyzes them with AI, and generates a perfectly tailored ATS-friendly PDF.
                </p>
              </div>
              <div className="flex flex-col justify-center space-y-4 rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 group">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">AI Cover Letters</h3>
                <p className="text-muted-foreground">
                  Stop writing cover letters from scratch. We use Gemini 1.5 Flash to write highly personalized cover letters highlighting your exact project experience.
                </p>
              </div>
              <div className="flex flex-col justify-center space-y-4 rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 group">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Deep Tech Matching</h3>
                <p className="text-muted-foreground">
                  Our matching engine understands the difference between RTOS and React. Get matched based on your actual tech stack, not just buzzwords.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Domains Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-secondary/10">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Specialized Domains</h2>
              <p className="max-w-[600px] text-muted-foreground">
                We aggregate top-tier roles from Greenhouse, Lever, and RemoteOK across hardcore engineering fields.
              </p>
            </div>
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex flex-col items-center justify-center rounded-lg bg-background p-6 shadow-sm text-center border border-border/50">
                <Cpu className="mb-2 h-8 w-8 text-white" strokeWidth={1.5} />
                <span className="text-sm font-semibold">Embedded & IoT</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-background p-6 shadow-sm text-center border border-border/50">
                <Bot className="mb-2 h-8 w-8 text-white" strokeWidth={1.5} />
                <span className="text-sm font-semibold">Robotics</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-background p-6 shadow-sm text-center border border-border/50">
                <Database className="mb-2 h-8 w-8 text-white" strokeWidth={1.5} />
                <span className="text-sm font-semibold">AI/ML & Data</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-background p-6 shadow-sm text-center border border-border/50">
                <Server className="mb-2 h-8 w-8 text-white" strokeWidth={1.5} />
                <span className="text-sm font-semibold">Backend & Cloud</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-border/40 py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for the modern engineer. Free forever.
          </p>
          <div className="flex items-center space-x-4 text-sm font-medium">
            <Link href="#" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

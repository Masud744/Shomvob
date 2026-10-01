'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileSignature,
  Sparkles,
  Download,
  Copy,
  Check,
  Printer,
  RotateCcw,
  Cpu,
  Shield,
  Zap,
  Bookmark,
  Building2,
  Briefcase,
  AlertCircle,
  Loader2,
  FileText,
  Sliders,
  ChevronDown,
  Info,
  GraduationCap,
  Bot,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface SavedJobOption {
  id: string;
  title: string;
  company: string;
  description?: string;
  location?: string;
}

interface UserProfile {
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  headline?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  resume_parsed_data?: {
    raw_text?: string;
    skills?: string[];
    [key: string]: unknown;
  };
}

interface CoverLetterRecord {
  id: string;
  content: string;
  created_at: string;
  job_id?: string;
}

const TONES = [
  {
    id: 'academic',
    label: 'Academic & Rigorous',
    desc: 'Scholarly, evidence-backed & human grounded',
    icon: GraduationCap,
  },
  {
    id: 'technical',
    label: 'Technical & Metric',
    desc: 'Deep engineering impact & system design',
    icon: Cpu,
  },
  {
    id: 'executive',
    label: 'Executive & Strategic',
    desc: 'Architecture ownership & business delivery',
    icon: Shield,
  },
  {
    id: 'enthusiastic',
    label: 'Passionate Startup',
    desc: 'High velocity, curiosity & mission alignment',
    icon: Zap,
  },
] as const;

function cleanCoverLetterText(raw: string, defaultName: string = ""): string {
  if (!raw) return "";
  let text = raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
  // Strip markdown bold / italic markers
  text = text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");

  // If there is a salutation like "Dear ...", strip duplicate header metadata preceding it
  const salutationIndex = text.search(/Dear\s+/i);
  if (salutationIndex > 0) {
    const prefix = text.substring(0, salutationIndex);
    if (
      prefix.toLowerCase().includes("subject:") ||
      prefix.toLowerCase().includes("date") ||
      prefix.includes("@") ||
      prefix.toLowerCase().includes("hiring") ||
      prefix.includes("[")
    ) {
      text = text.substring(salutationIndex);
    }
  }

  // Replace accidental None sign-offs
  const safeName = defaultName && defaultName.toLowerCase() !== "none" ? defaultName : "Applicant";
  text = text.replace(/(Sincerely|Warm regards|Best regards|Regards),?\s*\n+None\b/gi, `$1,\n${safeName}`);

  // Ensure professional closing if absent
  if (!text.toLowerCase().includes("sincerely") && !text.toLowerCase().includes("regards")) {
    text = `${text.trim()}\n\nSincerely,\n${safeName}`;
  }

  return text.trim();
}

export default function CoverLetterPage() {

  // Input fields
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedTone, setSelectedTone] = useState<'academic' | 'technical' | 'executive' | 'enthusiastic'>('academic');
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'groq' | 'gemini'>('auto');
  const [lastUsedModel, setLastUsedModel] = useState<string | null>(null);
  const [customFocus, setCustomFocus] = useState('');

  // Profile & Saved jobs
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const applicantName = (profile?.full_name?.trim() && profile.full_name !== "None") ? profile.full_name : "Shahriar Alom Masud";
  const [savedJobs, setSavedJobs] = useState<SavedJobOption[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Output fields (editable in the live A4 preview)
  const [generatedBody, setGeneratedBody] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [template, setTemplate] = useState<'modern' | 'serif'>('modern');

  // UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [history, setHistory] = useState<CoverLetterRecord[]>([]);

  // ── Load profile, saved jobs & letter history on mount ──
  useEffect(() => {
    // 1. Profile
    api
      .get<UserProfile>('/profile')
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => {});

    // 2. Saved Jobs
    setIsLoadingJobs(true);
    api
      .get<{ job: SavedJobOption }[]>('/saved-jobs')
      .then((items) => {
        if (Array.isArray(items)) {
          const list = items
            .map((item) => item.job)
            .filter(Boolean) as SavedJobOption[];
          setSavedJobs(list);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingJobs(false));

    // 3. Cover letter history
    api
      .get<CoverLetterRecord[]>('/cover-letter/history')
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(() => {});

    // Current date
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    setDateStr(today);
  }, []);

  // ── Handle Auto-Extraction when user pastes JD ──
  const handleJobDescChange = (text: string) => {
    setJobDescription(text);

    // If job title is empty, try to detect role title
    if (!jobTitle) {
      const titleMatch = text.match(/(?:Role|Title|Position|Job):\s*([^\n\r]+)/i);
      if (titleMatch?.[1]) {
        setJobTitle(titleMatch[1].trim());
      }
    }

    // If company is empty, try to detect company
    if (!companyName) {
      const companyMatch = text.match(/(?:Company|Organization|At):\s*([^\n\r]+)/i);
      if (companyMatch?.[1]) {
        setCompanyName(companyMatch[1].trim());
      }
    }
  };

  // ── Handle Pick from Saved Jobs ──
  const handleSelectSavedJob = async (jobId: string) => {
    if (!jobId) return;
    const found = savedJobs.find((j) => j.id === jobId);
    if (!found) return;

    setJobTitle(found.title || '');
    setCompanyName(found.company || '');

    // Fetch full description if missing
    if (found.description) {
      setJobDescription(found.description);
    } else {
      try {
        const full = await api.get<{ description?: string }>(`/jobs/${jobId}`);
        if (full?.description) {
          setJobDescription(full.description);
        }
      } catch {}
    }
  };

  // ── Generate Cover Letter ──
  const handleGenerate = async () => {
    if (!jobDescription.trim() && !jobTitle.trim()) {
      setErrorMsg('Please paste a job description or provide the job title.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    const company = companyName.trim() || 'Hiring Organization';
    const title = jobTitle.trim() || 'Software Engineer';

    try {
      const res = await api.post<{ content: string; id: string; ai_model?: string }>('/cover-letter/generate', {
        job_title: title,
        company_name: company,
        job_description: jobDescription.trim(),
        tone: selectedTone,
        custom_focus: customFocus.trim(),
        provider: selectedProvider,
      });

      if (res?.content) {
        if (res.ai_model) setLastUsedModel(res.ai_model);
        // Parse into recipient, subject, and body
        let rawContent = res.content.trim();

        // Setup clean standard headers
        setRecipient(`Hiring Manager & Engineering Team\n${company}`);
        setSubject(`RE: Application for ${title} Position`);

        // Clean duplicate headers & markdown markers
        const cleaned = cleanCoverLetterText(rawContent, applicantName);
        setGeneratedBody(cleaned);

        // Add to history list
        setHistory((prev) => [
          {
            id: res.id || String(Date.now()),
            content: rawContent,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'Could not generate cover letter. Please verify your connection.';
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Copy to Clipboard ──
  const handleCopy = () => {
    if (!generatedBody) return;
    const fullText = `${applicantName}\n${contactInfo.line1}\n${contactInfo.line2 ? contactInfo.line2 + '\n' : ''}\n${dateStr}\n\n${recipient}\n\n${subject}\n\n${generatedBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Download PDF ──
  const handleDownloadPdf = async () => {
    if (!generatedBody) return;
    setIsDownloadingPdf(true);

    try {
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
      const token = typeof window !== 'undefined' ? (await import('@/lib/supabase/client')).createClient() : null;
      const session = token ? (await token.auth.getSession()).data.session : null;

      const res = await fetch(`${API_BASE}/cover-letter/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          applicant_name: applicantName,
          contact_info: contactInfo.combined,
          email: contactInfo.email,
          phone: contactInfo.phone,
          location: contactInfo.location,
          linkedin_url: contactInfo.rawLinkedinUrl,
          github_url: contactInfo.rawGithubUrl,
          date_str: dateStr,
          recipient_info: recipient,
          subject: subject,
          body: generatedBody,
          template,
        }),
      });

      if (!res.ok) {
        throw new Error('PDF export failed on server');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cover_Letter_${applicantName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Backend PDF failed, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ── Print ──
  const handlePrint = () => {
    window.print();
  };

  // Rich candidate contact line synthesized from profile and authentic CV
  const contactInfo = useMemo(() => {
    const rawCv = profile?.resume_parsed_data?.raw_text || '';
    const extract = (pattern: RegExp) => {
      const match = rawCv.match(pattern);
      return match ? match[1].trim() : '';
    };

    // Prioritize CV email explicitly as requested by user
    const cvEmail = extract(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
    const email = cvEmail || profile?.email || 'shahriar0002@std.uftb.ac.bd';
    const phone =
      profile?.phone ||
      extract(/(\+?\d{1,4}[\s-]?(?:\(?\d{1,4}\)?)?[\s-]?\d{3,4}[\s-]?\d{3,4})/) ||
      '+880 1740-071118';
    const city = profile?.city || 'Dhaka';
    const country = profile?.country || 'Bangladesh';
    const location = city ? `${city}, ${country}` : country;

    const rawLi =
      profile?.linkedin_url ||
      extract(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);
    const linkedin = rawLi
      ? rawLi.replace(/^https?:\/\//, '')
      : 'linkedin.com/in/shahriar-alom-masud';
    const rawLinkedinUrl = linkedin ? `https://${linkedin}` : '';

    const rawGh =
      profile?.github_url || extract(/(github\.com\/[a-zA-Z0-9_-]+)/i);
    const github = rawGh
      ? rawGh.replace(/^https?:\/\//, '')
      : 'github.com/Masud744';
    const rawGithubUrl = github ? `https://${github}` : '';

    const line1 = [email, phone, location].filter(Boolean).join('  •  ');
    const line2 = [linkedin, github].filter(Boolean).join('  •  ');

    return {
      email,
      phone,
      location,
      linkedin,
      rawLinkedinUrl,
      github,
      rawGithubUrl,
      line1,
      line2,
      combined: line2 ? `${line1}\n${line2}` : line1,
    };
  }, [profile]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-text space-y-3">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 mb-1">
            <Sparkles className="h-3 w-3" />
            AI Cover Letter Studio
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Generate & Export <span className="text-primary">Tailored Cover Letter</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Paste a job circular or pick a saved job to craft an ATS-optimized, executive A4 letter in seconds.
          </p>
        </div>

        {/* Quick Stats / History Pill */}
        {history.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border/50 px-3 py-1.5 rounded-lg shrink-0">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>{history.length} letters generated</span>
          </div>
        )}
      </div>

      {/* ── Main Split View ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(380px,460px)_1fr] gap-4 items-stretch overflow-hidden">
        {/* ◄◄ LEFT COLUMN: Input & Controls Studio */}
        <div className="flex flex-col h-full min-h-0 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-border/50 bg-muted/20 shrink-0 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Job Requirements & Tone
            </span>

            {/* Quick Picker from Saved Jobs */}
            {savedJobs.length > 0 && (
              <div className="relative">
                <select
                  onChange={(e) => handleSelectSavedJob(e.target.value)}
                  defaultValue=""
                  className="h-7 text-[11px] bg-background border border-border/70 rounded-md px-2 pr-6 text-foreground font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                  style={{
                    backgroundImage:
                      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                  }}
                >
                  <option value="" disabled>
                    Import Saved Job...
                  </option>
                  {savedJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.company}: {j.title.slice(0, 24)}...
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Title & Company Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  Target Job Title
                </label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Embedded Engineer"
                  className="h-8 text-xs bg-background border-border/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  Company Name
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. General Motors"
                  className="h-8 text-xs bg-background border-border/60"
                />
              </div>
            </div>

            {/* Job Description Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">
                  Job Description / Circular Requirements <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {jobDescription.length} chars
                </span>
              </div>
              <textarea
                value={jobDescription}
                onChange={(e) => handleJobDescChange(e.target.value)}
                placeholder="Paste the full job description, circular duties, or bullet points here..."
                rows={7}
                className="w-full rounded-lg border border-border/60 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none font-sans"
              />
            </div>

            {/* Tone Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Writing Tone & Narrative</label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedTone(id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      selectedTone === id
                        ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-xs'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-1 ${selectedTone === id ? 'text-primary' : ''}`} />
                    <span className="text-[11px] leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Focus / Key Points */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Highlight Special Projects / Focus (Optional)
              </label>
              <Input
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                placeholder="e.g. Focus on RTOS, CAN bus and 4+ years of hardware prototyping"
                className="h-8 text-xs bg-background border-border/60"
              />
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-3 border-t border-border/50 bg-card shrink-0">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !jobDescription.trim()}
              className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all cursor-pointer gap-2 shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Profile & Writing Letter...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Tailored Cover Letter
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ►► RIGHT COLUMN: Live Interactive A4 Sheet & Preview */}
        <div className="flex flex-col h-full min-h-0 rounded-xl border border-border/60 bg-muted/20 overflow-hidden shadow-sm">
          {/* Top Preview Toolbar */}
          <div className="p-2.5 sm:px-4 border-b border-border/50 bg-card shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground hidden sm:inline">Template:</span>
              <div className="flex items-center rounded-lg border border-border/60 p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setTemplate('modern')}
                  className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                    template === 'modern'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Modern Clean (Sans)
                </button>
                <button
                  type="button"
                  onClick={() => setTemplate('serif')}
                  className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                    template === 'serif'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Executive (Serif)
                </button>
              </div>
            </div>

              {/* Interactive AI Model Selector Dropdown Pill */}
              <div className="relative inline-flex items-center">
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    const p = e.target.value as 'auto' | 'groq' | 'gemini';
                    setSelectedProvider(p);
                    if (p === 'groq') setLastUsedModel('groq:openai/gpt-oss-120b');
                    else if (p === 'gemini') setLastUsedModel('gemini:gemini-2.5-flash');
                    else setLastUsedModel(null);
                  }}
                  className="h-7 text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-full pl-7 pr-6 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none transition-all shadow-xs"
                  title="Switch AI Engine (Groq LPU 120B, Gemini 2.5, or Auto Failover)"
                  style={{
                    backgroundImage:
                      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2310b981\' stroke-width=\'2.5\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                  }}
                >
                  <option value="auto" className="bg-popover text-popover-foreground">
                    Auto Failover (Groq 120B + Gemini)
                  </option>
                  <option value="groq" className="bg-popover text-popover-foreground">
                    Groq LPU (120B) — Fast (~1s)
                  </option>
                  <option value="gemini" className="bg-popover text-popover-foreground">
                    Gemini 2.5 Flash — Multimodal
                  </option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
                  <Zap className="h-3 w-3" />
                </div>
              </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!generatedBody}
                className="h-7 text-xs border-border/60 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy entire letter text to clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!generatedBody}
                className="h-7 text-xs border-border/60 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Print or Save via Browser"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </Button>

              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={!generatedBody || isDownloadingPdf}
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 cursor-pointer shadow-xs"
                title="Download ATS-ready Vector A4 PDF"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Download PDF</span>
              </Button>
            </div>
          </div>

          {/* ── Scrollable Paper Container ── */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex justify-center bg-zinc-950/40">
            {generatedBody ? (
              /* REAL A4 SHEET CONTAINER */
              <div
                id="printable-cover-letter"
                className={`w-full max-w-[720px] min-h-[960px] bg-white text-zinc-900 rounded-lg shadow-xl border border-zinc-200/80 p-8 sm:p-12 transition-all select-text ${
                  template === 'serif' ? 'font-serif' : 'font-sans'
                }`}
                style={{
                  lineHeight: '1.55',
                }}
              >
                {/* 1. Letterhead with Clickable Redirect Links */}
                <div className="border-b border-zinc-200 pb-4 mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 uppercase">
                    {applicantName}
                  </h2>

                  {/* Line 1: Email (mailto:) • Phone (tel:) • Location */}
                  <div className="text-xs text-zinc-600 mt-1.5 font-sans font-medium flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {contactInfo.email && (
                      <a
                        href={`mailto:${contactInfo.email}`}
                        className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-blue-600 transition-colors cursor-pointer hover:underline"
                        title={`Send email to ${contactInfo.email}`}
                      >
                        <Mail className="h-3 w-3 text-zinc-400 hover:text-blue-600 shrink-0" />
                        <span>{contactInfo.email}</span>
                      </a>
                    )}
                    {contactInfo.email && contactInfo.phone && <span className="text-zinc-300 font-normal">|</span>}
                    {contactInfo.phone && (
                      <a
                        href={`tel:${contactInfo.phone.replace(/[^\d+]/g, '')}`}
                        className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-blue-600 transition-colors cursor-pointer hover:underline"
                        title={`Call ${contactInfo.phone}`}
                      >
                        <Phone className="h-3 w-3 text-zinc-400 hover:text-blue-600 shrink-0" />
                        <span>{contactInfo.phone}</span>
                      </a>
                    )}
                    {contactInfo.phone && contactInfo.location && <span className="text-zinc-300 font-normal">|</span>}
                    {contactInfo.location && (
                      <span className="inline-flex items-center gap-1.5 text-zinc-600">
                        <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                        <span>{contactInfo.location}</span>
                      </span>
                    )}
                  </div>

                  {/* Line 2: LinkedIn (Redirect) • GitHub (Redirect) */}
                  {(contactInfo.linkedin || contactInfo.github) && (
                    <div className="text-xs mt-1.5 font-sans flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {contactInfo.linkedin && (
                        <a
                          href={contactInfo.rawLinkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors cursor-pointer hover:underline group"
                          title="Open LinkedIn Profile (Opens in new tab)"
                        >
                          <svg className="h-3 w-3 fill-[#0A66C2] shrink-0" viewBox="0 0 24 24">
                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                          </svg>
                          <span>{contactInfo.linkedin}</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
                        </a>
                      )}
                      {contactInfo.linkedin && contactInfo.github && <span className="text-zinc-300 font-normal">|</span>}
                      {contactInfo.github && (
                        <a
                          href={contactInfo.rawGithubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-zinc-800 hover:text-zinc-950 font-medium transition-colors cursor-pointer hover:underline group"
                          title="Open GitHub Profile (Opens in new tab)"
                        >
                          <svg className="h-3 w-3 fill-zinc-800 shrink-0" viewBox="0 0 24 24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                          </svg>
                          <span>{contactInfo.github}</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Date */}
                <div className="mb-4">
                  <p className="text-xs text-zinc-600 font-medium font-sans">{dateStr}</p>
                </div>

                {/* 3. Recipient */}
                <div className="mb-5 space-y-0.5">
                  <p className="text-xs font-semibold text-zinc-800">
                    Hiring Manager & Engineering Team
                  </p>
                  <p className="text-xs text-zinc-600 font-medium">{companyName || 'Hiring Organization'}</p>
                </div>

                {/* 4. Subject */}
                <div className="mb-5">
                  <p className="text-xs font-bold text-zinc-900 tracking-wide">
                    {subject || `RE: Application for ${jobTitle || 'Engineering'} Role`}
                  </p>
                </div>

                {/* 5. Live-Editable Letter Body & Closing */}
                <div className="space-y-3.5 text-[13px] text-zinc-800 leading-relaxed text-left">
                  <textarea
                    value={generatedBody}
                    onChange={(e) => setGeneratedBody(e.target.value)}
                    rows={Math.max(18, (generatedBody ? generatedBody.split('\n').length + 3 : 20))}
                    className="w-full bg-transparent border-0 p-0 text-[13px] text-zinc-800 focus:outline-none focus:ring-0 resize-none font-inherit leading-relaxed overflow-hidden"
                    title="Click anywhere to edit or customize your letter text"
                  />
                </div>
              </div>
            ) : (
              /* EMPTY STATE PLACEHOLDER */
              <div className="w-full max-w-[640px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/50 rounded-xl my-auto">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 border border-primary/20">
                  <FileSignature className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Your A4 Cover Letter Preview</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4 leading-relaxed">
                  Paste a job circular or import from your saved jobs on the left, then click{' '}
                  <span className="text-foreground font-semibold">Generate Tailored Cover Letter</span>.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-card border border-border/60 px-3 py-1.5 rounded-lg">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  <span>Exports in standard 210x297mm A4 with ATS-compliant vector text</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Briefcase, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'

const TARGET_ROLES = [
  { value: 'Full-Stack Engineer', label: 'Full-Stack Engineer' },
  { value: 'Backend Engineer', label: 'Backend Engineer (Python / Node / Go)' },
  { value: 'Frontend Engineer', label: 'Frontend Engineer (React / Next.js)' },
  { value: 'AI / Machine Learning Engineer', label: 'AI / Machine Learning Engineer' },
  { value: 'Mobile App Developer', label: 'Mobile App Developer (Flutter / React Native)' },
  { value: 'DevOps & Cloud Engineer', label: 'DevOps & Cloud Engineer (Docker / AWS)' },
  { value: 'Embedded & IoT Systems', label: 'Embedded & IoT Systems Engineer' },
  { value: 'Software QA & Test Engineer', label: 'Software QA & Test Engineer' },
]

const EXPERIENCE_LEVELS = [
  { value: 'Student / Fresh Graduate', label: 'Student / Fresh Graduate (< 1 yr)' },
  { value: 'Junior Engineer', label: 'Junior Engineer (1-2 yrs)' },
  { value: 'Mid-Level Engineer', label: 'Mid-Level Engineer (3-5 yrs)' },
  { value: 'Senior Engineer', label: 'Senior / Lead Engineer (5+ yrs)' },
]

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verification Screen State
  const [isVerificationSent, setIsVerificationSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            target_role: targetRole || 'Software Engineer',
            experience_level: experienceLevel || 'Student / Fresh Graduate',
          },
          emailRedirectTo: `${origin}/auth/callback`,
        }
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
      } else {
        // If email verification is enabled on Supabase, data.session is null
        if (!data.session) {
          setIsVerificationSent(true)
          setResendCooldown(60)
        } else {
          // If auto-confirm is on in Supabase, navigate directly to dashboard
          router.push('/dashboard')
          router.refresh()
        }
        setIsLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during account creation.')
      setIsLoading(false)
    }
  }

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setResendMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })

      if (error) {
        setResendMessage(`Error: ${error.message}`)
      } else {
        setResendMessage('Verification email resent successfully! Check your inbox.')
        setResendCooldown(60)
      }
    } catch (err: any) {
      setResendMessage('Could not resend verification email. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/85 shadow-lg backdrop-blur-md rounded-2xl">
      {!isVerificationSent ? (
        <>
          <CardHeader className="space-y-1.5 pb-4 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create your account
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Join thousands of engineers discovering top-tier tech roles
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSignup}>
            <CardContent className="space-y-3.5 pt-1">
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-foreground/90">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    id="fullName" 
                    type="text" 
                    placeholder="Masud Nil" 
                    required 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    className="pl-9 h-9 text-xs bg-background/50 border-border/80 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground/90">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="engineer@example.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="pl-9 h-9 text-xs bg-background/50 border-border/80 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Target Engineering Role & Experience Level Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold text-foreground/90 flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    Target Role
                  </Label>
                  <Select value={targetRole} onValueChange={(val) => setTargetRole(val || "")}>
                    <SelectTrigger id="role" className="h-9 text-xs bg-background/50 border-border/80">
                      <SelectValue placeholder="Select primary role" />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exp" className="text-xs font-semibold text-foreground/90 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3 text-muted-foreground" />
                    Experience
                  </Label>
                  <Select value={experienceLevel} onValueChange={(val) => setExperienceLevel(val || "")}>
                    <SelectTrigger id="exp" className="h-9 text-xs bg-background/50 border-border/80">
                      <SelectValue placeholder="Experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((e) => (
                        <SelectItem key={e.value} value={e.value} className="text-xs">
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="Min. 6 characters" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-9 pr-9 h-9 text-xs bg-background/50 border-border/80 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                className="w-full h-9 mt-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Free Account'
                )}
              </Button>
            </CardContent>
          </form>

          <CardFooter className="pt-2 pb-6 flex justify-center border-t border-border/40 mt-4">
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline transition-colors">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </>
      ) : (
        /* ── Email Verification Sent Screen ── */
        <>
          <CardHeader className="space-y-2 pb-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto flex items-center justify-center shadow-xs">
              <Mail className="h-7 w-7 animate-bounce" />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Verify your email address
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto">
              We have dispatched an activation link to your inbox.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 text-center space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Confirmation sent to:</p>
              <p className="text-sm font-bold text-foreground font-mono truncate">{email}</p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground bg-background/50 border border-border/60 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Click the confirmation link inside your email to activate your profile.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>If you don&apos;t see it within a couple minutes, please check your <strong>Spam/Junk</strong> folder.</span>
              </div>
            </div>

            {resendMessage && (
              <div className="p-2.5 text-xs text-center rounded-md bg-primary/10 text-primary border border-primary/20">
                {resendMessage}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendEmail}
                disabled={resendCooldown > 0 || resendLoading}
                className="w-full h-9 text-xs font-semibold border-border hover:bg-muted active:scale-[0.98] transition-all"
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend email in ${resendCooldown}s`
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Resend confirmation email
                  </>
                )}
              </Button>

              <Link href="/login" className="block w-full">
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-foreground">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  )
}

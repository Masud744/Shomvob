'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot Password Mode State
  const [isForgotMode, setIsForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during sign-in.')
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError(null)
    setForgotSuccess(false)

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
      })

      if (error) {
        setForgotError(error.message)
        setForgotLoading(false)
      } else {
        setForgotSuccess(true)
        setForgotLoading(false)
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Could not send reset link. Please try again.')
      setForgotLoading(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/85 shadow-lg backdrop-blur-md rounded-2xl">
      {!isForgotMode ? (
        <>
          <CardHeader className="space-y-1.5 pb-4 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Welcome back</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sign in to manage your jobs, resumes, and applications
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-2">
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true)
                      setForgotEmail(email)
                      setForgotError(null)
                      setForgotSuccess(false)
                    }}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••"
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
                className="w-full h-9 mt-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </CardContent>
          </form>

          <CardFooter className="pt-2 pb-6 flex justify-center border-t border-border/40 mt-4">
            <p className="text-xs text-muted-foreground text-center">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline transition-colors">
                Create an account
              </Link>
            </p>
          </CardFooter>
        </>
      ) : (
        /* ── Forgot Password Sub-Flow ── */
        <>
          <CardHeader className="space-y-1.5 pb-3 text-center">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Reset Password
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground max-w-xs mx-auto">
              Enter your account email and we will send a secure link to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {forgotError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-3 py-2 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Recovery Email Sent</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We have sent a password reset link to <strong className="text-foreground font-mono">{forgotEmail}</strong>. Please check your inbox and click the link to proceed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsForgotMode(false)}
                  className="w-full mt-2 h-8 text-xs font-medium border-border hover:bg-muted"
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-xs font-semibold text-foreground/90">Registered Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="forgot-email" 
                      type="email" 
                      placeholder="engineer@example.com" 
                      required 
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      disabled={forgotLoading}
                      className="pl-9 h-9 text-xs bg-background/50 border-border/80 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-9 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs" 
                  type="submit" 
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer py-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
              </form>
            )}
          </CardContent>
        </>
      )}
    </Card>
  )
}

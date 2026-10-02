'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      setIsLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.')
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
      } else {
        setSuccess(true)
        setIsLoading(false)
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while resetting your password.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 bg-background">
      <div className="flex items-center justify-between w-full max-w-md mx-auto mb-6 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/shombhob-brand-white.png"
            alt="সম্ভব"
            className="h-8 w-auto object-contain hidden dark:block"
          />
          <img
            src="/shombhob-brand-black.png"
            alt="সম্ভব"
            className="h-8 w-auto object-contain block dark:hidden"
          />
        </Link>
        <ThemeToggle />
      </div>

      <div className="my-auto w-full max-w-md mx-auto">
        <Card className="border-border/70 bg-card/85 shadow-lg backdrop-blur-md rounded-2xl">
          <CardHeader className="space-y-1.5 pb-4 text-center">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 text-primary mx-auto flex items-center justify-center mb-1">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Choose New Password
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter your new secure password below to regain access to your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="space-y-3 py-3 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Password Updated!</h4>
                <p className="text-xs text-muted-foreground">
                  Your password has been reset successfully. Redirecting you to your dashboard...
                </p>
                <div className="pt-2">
                  <Link href="/dashboard">
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground">
                      Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-semibold text-foreground/90">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="new-password" 
                      type={showPassword ? "text" : "password"} 
                      required 
                      placeholder="Min. 6 characters" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-9 pr-9 h-9 text-xs bg-background/50 border-border/80 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-semibold text-foreground/90">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="confirm-password" 
                      type={showPassword ? "text" : "password"} 
                      required 
                      placeholder="Repeat password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-9 h-9 text-xs bg-background/50 border-border/80 focus-visible:ring-primary"
                    />
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
                      Updating password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center text-xs text-muted-foreground shrink-0">
        <p>© {new Date().getFullYear()} সম্ভব (Shomvob). All rights reserved.</p>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Cpu,
  FileText,
  FileEdit,
  Home,
  LogOut,
  Menu,
  Sparkles,
  User,
  X,
  Briefcase,
  Bookmark,
  Settings,
  Bell,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { NotificationsPopover } from '@/components/dashboard/NotificationsPopover'
import { SettingsModal } from '@/components/dashboard/SettingsModal'
import { ProfileDropdown } from '@/components/dashboard/ProfileDropdown'

const SIDEBAR_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Find Jobs', href: '/dashboard/jobs', icon: Briefcase },
  { name: 'Competitions', href: '/dashboard/competitions', icon: Trophy },
  { name: 'Saved Jobs', href: '/dashboard/saved-jobs', icon: Bookmark },
  { name: 'Applications', href: '/dashboard/applications', icon: FileText },
  { name: 'Cover Letter', href: '/dashboard/cover-letter', icon: FileEdit },
  { name: 'Profile', href: '/dashboard/profile', icon: User },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUserEmail(session.user.email || null)
          setUserName(
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] || null
          )
        }
      } catch { /* silent */ }
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard/jobs')) return 'Find Jobs'
    return SIDEBAR_ITEMS.find((item) => item.href === pathname)?.name || 'Dashboard'
  }

  const Sidebar = ({ isMobileDrawer = false }: { isMobileDrawer?: boolean }) => (
    <div className="flex h-full flex-col bg-card border-r border-border/50" suppressHydrationWarning>
      {/* Logo */}
      <div className={`flex h-[72px] items-center border-b border-border/60 ${isMobileDrawer ? 'px-5' : 'px-3 lg:px-5 justify-center lg:justify-start'}`}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group" title="সম্ভব">
          {/* Collapsed Rail View (Tablet/Desktop icon-only rail) */}
          <div className={`${isMobileDrawer ? 'hidden' : 'flex lg:hidden'} h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 border border-border p-1.5 transition-colors group-hover:border-foreground/30`}>
            <img
              src="/shombhob-icon-white.png"
              alt="সম্ভব"
              className="h-full w-full object-contain hidden dark:block"
            />
            <img
              src="/shombhob-icon-black.png"
              alt="সম্ভব"
              className="h-full w-full object-contain block dark:hidden"
            />
          </div>

          {/* Full Expanded View (Desktop sidebar & Mobile drawer) */}
          <div className={`${isMobileDrawer ? 'flex' : 'hidden lg:flex'} flex-col justify-center`}>
            <img
              src="/shombhob-brand-white.png"
              alt="সম্ভব"
              className="h-7 w-auto object-contain self-start hidden dark:block"
            />
            <img
              src="/shombhob-brand-black.png"
              alt="সম্ভব"
              className="h-7 w-auto object-contain self-start block dark:hidden"
            />
            <span className="text-[9.5px] text-muted-foreground font-normal tracking-tight leading-tight mt-1">
              Find opportunities. Build your future.
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-3">
        <nav className={`grid items-start space-y-1 ${isMobileDrawer ? 'px-3' : 'px-2 lg:px-3'}`}>
          {SIDEBAR_ITEMS.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                onClick={() => setIsMobileOpen(false)}
                className={`group flex items-center gap-3 rounded-lg py-2.5 text-[13px] font-medium transition-colors ${
                  isMobileDrawer
                    ? 'px-3'
                    : 'px-2.5 lg:px-3 justify-center lg:justify-start'
                } ${
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive ? 'text-accent-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                  strokeWidth={1.75}
                />
                <span className={isMobileDrawer ? 'inline' : 'hidden lg:inline'}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile + Logout */}
      <div className={`border-t border-border/50 mt-auto ${isMobileDrawer ? 'p-3' : 'p-2 lg:p-3'}`}>
        <div className={`flex items-center gap-3 ${isMobileDrawer ? 'px-2 py-2' : 'px-1 lg:px-2 py-2 justify-center lg:justify-start'}`}>
          <div
            className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
            title={userName || 'User'}
          >
            <span className="text-sm font-semibold text-foreground">
              {(userName || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className={isMobileDrawer ? 'flex-1 min-w-0' : 'hidden lg:block flex-1 min-w-0'}>
            <p className="text-[13px] font-semibold text-foreground truncate">
              {userName || 'User'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {userEmail || 'user@email.com'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className={`p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${
              isMobileDrawer ? 'block' : 'hidden lg:block'
            }`}
            title="Log out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )

  const isFixedViewportPage =
    pathname === '/dashboard' ||
    pathname === '/dashboard/jobs' ||
    pathname === '/dashboard/saved-jobs' ||
    pathname === '/dashboard/applications' ||
    pathname.startsWith('/dashboard/resume') ||
    pathname.startsWith('/dashboard/profile');

  const MOBILE_TABS = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { name: 'Saved', href: '/dashboard/saved-jobs', icon: Bookmark },
    { name: 'Pipeline', href: '/dashboard/applications', icon: FileText },
    { name: 'Profile', href: '/dashboard/profile', icon: User },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-3/4 max-w-[280px] bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Sidebar isMobileDrawer={true} />
          </div>
        </div>
      )}

      {/* Desktop / Tablet Rail Sidebar */}
      <div className="hidden border-r border-border bg-card md:block md:w-[68px] lg:w-[240px] md:fixed md:inset-y-0 md:h-screen transition-all duration-200">
        <Sidebar isMobileDrawer={false} />
      </div>

      {/* Main Content Wrapper */}
      <div className="flex flex-col md:pl-[68px] lg:pl-[240px] flex-1 h-screen overflow-hidden transition-all duration-200">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/90 px-4 lg:px-6 backdrop-blur supports-[backdrop-filter]:bg-card/75 z-40">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setIsMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation</span>
          </Button>

          <div className="flex-1 text-sm font-medium text-muted-foreground">
            {getPageTitle()}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Theme Selector (Light, Dark, System) */}
            <ThemeToggle />

            {/* Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Settings & Preferences"
              aria-label="Settings"
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>

            {/* Notifications Popover */}
            <NotificationsPopover />

            {/* User Profile Dropdown Menu */}
            <ProfileDropdown
              userName={userName}
              userEmail={userEmail}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onLogout={handleLogout}
            />
          </div>
        </header>

        <main
          className={
            isFixedViewportPage
              ? 'flex-1 bg-background px-4 py-3 lg:px-6 lg:py-4 overflow-hidden flex flex-col min-h-0 pb-16 md:pb-4'
              : 'flex-1 bg-background p-4 lg:p-6 overflow-y-auto scroll-smooth pb-20 md:pb-6'
          }
        >
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="mobile-tab-bar">
        {MOBILE_TABS.map((tab) => {
          const isActive =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`mobile-tab-item ${isActive ? 'active' : ''}`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="mobile-tab-label">{tab.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Settings Dialog ── */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userName={userName}
        userEmail={userEmail}
        onLogout={handleLogout}
      />
    </div>
  )
}

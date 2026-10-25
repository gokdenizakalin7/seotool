'use client'

import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { QrCode, Menu as MenuIcon, LayoutDashboard, Settings, X, LogOut, Smartphone, ShieldCheck, Gift, BadgePercent, CalendarDays, Info, ExternalLink, CircleHelp } from 'lucide-react'
import { QrChefMark, QrChefWordmark } from '@/components/brand/qr-chef-logo'
import { siteUrl } from '@/lib/site-url'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { signOutClient } from '@/lib/session'
import { leaveTo } from '@/lib/leave-guard'
import { useTour } from '@/components/tour/TourProvider'

/** tour: panel rehberinin vurguladığı öğe kimliği (data-tour) */
type NavItem = { to: string; label: string; icon: React.ElementType; active: boolean; featured?: boolean; tour: string }

export function Sidebar({ 
  isSidebarOpen, 
  setIsSidebarOpen, 
  userInfo,
  userRole
}: { 
  isSidebarOpen: boolean; 
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>; 
  userInfo: { name: string; email: string; logoUrl?: string };
  userRole?: string;
}) {
  const location = useLocation()
  const navigate = useNavigate()

  const path = location.pathname.replace(/\/$/, '')

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Kontrol Paneli', icon: LayoutDashboard, active: path === '/dashboard', tour: 'nav-dashboard' },
    { to: '/dashboard/menu-editor', label: 'Canlı Menü Editörü', icon: Smartphone, active: path.startsWith('/dashboard/menu-editor'), featured: true, tour: 'nav-menu-editor' },
    { to: '/dashboard/menus', label: 'Menü Listesi', icon: MenuIcon, active: path.startsWith('/dashboard/menus'), tour: 'nav-menus' },
    { to: '/dashboard/qr-codes', label: 'QR Kodlar & Masalar', icon: QrCode, active: path.startsWith('/dashboard/qr-codes'), tour: 'nav-qr' },
    { to: '/dashboard/settings', label: 'Restoran Ayarları', icon: Settings, active: path.startsWith('/dashboard/settings'), tour: 'nav-settings' },
  ]

  // Müşterinin QR ile açtığı işletme sitesinin bölümleri
  const siteItems: NavItem[] = [
    { to: '/dashboard/campaigns', label: 'Kampanyalar', icon: Gift, active: path.startsWith('/dashboard/campaigns'), tour: 'nav-campaigns' },
    { to: '/dashboard/price-plans', label: 'Fiyat Planları', icon: BadgePercent, active: path.startsWith('/dashboard/price-plans'), tour: 'nav-price-plans' },
    { to: '/dashboard/events', label: 'Etkinlikler', icon: CalendarDays, active: path.startsWith('/dashboard/events'), tour: 'nav-events' },
    { to: '/dashboard/about', label: 'Hakkımızda', icon: Info, active: path.startsWith('/dashboard/about'), tour: 'nav-about' },
  ]
  const { restaurant } = useRestaurant()
  const { start: startTour } = useTour()

  const renderItem = (item: NavItem) => (
    <Link
      key={item.to}
      to={item.to}
      data-tour={item.tour}
      onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
      className={`group relative flex items-center rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors ${
        item.active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
      }`}
    >
      {item.active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-2xl bg-primary shadow-[0_6px_20px_rgba(15,23,42,0.25)] dark:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <item.icon className="relative z-10 mr-3 h-[18px] w-[18px]" />
      <span className="relative z-10">{item.label}</span>
      {item.featured && !item.active && (
        <span className="relative z-10 ml-auto rounded-full border border-border bg-card/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
          Canlı
        </span>
      )}
    </Link>
  )

  const handleLogout = () =>
    leaveTo(async () => {
      await signOutClient()
      navigate('/login')
    })

  return (
    <>
      {/* Dar ekranda açık kenar çubuğunun arkası kararır, dokununca kapanır (masaüstünde çubuk sabit, karartma yok) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            key="sidebar-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>
    <motion.aside
      className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between border-r border-border/60 bg-card/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-black/40 lg:relative lg:max-w-none lg:shadow-none"
      initial={false}
      animate={{ x: isSidebarOpen ? 0 : '-100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="min-h-0 overflow-y-auto">
        <div className="flex h-20 items-center justify-between px-5">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 shadow-lg backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
              <QrChefMark size={32} className="text-foreground" />
            </div>
            <div className="leading-tight">
              <span className="block text-lg font-extrabold tracking-tight text-foreground">
                <QrChefWordmark />
              </span>
              <span className="block text-[11px] font-medium text-muted-foreground">Restoran Yönetim Paneli</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
            <X className="h-5 w-5" />
            <span className="sr-only">Kapat</span>
          </Button>
        </div>

        <nav className="space-y-1.5 p-4">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Menü</p>
          {navItems.map(renderItem)}

          <div className="space-y-1.5" data-tour="nav-site">
            <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Web Sitem</p>
            {siteItems.map(renderItem)}
            {restaurant?.subdomain && (
              <a
                href={siteUrl(restaurant.subdomain)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center rounded-2xl px-3.5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
              >
                <ExternalLink className="mr-3 h-[18px] w-[18px]" />
                Sitemi Gör
              </a>
            )}
          </div>

          <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Yardım</p>
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) setIsSidebarOpen(false)
              startTour()
            }}
            className="flex w-full items-center rounded-2xl px-3.5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
          >
            <CircleHelp className="mr-3 h-[18px] w-[18px]" />
            Panel Rehberi
          </button>

          {userRole === 'superadmin' && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <Link
                to="/admin"
                className="flex items-center rounded-2xl border border-border bg-card/50 px-3.5 py-3 text-xs font-bold text-foreground backdrop-blur-md transition-all hover:bg-accent"
              >
                <ShieldCheck className="mr-3 h-4 w-4" />
                Süper Admin Paneli
              </Link>
            </div>
          )}
        </nav>
      </div>

      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-start rounded-2xl border border-border/60 bg-card/60 p-2.5 backdrop-blur-xl hover:bg-accent dark:border-white/10 dark:bg-white/5">
              <Avatar className="mr-3 h-10 w-10 border-2 border-border">
                <AvatarImage src={userInfo.logoUrl || ""} alt={userInfo.name} className="object-contain bg-white" />
                <AvatarFallback className="bg-primary/10 font-bold text-foreground">
                  {userInfo.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start truncate text-left">
                <span className="truncate text-sm font-semibold leading-tight text-foreground">{userInfo.name}</span>
                <span className="truncate text-xs text-muted-foreground">{userInfo.email}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuItem onClick={() => leaveTo(() => navigate('/dashboard/settings'), '/dashboard/settings')}>
              <Settings className="h-4 w-4 mr-2" /> Restoran Ayarları
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
    </>
  )
}

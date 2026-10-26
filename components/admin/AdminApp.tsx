'use client'

import React, { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Building2,
  FolderTree,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Package,
  Settings,
  Store,
  Users,
  X,
} from 'lucide-react'
import { QrChefMark, QrChefWordmark } from '@/components/brand/qr-chef-logo'
import { Button } from '@/components/ui/button'
import { PanelBackground, PanelThemeProvider, ThemeToggle } from '@/components/theme/PanelTheme'
import { clearClientSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { adminApi } from './lib/admin-api'
import { OverviewPage } from './overview/OverviewPage'
import { RestaurantsPage } from './restaurants/RestaurantsPage'
import { RestaurantDetailPage } from './restaurants/RestaurantDetailPage'
import { ApplicationsPage } from './applications/ApplicationsPage'
import { UsersPage } from './users/UsersPage'
import { CategoriesPage } from './catalog/CategoriesPage'
import { ItemsPage } from './catalog/ItemsPage'
import { BusinessTypesPage } from './business/BusinessTypesPage'
import { AnalyticsPage } from './analytics/AnalyticsPage'
import { SettingsPage } from './settings/SettingsPage'
import { AuditLogPage } from './audit/AuditLogPage'

const NAV: { group: string; items: { to: string; label: string; icon: React.ElementType; exact?: boolean }[] }[] = [
  {
    group: 'Genel',
    items: [
      { to: '/admin', label: 'Genel Bakış', icon: LayoutDashboard, exact: true },
      { to: '/admin/analytics', label: 'Analitik', icon: BarChart3 },
    ],
  },
  {
    group: 'Hesaplar',
    items: [
      { to: '/admin/applications', label: 'Başvurular', icon: Inbox },
      { to: '/admin/restaurants', label: 'Restoranlar', icon: Building2 },
      { to: '/admin/users', label: 'Kullanıcılar', icon: Users },
    ],
  },
  {
    group: 'Katalog',
    items: [
      { to: '/admin/catalog/categories', label: 'Kategori Ağacı', icon: FolderTree },
      { to: '/admin/catalog/items', label: 'Ürünler & Görseller', icon: Package },
      { to: '/admin/business-types', label: 'İşletme Türleri & Şablonlar', icon: Store },
    ],
  },
  {
    group: 'Sistem',
    items: [
      { to: '/admin/settings', label: 'Platform Ayarları', icon: Settings },
      { to: '/admin/audit', label: 'İşlem Geçmişi', icon: History },
    ],
  },
]

export function AdminApp() {
  return (
    <PanelThemeProvider>
      <AdminShell />
    </PanelThemeProvider>
  )
}

function AdminShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const path = location.pathname.replace(/\/$/, '') || '/admin'
  // Onay bekleyen başvuru sayısı: menüde rozet (her sayfa geçişinde tazelenir)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    let alive = true
    adminApi<{ counts: { pending: number } }>('/api/admin/applications?summary=1')
      .then((d) => alive && setPendingCount(d.counts?.pending ?? 0))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [location.pathname])

  const handleLogout = async () => {
    clearClientSession()
    await supabase.auth.signOut().catch(() => undefined)
    navigate('/login')
  }

  const sidebar = (
    <div className="flex min-h-full flex-col justify-between">
      <div>
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 shadow-lg dark:border-white/20 dark:bg-white/10">
            <QrChefMark size={28} className="text-foreground" />
          </div>
          <div className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight text-foreground">
              <QrChefWordmark />
            </span>
            <span className="block text-[11px] font-medium text-muted-foreground">Sistem Yöneticisi</span>
          </div>
        </div>
        <nav className="space-y-4 p-3">
          {NAV.map((g) => (
            <div key={g.group} className="space-y-1">
              <p className="px-3 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{g.group}</p>
              {g.items.map((item) => {
                const active = item.exact ? path === item.to : path === item.to || path.startsWith(item.to + '/')
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'relative flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="admin-nav-pill"
                        className="absolute inset-0 rounded-xl bg-primary shadow-[0_6px_20px_rgba(15,23,42,0.25)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className="relative z-10 mr-3 h-4 w-4" />
                    <span className="relative z-10">{item.label}</span>
                    {item.to === '/admin/applications' && pendingCount > 0 && (
                      <span
                        className={cn(
                          'relative z-10 ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                          active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-500 text-white'
                        )}
                        title={`${pendingCount} başvuru onay bekliyor`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>
        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-600 hover:bg-red-500/10">
          <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
        </Button>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <PanelBackground />

      {/* Masaüstü yan menü */}
      <aside className="relative z-20 hidden w-64 shrink-0 overflow-y-auto border-r border-border/60 bg-card/70 backdrop-blur-2xl dark:border-white/10 dark:bg-black/40 lg:block">
        {sidebar}
      </aside>

      {/* Mobil yan menü */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-border/60 bg-card shadow-2xl">
            <Button variant="ghost" size="icon" className="absolute right-2 top-3" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border/60 bg-card/60 px-4 backdrop-blur-2xl dark:border-white/10 dark:bg-black/30 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <MenuIcon className="h-5 w-5" />
          </Button>
          <span className="font-bold">Sistem Yöneticisi</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
            <Routes>
              <Route index element={<OverviewPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="restaurants" element={<RestaurantsPage />} />
              <Route path="restaurants/:id" element={<RestaurantDetailPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="catalog" element={<Navigate to="/admin/catalog/items" replace />} />
              <Route path="catalog/categories" element={<CategoriesPage />} />
              <Route path="catalog/items" element={<ItemsPage />} />
              <Route path="business-types" element={<BusinessTypesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit" element={<AuditLogPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

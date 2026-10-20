'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { PageTransition, useSmoothScroll, useRevealOnScroll } from '@/components/dashboard/ScrollNavigation'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { AccountBanners } from '@/components/dashboard/AccountBanners'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'
import { PanelThemeProvider, PanelBackground } from '@/components/theme/PanelTheme'
import { TourProvider } from '@/components/tour/TourProvider'
import {
  AboutContent,
  CampaignsContent,
  DASHBOARD_PAGES,
  DashboardContent,
  EventsContent,
  LiveMenuEditor,
  MenusContent,
  PricePlansContent,
  QRCodesContent,
  SettingsContent,
} from '@/components/lazy-pages'
import { preloadWhenIdle } from '@/lib/lazy-page'

/**
 * Restoran paneli iskeleti (kenar çubuğu, üst bar, sayfa geçişi). Ayrı pakettir; sayfalar da ayrı paketlerdir
 * (components/lazy-pages.ts) ve panel açılınca boşta önceden indirilir.
 */

function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useSmoothScroll(mainRef)
  useRevealOnScroll(mainRef)
  const { restaurant: currentRestaurant, role: userRole, email, isLoading } = useRestaurant()

  // Diğer panel sayfaları boşta indirilir: menüler arası geçişte paket beklenmez
  useEffect(() => preloadWhenIdle(DASHBOARD_PAGES), [])

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 1024)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const userInfo = {
    name: currentRestaurant?.name || 'Yükleniyor...',
    email: email || '...',
    logoUrl: currentRestaurant?.branding?.logoUrl || ''
  }

  return (
    <PanelThemeProvider>
    {/* Panel rehberi: ilk girişlerde zorunlu tur; sonra üst bardaki (?) menüsünden bölüm bölüm */}
    <TourProvider setSidebarOpen={setIsSidebarOpen}>
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <PanelBackground />
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        userInfo={userInfo}
        userRole={userRole}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header 
          setIsSidebarOpen={setIsSidebarOpen} 
          restaurantName={currentRestaurant?.name}
          subdomain={currentRestaurant?.subdomain}
          logoUrl={currentRestaurant?.branding?.logoUrl}
        />
        <AccountBanners />

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <PageTransition mainRef={mainRef}>
            {isLoading ? (
              <PageSpinner />
            ) : (
            <Suspense fallback={<PageSpinner />}>
            <Routes location={location}>
              <Route index element={<DashboardContent />} />
              <Route path="" element={<DashboardContent />} />
              <Route path="/" element={<DashboardContent />} />
              <Route path="menu-editor" element={<LiveMenuEditor />} />
              <Route path="/menu-editor" element={<LiveMenuEditor />} />
              <Route path="menus" element={<MenusContent />} />
              <Route path="/menus" element={<MenusContent />} />
              {/* Eski menü görüntüleme/düzenleme adresleri tek editöre yönlenir */}
              <Route path="menus/:id" element={<MenuEditorRedirect />} />
              <Route path="menus/:id/edit" element={<MenuEditorRedirect />} />
              <Route path="qr-codes" element={<QRCodesContent />} />
              <Route path="/qr-codes" element={<QRCodesContent />} />
              <Route path="settings" element={<SettingsContent />} />
              <Route path="/settings" element={<SettingsContent />} />
              {/* İşletme sitesi modülleri */}
              <Route path="price-plans" element={<PricePlansContent />} />
              <Route path="/price-plans" element={<PricePlansContent />} />
              <Route path="campaigns" element={<CampaignsContent />} />
              <Route path="/campaigns" element={<CampaignsContent />} />
              <Route path="events" element={<EventsContent />} />
              <Route path="/events" element={<EventsContent />} />
              <Route path="about" element={<AboutContent />} />
              <Route path="/about" element={<AboutContent />} />
              <Route path="*" element={<DashboardContent />} />
            </Routes>
            </Suspense>
            )}
          </PageTransition>
        </main>
      </div>
    </div>
    </TourProvider>
    </PanelThemeProvider>
  )
}

/** /dashboard/menus/:id(/edit) → canlı editörde o menü */
function MenuEditorRedirect() {
  const { id } = useParams()
  return <Navigate to={`/dashboard/menu-editor${id ? `?menu=${encodeURIComponent(id)}` : ''}`} replace />
}

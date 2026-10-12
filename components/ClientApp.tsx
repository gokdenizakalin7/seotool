'use client'

import React, { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { PageTransition, useSmoothScroll, useRevealOnScroll } from '@/components/dashboard/ScrollNavigation'

import { LandingPage } from '@/components/landing/LandingPage'
import { BusinessDirectory } from '@/components/landing/BusinessDirectory'
import { Login } from '@/components/auth/Login'
import { Signup } from '@/components/auth/Signup'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { RestaurantProvider, useRestaurant } from '@/components/providers/RestaurantProvider'
import { AdminApp } from '@/components/admin/AdminApp'
import { MustChangePasswordGate } from '@/components/auth/MustChangePasswordGate'
import { AccountBanners } from '@/components/dashboard/AccountBanners'
import { AdminGuard, AuthGuard, OnboardingGuard } from '@/components/auth/RouteGuards'

import { Sidebar } from '@/components/dashboard/Sidebar'
import { PanelThemeProvider, PanelBackground } from '@/components/theme/PanelTheme'
import { Header } from '@/components/dashboard/Header'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { LiveMenuEditor } from '@/components/dashboard/LiveMenuEditor'
import { MenusContent } from '@/components/dashboard/MenusContent'
import { QRCodesContent } from '@/components/dashboard/QRCodesContent'
import { SettingsContent } from '@/components/dashboard/SettingsContent'
import { PublicMenuView } from '@/components/public/PublicMenuView'
import { ImageCredits } from '@/components/public/ImageCredits'

function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useSmoothScroll(mainRef)
  useRevealOnScroll(mainRef)
  const { restaurant: currentRestaurant, role: userRole, email, isLoading } = useRestaurant()

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
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
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
              <Route path="*" element={<DashboardContent />} />
            </Routes>
            )}
          </PageTransition>
        </main>
      </div>
    </div>
    </PanelThemeProvider>
  )
}

/** /dashboard/menus/:id(/edit) → canlı editörde o menü */
function MenuEditorRedirect() {
  const { id } = useParams()
  return <Navigate to={`/dashboard/menu-editor${id ? `?menu=${encodeURIComponent(id)}` : ''}`} replace />
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-xl border border-red-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-gray-900">Bir Hata Oluştu</h2>
            <p className="text-xs text-gray-500 font-mono bg-gray-50 p-3 rounded-lg overflow-auto text-left max-h-32">
              {String(this.state.error?.message || this.state.error || 'Bilinmeyen hata')}
            </p>
            <button
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              className="w-full py-2.5 px-4 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Önbelleği Temizle ve Yeniden Yükle
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function ClientApp() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <MustChangePasswordGate />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<OnboardingGuard><OnboardingWizard /></OnboardingGuard>} />
          {/* Eski aktivasyon linkleri: şifreyi artık admin belirliyor */}
          <Route path="/activate" element={<Navigate to="/login" replace />} />
          <Route path="/admin/*" element={<AdminGuard><AdminApp /></AdminGuard>} />
          <Route path="/dashboard/*" element={<AuthGuard><RestaurantProvider><DashboardLayout /></RestaurantProvider></AuthGuard>} />
          <Route path="/business" element={<BusinessDirectory />} />
          <Route path="/menu/:subdomain" element={<PublicMenuView />} />
          <Route path="/gorsel-kaynaklari" element={<ImageCredits />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}

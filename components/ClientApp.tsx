'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import {
  AdminRoute,
  BusinessDirectory,
  DashboardRoute,
  ImageCredits,
  LandingPage,
  LegalPage,
  Login,
  OnboardingRoute,
  Signup,
  pagesForPath,
} from '@/components/lazy-pages'

function FullPageSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  )
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
    // Açılan sayfanın paketi ilk çizimden önce iner (spinner zaten görünür): Suspense beklemesi olmaz
    const pages = pagesForPath(window.location.pathname)
    Promise.all(pages.map((page) => page.preload()))
      .catch(() => {}) // yüklenemezse sayfa açılırken yeniden denenir (gerekirse bir kez yenilenir)
      .finally(() => setIsClient(true))
  }, [])

  if (!isClient) return <FullPageSpinner />

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        {/* Her sayfa ayrı paket (components/lazy-pages.ts): paket inene kadar tam ekran spinner */}
        <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          {/* Eski aktivasyon linkleri: şifreyi artık admin belirliyor */}
          <Route path="/activate" element={<Navigate to="/login" replace />} />
          <Route path="/admin/*" element={<AdminRoute />} />
          <Route path="/dashboard/*" element={<DashboardRoute />} />
          <Route path="/business" element={<BusinessDirectory />} />
          {/* /menu/:subdomain ayrı sunucu rotasıdır (app/menu/[subdomain]); panel paketine girmez */}
          <Route path="/gorsel-kaynaklari" element={<ImageCredits />} />
          <Route path="/kosullar" element={<LegalPage kind="terms" />} />
          <Route path="/gizlilik" element={<LegalPage kind="privacy" />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}

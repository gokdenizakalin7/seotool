'use client'

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/api-client'

/**
 * Admin Rota Kalkanı (AdminGuard)
 * /admin/* rotalarına yalnızca süper admin erişir. Restoran içindeki 'admin' rolü (org yöneticisi) bu panele giremez.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let isMounted = true
    const checkAdminStatus = async () => {
      try {
        const res = await authFetch('/api/auth/me')
        if (res.ok) {
          const user = await res.json()
          if (isMounted) {
            if (user.role !== 'superadmin') {
              setIsAuthorized(false)
              startRedirect('restaurant')
            } else {
              setIsAuthorized(true)
            }
          }
        } else {
          if (isMounted) {
            setIsAuthorized(false)
            startRedirect('restaurant')
          }
        }
      } catch (e) {
        if (isMounted) {
          setIsAuthorized(false)
          startRedirect('restaurant')
        }
      }
    }

    const startRedirect = (role: string) => {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            navigate(role === 'restaurant' ? '/dashboard/menu-editor' : '/login')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    checkAdminStatus()

    return () => { isMounted = false }
  }, [navigate])

  if (isAuthorized === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl space-y-5 border border-red-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner">
            <ShieldAlert className="h-9 w-9" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wider mb-2">
              403 • Yetkisiz Erişim
            </span>
            <h2 className="text-xl font-extrabold text-gray-900">Bu Sayfaya Erişim Yetkiniz Yok</h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Sistem yönetimi ve kullanıcı listeleri yalnızca <strong>Süper Yöneticilere (Admin)</strong> açıktır. Restoran kullanıcıları bu alana erişemez.
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-medium">
            {countdown > 0 ? (
              <p>{countdown} saniye içinde restoran panelinize yönlendiriliyorsunuz...</p>
            ) : (
              <p>Yönlendiriliyor...</p>
            )}
          </div>

          <div className="pt-2">
            <Button
              onClick={() => navigate('/dashboard/menu-editor')}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-5"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Restoran Paneline Dön
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

type GuardState = 'loading' | 'ok' | 'denied'

/**
 * Oturum Kalkanı (AuthGuard)
 * /dashboard/* için giriş zorunlu. Onboarding'i bitmemiş restoran kullanıcısı /onboarding'e gider.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [state, setState] = useState<GuardState>('loading')

  useEffect(() => {
    if (typeof window === 'undefined') return

    let isMounted = true
    const check = async () => {
      try {
        const res = await authFetch('/api/auth/me')
        if (!isMounted) return
        if (!res.ok) {
          setState('denied')
          navigate('/login')
          return
        }
        const me = await res.json()
        const isAdmin = me.role === 'superadmin'
        if (!isAdmin && me.organization && !me.organization.onboardingCompleted) {
          navigate('/onboarding', { replace: true })
          return
        }
        setState('ok')
      } catch (e) {
        if (isMounted) {
          setState('denied')
          navigate('/login')
        }
      }
    }
    check()

    return () => { isMounted = false }
  }, [navigate])

  if (state === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Giriş Yapmalısınız</h3>
          <p className="text-xs text-gray-500">Bu panele erişmek için lütfen önce giriş yapın.</p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Giriş Sayfasına Git
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Onboarding Kalkanı: giriş zorunlu; onboarding'i bitmiş kullanıcı /dashboard'a gider.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await authFetch('/api/auth/me')
        if (!isMounted) return
        if (!res.ok) {
          navigate('/login', { replace: true })
          return
        }
        const me = await res.json()
        if (me.role === 'superadmin') {
          navigate('/admin', { replace: true })
        } else if (!me.organization || me.organization.onboardingCompleted) {
          navigate('/dashboard', { replace: true })
        } else {
          setOk(true)
        }
      } catch {
        if (isMounted) navigate('/login', { replace: true })
      }
    })()
    return () => { isMounted = false }
  }, [navigate])

  if (!ok) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  return <>{children}</>
}

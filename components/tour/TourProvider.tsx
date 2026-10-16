'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { confirmLeave } from '@/lib/leave-guard'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { hasScrollNavGuard, scrollMainToElement } from '@/components/dashboard/ScrollNavigation'
import { TOUR_PAGE_ROUTES, TOUR_STEPS, type TourChapterId, type TourStep } from '@/lib/tour/tour-steps'
import { isTourForced, markTourCompleted, readTourState, type TourLoginState } from '@/lib/tour/tour-state'
import { TourOverlay } from '@/components/tour/TourOverlay'

/**
 * Panel rehberi motoru: adımlar arasında sayfa geçişi yapar, hedef öğeyi bekler ve görünür kılar,
 * klavye kısayollarını dinler; ilk girişlerde rehberi kendiliğinden (atlanamaz) başlatır.
 */

export interface TourStartOptions {
  /** Yalnızca bu bölümün adımları; yoksa tüm tur */
  chapter?: TourChapterId
  /** Atlanamaz (ilk girişler) */
  forced?: boolean
  /** Yarıda kalan zorunlu tura kaldığı yerden devam (sayfa yenileme / yeniden kurulum) */
  resume?: TourProgress
}

/** Zorunlu turun ilerlemesi (sessionStorage): sayfa yenilense ya da panel yeniden kurulsa tur baştan başlamaz */
interface TourProgress {
  loginAt: string
  index: number
  returnTo: string | null
}

const PROGRESS_KEY = 'qrchef_tour_progress'

function readProgress(loginAt: string): TourProgress | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<TourProgress>
    if (p.loginAt !== loginAt || typeof p.index !== 'number') return null
    return { loginAt, index: p.index, returnTo: typeof p.returnTo === 'string' ? p.returnTo : null }
  } catch {
    return null
  }
}

function writeProgress(p: TourProgress | null) {
  try {
    if (p) sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
    else sessionStorage.removeItem(PROGRESS_KEY)
  } catch {
    // depolama kapalı
  }
}

interface TourRun {
  steps: TourStep[]
  index: number
  forced: boolean
  /** Tam tur bitince dönülecek adres (ör. kurulumdan gelen ?start=template yönlendirmesi); bölüm turunda yok */
  returnTo: string | null
}

export type TourStatus = 'idle' | 'loading' | 'active'

interface TourContextValue {
  active: boolean
  forced: boolean
  start: (opts?: TourStartOptions) => void
  stop: () => void
}

const Ctx = createContext<TourContextValue | null>(null)

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Koşul sağlanana ya da süre dolana kadar bekler (kısa aralıklarla yoklar) */
async function waitFor<T>(probe: () => T | null | undefined, timeoutMs: number, alive: () => boolean): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = probe()
    if (found) return found
    if (!alive() || Date.now() >= deadline) return null
    await sleep(60)
  }
}

const normalizePath = (p: string) => (p.replace(/\/$/, '') || '/dashboard')
const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 1024

export function TourProvider({
  children,
  setSidebarOpen,
}: {
  children: React.ReactNode
  /** Dar ekranda kenar çubuğunu açıp kapatır (adım kenar çubuğundaki bir öğeyi gösterirken) */
  setSidebarOpen: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { restaurant, role, isLoading, impersonating, isSuspended } = useRestaurant()

  const [run, setRun] = useState<TourRun | null>(null)
  const [status, setStatus] = useState<TourStatus>('idle')
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null)

  const runRef = useRef<TourRun | null>(null)
  runRef.current = run
  const tokenRef = useRef(0)
  const loginStateRef = useRef<TourLoginState | null>(null)

  const sidebarFor = useCallback(
    (step: TourStep) => {
      if (isNarrow()) setSidebarOpen(!!step.sidebar)
    },
    [setSidebarOpen]
  )

  const reset = useCallback(() => {
    tokenRef.current++
    setRun(null)
    setStatus('idle')
    setTargetEl(null)
    writeProgress(null)
    if (isNarrow()) setSidebarOpen(false)
  }, [setSidebarOpen])

  const finish = useCallback(
    async (current: TourRun) => {
      reset()
      if (current.forced) {
        const state = loginStateRef.current
        if (state) await markTourCompleted(state)
        toast.success('Panel turu tamamlandı', {
          description: 'İstediğiniz zaman sağ üstteki (?) düğmesinden yeniden açabilirsiniz.',
        })
      }
      if (current.returnTo && current.returnTo !== window.location.pathname + window.location.search) {
        navigate(current.returnTo, { replace: true })
      }
    },
    [navigate, reset]
  )

  const activate = useCallback(
    async (current: TourRun, index: number, dir: 1 | -1) => {
      const token = ++tokenRef.current
      const alive = () => tokenRef.current === token

      if (index < 0) {
        index = 0
        dir = 1
      }
      if (index >= current.steps.length) {
        finish(current)
        return
      }
      const step = current.steps[index]
      const next: TourRun = { ...current, index }
      setRun(next)
      setStatus('loading')
      setTargetEl(null)
      if (next.forced && loginStateRef.current) {
        writeProgress({ loginAt: loginStateRef.current.loginAt, index, returnTo: next.returnTo })
      }

      // Sayfa: gerekirse geç, verisi yüklenene kadar bekle
      let navigated = false
      if (step.page) {
        const route = TOUR_PAGE_ROUTES[step.page]
        if (normalizePath(window.location.pathname) !== route) {
          navigated = true
          navigate(route)
        }
        const ready = await waitFor(
          () => document.querySelector(`[data-tour-page="${step.page}"][data-tour-ready="true"]`),
          12000,
          alive
        )
        if (!alive()) return
        if (!ready && step.optional) {
          activate(next, index + dir, dir)
          return
        }
      }

      sidebarFor(step)
      if (step.sidebar && isNarrow()) await sleep(380) // çubuğun açılma animasyonu
      if (!alive()) return

      let el: HTMLElement | null = null
      if (step.target) {
        // Sayfa zaten ekrandaysa hedefin olup olmadığı hemen bellidir; yeni açıldıysa kısa süre beklenir
        el = await waitFor(
          () => document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`),
          step.optional ? (navigated ? 600 : 100) : 3000,
          alive
        )
        if (!alive()) return
        if (!el && step.optional) {
          activate(next, index + dir, dir)
          return
        }
        if (el) {
          const scrolled = scrollMainToElement(el)
          // Sayfa geçiş animasyonu / kaydırma otursun
          await sleep(scrolled ? 560 : navigated ? 360 : step.sidebar ? 60 : 90)
          if (!alive()) return
        }
      }

      setTargetEl(el)
      setStatus('active')
    },
    [finish, navigate, sidebarFor]
  )

  const start = useCallback(
    (opts: TourStartOptions = {}) => {
      if (!opts.forced) {
        // Sayfada kaydedilmemiş değişiklik varsa (editör, Web Sitem) rehber sayfa değiştirip kaybettirmesin
        if (hasScrollNavGuard()) {
          toast.warning('Önce kaydedilmemiş değişiklikleri kaydedin', {
            description: 'Rehber sayfalar arasında geçiş yapar; kaydedilmemiş değişiklikler kaybolabilir.',
          })
          return
        }
        if (!confirmLeave()) return
      }
      const steps = opts.chapter ? TOUR_STEPS.filter((s) => s.chapter === opts.chapter) : TOUR_STEPS
      if (!steps.length) return
      const resume = opts.resume && opts.resume.index < steps.length ? opts.resume : null
      const current: TourRun = {
        steps,
        index: 0,
        forced: !!opts.forced,
        returnTo: resume ? resume.returnTo : opts.chapter ? null : window.location.pathname + window.location.search,
      }
      activate(current, resume ? resume.index : 0, 1)
    },
    [activate]
  )

  const stop = useCallback(() => {
    if (runRef.current?.forced) return
    reset()
  }, [reset])

  const next = useCallback(() => {
    const current = runRef.current
    if (!current || status !== 'active') return
    activate(current, current.index + 1, 1)
  }, [activate, status])

  const prev = useCallback(() => {
    const current = runRef.current
    if (!current || status !== 'active' || current.index === 0) return
    activate(current, current.index - 1, -1)
  }, [activate, status])

  // Hedef sayfadan kaybolduysa (ör. tarayıcı geri tuşu) adımı yeniden kur
  const onTargetLost = useCallback(() => {
    const current = runRef.current
    if (!current || status !== 'active') return
    activate(current, current.index, 1)
  }, [activate, status])

  // Klavye: → / ← adım, Esc kapat (zorunlu turda kapanmaz)
  useEffect(() => {
    if (!run) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        stop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, next, prev, stop])

  // Oturum kullanıcısı değişince (şifre belirlendi, rehber kaydedildi) zorunluluk yeniden değerlendirilir
  const [authTick, setAuthTick] = useState(0)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN') setAuthTick((t) => t + 1)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // İlk girişlerde rehber kendiliğinden başlar (sistem yöneticisi, "Panele Gir" ve salt-okunur hesaplar hariç)
  const autoStartedRef = useRef(false)
  useEffect(() => {
    if (autoStartedRef.current || isLoading || !restaurant || impersonating || role === 'superadmin' || isSuspended) return
    let cancelled = false
    ;(async () => {
      const state = await readTourState()
      if (cancelled || autoStartedRef.current || !state) return
      if (state.mustChangePassword || !isTourForced(state)) return
      autoStartedRef.current = true
      loginStateRef.current = state
      start({ forced: true, resume: readProgress(state.loginAt) ?? undefined })
    })()
    return () => {
      cancelled = true
    }
  }, [isLoading, restaurant, impersonating, role, isSuspended, authTick, start])

  const value = useMemo<TourContextValue>(
    () => ({ active: !!run, forced: !!run?.forced, start, stop }),
    [run, start, stop]
  )

  const step = run ? run.steps[run.index] : null

  return (
    <Ctx.Provider value={value}>
      {children}
      {run && step && (
        <TourOverlay
          step={step}
          index={run.index}
          total={run.steps.length}
          forced={run.forced}
          status={status}
          targetEl={targetEl}
          onNext={next}
          onPrev={prev}
          onClose={stop}
          onTargetLost={onTargetLost}
        />
      )}
    </Ctx.Provider>
  )
}

export function useTour() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTour, TourProvider içinde kullanılmalı')
  return v
}

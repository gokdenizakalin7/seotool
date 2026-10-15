'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Lenis from 'lenis'

/** Sidebar sırasıyla panel sayfaları. */
export const PANEL_PAGES = [
  { to: '/dashboard', label: 'Kontrol Paneli' },
  { to: '/dashboard/menu-editor', label: 'Canlı Menü Editörü' },
  { to: '/dashboard/menus', label: 'Menü Listesi' },
  { to: '/dashboard/qr-codes', label: 'QR Kodlar & Masalar' },
  { to: '/dashboard/settings', label: 'Restoran Ayarları' },
  { to: '/dashboard/campaigns', label: 'Kampanyalar' },
  { to: '/dashboard/price-plans', label: 'Fiyat Planları' },
  { to: '/dashboard/events', label: 'Etkinlikler' },
  { to: '/dashboard/about', label: 'Hakkımızda' },
]

type ScrollNavGuard = (to: string) => boolean
let scrollNavGuard: ScrollNavGuard | null = null

/** Sayfa scroll ile ayrılmayı kendisi ele almak isterse kaydeder; guard true dönerse geçiş yapılmaz. */
export function setScrollNavGuard(guard: ScrollNavGuard | null) {
  scrollNavGuard = guard
}

let lenisInstance: Lenis | null = null

/** getartcraft.com/apps ile aynı: Lenis, lerp 0.12 */
export function useSmoothScroll(mainRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      wrapper: main,
      content: main,
      eventsTarget: main,
      lerp: 0.12,
      allowNestedScroll: true,
    })
    lenisInstance = lenis

    let raf = 0
    const loop = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // İçerik değişince (sayfa/route/veri yüklemesi) yüksekliği yeniden ölç
    let timer: ReturnType<typeof setTimeout> | undefined
    const mo = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => lenis.resize(), 120)
    })
    mo.observe(main, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      mo.disconnect()
      lenis.destroy()
      if (lenisInstance === lenis) lenisInstance = null
    }
  }, [mainRef])
}

function scrollMainTo(main: HTMLElement, where: 'top' | 'bottom') {
  const run = () => {
    if (lenisInstance) {
      lenisInstance.resize()
      lenisInstance.scrollTo(where === 'top' ? 0 : lenisInstance.limit, { immediate: true, force: true })
    } else {
      main.scrollTop = where === 'top' ? 0 : main.scrollHeight
    }
  }
  run()
  if (where === 'bottom') requestAnimationFrame(() => requestAnimationFrame(run))
}

const REVEAL_FROM = { opacity: '0', transform: 'translateY(28px)', filter: 'blur(8px)' }
const REVEAL_EASE = 'cubic-bezier(0.215, 0.61, 0.355, 1)' // GSAP power3.out

/**
 * getartcraft.com/apps "data-reveal" davranışı: öğe görünüme %88 çizgisini geçince
 * 28px aşağıdan + blur(8px)'den 0.9s power3.out ile netleşerek gelir. Grup içinde
 * yatay konuma göre (0–0.18s) kademeli gecikme uygulanır.
 */
export function useRevealOnScroll(mainRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const seen = new WeakSet<Element>()
    const delays = new WeakMap<Element, number>()

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          io.unobserve(el)
          const delay = delays.get(el) ?? 0
          const t = `0.9s ${REVEAL_EASE} ${delay}s`
          el.style.transition = `opacity ${t}, transform ${t}, filter ${t}`
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          el.style.filter = 'blur(0px)'
          let done = false
          const cleanup = () => {
            if (done) return
            done = true
            // Kalıntı transform/filter içerideki fixed öğeleri ve hover efektlerini bozmasın
            el.style.transition = el.style.opacity = el.style.transform = el.style.filter = el.style.willChange = ''
          }
          el.addEventListener('transitionend', e => { if (e.propertyName === 'opacity') cleanup() })
          setTimeout(cleanup, (0.9 + delay) * 1000 + 200)
        })
      },
      { root: main, rootMargin: '0px 0px -12% 0px', threshold: 0 }
    )

    const scan = () => {
      main.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el => {
        if (seen.has(el)) return
        seen.add(el)
        const group = el.closest('[data-reveal-group]')
        if (group && group !== el) {
          const g = group.getBoundingClientRect()
          const r = el.getBoundingClientRect()
          delays.set(el, g.width > 0 ? ((r.left - g.left) / g.width) * 0.18 : 0)
        }
        el.style.opacity = REVEAL_FROM.opacity
        el.style.transform = REVEAL_FROM.transform
        el.style.filter = REVEAL_FROM.filter
        el.style.willChange = 'opacity, transform, filter'
        io.observe(el)
      })
    }

    // MutationObserver mikro-görev olarak boyamadan önce çalışır; ilk karede titreme olmaz
    const mo = new MutationObserver(scan)
    mo.observe(main, { childList: true, subtree: true })
    scan()

    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [mainRef])
}

const THRESHOLD = 120 // geçiş için gereken ek kaydırma miktarı
const LOCK_MS = 1300

function normalize(pathname: string) {
  const p = pathname.replace(/\/$/, '')
  return p === '' ? '/dashboard' : p
}

function pageIndex(pathname: string) {
  const p = normalize(pathname)
  const idx = PANEL_PAGES.findIndex(page =>
    page.to === '/dashboard' ? p === '/dashboard' : p.startsWith(page.to)
  )
  return idx === -1 ? 0 : idx
}

function chainIndex(pathname: string) {
  const p = normalize(pathname)
  return PANEL_PAGES.findIndex(page =>
    page.to === '/dashboard' ? p === '/dashboard' : p === page.to
  )
}

/** Hedef eleman main içindeki kendi kaydırma alanına sahip bir kabın (ör. telefon önizlemesi) içinde mi? */
function isInScrollableArea(target: EventTarget | null, root: HTMLElement) {
  let el = target as HTMLElement | null
  while (el && el !== root) {
    if (el.nodeType === 1) {
      const style = getComputedStyle(el)
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return true
    }
    el = el.parentElement
  }
  return false
}

type Progress = { dir: 1 | -1; value: number; label: string } | null

/** Kaydırma ile sayfa geçişi + ilerleme ipucu. State burada tutulur; panelin geri kalanı yeniden render olmaz. */
export function ScrollNavigator({ mainRef }: { mainRef: React.RefObject<HTMLElement | null> }) {
  const progress = useScrollPageNavigation(mainRef)
  return <ScrollHint progress={progress} />
}

function useScrollPageNavigation(mainRef: React.RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<Progress>(null)

  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    let acc = 0
    let lockUntil = 0
    let lastWheelAt = 0
    let gestureDir = 0
    let gestureOk = false
    let resetTimer: ReturnType<typeof setTimeout> | undefined

    const clear = () => {
      acc = 0
      setProgress(null)
    }

    const onWheel = (e: WheelEvent) => {
      const now = Date.now()
      const gap = now - lastWheelAt
      lastWheelAt = now

      // Geçiş sürerken gelen (ivme dahil) tüm olayları yut
      if (now < lockUntil) return

      const target = e.target as HTMLElement | null
      if (target?.closest('[role="dialog"], [role="menu"], [role="listbox"], textarea, input, select')) return
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 4) return

      const dy = e.deltaY
      const dir: 1 | -1 = dy > 0 ? 1 : -1

      // Yeni bir kaydırma hareketi mi? (kısa bir sessizlik sonrası ya da yön değişimi)
      if (gap > 200 || dir !== gestureDir) {
        // Aynı yönde art arda gelen kısa kaydırmalar (ör. fare tekerleği tıkları) birikmeye devam eder
        if (dir !== gestureDir) acc = 0
        gestureDir = dir
        const idx = chainIndex(pathRef.current)
        const hasNext = idx !== -1 && !!PANEL_PAGES[idx + dir]
        // Lenis açıkken kullanıcının ulaşmak istediği (hedef) konuma bakılır
        const pos = lenisInstance ? lenisInstance.targetScroll : main.scrollTop
        const max = lenisInstance ? lenisInstance.limit : main.scrollHeight - main.clientHeight
        const atTop = pos <= 1
        const atBottom = pos >= max - 2
        // Hareket zaten sayfa sınırındayken başladıysa geçiş yapılabilir.
        // Aksi halde (normal kaydırmanın ivmesi sona vurduysa) geçiş yapılmaz.
        gestureOk = hasNext && (dir > 0 ? atBottom : atTop) && !isInScrollableArea(e.target, main)
      }

      if (!gestureOk) return

      const idx = chainIndex(pathRef.current)
      const nextPage = PANEL_PAGES[idx + dir]
      if (!nextPage) return

      acc += Math.abs(dy)
      const value = Math.min(acc / THRESHOLD, 1)
      setProgress({ dir, value, label: nextPage.label })

      clearTimeout(resetTimer)
      resetTimer = setTimeout(clear, 600)

      if (value >= 1) {
        clearTimeout(resetTimer)
        lockUntil = now + LOCK_MS
        gestureOk = false // aynı hareket ikinci kez geçiş yapamaz
        acc = 0
        setProgress(null)
        if (scrollNavGuard?.(nextPage.to)) return
        navigate(nextPage.to, { state: { scrollDir: dir } })
      }
    }

    main.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      main.removeEventListener('wheel', onWheel)
      clearTimeout(resetTimer)
    }
  }, [mainRef, navigate])

  return progress
}

export function ScrollHint({
  progress,
}: {
  progress: { dir: 1 | -1; value: number; label: string } | null
}) {
  return (
    <AnimatePresence>
      {progress && (
        <motion.div
          key={progress.dir}
          initial={{ opacity: 0, y: progress.dir > 0 ? 20 : -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: progress.dir > 0 ? 10 : -10 }}
          transition={{ duration: 0.2 }}
          className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 ${
            progress.dir > 0 ? 'bottom-5' : 'top-5'
          }`}
        >
          <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-black/60">
            {progress.dir > 0 ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span>{progress.label}</span>
            <span className="relative h-1 w-16 overflow-hidden rounded-full bg-foreground/10">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${progress.value * 100}%` }}
              />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const variants = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir * 90,
    scale: 0.985,
  }),
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    // transform kalırsa içerideki `fixed` öğeler (ör. editörün kaydet çubuğu) ekrana göre konumlanmaz
    transitionEnd: { transform: 'none' },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir * -50,
    scale: 0.99,
    // Kısa çıkış: yeni sayfa (ve veri isteği) bu animasyon bitince başlar
    transition: { duration: 0.12, ease: [0.4, 0, 1, 1] as const },
  }),
}

/** Sayfalar arasında yönlü, blur'lu geçiş animasyonu. */
export function PageTransition({
  children,
  mainRef,
}: {
  children: React.ReactNode
  mainRef: React.RefObject<HTMLElement | null>
}) {
  const location = useLocation()
  const key = normalize(location.pathname).split('/').slice(0, 3).join('/')
  const idx = pageIndex(location.pathname)
  const prevIdx = useRef(idx)
  const dirRef = useRef<1 | -1>(1)

  if (prevIdx.current !== idx) {
    dirRef.current = idx > prevIdx.current ? 1 : -1
    prevIdx.current = idx
  }
  const dir = dirRef.current

  return (
    <AnimatePresence mode="wait" custom={dir} initial={false} onExitComplete={() => {
      const main = mainRef.current
      if (main) scrollMainTo(main, dir < 0 ? 'bottom' : 'top')
    }}>
      <motion.div
        key={key}
        custom={dir}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

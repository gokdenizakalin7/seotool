'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Lightbulb, Lock, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chapterTitle, type TourPlacement, type TourStep } from '@/lib/tour/tour-steps'
import type { TourStatus } from '@/components/tour/TourProvider'

/**
 * Rehber katmanı: karartılmış arka plan + hedef öğenin etrafında "spot ışığı" + açıklama kartı.
 * Arka plan tıklamaları yutar: tur sürerken panelle etkileşim kurulamaz (zorunlu turda atlanamaz).
 */

const PAD = 8 // spot ışığının hedef etrafındaki payı
const GAP = 14 // kart ile spot arası
const EDGE = 12 // kartın ekran kenarına en yakın mesafesi
const RADIUS = 18

type Rect = { top: number; left: number; width: number; height: number }
type Placement = Exclude<TourPlacement, 'auto'> | 'center'
type Position = { top: number; left: number; placement: Placement; arrow: number }

const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.8 } as const

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function computePosition(
  rect: Rect | null,
  size: { width: number; height: number },
  prefer: TourPlacement | undefined,
  vw: number,
  vh: number
): Position {
  if (!rect || size.width === 0) {
    return { top: Math.max(EDGE, (vh - size.height) / 2), left: Math.max(EDGE, (vw - size.width) / 2), placement: 'center', arrow: 0 }
  }
  const spot = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
  const space = {
    bottom: vh - (spot.top + spot.height),
    top: spot.top,
    right: vw - (spot.left + spot.width),
    left: spot.left,
  }
  const fits = (p: Exclude<Placement, 'center'>) =>
    p === 'bottom' || p === 'top' ? space[p] >= size.height + GAP + EDGE : space[p] >= size.width + GAP + EDGE
  const order: Exclude<Placement, 'center'>[] = ['bottom', 'top', 'right', 'left']
  if (prefer && prefer !== 'auto') order.unshift(prefer)
  // Hiçbir yöne sığmıyorsa (ekranı kaplayan hedef) en geniş boşluğa konur ve kart ekran içinde tutulur
  const placement = order.find(fits) ?? order.reduce((best, p) => (space[p] > space[best] ? p : best), order[0])

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))
  const centerX = spot.left + spot.width / 2
  const centerY = spot.top + spot.height / 2

  let top: number
  let left: number
  switch (placement) {
    case 'bottom':
      top = spot.top + spot.height + GAP
      left = centerX - size.width / 2
      break
    case 'top':
      top = spot.top - GAP - size.height
      left = centerX - size.width / 2
      break
    case 'right':
      top = centerY - size.height / 2
      left = spot.left + spot.width + GAP
      break
    default:
      top = centerY - size.height / 2
      left = spot.left - GAP - size.width
  }
  top = clamp(top, EDGE, vh - size.height - EDGE)
  left = clamp(left, EDGE, vw - size.width - EDGE)
  const arrow =
    placement === 'bottom' || placement === 'top'
      ? clamp(centerX - left, 24, size.width - 24)
      : clamp(centerY - top, 24, size.height - 24)
  return { top, left, placement, arrow }
}

export function TourOverlay({
  step,
  index,
  total,
  forced,
  status,
  targetEl,
  onNext,
  onPrev,
  onClose,
  onTargetLost,
}: {
  step: TourStep
  index: number
  total: number
  forced: boolean
  status: TourStatus
  targetEl: HTMLElement | null
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onTargetLost: () => void
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  // Hedefin konumunu her karede izle (sayfa geçişi, kaydırma, kenar çubuğu animasyonu)
  useEffect(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    if (!targetEl) {
      setRect(null)
      return () => window.removeEventListener('resize', onResize)
    }
    let raf = 0
    let last = ''
    const tick = () => {
      if (!targetEl.isConnected) {
        onTargetLost()
        return
      }
      const r = readRect(targetEl)
      const key = [r.top, r.left, r.width, r.height].map((n) => Math.round(n)).join(',')
      if (key !== last) {
        last = key
        setRect(r)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [targetEl, onTargetLost])

  // Kartın boyutu (yerleşim hesabı için)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [step.id, status])

  // Odak: ana düğme (klavyeyle Enter → İleri)
  useEffect(() => {
    if (status !== 'active') return
    cardRef.current?.querySelector<HTMLButtonElement>('[data-tour-primary]')?.focus({ preventScroll: true })
  }, [status, step.id])

  const isSheet = viewport.w > 0 && viewport.w < 640
  const centered = !rect || status !== 'active'
  const pos = computePosition(centered ? null : rect, size, step.placement, viewport.w, viewport.h)
  const isLast = index === total - 1
  const loading = status !== 'active'

  // Spot: hedef varsa etrafında, yoksa ekran ortasında sıfır boyut (tam karartma)
  const spot = rect && status === 'active'
    ? { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : { x: viewport.w / 2, y: viewport.h / 2, width: 0, height: 0 }

  // Dar ekranda kart alt (hedef üstteyse üst) kenara yapışık bir yaprak olur
  const sheetAtTop = isSheet && rect && status === 'active' && rect.top + rect.height / 2 > viewport.h / 2
  const cardStyle: React.CSSProperties = isSheet
    ? { left: EDGE, right: EDGE, width: 'auto', ...(sheetAtTop ? { top: EDGE } : { bottom: EDGE }) }
    : { top: pos.top, left: pos.left }

  const arrowStyle: React.CSSProperties | null =
    isSheet || pos.placement === 'center'
      ? null
      : pos.placement === 'bottom'
        ? { top: -6, left: pos.arrow - 6 }
        : pos.placement === 'top'
          ? { bottom: -6, left: pos.arrow - 6 }
          : pos.placement === 'right'
            ? { left: -6, top: pos.arrow - 6 }
            : { right: -6, top: pos.arrow - 6 }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="tour-layer fixed inset-0 z-[100]" aria-live="polite">
      {/* Karartma + spot ışığı (maske); katman tıklamaları yutar */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-spot-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            <motion.rect
              fill="#000"
              rx={RADIUS}
              ry={RADIUS}
              initial={false}
              animate={spot}
              transition={SPRING}
            />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(2, 6, 23, 0.7)" mask="url(#tour-spot-mask)" />
      </svg>

      {/* Hedefin etrafındaki parlayan çerçeve */}
      {rect && status === 'active' && (
        <motion.div
          aria-hidden
          className="tour-ring pointer-events-none absolute"
          style={{ borderRadius: RADIUS }}
          initial={false}
          animate={{ top: spot.y, left: spot.x, width: spot.width, height: spot.height, opacity: 1 }}
          transition={SPRING}
        />
      )}

      {/* Yükleniyor rozeti (sayfa geçişi / hedef bekleniyor) */}
      {loading && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-xl">
            <Loader2 className="h-4 w-4 animate-spin" /> Sayfa hazırlanıyor…
          </div>
        </div>
      )}

      {/* Açıklama kartı */}
      {!loading && (
        <motion.div
          key={step.id}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`tour-title-${step.id}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute z-[101] rounded-3xl border border-border/60 bg-popover/95 text-popover-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${
            pos.placement === 'center' && !isSheet ? 'w-[460px] max-w-[calc(100vw-24px)]' : 'w-[380px] max-w-[calc(100vw-24px)]'
          }`}
          style={cardStyle}
        >
          {arrowStyle && (
            <span
              aria-hidden
              className="absolute h-3 w-3 rotate-45 border-border/60 bg-popover"
              style={{
                ...arrowStyle,
                borderLeftWidth: pos.placement === 'right' || pos.placement === 'bottom' ? 1 : 0,
                borderTopWidth: pos.placement === 'bottom' || pos.placement === 'left' ? 1 : 0,
                borderRightWidth: pos.placement === 'left' || pos.placement === 'top' ? 1 : 0,
                borderBottomWidth: pos.placement === 'top' || pos.placement === 'right' ? 1 : 0,
              }}
            />
          )}

          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
                <Sparkles className="h-3 w-3" /> {chapterTitle(step.chapter)}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1} / {total}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>

            <h3 id={`tour-title-${step.id}`} className="pt-1 text-lg font-extrabold leading-tight tracking-tight text-foreground">
              {step.title}
            </h3>
            {step.body.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {step.bullets && (
              <ul className="space-y-1.5 text-sm leading-snug text-muted-foreground">
                {step.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            {step.tip && (
              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{step.tip}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              {forced ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground" title="İlk girişlerde rehber atlanamaz">
                  <Lock className="h-3 w-3" /> İlk girişte zorunlu
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Kapat
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onPrev} disabled={index === 0}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Geri
                </Button>
                <Button size="sm" onClick={onNext} data-tour-primary className="px-4">
                  {isLast ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Bitir
                    </>
                  ) : (
                    <>
                      İleri <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>,
    document.body
  )
}

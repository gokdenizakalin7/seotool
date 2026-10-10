'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Percent,
  ScanSearch,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { COMMON_ALLERGENS, type EditorCategory } from './types'

export interface ScanPhoto {
  id: string
  preview: string
}

/* ───────────── Özet / Kontrol paneli ───────────── */

export interface SummaryStats {
  categories: number
  items: number
  noName: number
  noPrice: number
  duplicate: number
  noCalories: number
  noImage: number
  complete: number
  /** Kataloğa bağlı ürün sayısı */
  catalogMatched?: number
  /** Bekleyen katalog önerisi olan ürün sayısı */
  catalogSuggested?: number
  /** Katalogda karşılığı olmayan ürün sayısı */
  catalogNone?: number
}

export function ScanSummaryPanel({
  stats,
  photos,
  onOpenPhoto,
  onNextIssue,
  issueCount,
}: {
  stats: SummaryStats
  photos: ScanPhoto[]
  onOpenPhoto: (index: number) => void
  onNextIssue: () => void
  issueCount: number
}) {
  const pct = stats.items === 0 ? 0 : Math.round((stats.complete / stats.items) * 100)
  const rows: { label: string; value: number; warn?: boolean }[] = [
    { label: 'Adı boş', value: stats.noName, warn: true },
    { label: 'Fiyatı eksik', value: stats.noPrice, warn: true },
    { label: 'Tekrar eden', value: stats.duplicate, warn: true },
    { label: 'Kalorisi eksik', value: stats.noCalories },
    { label: 'Görseli yok', value: stats.noImage },
    { label: 'Katalog önerisi bekleyen', value: stats.catalogSuggested ?? 0 },
    { label: 'Katalogda yok', value: stats.catalogNone ?? 0 },
  ]

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Özet</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-2xl font-bold">{stats.categories}</p>
            <p className="text-[11px] text-muted-foreground">Kategori</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-2xl font-bold">{stats.items}</p>
            <p className="text-[11px] text-muted-foreground">Ürün</p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-card p-3">
            <p className="text-2xl font-bold">{stats.catalogMatched ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Katalogdan eşleşen (görselli)</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold">Tamamlanma</span>
          <span className="font-bold text-primary">%{pct}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Adı ve fiyatı dolu ürünler</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold">Kontrol</p>
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-bold',
                  r.value === 0
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : r.warn
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-amber-500/10 text-amber-500'
                )}
              >
                {r.value}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5"
          disabled={issueCount === 0}
          onClick={onNextIssue}
        >
          {issueCount === 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sorun yok
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" /> Sıradaki sorun ({issueCount})
            </>
          )}
        </Button>
      </div>

      {photos.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <ScanSearch className="h-3.5 w-3.5" /> Taranan menü
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenPhoto(i)}
                className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border"
                title="Büyüt"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={`Sayfa ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── Kaynak fotoğraf görüntüleyici ───────────── */

export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: ScanPhoto[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(false)
  const photo = photos[index]
  if (!photo) return null
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center gap-2 p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium">
          Sayfa {index + 1} / {photos.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setZoom((z) => !z)}>
            {zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.preview}
          alt=""
          onClick={() => setZoom((z) => !z)}
          className={cn(
            'mx-auto select-none',
            zoom ? 'max-w-none cursor-zoom-out w-[200%]' : 'max-h-full max-w-full cursor-zoom-in object-contain'
          )}
        />
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
            <ChevronLeft className="h-4 w-4" /> Önceki
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={index === photos.length - 1}
            onClick={() => onIndexChange(index + 1)}
          >
            Sonraki <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* ───────────── Toplu işlem çubuğu ───────────── */

const selectCls =
  'h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function BulkActionBar({
  count,
  categories,
  onClear,
  onSelectVisible,
  onDelete,
  onMove,
  onPricePercent,
  onAddAllergen,
}: {
  count: number
  categories: EditorCategory[]
  onClear: () => void
  onSelectVisible: () => void
  onDelete: () => void
  onMove: (catId: string) => void
  onPricePercent: (percent: number) => void
  onAddAllergen: (allergen: string) => void
}) {
  const [percent, setPercent] = useState('')
  const [allergen, setAllergen] = useState('')

  return (
    <div className="absolute inset-x-3 bottom-4 z-40 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-border bg-popover/95 p-2.5 shadow-2xl backdrop-blur">
      <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{count} seçili</span>
      <button type="button" onClick={onSelectVisible} className="text-xs text-muted-foreground hover:text-foreground">
        Görünenleri seç
      </button>
      <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
        Temizle
      </button>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

      <select
        className={selectCls}
        value=""
        onChange={(e) => e.target.value && onMove(e.target.value)}
        aria-label="Kategoriye taşı"
      >
        <option value="">Kategoriye taşı…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || 'Adsız'}
          </option>
        ))}
      </select>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number(percent.replace(',', '.'))
          if (!Number.isFinite(n) || n === 0) return
          onPricePercent(n)
          setPercent('')
        }}
      >
        <div className="relative">
          <Percent className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="Zam/indirim"
            inputMode="decimal"
            className={cn(selectCls, 'w-28 pl-7')}
            title="Örn: 10 (zam) veya -10 (indirim)"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" className="h-8">
          Fiyata uygula
        </Button>
      </form>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (!allergen.trim()) return
          onAddAllergen(allergen.trim())
          setAllergen('')
        }}
      >
        <input
          list="scan-allergen-list"
          value={allergen}
          onChange={(e) => setAllergen(e.target.value)}
          placeholder="Alerjen ekle"
          className={cn(selectCls, 'w-32')}
        />
        <datalist id="scan-allergen-list">
          {COMMON_ALLERGENS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <Button type="submit" size="sm" variant="outline" className="h-8">
          Ekle
        </Button>
      </form>

      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" /> Sil
      </Button>
    </div>
  )
}
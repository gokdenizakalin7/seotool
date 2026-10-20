import { toIstanbulInput } from '@/lib/events'

/* ---- Açılır tarih / saat listeleri (tarayıcının tarih-saat kutuları yerine); etkinlik ve kampanya formları ---- */

export function todayIstanbul(): string {
  return toIstanbulInput(new Date().toISOString()).date
}

export const DAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** "2026-10-16" → yerel takvim günü (saat dilimi kayması olmasın diye öğlen) */
export function dayFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12)
}

function isoFromDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(iso: string, n: number): string {
  const d = dayFromIso(iso)
  d.setDate(d.getDate() + n)
  return isoFromDay(d)
}

function labelDay(iso: string, today: string): string {
  const base = DAY_FMT.format(dayFromIso(iso))
  if (iso === today) return `Bugün · ${base}`
  if (iso === addDays(today, 1)) return `Yarın · ${base}`
  return base
}

/**
 * `from` gününden (varsayılan bugün) itibaren `days` gün; seçili değer listede yoksa (ör. geçmiş tarih)
 * başa eklenir
 */
export function dateOptions(current: string, days: number, from?: string): { value: string; label: string }[] {
  const today = todayIstanbul()
  const start = from && from > today ? from : today
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < days; i++) {
    const iso = addDays(start, i)
    out.push({ value: iso, label: labelDay(iso, today) })
  }
  if (current && !out.some((o) => o.value === current)) out.unshift({ value: current, label: labelDay(current, today) })
  return out
}

/** 15 dakikalık adımlarla 00:00–23:45; seçili saat adımda değilse (ör. 21:10) listeye eklenir */
export const TIME_OPTIONS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export function timeOptions(current: string): string[] {
  return current && !TIME_OPTIONS.includes(current) ? [...TIME_OPTIONS, current].sort() : TIME_OPTIONS
}

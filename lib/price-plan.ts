import type { Menu } from '@/lib/types'
import { formatPrice, parsePrice, roundAmount, type Rounding } from '@/lib/price'

/**
 * Fiyat planları: mevcut menü fiyatlarının üzerine yüzde / sabit tutar artış-indirim, ürün bazında istisna,
 * kategori hariç tutma ve haftalık gün/saat takvimi. Saf fonksiyonlar; sunucu (müşteri sayfası) ve panel
 * (önizleme tablosu) aynı hesabı kullanır.
 */

export const ISTANBUL_TZ = 'Europe/Istanbul'

/** Haftalık pencere. days: ISO gün (1 = Pazartesi … 7 = Pazar). Bitiş ≤ başlangıç ise gece yarısını aşar. */
export interface ScheduleWindow {
  days: number[]
  start: string // "HH:MM"
  end: string // "HH:MM"
}

export interface PricePlan {
  id: string
  name: string
  bannerText?: string | null
  adjustmentType: 'percent' | 'fixed'
  /** İşaretli: +10 artış, -10 indirim (yüzde ya da para birimi) */
  adjustmentValue: number
  rounding: Rounding
  excludedCategoryIds: string[]
  schedule: ScheduleWindow[]
  scheduleEnabled: boolean
  displayOrder: number
  /** Ürün bazında istisna: sayı = bu fiyat, null = bu ürüne plan uygulanmaz */
  overrides: Record<string, number | null>
}

export interface PriceModeState {
  mode: 'auto' | 'manual'
  /** Elle modda seçilen plan; null = "Normal fiyatlar" */
  activePlanId: string | null
  /** Elle seçimin bitişi (ISO); null = süresiz. Bitince takvime dönülür. */
  manualUntil: string | null
}

export interface EffectivePlan {
  plan: PricePlan | null
  source: 'manual' | 'schedule' | 'none'
  /** Elle seçimin bitişi */
  until?: string | null
}

const WEEKDAY_TO_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ISTANBUL_TZ,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** İstanbul saatine göre haftanın günü (ISO) ve günün dakikası */
export function istanbulClock(now: Date): { isoDay: number; minutes: number } {
  const parts = clockFormatter.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  const hour = Number(get('hour')) % 24
  return { isoDay: WEEKDAY_TO_ISO[get('weekday')] || 1, minutes: hour * 60 + Number(get('minute')) }
}

/** "20:30" → 1230; geçersizse null */
export function parseClock(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const prevIsoDay = (d: number) => (d === 1 ? 7 : d - 1)

/** Pencere şu an açıksa başlangıcından bu yana geçen dakika, değilse null */
export function windowElapsed(win: ScheduleWindow, clock: { isoDay: number; minutes: number }): number | null {
  const start = parseClock(win.start)
  const end = parseClock(win.end)
  if (start == null || end == null || !win.days?.length) return null
  const m = clock.minutes
  if (end > start) {
    return win.days.includes(clock.isoDay) && m >= start && m < end ? m - start : null
  }
  // Gece yarısını aşan pencere (ör. 20:00–02:00): başladığı gün akşamı ya da ertesi gün sabahı
  if (win.days.includes(clock.isoDay) && m >= start) return m - start
  if (win.days.includes(prevIsoDay(clock.isoDay)) && m < end) return m + 1440 - start
  return null
}

/**
 * Şu an geçerli plan. Öncelik: (1) süresi dolmamış elle seçim (plan ya da "Normal fiyatlar"),
 * (2) takvimde şu an açık pencereler arasında en son başlamış olan, (3) normal fiyatlar.
 */
export function resolveEffectivePlan(plans: PricePlan[], state: PriceModeState, now: Date = new Date()): EffectivePlan {
  if (state.mode === 'manual' && (!state.manualUntil || now.getTime() < new Date(state.manualUntil).getTime())) {
    const plan = state.activePlanId ? plans.find((p) => p.id === state.activePlanId) ?? null : null
    return { plan, source: 'manual', until: state.manualUntil }
  }

  const clock = istanbulClock(now)
  let best: { plan: PricePlan; elapsed: number } | null = null
  for (const plan of plans) {
    if (!plan.scheduleEnabled) continue
    for (const win of plan.schedule || []) {
      const elapsed = windowElapsed(win, clock)
      if (elapsed == null) continue
      if (
        !best ||
        elapsed < best.elapsed ||
        (elapsed === best.elapsed && plan.displayOrder < best.plan.displayOrder)
      ) {
        best = { plan, elapsed }
      }
    }
  }
  return best ? { plan: best.plan, source: 'schedule' } : { plan: null, source: 'none' }
}

/** Takvimdeki bir sonraki pencere başlangıcı (7 gün içinde) */
export function nextScheduledWindow(
  plans: PricePlan[],
  now: Date = new Date()
): { plan: PricePlan; window: ScheduleWindow; startsAt: Date } | null {
  const clock = istanbulClock(now)
  let best: { plan: PricePlan; window: ScheduleWindow; inMinutes: number } | null = null
  for (const plan of plans) {
    if (!plan.scheduleEnabled) continue
    for (const win of plan.schedule || []) {
      const start = parseClock(win.start)
      if (start == null) continue
      for (let d = 0; d <= 7; d++) {
        const day = ((clock.isoDay - 1 + d) % 7) + 1
        if (!win.days.includes(day)) continue
        const inMinutes = d * 1440 + start - clock.minutes
        if (inMinutes <= 0) continue
        if (!best || inMinutes < best.inMinutes) best = { plan, window: win, inMinutes }
        break
      }
    }
  }
  if (!best) return null
  const startsAt = new Date(now.getTime() + best.inMinutes * 60_000)
  startsAt.setSeconds(0, 0)
  return { plan: best.plan, window: best.window, startsAt }
}

export interface PlanPriceContext {
  itemId: string
  categoryId?: string | null
  /** Kategorinin üst kategorisi (iki seviyeli menülerde hariç tutma üst kategoriden de gelir) */
  parentCategoryId?: string | null
}

export interface PlanPriceResult {
  price: string
  /** Fiyat düştüyse üstü çizili gösterilecek eski fiyat */
  original?: string
  changed: boolean
  /** Fiyat okunamadı; plan uygulanmadı */
  unparsable?: boolean
  /** Ürüne özel istisna kullanıldı */
  overridden?: boolean
}

/** Tek bir fiyatı plana göre hesaplar. Sıra: ürün istisnası → hariç kategori → okunamayan fiyat → kural + yuvarlama. */
export function applyPlanToPrice(
  price: string,
  ctx: PlanPriceContext,
  plan: PricePlan | null,
  currency: string = '₺'
): PlanPriceResult {
  if (!plan) return { price, changed: false }
  const base = parsePrice(price)
  const symbol = base?.currency || currency

  if (Object.prototype.hasOwnProperty.call(plan.overrides || {}, ctx.itemId)) {
    const override = plan.overrides[ctx.itemId]
    if (override == null) return { price, changed: false, overridden: true }
    const next = roundAmount(override, 'none')
    if (base && next === base.amount) return { price, changed: false, overridden: true }
    return {
      price: formatPrice(next, symbol),
      original: base && next < base.amount ? formatPrice(base.amount, symbol) : undefined,
      changed: true,
      overridden: true,
    }
  }

  const excluded = plan.excludedCategoryIds || []
  if (
    (ctx.categoryId && excluded.includes(ctx.categoryId)) ||
    (ctx.parentCategoryId && excluded.includes(ctx.parentCategoryId))
  ) {
    return { price, changed: false }
  }

  if (!base) return { price, changed: false, unparsable: true }

  const raw =
    plan.adjustmentType === 'percent'
      ? base.amount * (1 + plan.adjustmentValue / 100)
      : base.amount + plan.adjustmentValue
  const next = roundAmount(raw, plan.rounding)
  if (next === base.amount) return { price, changed: false }
  return {
    price: formatPrice(next, symbol),
    original: next < base.amount ? formatPrice(base.amount, symbol) : undefined,
    changed: true,
  }
}

/** Menüdeki tüm ürünlere planı uygular (menüyü değiştirmez; yeni nesne döner) */
export function applyPricePlanToMenu(menu: Menu, plan: PricePlan | null, currency: string = '₺'): Menu {
  if (!plan) return menu
  const parentOf = new Map((menu.categories || []).map((c) => [c.id, c.parent_id || null]))
  return {
    ...menu,
    categories: (menu.categories || []).map((cat) => ({
      ...cat,
      items: (cat.items || []).map((item) => {
        const result = applyPlanToPrice(
          item.price,
          { itemId: item.id, categoryId: cat.id, parentCategoryId: parentOf.get(cat.id) },
          plan,
          currency
        )
        if (!result.changed) return item
        return { ...item, price: result.price, original_price: result.original }
      }),
    })),
  }
}

/** Kısa açıklama: "%10 artış", "20 ₺ indirim" */
export function describePlan(plan: Pick<PricePlan, 'adjustmentType' | 'adjustmentValue'>, currency: string = '₺'): string {
  const value = Math.abs(plan.adjustmentValue)
  const amount = plan.adjustmentType === 'percent' ? `%${value.toLocaleString('tr-TR')}` : formatPrice(value, currency)
  if (plan.adjustmentValue === 0) return 'Değişiklik yok'
  return `${amount} ${plan.adjustmentValue > 0 ? 'artış' : 'indirim'}`
}

export const ISO_DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

/** Haftalık pencereyi hafta dakikası aralıklarına böler (gece yarısı ve Pazar→Pazartesi taşmaları dahil) */
function windowRanges(win: ScheduleWindow): Array<[number, number]> {
  const start = parseClock(win.start)
  const end = parseClock(win.end)
  if (start == null || end == null) return []
  const WEEK = 7 * 1440
  const out: Array<[number, number]> = []
  for (const day of win.days || []) {
    const s = (day - 1) * 1440 + start
    const e = end > start ? (day - 1) * 1440 + end : day * 1440 + end
    if (e <= WEEK) out.push([s, e])
    else {
      out.push([s, WEEK])
      out.push([0, e - WEEK])
    }
  }
  return out
}

/** Takvimleri çakışan plan çiftleri (panelde uyarı) */
export function findScheduleOverlaps(plans: PricePlan[]): Array<[PricePlan, PricePlan]> {
  const active = plans.filter((p) => p.scheduleEnabled && p.schedule?.length)
  const pairs: Array<[PricePlan, PricePlan]> = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i].schedule.flatMap(windowRanges)
      const b = active[j].schedule.flatMap(windowRanges)
      if (a.some(([as, ae]) => b.some(([bs, be]) => as < be && bs < ae))) pairs.push([active[i], active[j]])
    }
  }
  return pairs
}

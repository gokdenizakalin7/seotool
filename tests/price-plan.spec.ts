import { test, expect } from '@playwright/test'
import {
  applyPlanToPrice,
  applyPricePlanToMenu,
  describePlan,
  findScheduleOverlaps,
  istanbulClock,
  nextScheduledWindow,
  resolveEffectivePlan,
  windowElapsed,
  type PricePlan,
} from '../lib/price-plan'
import type { Menu } from '../lib/types'

const plan = (over: Partial<PricePlan> = {}): PricePlan => ({
  id: 'p1',
  name: 'Etkinlik Fiyatları',
  adjustmentType: 'percent',
  adjustmentValue: 20,
  rounding: '1',
  excludedCategoryIds: [],
  schedule: [{ days: [5], start: '20:00', end: '02:00' }],
  scheduleEnabled: true,
  displayOrder: 0,
  overrides: {},
  ...over,
})

const AUTO = { mode: 'auto' as const, activePlanId: null, manualUntil: null }

test.describe('İstanbul saati ve takvim penceresi', () => {
  test('istanbulClock UTC+3', () => {
    // 2026-10-16 Cuma 17:30 UTC = 20:30 İstanbul
    expect(istanbulClock(new Date('2026-10-16T17:30:00Z'))).toEqual({ isoDay: 5, minutes: 20 * 60 + 30 })
  })
  test('gece yarısını aşan pencere', () => {
    const win = { days: [5], start: '20:00', end: '02:00' }
    expect(windowElapsed(win, { isoDay: 5, minutes: 20 * 60 + 30 })).toBe(30)
    expect(windowElapsed(win, { isoDay: 6, minutes: 60 + 30 })).toBe(5 * 60 + 30) // Cumartesi 01:30
    expect(windowElapsed(win, { isoDay: 6, minutes: 2 * 60 + 30 })).toBeNull()
    expect(windowElapsed(win, { isoDay: 5, minutes: 19 * 60 })).toBeNull()
  })
  test('aynı gün pencere', () => {
    const win = { days: [1, 2], start: '17:00', end: '19:00' }
    expect(windowElapsed(win, { isoDay: 2, minutes: 18 * 60 })).toBe(60)
    expect(windowElapsed(win, { isoDay: 3, minutes: 18 * 60 })).toBeNull()
  })
})

test.describe('resolveEffectivePlan', () => {
  const plans = [plan()]
  test('takvim: Cuma 20:30 ve Cumartesi 01:30 aktif, 02:30 pasif', () => {
    expect(resolveEffectivePlan(plans, AUTO, new Date('2026-10-16T17:30:00Z'))).toMatchObject({ source: 'schedule', plan: { id: 'p1' } })
    expect(resolveEffectivePlan(plans, AUTO, new Date('2026-10-16T22:30:00Z')).source).toBe('schedule')
    expect(resolveEffectivePlan(plans, AUTO, new Date('2026-10-16T23:30:00Z'))).toEqual({ plan: null, source: 'none' })
  })
  test('takvim kapalıysa uygulanmaz', () => {
    expect(resolveEffectivePlan([plan({ scheduleEnabled: false })], AUTO, new Date('2026-10-16T17:30:00Z')).plan).toBeNull()
  })
  test('elle seçim takvimin önüne geçer; "Normal fiyatlar" da', () => {
    const now = new Date('2026-10-16T17:30:00Z')
    const other = plan({ id: 'p2', name: 'Happy Hour', scheduleEnabled: false })
    expect(resolveEffectivePlan([...plans, other], { mode: 'manual', activePlanId: 'p2', manualUntil: null }, now).plan?.id).toBe('p2')
    expect(resolveEffectivePlan(plans, { mode: 'manual', activePlanId: null, manualUntil: null }, now)).toMatchObject({ plan: null, source: 'manual' })
  })
  test('süresi dolan elle seçim takvime döner', () => {
    const now = new Date('2026-10-16T17:30:00Z')
    const r = resolveEffectivePlan(plans, { mode: 'manual', activePlanId: null, manualUntil: '2026-10-16T10:00:00Z' }, now)
    expect(r.source).toBe('schedule')
  })
  test('çakışmada en son başlayan pencere kazanır', () => {
    const now = new Date('2026-10-16T19:00:00Z') // Cuma 22:00
    const late = plan({ id: 'late', schedule: [{ days: [5], start: '21:30', end: '23:00' }] })
    expect(resolveEffectivePlan([plan(), late], AUTO, now).plan?.id).toBe('late')
  })
  test('sıradaki pencere', () => {
    const next = nextScheduledWindow([plan()], new Date('2026-10-15T09:00:00Z')) // Perşembe 12:00
    expect(next?.plan.id).toBe('p1')
    expect(next?.startsAt.toISOString()).toBe('2026-10-16T17:00:00.000Z')
  })
})

test.describe('applyPlanToPrice', () => {
  test('yüzde artış ve yuvarlama; artışta eski fiyat gösterilmez', () => {
    expect(applyPlanToPrice('85 ₺', { itemId: 'a' }, plan())).toEqual({ price: '102 ₺', original: undefined, changed: true })
  })
  test('indirimde eski fiyat üstü çizili', () => {
    const r = applyPlanToPrice('100 ₺', { itemId: 'a' }, plan({ adjustmentValue: -15 }))
    expect(r).toMatchObject({ price: '85 ₺', original: '100 ₺', changed: true })
  })
  test('sabit tutar', () => {
    expect(applyPlanToPrice('120', { itemId: 'a' }, plan({ adjustmentType: 'fixed', adjustmentValue: -20 }), '₺').price).toBe('100 ₺')
  })
  test('ürün istisnası ve "uygulanmaz"', () => {
    const p = plan({ overrides: { a: 99, b: null } })
    expect(applyPlanToPrice('85 ₺', { itemId: 'a' }, p)).toMatchObject({ price: '99 ₺', overridden: true })
    expect(applyPlanToPrice('85 ₺', { itemId: 'b' }, p)).toMatchObject({ price: '85 ₺', changed: false })
  })
  test('hariç kategori (üst kategori dahil) ve okunamayan fiyat', () => {
    const p = plan({ excludedCategoryIds: ['drinks'] })
    expect(applyPlanToPrice('85 ₺', { itemId: 'a', categoryId: 'drinks' }, p).changed).toBe(false)
    expect(applyPlanToPrice('85 ₺', { itemId: 'a', categoryId: 'beer', parentCategoryId: 'drinks' }, p).changed).toBe(false)
    expect(applyPlanToPrice('S:50/L:70', { itemId: 'a' }, plan())).toMatchObject({ unparsable: true, changed: false })
  })
  test('plan yoksa fiyat aynen', () => {
    expect(applyPlanToPrice('85 ₺', { itemId: 'a' }, null)).toEqual({ price: '85 ₺', changed: false })
  })
})

test('applyPricePlanToMenu menüyü değiştirmez', () => {
  const menu = {
    id: 'm',
    categories: [
      { id: 'c1', parent_id: null, items: [{ id: 'i1', price: '100 ₺' }] },
      { id: 'c2', parent_id: 'c1', items: [{ id: 'i2', price: '50 ₺' }] },
    ],
  } as unknown as Menu
  const out = applyPricePlanToMenu(menu, plan({ adjustmentValue: -10, excludedCategoryIds: ['c1'] }))
  expect(out.categories[0].items[0].price).toBe('100 ₺')
  expect(out.categories[1].items[0].price).toBe('50 ₺') // üst kategori hariç
  expect(menu.categories[0].items[0].price).toBe('100 ₺')
  const all = applyPricePlanToMenu(menu, plan({ adjustmentValue: -10 }))
  expect(all.categories[1].items[0]).toMatchObject({ price: '45 ₺', original_price: '50 ₺' })
})

test('describePlan ve çakışma', () => {
  expect(describePlan(plan())).toBe('%20 artış')
  expect(describePlan(plan({ adjustmentType: 'fixed', adjustmentValue: -20 }))).toBe('20 ₺ indirim')
  const a = plan({ id: 'a', schedule: [{ days: [5], start: '20:00', end: '02:00' }] })
  const b = plan({ id: 'b', schedule: [{ days: [6], start: '01:00', end: '03:00' }] })
  const c = plan({ id: 'c', schedule: [{ days: [6], start: '03:00', end: '05:00' }] })
  expect(findScheduleOverlaps([a, b, c]).map(([x, y]) => `${x.id}-${y.id}`)).toEqual(['a-b'])
  // Pazar gecesi → Pazartesi sabahı taşması
  const sun = plan({ id: 'sun', schedule: [{ days: [7], start: '22:00', end: '02:00' }] })
  const mon = plan({ id: 'mon', schedule: [{ days: [1], start: '01:00', end: '02:00' }] })
  expect(findScheduleOverlaps([sun, mon])).toHaveLength(1)
})

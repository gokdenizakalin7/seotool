import { test, expect } from '@playwright/test'
import {
  endFromInputs,
  eventOccurrences,
  fromIstanbulInput,
  groupOccurrences,
  istanbulDateKey,
  toIstanbulInput,
  type SiteEvent,
} from '../lib/events'

const event = (over: Partial<SiteEvent> = {}): SiteEvent => ({
  id: 'e1',
  title: 'Canlı Müzik',
  description: '',
  startsAt: fromIstanbulInput('2026-10-16', '21:00'),
  endsAt: endFromInputs('2026-10-16', '21:00', '01:00'),
  repeatWeekly: false,
  repeatUntil: null,
  posterUrl: null,
  isPublished: true,
  ...over,
})

test('İstanbul saati dönüşümleri', () => {
  expect(fromIstanbulInput('2026-10-16', '21:00')).toBe('2026-10-16T18:00:00.000Z')
  expect(toIstanbulInput('2026-10-16T18:00:00.000Z')).toEqual({ date: '2026-10-16', time: '21:00' })
  // Bitiş başlangıçtan önce: ertesi gün
  expect(endFromInputs('2026-10-16', '21:00', '01:00')).toBe('2026-10-16T22:00:00.000Z')
  expect(istanbulDateKey('2026-10-16T22:30:00Z')).toBe('2026-10-17')
})

test('tek seferlik etkinlik: sürerken "şu an", bitince listeden çıkar', () => {
  expect(eventOccurrences([event()], new Date('2026-10-16T12:00:00Z'))[0]).toMatchObject({ isNow: false })
  expect(eventOccurrences([event()], new Date('2026-10-16T19:00:00Z'))[0]).toMatchObject({ isNow: true })
  expect(eventOccurrences([event()], new Date('2026-10-16T22:30:00Z'))).toHaveLength(0)
  expect(eventOccurrences([event({ isPublished: false })], new Date('2026-10-16T12:00:00Z'))).toHaveLength(0)
})

test('haftalık tekrar ve bitiş günü', () => {
  const weekly = event({ repeatWeekly: true, startsAt: fromIstanbulInput('2026-10-02', '21:00'), endsAt: endFromInputs('2026-10-02', '21:00', '23:00') })
  const occ = eventOccurrences([weekly], new Date('2026-10-15T12:00:00Z'), 30)
  expect(occ[0].start).toBe('2026-10-16T18:00:00.000Z')
  expect(occ.length).toBeGreaterThanOrEqual(4)
  const limited = eventOccurrences([{ ...weekly, repeatUntil: '2026-10-23' }], new Date('2026-10-15T12:00:00Z'), 60)
  expect(limited.map((o) => istanbulDateKey(o.start))).toEqual(['2026-10-16', '2026-10-23'])
})

test('gruplama: bugün / bu hafta / sonra', () => {
  const now = new Date('2026-10-16T09:00:00Z')
  const occ = eventOccurrences(
    [
      event(),
      event({ id: 'e2', startsAt: fromIstanbulInput('2026-10-20', '20:00'), endsAt: null }),
      event({ id: 'e3', startsAt: fromIstanbulInput('2026-11-05', '20:00'), endsAt: null }),
    ],
    now
  )
  const g = groupOccurrences(occ, now)
  expect(g.today.map((o) => o.event.id)).toEqual(['e1'])
  expect(g.thisWeek.map((o) => o.event.id)).toEqual(['e2'])
  expect(g.later.map((o) => o.event.id)).toEqual(['e3'])
})

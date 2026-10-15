/**
 * Etkinlikler (canlı müzik vb.): İstanbul saatiyle giriş/çıkış, haftalık tekrarların açılması ve
 * "Bugün / Bu hafta / Yaklaşan" gruplaması. Türkiye 2016'dan beri sürekli UTC+3 (yaz saati yok).
 */

export const ISTANBUL_TZ = 'Europe/Istanbul'
const ISTANBUL_OFFSET = '+03:00'
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
/** Bitiş saati girilmemiş etkinliğin varsayılan süresi */
export const DEFAULT_EVENT_DURATION_MS = 4 * HOUR_MS

export interface SiteEvent {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt: string | null
  repeatWeekly: boolean
  /** Haftalık tekrarın son günü (YYYY-MM-DD, İstanbul); null = süresiz */
  repeatUntil: string | null
  posterUrl: string | null
  isPublished: boolean
}

export interface EventOccurrence {
  event: SiteEvent
  start: string
  end: string
  /** Şu an sürüyor */
  isNow: boolean
}

/** "2026-10-16" + "21:00" (İstanbul) → ISO (UTC) */
export function fromIstanbulInput(date: string, time: string): string {
  return new Date(`${date}T${time}:00${ISTANBUL_OFFSET}`).toISOString()
}

/** ISO → İstanbul tarih ve saat alanları (form girişleri için) */
export function toIstanbulInput(iso: string): { date: string; time: string } {
  const shifted = new Date(new Date(iso).getTime() + ISTANBUL_OFFSET_MS).toISOString()
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) }
}

/** Bitiş saati başlangıçtan önceyse (ör. 21:00–02:00) ertesi güne taşar */
export function endFromInputs(date: string, startTime: string, endTime: string): string {
  const start = new Date(fromIstanbulInput(date, startTime)).getTime()
  let end = new Date(fromIstanbulInput(date, endTime)).getTime()
  if (end <= start) end += DAY_MS
  return new Date(end).toISOString()
}

/** İstanbul'a göre takvim günü (YYYY-MM-DD) */
export function istanbulDateKey(d: Date | string): string {
  return new Date(new Date(d).getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10)
}

function durationMs(event: SiteEvent): number {
  if (!event.endsAt) return DEFAULT_EVENT_DURATION_MS
  const ms = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()
  return ms > 0 ? ms : DEFAULT_EVENT_DURATION_MS
}

/**
 * Bitmemiş tüm oturumlar (sürenler dahil), başlangıca göre sıralı. Haftalık tekrarlar
 * horizonDays içinde ve tekrar bitiş gününe kadar açılır.
 */
export function eventOccurrences(
  events: SiteEvent[],
  now: Date = new Date(),
  horizonDays = 60,
  maxPerEvent = 8
): EventOccurrence[] {
  const nowMs = now.getTime()
  const horizon = nowMs + horizonDays * DAY_MS
  const out: EventOccurrence[] = []

  for (const event of events) {
    if (!event.isPublished) continue
    const start0 = new Date(event.startsAt).getTime()
    if (!Number.isFinite(start0)) continue
    const duration = durationMs(event)

    if (!event.repeatWeekly) {
      const end = start0 + duration
      if (end > nowMs && start0 < horizon) {
        out.push({
          event,
          start: new Date(start0).toISOString(),
          end: new Date(end).toISOString(),
          isNow: start0 <= nowMs,
        })
      }
      continue
    }

    // İlk bitmemiş tekrar
    let k = Math.max(0, Math.floor((nowMs - start0) / WEEK_MS))
    if (start0 + k * WEEK_MS + duration <= nowMs) k += 1
    for (let n = 0; n < maxPerEvent; n++, k++) {
      const start = start0 + k * WEEK_MS
      if (start >= horizon) break
      if (event.repeatUntil && istanbulDateKey(new Date(start)) > event.repeatUntil) break
      out.push({
        event,
        start: new Date(start).toISOString(),
        end: new Date(start + duration).toISOString(),
        isNow: start <= nowMs,
      })
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/** Bugün (ya da şu an süren), önümüzdeki 7 gün ve sonrası */
export function groupOccurrences(occurrences: EventOccurrence[], now: Date = new Date()) {
  const today = istanbulDateKey(now)
  const weekEnd = now.getTime() + 7 * DAY_MS
  const groups = { today: [] as EventOccurrence[], thisWeek: [] as EventOccurrence[], later: [] as EventOccurrence[] }
  for (const occ of occurrences) {
    if (occ.isNow || istanbulDateKey(occ.start) === today) groups.today.push(occ)
    else if (new Date(occ.start).getTime() < weekEnd) groups.thisWeek.push(occ)
    else groups.later.push(occ)
  }
  return groups
}

const LOCALES: Record<string, string> = { tr: 'tr-TR', en: 'en-GB', ar: 'ar', ru: 'ru-RU' }

/** "16 Ekim Cuma" */
export function formatEventDay(iso: string, lang = 'tr'): string {
  return new Intl.DateTimeFormat(LOCALES[lang] || 'tr-TR', {
    timeZone: ISTANBUL_TZ,
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date(iso))
}

/** "21:00" */
export function formatEventTime(iso: string, lang = 'tr'): string {
  return new Intl.DateTimeFormat(LOCALES[lang] || 'tr-TR', {
    timeZone: ISTANBUL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

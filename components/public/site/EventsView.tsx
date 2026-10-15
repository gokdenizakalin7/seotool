'use client'

import { CalendarDays, Clock, Repeat } from 'lucide-react'
import { formatEventDay, formatEventTime } from '@/lib/events'
import { useSiteLang } from './i18n'

export interface EventCard {
  key: string
  title: string
  description: string
  posterUrl: string | null
  start: string
  end: string
  isNow: boolean
  weekly: boolean
}

export interface EventGroups {
  today: EventCard[]
  thisWeek: EventCard[]
  later: EventCard[]
}

function EventItem({ event, primaryColor }: { event: EventCard; primaryColor: string }) {
  const { lang, t } = useSiteLang()
  return (
    <article className="overflow-hidden rounded-[24px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      {event.posterUrl ? (
        <img src={event.posterUrl} alt={event.title} loading="lazy" className="w-full aspect-[4/3] object-cover" />
      ) : (
        <div
          className="flex w-full aspect-[4/1] items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}
        >
          <CalendarDays className="h-10 w-10 text-white/60" />
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {event.isNow && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {t.liveNow}
            </span>
          )}
          {event.weekly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-gray-600 dark:text-zinc-300">
              <Repeat className="h-3 w-3" /> {t.weekly}
            </span>
          )}
        </div>
        <h3 className="text-lg font-extrabold leading-tight text-gray-900 dark:text-zinc-100">{event.title}</h3>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-zinc-300">
          <Clock className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
          <span>
            {formatEventDay(event.start, lang)} · {formatEventTime(event.start, lang)}–{formatEventTime(event.end, lang)}
          </span>
        </p>
        {event.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500 dark:text-zinc-400">{event.description}</p>
        )}
      </div>
    </article>
  )
}

/** Etkinlikler sekmesi: Bugün / Bu hafta / Yaklaşan */
export function EventsView({ groups, primaryColor }: { groups: EventGroups; primaryColor: string }) {
  const { t } = useSiteLang()
  const sections = [
    { key: 'today', title: t.today, items: groups.today },
    { key: 'thisWeek', title: t.thisWeek, items: groups.thisWeek },
    { key: 'later', title: t.upcoming, items: groups.later },
  ].filter((s) => s.items.length > 0)

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-8 mb-24">
      <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-zinc-100">{t.navEvents}</h2>
      {sections.length === 0 ? (
        <div className="rounded-[28px] bg-white dark:bg-[#2c2c2e] py-16 text-center text-gray-400 dark:text-zinc-500 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">{t.noEvents}</p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.key} className="space-y-3">
            <h3 className="border-b border-gray-200/60 dark:border-white/10 pb-2 text-lg font-bold text-gray-900 dark:text-zinc-100">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((event) => (
                <EventItem key={event.key} event={event} primaryColor={primaryColor} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}

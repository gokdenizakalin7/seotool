import type { Metadata } from 'next'
import { EventsView, type EventCard } from '@/components/public/site/EventsView'
import { brandColor } from '@/components/public/site/types'
import { getSiteEvents, getSiteRestaurant, requireSite, type SearchParams } from '@/lib/server/site'
import { eventOccurrences, groupOccurrences, type EventOccurrence } from '@/lib/events'
import { isValidSiteSlug } from '@/lib/site-url'
import { breadcrumbJsonLd, eventsDescription, eventsJsonLd, jsonLdHtml, sitePageMetadata } from '@/lib/site-seo'

/** Yaklaşan etkinlik yoksa sayfa boş: menüde bağlantısı da gizli, arama motoruna kapalı (sitemap'te de yok) */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = isValidSiteSlug(slug) ? await getSiteRestaurant(slug) : null
  if (!r || r.suspended) return {}
  const occurrences = r.id ? eventOccurrences(await getSiteEvents(r.id)) : []
  return {
    ...sitePageMetadata(r, slug, 'etkinlikler', `${r.name} Etkinlikleri${r.city ? ` | ${r.city}` : ''}`, eventsDescription(r, occurrences)),
    ...(occurrences.length ? {} : { robots: { index: false, follow: true } }),
  }
}

const toCard = (o: EventOccurrence): EventCard => ({
  key: `${o.event.id}-${o.start}`,
  title: o.event.title,
  description: o.event.description,
  posterUrl: o.event.posterUrl,
  start: o.start,
  end: o.end,
  isNow: o.isNow,
  weekly: o.event.repeatWeekly,
})

export default async function SiteEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const restaurant = await requireSite(slug, 'etkinlikler', await searchParams)
  if (restaurant.suspended || !restaurant.id) return null

  // Gruplama sunucuda (istek anı): istemci saatine göre değişip hidrasyon farkı oluşmasın
  const now = new Date()
  const occurrences = eventOccurrences(await getSiteEvents(restaurant.id), now)
  const groups = groupOccurrences(occurrences, now)
  const eventsLd = eventsJsonLd(restaurant, slug, occurrences)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(restaurant, slug, 'etkinlikler', 'Etkinlikler')) }}
      />
      {/* Google etkinlik sonuçları: her oturum ayrı Event */}
      {eventsLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(eventsLd) }} />}
      <EventsView
        primaryColor={brandColor(restaurant)}
        groups={{ today: groups.today.map(toCard), thisWeek: groups.thisWeek.map(toCard), later: groups.later.map(toCard) }}
      />
    </>
  )
}

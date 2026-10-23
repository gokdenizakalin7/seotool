import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { EVENT_SELECT, mapEventRow } from '@/lib/server/site-data'
import { eventOccurrences } from '@/lib/events'
import { canonicalOrigin, isValidSiteSlug, sitePath } from '@/lib/site-url'

/**
 * Ana sayfa + yayındaki (status: active) işletme siteleri. Etkinlikler sayfası yalnızca yaklaşan etkinliği olan
 * işletmede listelenir (yoksa sayfa noindex, bkz. app/[slug]/etkinlikler). Saatte bir yenilenir.
 */
export const revalidate = 3600

type OrgRow = { id: string; subdomain: string | null; status: string | null }

/** Yaklaşan etkinliği olan işletme kimlikleri; etkinlik tablosu yoksa (migration 15) boş */
async function orgsWithEvents(): Promise<Set<string>> {
  try {
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const rows = await fetchAll<any>(
      supabaseAdmin,
      'events',
      `organization_id, ${EVENT_SELECT}`,
      (q) => q.eq('is_published', true).or(`repeat_weekly.eq.true,starts_at.gte.${since}`),
      ['id']
    )
    const byOrg = new Map<string, any[]>()
    for (const row of rows) byOrg.set(row.organization_id, [...(byOrg.get(row.organization_id) || []), row])
    const now = new Date()
    return new Set([...byOrg].filter(([, list]) => eventOccurrences(list.map(mapEventRow), now).length > 0).map(([id]) => id))
  } catch {
    return new Set()
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalOrigin()
  const entries: MetadataRoute.Sitemap = [{ url: `${origin}/`, changeFrequency: 'weekly', priority: 1 }]

  let orgs: OrgRow[] = []
  try {
    orgs = await fetchAll<OrgRow>(supabaseAdmin, 'organizations', 'id, subdomain, status', undefined, ['id'])
  } catch (error) {
    console.error('sitemap organizations:', (error as Error).message)
    return entries
  }
  const withEvents = await orgsWithEvents()

  for (const org of orgs) {
    const slug = org.subdomain || ''
    // Onay bekleyen, reddedilen ve askıdaki işletmelerin sitesi yayında değil (noindex / 404)
    if ((org.status && org.status !== 'active') || !isValidSiteSlug(slug)) continue
    entries.push({ url: `${origin}${sitePath(slug)}`, changeFrequency: 'weekly', priority: 0.8 })
    if (withEvents.has(org.id)) entries.push({ url: `${origin}${sitePath(slug, 'etkinlikler')}`, changeFrequency: 'daily', priority: 0.6 })
    entries.push({ url: `${origin}${sitePath(slug, 'hakkimizda')}`, changeFrequency: 'monthly', priority: 0.5 })
    entries.push({ url: `${origin}${sitePath(slug, 'iletisim')}`, changeFrequency: 'monthly', priority: 0.5 })
  }
  return entries
}

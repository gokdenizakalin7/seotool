import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { EVENT_SELECT, mapEventRow } from '@/lib/server/site-data'
import { eventOccurrences } from '@/lib/events'
import { canonicalOrigin, isValidSiteSlug, sitePath } from '@/lib/site-url'
import { BLOG_POSTS, blogPostPath } from '@/lib/blog/posts'
import { BUSINESS_PAGES, businessPagePath } from '@/lib/marketing/business-pages'

/**
 * Ana sayfa, tanıtım sayfaları (/qr-menu, /blog, hukuki metinler) + yayındaki (status: active) işletme siteleri.
 * Etkinlikler sayfası yalnızca yaklaşan etkinliği olan işletmede listelenir (yoksa sayfa noindex, bkz. app/[slug]/etkinlikler).
 * İşletme sitelerinde lastmod yok: organizations/menus.updated_at her değişiklikte güncellenmiyor, yanlış tarih vermektense
 * hiç verilmez. Saatte bir yenilenir.
 */
export const revalidate = 3600

type OrgRow = { id: string; subdomain: string | null; status: string | null; cover_url: string | null; logo_url: string | null }

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

/** Kapak/logo görseli (görsel arama); base64 ve göreli adresler atlanır */
const imageOf = (org: OrgRow) => [org.cover_url, org.logo_url].find((u) => typeof u === 'string' && /^https?:\/\//.test(u))

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalOrigin()
  const latestPost = BLOG_POSTS.map((p) => p.updatedAt).sort().at(-1)
  const entries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/qr-menu`, changeFrequency: 'weekly', priority: 0.9 },
    ...BUSINESS_PAGES.map((p) => ({ url: `${origin}${businessPagePath(p.slug)}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${origin}/blog`, lastModified: latestPost, changeFrequency: 'weekly', priority: 0.8 },
    ...BLOG_POSTS.map((p) => ({ url: `${origin}${blogPostPath(p.slug)}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: `${origin}/gizlilik`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/kosullar`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  let orgs: OrgRow[] = []
  try {
    orgs = await fetchAll<OrgRow>(supabaseAdmin, 'organizations', 'id, subdomain, status, cover_url, logo_url', undefined, ['id'])
  } catch (error) {
    console.error('sitemap organizations:', (error as Error).message)
    return entries
  }
  const withEvents = await orgsWithEvents()

  for (const org of orgs) {
    const slug = org.subdomain || ''
    // Onay bekleyen, reddedilen ve askıdaki işletmelerin sitesi yayında değil (noindex / 404)
    if ((org.status && org.status !== 'active') || !isValidSiteSlug(slug)) continue
    const image = imageOf(org)
    entries.push({ url: `${origin}${sitePath(slug)}`, changeFrequency: 'weekly', priority: 0.8, ...(image ? { images: [image] } : {}) })
    if (withEvents.has(org.id)) entries.push({ url: `${origin}${sitePath(slug, 'etkinlikler')}`, changeFrequency: 'daily', priority: 0.6 })
    entries.push({ url: `${origin}${sitePath(slug, 'hakkimizda')}`, changeFrequency: 'monthly', priority: 0.5 })
    entries.push({ url: `${origin}${sitePath(slug, 'iletisim')}`, changeFrequency: 'monthly', priority: 0.5 })
  }
  return entries
}

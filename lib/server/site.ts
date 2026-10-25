import { cache } from 'react'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { getBusinessTypeInfo, getPublicMenus, getPublicRestaurant } from '@/lib/server/public-menu'
import { findMovedSlug, loadCampaigns, loadEvents, loadPricePlans } from '@/lib/server/site-data'
import { isValidSiteSlug, sitePath, type SitePage } from '@/lib/site-url'
import { buildAboutTemplate } from '@/lib/about-template'
import type { SiteRestaurant } from '@/components/public/site/types'

/**
 * İşletme sitesi (app/[slug]) sayfa yardımcıları. Yükleyiciler React cache() ile sarılı:
 * layout ve sayfa aynı istekte aynı sorguyu paylaşır.
 */

export const getSiteRestaurant = getPublicRestaurant as (slug: string) => Promise<(SiteRestaurant & Record<string, any>) | null>
export const getSitePricePlans = cache(loadPricePlans)
export const getSiteCampaigns = cache((orgId: string) => loadCampaigns(orgId, { onlyActive: true }))
export const getSiteEvents = cache((orgId: string) => loadEvents(orgId, { publishedUpcoming: true }))

/**
 * "Hakkımızda" metni: işletmenin yazdığı, yoksa türüne ve menüsüne göre otomatik metin.
 * Sayfa ve meta açıklaması aynı metni kullanır.
 */
export const getSiteAbout = cache(async (slug: string) => {
  const restaurant = await getSiteRestaurant(slug)
  if (!restaurant || restaurant.suspended) return null
  const [menus, typeInfo] = await Promise.all([getPublicMenus(slug), getBusinessTypeInfo(restaurant.business_type)])
  const categories = (menus[0]?.categories || []).filter((c) => !c.parent_id && c.items?.length).map((c) => c.name)
  const featured = (menus[0]?.categories || []).flatMap((c) => c.items || []).filter((i) => i.is_featured).map((i) => i.name)
  const text =
    restaurant.about_text?.trim() ||
    buildAboutTemplate({
      name: restaurant.name,
      businessType: restaurant.business_type,
      typeLabel: typeInfo.label,
      city: restaurant.city,
      categories,
      featured,
    })
  return { text, typeLabel: typeInfo.label, categories }
})

export type SearchParams = Record<string, string | string[] | undefined>

function toQueryString(query?: SearchParams): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else if (value != null) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Sayfanın işletmesini döndürür. Büyük harfli adres küçük harfe, adı değişmiş işletmenin eski adresi
 * yeni adresine (sorgu korunarak) yönlendirilir; bulunamazsa 404.
 */
export async function requireSite(
  slug: string,
  page: SitePage,
  query?: SearchParams
): Promise<SiteRestaurant & Record<string, any>> {
  const lower = slug.toLowerCase()
  // Büyük harfli adres kalıcı olarak küçük harfe (308); adı değişen işletmenin eski adresi geçici (ad yeniden değişebilir)
  if (lower !== slug && isValidSiteSlug(lower)) permanentRedirect(`${sitePath(lower, page)}${toQueryString(query)}`)
  if (!isValidSiteSlug(slug)) notFound()

  const restaurant = await getSiteRestaurant(slug)
  if (restaurant) return restaurant

  const moved = await findMovedSlug(slug)
  if (moved) redirect(`${sitePath(moved, page)}${toQueryString(query)}`)
  notFound()
}

export const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null

import type { Metadata } from 'next'
import { PublicMenuView } from '@/components/public/PublicMenuView'
import type { SiteNotice } from '@/components/public/site/types'
import { getPublicMenus } from '@/lib/server/public-menu'
import { firstParam, getSiteCampaigns, getSiteEvents, getSitePricePlans, getSiteRestaurant, requireSite, type SearchParams } from '@/lib/server/site'
import { priceModeFromOrg } from '@/lib/server/site-data'
import { applyPlanToPrice, applyPricePlanToMenu, resolveEffectivePlan } from '@/lib/price-plan'
import { applyItemDealsToMenu, buildCampaignCategory, type CampaignComponent } from '@/lib/campaigns'
import { eventOccurrences, istanbulDateKey } from '@/lib/events'
import { isValidSiteSlug, sitePath } from '@/lib/site-url'
import type { Menu, MenuItem } from '@/lib/types'

/**
 * Sitenin ana sayfası: menü. QR buraya açılır (?table=..&tid=.. masa sayacı için).
 * Fiyatlar istek anında geçerli fiyat planına göre (elle seçim > takvim > normal) hesaplanır;
 * kampanyalar "Kampanyalı Ürünler" kategorisi olarak en üstte görünür. İndirimli ürün kampanyaları
 * (ör. 19:00'a kadar Tuborg 165 ₺) ürünün kendi kategorisindeki fiyatını da değiştirir.
 */
/** Menü sayfası "<işletme> menü ve fiyatları" aramalarına; masa QR'ının ?table=..&tid=.. sorgusu canonical'a girmez */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (!isValidSiteSlug(slug)) return {}
  const r = await getSiteRestaurant(slug)
  if (!r || r.suspended) return {}
  return {
    title: { absolute: `${r.name} Menü ve Fiyatları${r.city ? ` | ${r.city}` : ''}` },
    alternates: { canonical: sitePath(slug) },
  }
}

export default async function SiteMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const query = await searchParams
  const restaurant = await requireSite(slug, '', query)
  if (restaurant.suspended || !restaurant.id) return null

  const [menus, plans, campaigns, events] = await Promise.all([
    getPublicMenus(slug),
    getSitePricePlans(restaurant.id),
    getSiteCampaigns(restaurant.id),
    getSiteEvents(restaurant.id),
  ])

  const now = new Date()
  const currency = restaurant.currency || '₺'
  const effective = resolveEffectivePlan(plans, priceModeFromOrg(restaurant), now)
  const baseMenu: Menu | undefined = menus[0]
  const pricedMenu = baseMenu ? applyPricePlanToMenu(baseMenu, effective.plan, currency) : undefined

  // Kampanya "normal" fiyatları menüde o an görünen (plan uygulanmış) fiyatlarla tutarlı olsun
  const shownPrices = new Map<string, string>()
  const menuItems = new Map<string, MenuItem>()
  for (const cat of pricedMenu?.categories || []) {
    for (const item of cat.items || []) {
      shownPrices.set(item.id, item.price)
      menuItems.set(item.id, item)
    }
  }
  const priceOf = (component: CampaignComponent) => {
    const item = component.item
    if (!item) return null
    return (
      shownPrices.get(item.id) ??
      applyPlanToPrice(item.price, { itemId: item.id, categoryId: item.category_id }, effective.plan, currency).price
    )
  }
  const campaignCategory = buildCampaignCategory(campaigns, { now, currency, priceOf, menuItemOf: (id) => menuItems.get(id) })

  let menu = pricedMenu ? applyItemDealsToMenu(pricedMenu, campaigns, { now, currency }) : undefined
  if (campaignCategory) {
    const shell: Menu = menu ?? {
      id: 'kampanyalar',
      name: restaurant.name,
      description: '',
      image_url: '',
      is_listed: true,
      available_days: [],
      layout: 'grid',
      created_at: '',
      updated_at: '',
      categories: [],
    }
    menu = { ...shell, categories: [campaignCategory, ...(shell.categories || [])] }
  }

  // Duyurular: fiyat planı mesajı + bugün / şu an süren etkinlik
  const notices: SiteNotice[] = []
  if (effective.plan?.bannerText) {
    notices.push({ id: `plan-${effective.plan.id}`, kind: 'price', text: effective.plan.bannerText })
  }
  const today = istanbulDateKey(now)
  const todayEvent = eventOccurrences(events, now, 2).find((o) => o.isNow || istanbulDateKey(o.start) === today)
  if (todayEvent) {
    notices.push({
      id: `event-${todayEvent.event.id}`,
      kind: 'event',
      text: todayEvent.event.title,
      startsAt: todayEvent.start,
      isNow: todayEvent.isNow,
      href: sitePath(slug, 'etkinlikler'),
    })
  }

  return (
    <PublicMenuView
      restaurant={restaurant}
      menu={menu}
      tableName={firstParam(query.table) || firstParam(query.masa)}
      tableId={firstParam(query.tid)}
      notices={notices}
    />
  )
}

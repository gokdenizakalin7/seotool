import type { MenuCategory, MenuItem } from '@/lib/types'
import { formatPrice, parsePrice } from '@/lib/price'

/**
 * Kampanyalar (ör. "Bira + Patates"): işletmenin kendi ürünlerinden oluşan paketler, kendi fiyatıyla.
 * Müşteri menüsünde "Kampanyalı Ürünler" adlı sözde kategori olarak en üstte görünür.
 */

export const CAMPAIGN_CATEGORY_ID = 'kampanyalar'

export interface CampaignComponentItem {
  id: string
  name: string
  price: string
  image_url?: string | null
  is_available?: boolean | null
  category_id?: string | null
}

export interface CampaignComponent {
  /** Menüdeki ürün; ürün silinmişse null (ad anlık kopyadan gelir) */
  itemId: string | null
  /** Kampanya kaydedildiği andaki ürün adı */
  name: string
  quantity: number
  /** Menüdeki ürünün güncel hali (yüklenebildiyse) */
  item?: CampaignComponentItem | null
}

export interface Campaign {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string | null
  isActive: boolean
  displayOrder: number
  validFrom: string | null
  validUntil: string | null
  items: CampaignComponent[]
}

export type CampaignStatus = 'ok' | 'empty' | 'missing_item' | 'unavailable_item'

/** Paneldeki uyarı ve müşteri sayfasındaki görünürlük için içerik durumu */
export function campaignStatus(campaign: Pick<Campaign, 'items'>): CampaignStatus {
  if (!campaign.items?.length) return 'empty'
  if (campaign.items.some((c) => !c.itemId || !c.item)) return 'missing_item'
  if (campaign.items.some((c) => c.item?.is_available === false)) return 'unavailable_item'
  return 'ok'
}

export function isCampaignInWindow(campaign: Pick<Campaign, 'validFrom' | 'validUntil'>, now: Date = new Date()): boolean {
  const t = now.getTime()
  if (campaign.validFrom && new Date(campaign.validFrom).getTime() > t) return false
  if (campaign.validUntil && new Date(campaign.validUntil).getTime() <= t) return false
  return true
}

/** Müşteriye gösterilir mi: aktif, tarih aralığında ve tüm ürünleri menüde mevcut */
export function isCampaignLive(campaign: Campaign, now: Date = new Date()): boolean {
  return campaign.isActive && isCampaignInWindow(campaign, now) && campaignStatus(campaign) === 'ok'
}

/** Ürünlerin ayrı ayrı alınınca toplamı; herhangi biri okunamazsa null */
export function campaignNormalTotal(
  components: CampaignComponent[],
  priceOf: (component: CampaignComponent) => string | null | undefined
): number | null {
  let total = 0
  for (const component of components) {
    const parsed = parsePrice(priceOf(component) ?? '')
    if (!parsed) return null
    total += parsed.amount * Math.max(1, component.quantity || 1)
  }
  return Math.round(total * 100) / 100
}

/** Kampanya avantaj yüzdesi (normal toplam kampanya fiyatından büyükse) */
export function campaignSavingsPercent(price: number, normalTotal: number | null): number | null {
  if (normalTotal == null || normalTotal <= 0 || price >= normalTotal) return null
  return Math.round(((normalTotal - price) / normalTotal) * 100)
}

/** "Bira + Patates" önerisi */
export function suggestCampaignName(components: Pick<CampaignComponent, 'name' | 'quantity'>[]): string {
  return components
    .map((c) => (c.quantity > 1 ? `${c.quantity}× ${c.name}` : c.name))
    .join(' + ')
    .slice(0, 80)
}

/**
 * Müşteri menüsü için sözde kategori. priceOf, menüde o an gösterilen (fiyat planı uygulanmış) fiyatı
 * vermeli ki "normal toplam" menüdeki fiyatlarla tutarlı olsun. Kampanya fiyatına plan uygulanmaz.
 */
export function buildCampaignCategory(
  campaigns: Campaign[],
  opts: {
    now?: Date
    currency?: string
    priceOf: (component: CampaignComponent) => string | null | undefined
  }
): MenuCategory | null {
  const now = opts.now ?? new Date()
  const currency = opts.currency || '₺'
  const items: MenuItem[] = campaigns
    .filter((c) => isCampaignLive(c, now))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c, index) => {
      const normal = campaignNormalTotal(c.items, opts.priceOf)
      const bundle = c.items.map((comp) => ({ name: comp.item?.name || comp.name, quantity: Math.max(1, comp.quantity || 1) }))
      const firstImage = c.items.map((comp) => comp.item?.image_url).find(Boolean) || ''
      return {
        id: `campaign:${c.id}`,
        name: c.name,
        description: c.description || bundle.map((b) => `${b.quantity}× ${b.name}`).join(', '),
        price: formatPrice(c.price, currency),
        original_price: normal != null && normal > c.price ? formatPrice(normal, currency) : undefined,
        image_url: c.imageUrl || firstImage,
        display_order: index,
        is_available: true,
        is_featured: false,
        tags: ['discount'],
        bundle,
      }
    })
  if (!items.length) return null
  return {
    id: CAMPAIGN_CATEGORY_ID,
    name: 'Kampanyalı Ürünler',
    description: '',
    display_order: -1,
    is_active: true,
    items,
  }
}

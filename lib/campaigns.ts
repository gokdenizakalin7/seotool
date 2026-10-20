import type { Menu, MenuCategory, MenuItem } from '@/lib/types'
import { formatPrice, parsePrice } from '@/lib/price'
import { ISO_DAY_LABELS, istanbulClock, windowElapsed, type ScheduleWindow } from '@/lib/price-plan'

/**
 * Kampanyalar: işletmenin kendi ürünlerinden, kendi fiyatıyla. İki tür:
 *  - bundle (Paket, ör. "Bira + Patates 170 ₺"): seçilen ürünler birlikte tek fiyata.
 *  - per_item (İndirimli ürünler, ör. "Tuborg ve Efes 165 ₺"): her ürün ayrı ayrı kendi kampanya fiyatıyla;
 *    kampanya süresince ürün kendi kategorisinde de bu fiyatla görünür. Eski fiyat gösterilmez (üstü çizili
 *    fiyat yok); müşteri yalnızca kampanya fiyatını görür.
 * Müşteri menüsünde "Kampanyalı Ürünler" adlı sözde kategori olarak en üstte görünür. Tarih aralığı ve
 * haftalık gün/saat takvimiyle (İstanbul saati) sınırlanabilir.
 */

export const CAMPAIGN_CATEGORY_ID = 'kampanyalar'

export type CampaignKind = 'bundle' | 'per_item'

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
  /** per_item: bu ürünün kampanya fiyatı */
  price?: number | null
  /** Menüdeki ürünün güncel hali (yüklenebildiyse) */
  item?: CampaignComponentItem | null
}

export interface Campaign {
  id: string
  kind: CampaignKind
  name: string
  description: string
  /** bundle: paket fiyatı. per_item: ürün fiyatlarının en düşüğü (yalnızca sıralama/özet için) */
  price: number
  imageUrl: string | null
  isActive: boolean
  displayOrder: number
  validFrom: string | null
  validUntil: string | null
  /** Haftalık pencereler (İstanbul saati). Boş = her gün, tüm gün. Başlangıç = bitiş (00:00–00:00) = o gün boyunca. */
  schedule: ScheduleWindow[]
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

/** Haftalık takvime göre şu an geçerli mi (takvim yoksa her zaman) */
export function isCampaignInSchedule(campaign: Pick<Campaign, 'schedule'>, now: Date = new Date()): boolean {
  if (!campaign.schedule?.length) return true
  const clock = istanbulClock(now)
  return campaign.schedule.some((w) => windowElapsed(w, clock) != null)
}

/** per_item: müşteriye gösterilebilecek ürünler (menüde mevcut, tükenmemiş, fiyatı girilmiş) */
function sellableComponents(campaign: Campaign): CampaignComponent[] {
  return campaign.items.filter((c) => c.itemId && c.item && c.item.is_available !== false && c.price != null)
}

/**
 * Müşteriye gösterilir mi: aktif, tarih aralığında ve takvim saatinde. Paket tüm ürünleri menüde mevcutsa;
 * indirimli ürünler en az bir ürünü satılabiliyorsa (tükenen ürün tek başına gizlenir).
 */
export function isCampaignLive(campaign: Campaign, now: Date = new Date()): boolean {
  if (!campaign.isActive || !isCampaignInWindow(campaign, now) || !isCampaignInSchedule(campaign, now)) return false
  return campaign.kind === 'per_item' ? sellableComponents(campaign).length > 0 : campaignStatus(campaign) === 'ok'
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

/** Paket: "Bira + Patates"; indirimli ürünler: "Tuborg, Efes" */
export function suggestCampaignName(components: Pick<CampaignComponent, 'name' | 'quantity'>[], kind: CampaignKind = 'bundle'): string {
  if (kind === 'per_item') return components.map((c) => c.name).join(', ').slice(0, 80)
  return components
    .map((c) => (c.quantity > 1 ? `${c.quantity}× ${c.name}` : c.name))
    .join(' + ')
    .slice(0, 80)
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

/** "Her gün", "Hafta içi", "Hafta sonu" ya da "Pzt, Çar" */
export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort()
  if (sorted.length === 7) return 'Her gün'
  if (sorted.join() === '1,2,3,4,5') return 'Hafta içi'
  if (sorted.join() === '6,7') return 'Hafta sonu'
  return sorted.map((d) => ISO_DAY_LABELS[d - 1]).join(', ')
}

/** Panel özeti: "Her gün · 00:00–19:00", "Hafta sonu · tüm gün"; takvim yoksa null */
export function describeCampaignSchedule(schedule: ScheduleWindow[]): string | null {
  if (!schedule?.length) return null
  return schedule
    .map((w) => {
      const hours = w.start === w.end && w.start === '00:00' ? 'tüm gün' : `${w.start}–${w.end === '00:00' ? '24:00' : w.end}`
      return `${describeDays(w.days.length ? w.days : ALL_DAYS)} · ${hours}`
    })
    .join(' / ')
}

/**
 * Menüde gösterilen fiyata kampanya fiyatını uygular. Yalnızca daha düşükse (ya da mevcut fiyat okunamıyorsa,
 * ör. "S:50/L:70") geçerli olur; aksi halde null (fiyat planı zaten daha ucuza indirmiş olabilir).
 */
function dealOver(shown: string | null | undefined, deal: number, currency: string): string | null {
  const base = parsePrice(shown ?? '')
  if (base && deal >= base.amount) return null
  return formatPrice(deal, base?.currency || currency)
}

/** Şu an geçerli indirimli ürün fiyatları: ürün kimliği → en düşük kampanya fiyatı */
export function liveItemDeals(campaigns: Campaign[], now: Date = new Date()): Map<string, number> {
  const deals = new Map<string, number>()
  for (const campaign of campaigns) {
    if (campaign.kind !== 'per_item' || !isCampaignLive(campaign, now)) continue
    for (const comp of sellableComponents(campaign)) {
      const prev = deals.get(comp.itemId!)
      if (prev == null || comp.price! < prev) deals.set(comp.itemId!, comp.price!)
    }
  }
  return deals
}

/**
 * İndirimli ürün kampanyalarını menüdeki ürünlerin kendi kategorilerine uygular (menüyü değiştirmez; yeni nesne).
 * Menü önceden fiyat planıyla fiyatlanmış olmalı. Kampanyalı üründe üstü çizili eski fiyat gösterilmez
 * (fiyat planından gelen dahil).
 */
export function applyItemDealsToMenu(menu: Menu, campaigns: Campaign[], opts: { now?: Date; currency?: string } = {}): Menu {
  const deals = liveItemDeals(campaigns, opts.now)
  if (!deals.size) return menu
  const currency = opts.currency || '₺'
  return {
    ...menu,
    categories: (menu.categories || []).map((cat) => ({
      ...cat,
      items: (cat.items || []).map((item) => {
        const deal = deals.get(item.id)
        const price = deal != null ? dealOver(item.price, deal, currency) : null
        if (!price) return item
        return { ...item, price, original_price: undefined }
      }),
    })),
  }
}

/**
 * Müşteri menüsü için sözde kategori. priceOf, menüde o an gösterilen (fiyat planı uygulanmış, kampanya
 * uygulanmamış) fiyatı vermeli ki "normal" fiyatlar menüyle tutarlı olsun. Kampanya fiyatına plan uygulanmaz.
 * menuItemOf verilirse indirimli ürünler menüdeki tüm bilgileriyle (alerjen, bileşen…) listelenir.
 */
export function buildCampaignCategory(
  campaigns: Campaign[],
  opts: {
    now?: Date
    currency?: string
    priceOf: (component: CampaignComponent) => string | null | undefined
    menuItemOf?: (itemId: string) => MenuItem | undefined
  }
): MenuCategory | null {
  const now = opts.now ?? new Date()
  const currency = opts.currency || '₺'
  const deals = liveItemDeals(campaigns, now)
  // Paketin "ayrı ayrı" toplamı: içindeki ürün şu an indirimdeyse indirimli fiyatıyla
  const currentPriceOf = (comp: CampaignComponent) => {
    const shown = opts.priceOf(comp)
    const deal = comp.itemId ? deals.get(comp.itemId) : undefined
    return (deal != null && dealOver(shown, deal, currency)) || shown
  }

  const entries: Omit<MenuItem, 'display_order'>[] = []
  for (const c of campaigns.filter((x) => isCampaignLive(x, now)).sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (c.kind === 'per_item') {
      for (const comp of sellableComponents(c)) {
        const price = dealOver(opts.priceOf(comp), comp.price!, currency)
        if (!price) continue
        const full = opts.menuItemOf?.(comp.itemId!)
        entries.push({
          ...(full || {}),
          id: `campaign:${c.id}:${comp.itemId}`,
          name: comp.item!.name,
          description: c.description || c.name,
          price,
          // Eski fiyat gösterilmez (applyItemDealsToMenu ile aynı)
          original_price: undefined,
          image_url: comp.item!.image_url || c.imageUrl || '',
          is_available: true,
          is_featured: false,
          tags: [...new Set([...(full?.tags || []), 'discount' as const])],
          // Seçenek fiyatları kampanyaya dahil değil; indirimli kartta tek fiyat görünür
          variations: undefined,
        })
      }
      continue
    }
    const normal = campaignNormalTotal(c.items, currentPriceOf)
    const bundle = c.items.map((comp) => ({ name: comp.item?.name || comp.name, quantity: Math.max(1, comp.quantity || 1) }))
    const firstImage = c.items.map((comp) => comp.item?.image_url).find(Boolean) || ''
    entries.push({
      id: `campaign:${c.id}`,
      name: c.name,
      description: c.description || bundle.map((b) => `${b.quantity}× ${b.name}`).join(', '),
      price: formatPrice(c.price, currency),
      original_price: normal != null && normal > c.price ? formatPrice(normal, currency) : undefined,
      image_url: c.imageUrl || firstImage,
      is_available: true,
      is_featured: false,
      tags: ['discount'],
      bundle,
    })
  }
  if (!entries.length) return null
  return {
    id: CAMPAIGN_CATEGORY_ID,
    name: 'Kampanyalı Ürünler',
    description: '',
    display_order: -1,
    is_active: true,
    items: entries.map((e, index) => ({ ...e, display_order: index }) as MenuItem),
  }
}

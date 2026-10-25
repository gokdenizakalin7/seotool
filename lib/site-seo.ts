import type { Metadata } from 'next'
import type { SiteRestaurant } from '@/components/public/site/types'
import type { Menu, ProductTag } from '@/lib/types'
import type { EventOccurrence } from '@/lib/events'
import { CAMPAIGN_CATEGORY_ID } from '@/lib/campaigns'
import { parsePrice } from '@/lib/price'
import { canonicalOrigin, sitePath, type SitePage } from '@/lib/site-url'

/**
 * İşletme sitesi arama motoru yardımcıları: sayfa meta etiketleri ve schema.org yapısal verisi (JSON-LD).
 * Adresler her zaman canonicalOrigin() ile mutlak yazılır (NEXT_PUBLIC_SITE_URL yoksa üretim alan adı).
 */

/** İşletme türü → schema.org tipi (Google yerel işletme bilgisi) */
const SCHEMA_TYPE: Record<string, string> = {
  cafe: 'CafeOrCoffeeShop',
  pub: 'BarOrPub',
  meyhane: 'BarOrPub',
  nargile: 'BarOrPub',
  fastfood: 'FastFoodRestaurant',
  bakery: 'Bakery',
}

const CURRENCY_CODE: Record<string, string> = { '₺': 'TRY', $: 'USD', '€': 'EUR', '£': 'GBP' }

/** Ürün etiketi → schema.org diyet */
const DIET: Partial<Record<ProductTag, string>> = {
  vegan: 'https://schema.org/VeganDiet',
  vegetarian: 'https://schema.org/VegetarianDiet',
  gluten_free: 'https://schema.org/GlutenFreeDiet',
}

/* ------------------------------------------------------------------ */
/* Metin yardımcıları                                                  */
/* ------------------------------------------------------------------ */

/** Meta açıklaması: boşluklar sadeleşir, sınırı aşarsa kelime sınırında kesilir */
export function clipText(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`
}

/** Tamamı büyük harfle yazılmış kategori adı ("SICAK İÇECEKLER") → "Sıcak İçecekler"; diğerleri olduğu gibi */
export function readableName(name: string): string {
  const s = name.trim()
  if (s !== s.toLocaleUpperCase('tr') || s === s.toLocaleLowerCase('tr')) return s
  return s.toLocaleLowerCase('tr').replace(/(^|[\s(/&-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('tr'))
}

/** "a, b, c ve d" */
function joinTr(list: string[]): string {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} ve ${list[list.length - 1]}`
}

/** Yayındaki kategoriler (kampanya kategorisi hariç), menüdeki sırayla */
function menuSections(menu: Menu | undefined) {
  return (menu?.categories || []).filter((c) => c.is_active !== false && c.id !== CAMPAIGN_CATEGORY_ID && c.items?.length)
}

/* ------------------------------------------------------------------ */
/* Meta etiketleri                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sitenin bir sayfası için başlık, açıklama, canonical ve paylaşım kartı. openGraph sayfada tanımlanınca
 * layout'takinin yerine geçtiği (birleşmediği) için görsel ve site adı burada yeniden verilir.
 */
export function sitePageMetadata(r: SiteRestaurant, slug: string, page: SitePage, title: string, description: string): Metadata {
  const url = sitePath(slug, page)
  const desc = clipText(description)
  const image = r.cover_url || r.logo_url || undefined
  return {
    // absolute: kök layout'un "%s | QR Chef" şablonu işletmenin kendi sitesine eklenmesin
    title: { absolute: title },
    description: desc,
    alternates: { canonical: url },
    openGraph: { type: 'website', locale: 'tr_TR', siteName: r.name, url, title, description: desc, images: image ? [image] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description: desc, images: image ? [image] : undefined },
  }
}

/** Menü sayfası: "<işletme> (<şehir>) menüsü ve güncel fiyatları: Kahveler, Tatlılar…" */
export function menuDescription(r: SiteRestaurant, menu: Menu | undefined): string {
  const sections = menuSections(menu)
  if (!sections.length) return `${r.name}${r.city ? `, ${r.city}` : ''}: menü, kampanyalar, etkinlikler ve iletişim bilgileri.`
  const names = sections.map((c) => readableName(c.name))
  const items = sections.flatMap((c) => c.items)
  const hasNutrition = items.some((i) => i.calories || i.allergens?.length)
  return (
    `${r.name}${r.city ? ` (${r.city})` : ''} menüsü ve güncel fiyatları: ` +
    `${names.length > 4 ? `${names.slice(0, 4).join(', ')} ve diğerleri` : joinTr(names)}.` +
    `${hasNutrition ? ' Kalori ve alerjen bilgileriyle.' : ''}`
  )
}

export function contactDescription(r: SiteRestaurant): string {
  const address = [r.address, r.city].filter(Boolean).join(', ')
  return [
    `${r.name} iletişim bilgileri${address ? `: ${address}` : ''}.`,
    r.business_phone && `Telefon: ${r.business_phone}.`,
    r.working_hours && `Çalışma saatleri: ${r.working_hours.replace(/\s+/g, ' ')}.`,
    'Yol tarifi ve sosyal medya hesapları.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function eventsDescription(r: SiteRestaurant, occurrences: EventOccurrence[]): string {
  const titles = [...new Set(occurrences.map((o) => o.event.title))]
  if (!titles.length) return `${r.name} etkinlik takvimi.`
  return `${r.name} etkinlikleri: ${joinTr(titles.slice(0, 3))}. Yaklaşan etkinliklerin tarih ve saatleri.`
}

/* ------------------------------------------------------------------ */
/* Yapısal veri (JSON-LD)                                              */
/* ------------------------------------------------------------------ */

/** Mutlak adres; base64 (data:) ve boş adresler atlanır */
function absoluteUrl(url: string | null | undefined): string | undefined {
  if (!url || url.startsWith('data:')) return undefined
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${canonicalOrigin()}${url}` : undefined
}

/** Türkiye numarası uluslararası biçimde (0532… → +90532…); tanınmayan biçim olduğu gibi */
export function internationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) return `+90${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('90')) return `+${digits}`
  if (digits.length === 10 && digits.startsWith('5')) return `+90${digits}`
  return phone.trim()
}

/**
 * Google Haritalar adresindeki koordinat: yer kaydının kendisi (!3d…!4d…) ya da harita merkezi (@enlem,boylam).
 * Kısa bağlantılarda (maps.app.goo.gl) koordinat yoktur.
 */
export function geoFromMapsUrl(url: string | null | undefined): { latitude: number; longitude: number } | null {
  if (!url) return null
  const m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const latitude = Number(m[1])
  const longitude = Number(m[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_WORDS = /pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar|hafta|hariç|haric|kapalı|kapali|monday|tuesday|friday|weekend|weekday/i

/**
 * Serbest metin çalışma saati yalnızca tek ve her gün için geçerli bir aralıksa ("12.00 - 02.00", "Her gün 09:00–23:30")
 * schema.org saatine çevrilir; gün adı, birden çok aralık ya da belirsiz metin varsa yanlış bilgi vermemek için null.
 */
export function openingHoursFromText(text: string | null | undefined) {
  if (!text) return null
  const t = text.replace(/\s+/g, ' ').trim()
  if (DAY_WORDS.test(t)) return null
  const ranges = [...t.matchAll(/(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})/g)]
  if (ranges.length !== 1) return null
  const rest = t.replace(ranges[0][0], '').replace(/her ?gün|hergün|açık|acik|saat(ler)?i?|çalışma|calisma|:|\s/gi, '')
  if (rest) return null
  const [, h1, m1, h2, m2] = ranges[0].map(Number)
  if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null
  const hhmm = (h: number, m: number) => `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ALL_DAYS, opens: hhmm(h1, m1), closes: hhmm(h2, m2) }]
}

function postalAddress(r: SiteRestaurant) {
  if (!r.address && !r.city) return undefined
  return {
    '@type': 'PostalAddress',
    ...(r.address ? { streetAddress: r.address } : {}),
    ...(r.city ? { addressLocality: r.city } : {}),
    addressCountry: 'TR',
  }
}

/** İşletmenin kendisi (sitenin tüm sayfalarında, layout'ta) */
export function restaurantJsonLd(restaurant: SiteRestaurant, slug: string) {
  const url = `${canonicalOrigin()}${sitePath(slug)}`
  const sameAs = [
    restaurant.instagram_handle && `https://instagram.com/${restaurant.instagram_handle.replace(/^@+/, '')}`,
    restaurant.facebook_url,
    restaurant.tiktok_handle && `https://www.tiktok.com/@${restaurant.tiktok_handle.replace(/^@+/, '')}`,
    restaurant.x_handle && `https://x.com/${restaurant.x_handle.replace(/^@+/, '')}`,
    restaurant.youtube_url,
    restaurant.website_url,
  ].filter(Boolean)
  const image = absoluteUrl(restaurant.cover_url) || absoluteUrl(restaurant.logo_url)
  const logo = absoluteUrl(restaurant.logo_url)
  const address = postalAddress(restaurant)
  // Yorum bağlantısı da çoğunlukla yer kaydının tam adresidir (konum kısa bağlantıysa koordinat oradan)
  const geo = geoFromMapsUrl(restaurant.google_maps_url) || geoFromMapsUrl(restaurant.google_review_url)
  const hours = openingHoursFromText(restaurant.working_hours)
  return {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[restaurant.business_type || ''] || 'Restaurant',
    '@id': `${url}#isletme`,
    name: restaurant.name,
    url,
    hasMenu: url,
    ...(restaurant.currency ? { currenciesAccepted: CURRENCY_CODE[restaurant.currency] || restaurant.currency } : {}),
    ...(logo ? { logo } : {}),
    ...(image ? { image } : {}),
    ...(restaurant.about_text ? { description: clipText(restaurant.about_text, 300) } : {}),
    ...(restaurant.business_phone ? { telephone: internationalPhone(restaurant.business_phone) } : {}),
    ...(restaurant.contact_email ? { email: restaurant.contact_email } : {}),
    ...(address ? { address } : {}),
    ...(geo ? { geo: { '@type': 'GeoCoordinates', ...geo } } : {}),
    ...(restaurant.google_maps_url ? { hasMap: restaurant.google_maps_url } : {}),
    ...(hours ? { openingHoursSpecification: hours } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

/**
 * Menü sayfası: schema.org Menu → MenuSection → MenuItem (fiyat, açıklama, görsel, kalori, alerjen dışı diyet etiketleri).
 * Fiyatlar müşterinin o an gördüğü (fiyat planı uygulanmış) fiyatlardır; okunamayan fiyat ("S:50 / L:70") yazılmaz.
 */
export function menuJsonLd(restaurant: SiteRestaurant, slug: string, menu: Menu | undefined) {
  const sections = menuSections(menu)
  if (!sections.length) return null
  const url = `${canonicalOrigin()}${sitePath(slug)}`
  const currency = CURRENCY_CODE[restaurant.currency || '₺'] || 'TRY'
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${url}#menu`,
    name: `${restaurant.name} Menü`,
    url,
    inLanguage: 'tr',
    hasMenuSection: sections.map((cat) => ({
      '@type': 'MenuSection',
      name: readableName(cat.name),
      ...(cat.description ? { description: clipText(cat.description, 300) } : {}),
      hasMenuItem: cat.items.map((item) => {
        const price = parsePrice(item.price)
        const image = absoluteUrl(item.image_url)
        const diets = (item.tags || []).flatMap((tag) => (DIET[tag] ? [DIET[tag]] : []))
        return {
          '@type': 'MenuItem',
          name: item.name,
          ...(item.description ? { description: clipText(item.description, 300) } : {}),
          ...(image ? { image } : {}),
          ...(price
            ? { offers: { '@type': 'Offer', price: price.amount.toFixed(2), priceCurrency: CURRENCY_CODE[price.currency || ''] || currency } }
            : {}),
          ...(item.calories ? { nutrition: { '@type': 'NutritionInformation', calories: `${item.calories} kcal` } } : {}),
          ...(diets.length ? { suitableForDiet: diets } : {}),
        }
      }),
    })),
  }
}

/** Alt sayfa kırıntısı: İşletme › Hakkımızda (arama sonucunda adres yerine gösterilir) */
export function breadcrumbJsonLd(restaurant: SiteRestaurant, slug: string, page: SitePage, label: string) {
  const origin = canonicalOrigin()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: restaurant.name, item: `${origin}${sitePath(slug)}` },
      { '@type': 'ListItem', position: 2, name: label, item: `${origin}${sitePath(slug, page)}` },
    ],
  }
}

/**
 * Etkinlikler: Google etkinlik sonuçları için schema.org Event. Konumun adresi zorunlu olduğundan adresi olmayan
 * işletmede yazılmaz. Haftalık tekrarlar ayrı oturum olarak (ilk birkaçı) listelenir.
 */
export function eventsJsonLd(restaurant: SiteRestaurant, slug: string, occurrences: EventOccurrence[]) {
  const address = postalAddress(restaurant)
  if (!address || !occurrences.length) return null
  const url = `${canonicalOrigin()}${sitePath(slug)}`
  return occurrences.slice(0, 20).map((o) => {
    const image = absoluteUrl(o.event.posterUrl)
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: o.event.title,
      ...(o.event.description ? { description: clipText(o.event.description, 300) } : {}),
      startDate: o.start,
      endDate: o.end,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...(image ? { image: [image] } : {}),
      url: `${canonicalOrigin()}${sitePath(slug, 'etkinlikler')}`,
      location: { '@type': 'Place', name: restaurant.name, address, url },
      organizer: { '@type': 'Organization', name: restaurant.name, url },
    }
  })
}

/** <script type="application/ld+json"> içeriği; "</script>" kaçışıyla */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

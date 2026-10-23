import type { SiteRestaurant } from '@/components/public/site/types'
import { canonicalOrigin, sitePath } from '@/lib/site-url'

/**
 * İşletme sitesi arama motoru yardımcıları: schema.org işletme bilgisi (JSON-LD).
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

export function restaurantJsonLd(restaurant: SiteRestaurant, slug: string) {
  const url = `${canonicalOrigin()}${sitePath(slug)}`
  const sameAs = [
    restaurant.instagram_handle && `https://instagram.com/${restaurant.instagram_handle}`,
    restaurant.facebook_url,
    restaurant.tiktok_handle && `https://www.tiktok.com/@${restaurant.tiktok_handle}`,
    restaurant.x_handle && `https://x.com/${restaurant.x_handle}`,
    restaurant.youtube_url,
    restaurant.website_url,
  ].filter(Boolean)
  const image = restaurant.cover_url || restaurant.logo_url
  return {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[restaurant.business_type || ''] || 'Restaurant',
    '@id': `${url}#isletme`,
    name: restaurant.name,
    url,
    hasMenu: url,
    ...(restaurant.logo_url ? { logo: restaurant.logo_url } : {}),
    ...(image ? { image } : {}),
    ...(restaurant.about_text ? { description: restaurant.about_text.replace(/\s+/g, ' ').trim().slice(0, 300) } : {}),
    ...(restaurant.business_phone ? { telephone: restaurant.business_phone } : {}),
    ...(restaurant.contact_email ? { email: restaurant.contact_email } : {}),
    ...(restaurant.address || restaurant.city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(restaurant.address ? { streetAddress: restaurant.address } : {}),
            ...(restaurant.city ? { addressLocality: restaurant.city } : {}),
            addressCountry: 'TR',
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

/** <script type="application/ld+json"> içeriği; "</script>" kaçışıyla */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

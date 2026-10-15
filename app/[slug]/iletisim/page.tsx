import type { Metadata } from 'next'
import { ContactView } from '@/components/public/site/ContactView'
import { brandColor } from '@/components/public/site/types'
import { requireSite, type SearchParams } from '@/lib/server/site'
import { siteOrigin, sitePath } from '@/lib/site-url'

export const metadata: Metadata = { title: 'İletişim' }

/** Arama motorları için işletme bilgisi (schema.org) */
function businessJsonLd(restaurant: Awaited<ReturnType<typeof requireSite>>, slug: string) {
  const sameAs = [
    restaurant.instagram_handle && `https://instagram.com/${restaurant.instagram_handle}`,
    restaurant.facebook_url,
    restaurant.tiktok_handle && `https://www.tiktok.com/@${restaurant.tiktok_handle}`,
    restaurant.x_handle && `https://x.com/${restaurant.x_handle}`,
    restaurant.youtube_url,
    restaurant.website_url,
  ].filter(Boolean)
  const origin = siteOrigin()
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    ...(origin ? { url: `${origin}${sitePath(slug)}`, hasMenu: `${origin}${sitePath(slug)}` } : {}),
    ...(restaurant.logo_url ? { logo: restaurant.logo_url } : {}),
    ...(restaurant.cover_url ? { image: restaurant.cover_url } : {}),
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

export default async function SiteContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const restaurant = await requireSite(slug, 'iletisim', await searchParams)
  if (restaurant.suspended) return null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd(restaurant, slug)).replace(/</g, '\\u003c') }}
      />
      <ContactView restaurant={restaurant} primaryColor={brandColor(restaurant)} />
    </>
  )
}

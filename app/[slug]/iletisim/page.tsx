import type { Metadata } from 'next'
import { ContactView } from '@/components/public/site/ContactView'
import { brandColor } from '@/components/public/site/types'
import { getSiteRestaurant, requireSite, type SearchParams } from '@/lib/server/site'
import { isValidSiteSlug } from '@/lib/site-url'
import { breadcrumbJsonLd, contactDescription, jsonLdHtml, sitePageMetadata } from '@/lib/site-seo'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = isValidSiteSlug(slug) ? await getSiteRestaurant(slug) : null
  if (!r || r.suspended) return {}
  return sitePageMetadata(r, slug, 'iletisim', `${r.name} İletişim, Adres ve Çalışma Saatleri`, contactDescription(r))
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

  // İşletme bilgisi (schema.org JSON-LD) layout'ta, sitenin tüm sayfalarında
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(restaurant, slug, 'iletisim', 'İletişim')) }}
      />
      <ContactView restaurant={restaurant} primaryColor={brandColor(restaurant)} />
    </>
  )
}

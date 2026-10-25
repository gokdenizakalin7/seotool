import type { Metadata } from 'next'
import { AboutView } from '@/components/public/site/AboutView'
import { brandColor } from '@/components/public/site/types'
import { getSiteAbout, getSiteRestaurant, requireSite, type SearchParams } from '@/lib/server/site'
import { isValidSiteSlug } from '@/lib/site-url'
import { breadcrumbJsonLd, jsonLdHtml, sitePageMetadata } from '@/lib/site-seo'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = isValidSiteSlug(slug) ? await getSiteRestaurant(slug) : null
  const about = r ? await getSiteAbout(slug) : null
  if (!r || !about) return {}
  return sitePageMetadata(r, slug, 'hakkimizda', `${r.name} Hakkında${r.city ? ` | ${r.city}` : ''}`, about.text)
}

export default async function SiteAboutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const restaurant = await requireSite(slug, 'hakkimizda', await searchParams)
  if (restaurant.suspended) return null

  // İşletme metin yazmadıysa türüne ve menüsüne göre otomatik metin
  const about = await getSiteAbout(slug)
  if (!about) return null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(restaurant, slug, 'hakkimizda', 'Hakkımızda')) }}
      />
      <AboutView
      restaurant={restaurant}
      slug={slug}
      text={about.text}
      typeLabel={about.typeLabel}
      categories={about.categories.slice(0, 6)}
      primaryColor={brandColor(restaurant)}
      />
    </>
  )
}

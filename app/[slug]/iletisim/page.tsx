import type { Metadata } from 'next'
import { ContactView } from '@/components/public/site/ContactView'
import { brandColor } from '@/components/public/site/types'
import { requireSite, type SearchParams } from '@/lib/server/site'
import { sitePath } from '@/lib/site-url'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { title: 'İletişim', alternates: { canonical: sitePath(slug, 'iletisim') } }
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
  return <ContactView restaurant={restaurant} primaryColor={brandColor(restaurant)} />
}

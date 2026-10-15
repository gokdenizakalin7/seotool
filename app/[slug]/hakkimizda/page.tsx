import type { Metadata } from 'next'
import { AboutView } from '@/components/public/site/AboutView'
import { brandColor } from '@/components/public/site/types'
import { getBusinessTypeInfo, getPublicMenus } from '@/lib/server/public-menu'
import { requireSite, type SearchParams } from '@/lib/server/site'
import { buildAboutTemplate } from '@/lib/about-template'

export const metadata: Metadata = { title: 'Hakkımızda' }

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

  const [menus, typeInfo] = await Promise.all([getPublicMenus(slug), getBusinessTypeInfo(restaurant.business_type)])
  const categories = (menus[0]?.categories || []).filter((c) => !c.parent_id && c.items?.length).map((c) => c.name)
  const featured = (menus[0]?.categories || []).flatMap((c) => c.items || []).filter((i) => i.is_featured).map((i) => i.name)

  // İşletme metin yazmadıysa türüne ve menüsüne göre otomatik metin
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

  return (
    <AboutView
      restaurant={restaurant}
      slug={slug}
      text={text}
      typeLabel={typeInfo.label}
      categories={categories.slice(0, 6)}
      primaryColor={brandColor(restaurant)}
    />
  )
}

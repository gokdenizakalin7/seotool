import type { Metadata } from 'next'
import { AlertCircle } from 'lucide-react'
import { SiteShell } from '@/components/public/site/SiteShell'
import { getBusinessTypeCover, hasImageCredits } from '@/lib/server/public-menu'
import { getSiteEvents, getSiteRestaurant } from '@/lib/server/site'
import { eventOccurrences } from '@/lib/events'
import { isValidSiteSlug } from '@/lib/site-url'
import { jsonLdHtml, restaurantJsonLd } from '@/lib/site-seo'

/**
 * İşletme sitesi: qr-chef.com.tr/<slug> (Menü), /etkinlikler, /hakkimizda, /iletisim.
 * Her istekte okunur; panelde yapılan değişiklik anında yansır, fiyat planı istek anına göre seçilir.
 * Panel (SPA) yolları statik klasörlerle (app/dashboard, app/signup…) bu rotadan önce eşleşir.
 */
export const dynamic = 'force-dynamic'

// Sistem koyu temadaysa sayfa ilk boyamadan önce koyu açılır (hidrasyondan sonra beyaz→siyah flaşı olmaz)
const THEME_SCRIPT =
  "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}"

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  if (!isValidSiteSlug(slug)) return {}
  const r = await getSiteRestaurant(slug)
  if (!r) return {}
  // absolute: kök layout'un "%s | QR Chef" şablonu işletmenin kendi sitesine eklenmesin
  if (r.suspended) return { title: { absolute: r.name }, robots: { index: false } }

  const fallback = `${r.name}${r.city ? `, ${r.city}` : ''} — menü, kampanyalar, etkinlikler ve iletişim bilgileri.`
  const description = (r.about_text || fallback).replace(/\s+/g, ' ').trim().slice(0, 160)
  const image = r.cover_url || r.logo_url || undefined
  // canonical burada değil, her sayfanın kendisinde (layout'taki alt sayfalara miras kalıp onları menünün kopyası yapar)
  return {
    title: { absolute: r.name, template: `%s | ${r.name}` },
    description,
    openGraph: { title: r.name, description, type: 'website', locale: 'tr_TR', siteName: r.name, images: image ? [image] : undefined },
    icons: r.logo_url ? { icon: r.logo_url } : undefined,
  }
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { slug } = await params
  const restaurant = isValidSiteSlug(slug) ? await getSiteRestaurant(slug) : null

  // Bulunamadı: sayfa eski adres yönlendirmesini ya da 404'ü kendisi yapar
  if (!restaurant) return <>{children}</>

  if (restaurant.suspended) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        {restaurant.logo_url ? (
          <img src={restaurant.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover mb-5 shadow-sm" />
        ) : (
          <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        )}
        {restaurant.name && <h1 className="text-2xl font-bold text-gray-800 mb-2">{restaurant.name}</h1>}
        <p className="text-gray-500 max-w-md">{restaurant.message || 'Bu menü geçici olarak hizmet dışıdır.'}</p>
      </div>
    )
  }

  const needsTypeCover = !restaurant.cover_url?.trim() && !restaurant.logo_url?.trim()
  const [fallbackCover, events] = await Promise.all([
    needsTypeCover ? getBusinessTypeCover(restaurant.business_type) : Promise.resolve(''),
    restaurant.id ? getSiteEvents(restaurant.id) : Promise.resolve([]),
  ])
  const hasEvents = eventOccurrences(events).length > 0

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(restaurantJsonLd(restaurant, slug)) }} />
      <SiteShell
        restaurant={restaurant}
        slug={slug}
        fallbackCover={fallbackCover}
        hasEvents={hasEvents}
        hasImageCredits={hasImageCredits}
      >
        {children}
      </SiteShell>
    </>
  )
}

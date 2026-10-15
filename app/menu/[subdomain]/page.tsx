import { PublicMenuView } from '@/components/public/PublicMenuView'
import { PublicMenuPreview } from '@/components/public/PublicMenuPreview'
import { getBusinessTypeCover, getPublicMenus, getPublicRestaurant, hasImageCredits } from '@/lib/server/public-menu'

/**
 * Müşteri menüsü (QR). Panel SPA'sından ayrı, sunucuda render edilir: HTML menüyle birlikte gelir,
 * tarayıcıya yalnızca menü sayfasının JS'i iner. Menü her istekte okunur; editördeki değişiklik anında yansır.
 */
export const dynamic = 'force-dynamic'

// Sistem koyu temadaysa sayfa ilk boyamadan önce koyu açılır (hidrasyondan sonra beyaz→siyah flaşı olmaz)
const THEME_SCRIPT =
  "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}"

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { subdomain } = await params
  const query = await searchParams

  // Panel içi canlı önizleme: yayınlanmamış düzenlemeler üst pencereden postMessage ile gelir
  if (first(query.preview) === '1') {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <PublicMenuPreview hasImageCredits={hasImageCredits} />
      </>
    )
  }

  const [restaurant, menus] = await Promise.all([getPublicRestaurant(subdomain), getPublicMenus(subdomain)])
  const isLive = Boolean(restaurant && !restaurant.suspended)
  const needsTypeCover = isLive && !restaurant.cover_url?.trim() && !restaurant.logo_url?.trim()

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <PublicMenuView
        restaurant={restaurant}
        menu={isLive ? menus[0] : undefined}
        fallbackCover={needsTypeCover ? await getBusinessTypeCover(restaurant.business_type) : ''}
        hasImageCredits={hasImageCredits}
        tableName={first(query.table) || first(query.masa)}
        tableId={first(query.tid)}
      />
    </>
  )
}

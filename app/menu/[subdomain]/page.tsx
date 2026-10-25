import { notFound, permanentRedirect } from 'next/navigation'
import { PublicMenuPreview } from '@/components/public/PublicMenuPreview'
import { hasImageCredits } from '@/lib/server/public-menu'
import { findMovedSlug } from '@/lib/server/site-data'
import { isValidSiteSlug, legacyMenuRedirectPath } from '@/lib/site-url'

/**
 * Eski menü adresi. Basılı QR'lar /menu/<slug>?table=..&tid=.. biçiminde: sorgu korunarak işletme sitesine
 * (/<slug>) yönlendirilir; görüntülenme ve masa sayacı sitede sayılır. Panel içi canlı önizleme (?preview=1)
 * burada kalır (panelle aynı köken; X-Frame-Options: SAMEORIGIN).
 */
export const dynamic = 'force-dynamic'

// Sistem koyu temadaysa sayfa ilk boyamadan önce koyu açılır (hidrasyondan sonra beyaz→siyah flaşı olmaz)
const THEME_SCRIPT =
  "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}"

export const metadata = { robots: { index: false } }

export default async function LegacyMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { subdomain } = await params
  const query = await searchParams

  // Panel içi canlı önizleme: yayınlanmamış düzenlemeler üst pencereden postMessage ile gelir
  if ((Array.isArray(query.preview) ? query.preview[0] : query.preview) === '1') {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <PublicMenuPreview hasImageCredits={hasImageCredits} />
      </>
    )
  }

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v))
    else if (value != null) search.set(key, value)
  }
  const slug = subdomain.toLowerCase()

  // Ayrılmış ada sahipken migration 14'te yeniden adlandırılan işletmeler: geçmişten yeni ada
  const target = isValidSiteSlug(slug) ? slug : await findMovedSlug(slug)
  if (!target) notFound()
  // Kalıcı (308): arama motoru eski adresin sıralamasını işletme sitesine taşısın
  permanentRedirect(legacyMenuRedirectPath(target, search.toString()))
}

/**
 * İşletme sitesi adresleri: qr-chef.com.tr/<slug>[/etkinlikler | /hakkimizda | /iletisim]
 *
 * Sunucuda ve tarayıcıda çalışır (Node API'si yok). NEXT_PUBLIC_SITE_URL derleme anında gömülür;
 * tanımlı değilse tarayıcıda window.location.origin kullanılır (QR'lar panelin açık olduğu alan adını kodlar).
 */

export const SITE_PAGES = ['etkinlikler', 'hakkimizda', 'iletisim'] as const
export type SitePage = '' | (typeof SITE_PAGES)[number]

/**
 * İşletme adı olarak kullanılamayan yollar: panel (SPA) sayfaları, Next dosya kuralları ve olası gelecekteki sayfalar.
 * Veritabanındaki is_reserved_slug() ile AYNI liste olmalı (son tanım: supabase/migrations/19_reserve_qr_menu_slug.sql;
 * testle denetlenir).
 * Yeni bir üst düzey panel yolu eklenirse buraya da eklenmeli ve app/ altında statik bir klasör almalı.
 */
export const RESERVED_SLUGS = [
  'about', 'account', 'activate', 'admin', 'api', 'app', 'apple-icon', 'assets', 'auth', 'ayarlar',
  'blog', 'business', 'catalog', 'contact', 'dashboard', 'destek', 'etkinlikler', 'events', 'favicon',
  'fiyatlar', 'fonts', 'gizlilik', 'gorsel-kaynaklari', 'hakkimizda', 'help', 'hesap', 'icon',
  'iletisim', 'kampanyalar', 'kosullar', 'kvkk', 'login', 'logout', 'manifest', 'menu', 'null',
  'onboarding', 'opengraph-image', 'panel', 'preview', 'pricing', 'privacy', 'public', 'qr', 'qr-menu',
  'register', 'robots', 'settings', 'signup', 'site', 'sitemap', 'static', 'support', 'terms',
  'twitter-image', 'undefined', 'www', 'yardim',
] as const

const RESERVED = new Set<string>(RESERVED_SLUGS)

/** Geçerli işletme adı biçimi: küçük harf, rakam ve tire; 1-40 karakter; tireyle başlayıp bitmez */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.trim().toLowerCase())
}

/**
 * Yazarken normalize: küçük harf, Türkçe harf sadeleştirme, boşluk → tire; sondaki tire korunur
 * (kullanıcı yazmaya devam edebilsin). Kaydetmeden önce slugifyBusinessName ile kırpılır.
 */
export function slugInput(input: string): string {
  return (input || '')
    .toLocaleLowerCase('tr')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
}

/** İşletme adından site adresi: "Köşe Kafe" → "kose-kafe" (40 karakter, tireyle başlayıp bitmez) */
export function slugifyBusinessName(input: string): string {
  return slugInput(input).replace(/-+$/, '')
}

/** Site adresinde kullanılabilir mi (biçim + ayrılmış adlar) */
export function isValidSiteSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !isReservedSlug(slug)
}

/** Sitenin kök adresi (sonda / yok). Sunucuda NEXT_PUBLIC_SITE_URL yoksa '' döner (göreli adres). */
export function siteOrigin(): string {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '')
  if (env) return env
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Üretim alan adı: arama motorlarına bildirilen tek adres (www, *.vercel.app kopyaları buraya işaret eder) */
export const PRODUCTION_ORIGIN = 'https://qr-chef.com.tr'

/** Canonical, sitemap ve yapısal veride kullanılan kök adres; NEXT_PUBLIC_SITE_URL yoksa üretim alan adı */
export function canonicalOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '') || PRODUCTION_ORIGIN
}

/** Site içi yol: /kafe-adi veya /kafe-adi/etkinlikler */
export function sitePath(slug: string, page: SitePage = ''): string {
  return `/${encodeURIComponent(slug)}${page ? `/${page}` : ''}`
}

function toQueryString(query?: Record<string, string | null | undefined>): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Tam site adresi (QR, paylaşım bağlantıları) */
export function siteUrl(slug: string, page: SitePage = '', query?: Record<string, string | null | undefined>): string {
  return `${siteOrigin()}${sitePath(slug, page)}${toQueryString(query)}`
}

/**
 * Masa QR adresi. tid: masa adı değişse de basılı QR o masa için sayılsın; table: eski QR'lar yalnızca adı taşır.
 * Henüz kaydedilmemiş (tbl-…) masanın geçici kimliği QR'a yazılmaz.
 */
export function tableQrUrl(slug: string, table: { id: string; name: string }): string {
  return siteUrl(slug, '', { table: table.name, tid: table.id.startsWith('tbl-') ? undefined : table.id })
}

/** Eski /menu/<slug>?… adresinden yeni site adresine (sorgu korunur) */
export function legacyMenuRedirectPath(slug: string, search: string): string {
  const qs = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''
  return `${sitePath(slug)}${qs}`
}

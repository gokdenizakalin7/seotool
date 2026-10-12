/**
 * Katalog görseli URL yardımcıları (saf).
 * Katalog görselleri /catalog/{slug}.webp?v={hash} ve küçük boyu /catalog/{slug}-s.webp?v={hash}.
 * Tek boyutlu görseller (küçük boyu yok): /catalog/{slug}.webp?v={hash}&single=1
 */

export const CATALOG_IMAGE_PREFIX = '/catalog/'

export function isCatalogImage(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(CATALOG_IMAGE_PREFIX)
}

/** Admin panelinden yüklenen katalog varsayılan görseli (Storage: menu-images/catalog/{slug}-{hash}.webp) */
export function isStorageCatalogImage(url: string | null | undefined): boolean {
  return typeof url === 'string' && /\/menu-images\/catalog\/[a-z0-9-]+-[0-9a-f]{8}\.webp(\?|$)/.test(url)
}

/** Statik ya da Storage katalog görseli: restoranın kendi fotoğrafı değil */
export function isAnyCatalogImage(url: string | null | undefined): boolean {
  return isCatalogImage(url) || isStorageCatalogImage(url)
}

/** Kart/liste küçük resmi: katalog görseli ise "-s" varyantı, değilse aynı URL */
export function catalogThumbUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (!isCatalogImage(url)) return url
  const q = url.indexOf('?')
  const path = q === -1 ? url : url.slice(0, q)
  const query = q === -1 ? '' : url.slice(q)
  if (!path.endsWith('.webp') || path.endsWith('-s.webp') || /[?&]single=1(&|$)/.test(query)) return url
  return `${path.slice(0, -'.webp'.length)}-s.webp${query}`
}

export function catalogImageUrl(slug: string, hash?: string | null, single = false): string {
  const params = [hash ? `v=${hash.slice(0, 8)}` : '', single ? 'single=1' : ''].filter(Boolean)
  return `${CATALOG_IMAGE_PREFIX}${slug}.webp${params.length ? `?${params.join('&')}` : ''}`
}

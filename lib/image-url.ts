/**
 * Katalog görseli URL yardımcıları (saf).
 * Katalog görselleri /catalog/{slug}.webp?v={hash} ve küçük boyu /catalog/{slug}-s.webp?v={hash}.
 */

export const CATALOG_IMAGE_PREFIX = '/catalog/'

export function isCatalogImage(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(CATALOG_IMAGE_PREFIX)
}

/** Kart/liste küçük resmi: katalog görseli ise "-s" varyantı, değilse aynı URL */
export function catalogThumbUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (!isCatalogImage(url)) return url
  const q = url.indexOf('?')
  const path = q === -1 ? url : url.slice(0, q)
  const query = q === -1 ? '' : url.slice(q)
  if (!path.endsWith('.webp') || path.endsWith('-s.webp')) return url
  return `${path.slice(0, -'.webp'.length)}-s.webp${query}`
}

export function catalogImageUrl(slug: string, hash?: string | null): string {
  return `${CATALOG_IMAGE_PREFIX}${slug}.webp${hash ? `?v=${hash.slice(0, 8)}` : ''}`
}

import { supabaseAdmin } from '@/lib/supabase-admin'
import { isValidSiteSlug } from '@/lib/site-url'

export interface ExampleSite {
  name: string
  slug: string
  city: string | null
  image: string | null
}

/**
 * Tanıtım sayfalarında örnek gösterilen yayındaki işletme siteleri (onaylı, askıda değil). Hem misafire gerçek örnek
 * hem de işletme sitelerine ana siteden iç bağlantı. Veritabanı okunamazsa boş liste (sayfa yine çizilir).
 */
export async function listExampleSites({ type, limit = 12 }: { type?: string; limit?: number } = {}): Promise<ExampleSite[]> {
  try {
    let q = supabaseAdmin
      .from('organizations')
      .select('name, subdomain, city, logo_url, cover_url')
      .or('status.is.null,status.eq.active')
      .order('created_at', { ascending: true })
      .limit(limit)
    if (type) q = q.eq('business_type', type)
    const { data, error } = await q
    if (error) throw error
    return (data || [])
      .filter((o) => o.name && isValidSiteSlug(o.subdomain || ''))
      .map((o) => {
        const image = [o.cover_url, o.logo_url].find((u) => typeof u === 'string' && /^https?:\/\//.test(u)) || null
        return { name: o.name, slug: o.subdomain!, city: o.city || null, image }
      })
  } catch (error) {
    console.error('listExampleSites:', (error as Error).message)
    return []
  }
}

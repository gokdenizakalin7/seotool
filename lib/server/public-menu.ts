import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSetting } from '@/lib/server/platform-settings'
import { BUSINESS_TYPES } from '@/lib/business-types'
import type { Menu } from '@/lib/types'
import credits from '@/public/catalog/credits.json'

/**
 * İşletme sitesinin (/[slug]) sunucu tarafı verisi.
 * Restoran ve menü sorguları slug üzerinden birbirini beklemeden paralel çalışabilsin diye ayrıdır.
 * React cache(): layout, sayfa ve generateMetadata aynı istekte tek sorgu paylaşır.
 */

/** Migration 15: site sütunları (iletişim, hakkımızda, fiyat modu) */
const SITE_COLUMNS =
  'id, subdomain, name, status, logo_url, cover_url, primary_color, currency, address, city, business_phone, wifi_name, wifi_password, business_type, instagram_handle, whatsapp_number, google_maps_url, google_review_url, working_hours, contact_email, website_url, facebook_url, tiktok_handle, x_handle, youtube_url, about_text, price_mode, price_manual_until, active_price_plan_id'
const PUBLIC_COLUMNS =
  'id, name, status, logo_url, cover_url, primary_color, currency, address, city, business_phone, wifi_name, wifi_password, business_type, instagram_handle, whatsapp_number, google_maps_url, google_review_url, working_hours'
const LEGACY_COLUMNS =
  'id, name, logo_url, cover_url, primary_color, currency, address, city, business_phone, wifi_name, wifi_password'

/** Restoranın yalnızca herkese açık alanları; bulunamazsa null. Askıdaysa ad/logo/renk ve "hizmet dışı" mesajı. */
export const getPublicRestaurant = cache(async (subdomain: string): Promise<any | null> => {
  try {
    // Migration 15 / 04 çalışmadıysa eski sütunlara düş
    let { data, error } = await supabaseAdmin.from('organizations').select(SITE_COLUMNS).eq('subdomain', subdomain).maybeSingle()
    if (error) {
      const base = await supabaseAdmin.from('organizations').select(PUBLIC_COLUMNS).eq('subdomain', subdomain).maybeSingle()
      data = base.data as any
      error = base.error
    }
    if (error) {
      const legacy = await supabaseAdmin.from('organizations').select(LEGACY_COLUMNS).eq('subdomain', subdomain).maybeSingle()
      data = legacy.data as any
      error = legacy.error
    }
    if (error || !data) return null

    const { status, ...rest } = data as any
    if (status === 'suspended') {
      return {
        id: rest.id,
        name: rest.name,
        logo_url: rest.logo_url,
        primary_color: rest.primary_color,
        suspended: true,
        message: await getSetting('suspended_menu_message'),
      }
    }
    // Başvurusu reddedilen işletmenin sitesi yok
    if (status === 'rejected') return null
    // Onay bekleyen başvuru: site yayınlanmaz; işletme adı ve logosu da gösterilmez (yalnızca adres bilinir)
    if (status === 'pending') {
      return {
        id: rest.id,
        name: '',
        logo_url: '',
        primary_color: rest.primary_color,
        suspended: true,
        pending: true,
        message: 'Bu adres henüz yayında değil. İşletme başvurusu onaylandığında menü burada açılacak.',
      }
    }
    return rest
  } catch (err) {
    console.error('getPublicRestaurant:', err)
    return null
  }
})

/** Yayındaki (is_listed) menüler; aktif kategoriler ve mevcut ürünlerle, editördeki sırayla. Müşteri ilkini görür. */
export const getPublicMenus = cache(async (subdomain: string): Promise<Menu[]> => {
  const { data, error } = await supabaseAdmin
    .from('menus')
    .select(`
      id, name, description, image_url, layout,
      organizations!inner ( subdomain ),
      categories (
        id, parent_id, name, description, display_order, is_active,
        items (
          id, name, description, price, image_url, allergens, calories, is_available, is_featured, display_order, tags
        )
      )
    `)
    .eq('organizations.subdomain', subdomain)
    .eq('is_listed', true)
    .order('created_at', { ascending: true })
    .order('display_order', { ascending: true, referencedTable: 'categories' })
    .order('display_order', { ascending: true, referencedTable: 'categories.items' })
    .eq('categories.is_active', true)
    .eq('categories.items.is_available', true)

  if (error) {
    console.error('getPublicMenus:', error.message)
    return []
  }
  return (data || []).map(({ organizations: _org, ...menu }: any) => menu as Menu)
})

/**
 * Kapak ve logo yoksa kullanılan işletme türü kapağı ('' = varsayılan kapak). Pasif ya da tabloda
 * olmayan türler için koddaki yedek listeye bakılır (useBusinessTypes ile aynı kural).
 */
export async function getBusinessTypeCover(businessType?: string | null): Promise<string> {
  return (await getBusinessTypeInfo(businessType)).cover
}

/** İşletme türünün adı ve kapağı (tablo, yoksa koddaki yedek liste) */
export const getBusinessTypeInfo = cache(async (businessType?: string | null): Promise<{ label: string; cover: string }> => {
  if (!businessType) return { label: '', cover: '' }
  const { data, error } = await supabaseAdmin
    .from('business_types')
    .select('label, cover_image')
    .eq('slug', businessType)
    .eq('is_active', true)
    .maybeSingle()
  if (!error && data) return { label: data.label || '', cover: data.cover_image || '' }
  const fallback = BUSINESS_TYPES.find((t) => t.id === businessType)
  return { label: fallback?.label || '', cover: fallback?.coverImage || '' }
})

/** Stok fotoğraf atıfları varsa menü altbilgisinde "Görsel kaynakları" linki gösterilir */
export const hasImageCredits = Array.isArray(credits) && credits.length > 0

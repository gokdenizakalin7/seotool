/** Müşteri sitesine giden (DB sütun adlı) işletme alanları; bkz. lib/server/public-menu.ts */
export interface SiteRestaurant {
  id?: string
  subdomain?: string
  name: string
  logo_url?: string | null
  cover_url?: string | null
  primary_color?: string | null
  branding?: { primaryColor?: string | null }
  currency?: string | null
  business_type?: string | null
  address?: string | null
  city?: string | null
  business_phone?: string | null
  working_hours?: string | null
  wifi_name?: string | null
  wifi_password?: string | null
  instagram_handle?: string | null
  whatsapp_number?: string | null
  google_maps_url?: string | null
  google_review_url?: string | null
  contact_email?: string | null
  website_url?: string | null
  facebook_url?: string | null
  tiktok_handle?: string | null
  x_handle?: string | null
  youtube_url?: string | null
  about_text?: string | null
  suspended?: boolean
  message?: string | null
}

/** Menünün üstündeki duyuru şeridi (fiyat planı mesajı, bugünkü etkinlik) */
export interface SiteNotice {
  id: string
  kind: 'price' | 'event'
  text: string
  /** Etkinlik duyurusu: başlangıç saati (ISO); metin dile göre biçimlenir */
  startsAt?: string
  isNow?: boolean
  href?: string
}

export function brandColor(restaurant: Pick<SiteRestaurant, 'primary_color' | 'branding'> | null | undefined, override?: string | null) {
  return override || restaurant?.branding?.primaryColor || restaurant?.primary_color || '#e11d48'
}

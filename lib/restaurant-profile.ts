import { z } from 'zod'
import type { Restaurant } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Temizleyiciler (istemci ve sunucu ortak)                            */
/* ------------------------------------------------------------------ */

/** @ad, ad veya instagram.com/ad linkini kullanıcı adına çevirir. Geçersizse ''. */
export function normalizeInstagram(input: string): string {
  let v = (input || '').trim()
  if (!v) return ''
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^instagram\.com\//i, '')
  v = v.split(/[/?#]/)[0].replace(/^@+/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : ''
}

/** 05xx / +90 5xx / 5xx biçimlerini 905xxxxxxxxx'e çevirir. Geçersizse ''. */
export function normalizeWhatsapp(input: string): string {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  let n = digits
  if (n.startsWith('00')) n = n.slice(2)
  if (n.startsWith('0')) n = '90' + n.slice(1)
  else if (n.length === 10 && n.startsWith('5')) n = '90' + n
  return n.length >= 10 && n.length <= 15 ? n : ''
}

const GOOGLE_HOSTS = [
  'google.com',
  'maps.google.com',
  'search.google.com',
  'g.page',
  'goo.gl',
  'maps.app.goo.gl',
  'g.co',
]

/** Yalnızca https ve Google alan adlarını kabul eder. Geçersizse ''. */
export function normalizeGoogleUrl(input: string): string {
  let v = (input || '').trim()
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    const host = u.hostname.toLowerCase()
    const ok = GOOGLE_HOSTS.some((h) => host === h || host.endsWith('.' + h))
    if (!ok) return ''
    u.protocol = 'https:'
    return u.toString().slice(0, 2048)
  } catch {
    return ''
  }
}

/** Verilen alan adlarına ait https adresini kabul eder (alt alan adları dahil). Geçersizse ''. */
export function normalizeUrlForHosts(input: string, hosts: string[]): string {
  let v = (input || '').trim()
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    const host = u.hostname.toLowerCase()
    if (!hosts.some((h) => host === h || host.endsWith('.' + h))) return ''
    u.protocol = 'https:'
    return u.toString().slice(0, 2048)
  } catch {
    return ''
  }
}

/** İşletmenin kendi web sitesi: yalnızca http(s), https'e çevrilir. Geçersizse ''. */
export function normalizeWebUrl(input: string): string {
  let v = (input || '').trim()
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    if (!u.hostname.includes('.') || u.username || u.password) return ''
    u.protocol = 'https:'
    return u.toString().slice(0, 2048)
  } catch {
    return ''
  }
}

/** Geçersizse ''. */
export function normalizeEmail(input: string): string {
  const v = (input || '').trim().toLowerCase().slice(0, 200)
  return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(v) ? v : ''
}

/** @ad, ad veya tiktok.com/@ad → ad. Geçersizse ''. */
export function normalizeTiktok(input: string): string {
  let v = (input || '').trim()
  if (!v) return ''
  v = v.replace(/^https?:\/\/(www\.|m\.)?tiktok\.com\//i, '').replace(/^tiktok\.com\//i, '')
  v = v.split(/[/?#]/)[0].replace(/^@+/, '')
  return /^[A-Za-z0-9._]{2,24}$/.test(v) ? v : ''
}

/** @ad, ad, x.com/ad veya twitter.com/ad → ad. Geçersizse ''. */
export function normalizeXHandle(input: string): string {
  let v = (input || '').trim()
  if (!v) return ''
  v = v.replace(/^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//i, '').replace(/^(x|twitter)\.com\//i, '')
  v = v.split(/[/?#]/)[0].replace(/^@+/, '')
  return /^[A-Za-z0-9_]{1,15}$/.test(v) ? v : ''
}

export const normalizeFacebookUrl = (input: string) => normalizeUrlForHosts(input, ['facebook.com', 'fb.com', 'fb.me'])
export const normalizeYoutubeUrl = (input: string) => normalizeUrlForHosts(input, ['youtube.com', 'youtu.be'])

const clean = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[<>]/g, '').trim().slice(0, max))

/* ------------------------------------------------------------------ */
/* Güncelleme şeması                                                   */
/* ------------------------------------------------------------------ */

/** İşletme türleri artık DB'den (business_types) yönetildiği için yalnızca biçim doğrulanır. */
export const businessTypeSlug = z.string().regex(/^[a-z0-9-]{2,40}$/)

export const profileUpdateSchema = z.object({
  name: clean(100).optional(),
  currency: clean(10).optional(),
  businessType: businessTypeSlug.optional(),
  phone: clean(30).optional(),
  address: clean(300).optional(),
  city: clean(50).optional(),
  workingHours: clean(100).optional(),
  googleMapsUrl: z.string().transform(normalizeGoogleUrl).optional(),
  googleReviewUrl: z.string().transform(normalizeGoogleUrl).optional(),
  instagramHandle: z.string().transform(normalizeInstagram).optional(),
  whatsappNumber: z.string().transform(normalizeWhatsapp).optional(),
  contactEmail: z.string().transform(normalizeEmail).optional(),
  websiteUrl: z.string().transform(normalizeWebUrl).optional(),
  facebookUrl: z.string().transform(normalizeFacebookUrl).optional(),
  tiktokHandle: z.string().transform(normalizeTiktok).optional(),
  xHandle: z.string().transform(normalizeXHandle).optional(),
  youtubeUrl: z.string().transform(normalizeYoutubeUrl).optional(),
  aboutText: z
    .string()
    .transform((s) => s.replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000))
    .optional(),
  aboutSource: z.enum(['ai', 'manual', 'template']).optional(),
  wifiName: clean(32).optional(),
  wifiPassword: clean(63).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  onboardingStep: clean(30).optional(),
  completeOnboarding: z.boolean().optional(),
})

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

/** Doğrulanmış güncellemeyi DB sütunlarına çevirir. */
export function profileToDbColumns(p: ProfileUpdate): Record<string, any> {
  const m: Record<string, any> = {}
  const set = (col: string, v: any) => {
    if (v !== undefined) m[col] = v
  }
  set('name', p.name)
  set('currency', p.currency)
  set('business_type', p.businessType)
  set('business_phone', p.phone)
  set('address', p.address)
  set('city', p.city)
  set('working_hours', p.workingHours)
  set('google_maps_url', p.googleMapsUrl)
  set('google_review_url', p.googleReviewUrl)
  set('instagram_handle', p.instagramHandle)
  set('whatsapp_number', p.whatsappNumber)
  set('contact_email', p.contactEmail)
  set('website_url', p.websiteUrl)
  set('facebook_url', p.facebookUrl)
  set('tiktok_handle', p.tiktokHandle)
  set('x_handle', p.xHandle)
  set('youtube_url', p.youtubeUrl)
  if (p.aboutText !== undefined) {
    // Boş metin: sitede otomatik metin gösterilir
    m.about_text = p.aboutText || null
    m.about_source = p.aboutText ? p.aboutSource || 'manual' : null
  }
  set('wifi_name', p.wifiName)
  set('wifi_password', p.wifiPassword)
  set('primary_color', p.primaryColor)
  set('onboarding_step', p.onboardingStep)
  if (p.completeOnboarding) m.onboarding_completed_at = new Date().toISOString()
  return m
}

/* ------------------------------------------------------------------ */
/* DB satırı -> Restaurant                                             */
/* ------------------------------------------------------------------ */

export function orgRowToRestaurant(row: any, extra: { email?: string; role?: string } = {}): Restaurant {
  return {
    id: row.id,
    name: row.name || 'Restoranım',
    subdomain: row.subdomain,
    currency: row.currency || '₺',
    status: row.status === 'suspended' ? 'suspended' : 'active',
    statusReason: row.status_reason || '',
    statusChangedAt: row.status_changed_at || null,
    role: extra.role,
    ownerName: row.owner_name || '',
    createdAt: row.created_at || undefined,
    businessType: row.business_type || undefined,
    onboardingStep: row.onboarding_step || undefined,
    onboardingCompletedAt: row.onboarding_completed_at || null,
    businessInfo: {
      owner_name: row.owner_name || '',
      email: extra.email,
      phone: row.business_phone || '',
      address: row.address || '',
      city: row.city || '',
      wifi_name: row.wifi_name || '',
      wifi_password: row.wifi_password || '',
      instagramHandle: row.instagram_handle || '',
      whatsappNumber: row.whatsapp_number || '',
      googleMapsUrl: row.google_maps_url || '',
      googleReviewUrl: row.google_review_url || '',
      workingHours: row.working_hours || '',
      contactEmail: row.contact_email || '',
      websiteUrl: row.website_url || '',
      facebookUrl: row.facebook_url || '',
      tiktokHandle: row.tiktok_handle || '',
      xHandle: row.x_handle || '',
      youtubeUrl: row.youtube_url || '',
    },
    about: {
      text: row.about_text || '',
      source: row.about_source || null,
    },
    branding: {
      primaryColor: row.primary_color || '#e11d48',
      logoUrl: row.logo_url || '',
      coverUrl: row.cover_url || '',
      bannerUrl: row.cover_url || '',
      currency: row.currency || '₺',
    },
  }
}

/** Migration 15 öncesi profil sütunları (yeni sütunlar okunamazsa buna düşülür) */
export const ORG_PROFILE_COLUMNS_BASE =
  'id, name, subdomain, owner_name, status, status_reason, status_changed_at, created_at, currency, business_type, business_phone, address, city, logo_url, cover_url, primary_color, wifi_name, wifi_password, instagram_handle, whatsapp_number, google_maps_url, google_review_url, working_hours, onboarding_step, onboarding_completed_at'

/** Migration 15: işletme sitesi (iletişim, hakkımızda) sütunları */
export const ORG_SITE_COLUMNS =
  'contact_email, website_url, facebook_url, tiktok_handle, x_handle, youtube_url, about_text, about_source'

export const ORG_PROFILE_COLUMNS = `${ORG_PROFILE_COLUMNS_BASE}, ${ORG_SITE_COLUMNS}`

/** Henüz çalıştırılmamış migration'a ait sütun/tablo hatası mı (Postgres 42703/42P01, PostgREST PGRST204/205) */
export function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code || '') || /does not exist|could not find/i.test(error.message || '')
}

/* ------------------------------------------------------------------ */
/* Tamamlama kontrol listesi                                           */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  href: string
}

export function buildChecklist(
  r: Restaurant | null,
  opts: { hasMenu?: boolean; hasTables?: boolean } = {}
): ChecklistItem[] {
  const b = r?.businessInfo
  return [
    { id: 'type', label: 'İşletme türü', done: !!r?.businessType, href: '/dashboard/settings?tab=isletme' },
    { id: 'logo', label: 'Logo', done: !!r?.branding?.logoUrl, href: '/dashboard/settings?tab=marka' },
    { id: 'contact', label: 'Telefon ve adres', done: !!(b?.phone && b?.address), href: '/dashboard/settings?tab=isletme' },
    { id: 'wifi', label: 'Wi-Fi bilgisi', done: !!b?.wifi_name, href: '/dashboard/settings?tab=wifi' },
    { id: 'instagram', label: 'Instagram', done: !!b?.instagramHandle, href: '/dashboard/settings?tab=sosyal' },
    { id: 'review', label: 'Google yorum linki', done: !!b?.googleReviewUrl, href: '/dashboard/settings?tab=sosyal' },
    { id: 'menu', label: 'İlk menü', done: !!opts.hasMenu, href: '/dashboard/menu-editor' },
    { id: 'qr', label: 'İlk QR masa', done: !!opts.hasTables, href: '/dashboard/qr-codes' },
  ]
}

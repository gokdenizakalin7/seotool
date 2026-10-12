/**
 * Süper admin API'lerinin yanıt tipleri (istemci ve sunucu ortak).
 */

export type OrgStatus = 'active' | 'suspended'
export type MemberRole = 'owner' | 'admin' | 'staff'

export interface AdminOrgRow {
  id: string
  name: string
  subdomain: string
  ownerName: string
  phone: string
  city: string
  businessType: string | null
  logoUrl: string
  status: OrgStatus
  statusReason: string
  statusChangedAt: string | null
  createdAt: string
  onboardingCompleted: boolean
  owner: {
    userId: string
    email: string
    lastSignInAt: string | null
    bannedUntil: string | null
    isSuperAdmin: boolean
  } | null
  memberCount: number
  menuCount: number
  listedMenuCount: number
  itemCount: number
  tableCount: number
  qrViews: number
  views30d: number
}

export interface AdminMember {
  userId: string
  email: string
  role: MemberRole
  joinedAt: string
  lastSignInAt: string | null
  bannedUntil: string | null
  ownerName: string
  mustChangePassword: boolean
}

export interface AdminMenuSummary {
  id: string
  name: string
  isListed: boolean
  categoryCount: number
  itemCount: number
  updatedAt: string | null
}

export interface AdminTable {
  id: string
  name: string
  views: number
}

export interface AuditLogEntry {
  id: number
  actorEmail: string | null
  action: string
  targetType: string
  targetId: string | null
  targetLabel: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  createdAt: string
}

export interface AdminOrgDetail {
  /** organizations satırı (ham, snake_case) */
  org: Record<string, any>
  adminNote: string
  statusChangedByEmail: string | null
  members: AdminMember[]
  menus: AdminMenuSummary[]
  tables: AdminTable[]
  audit: AuditLogEntry[]
}

export interface AdminUserRow {
  id: string
  email: string
  createdAt: string
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  bannedUntil: string | null
  ownerName: string
  mustChangePassword: boolean
  /** Sistem yöneticisi (kök ya da panelden açılmış) */
  isSuperAdmin: boolean
  /** Kök sistem yöneticisi (SUPER_ADMIN_EMAIL): engellenemez, silinemez */
  isRootAdmin: boolean
  memberships: {
    organizationId: string
    name: string
    subdomain: string
    role: MemberRole
    status: OrgStatus
  }[]
}

export interface AdminCatalogCategory {
  id: string
  parentId: string | null
  slug: string
  name: string
  nameEn: string
  icon: string
  displayOrder: number
  isActive: boolean
  itemCount: number
  adminEditedAt: string | null
}

export interface AdminCatalogItem {
  id: string
  slug: string
  categoryId: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  priceSuggested: string
  imageUrl: string
  allergens: string[]
  calories: number | null
  tags: string[]
  displayOrder: number
  isActive: boolean
  adminEditedAt: string | null
  updatedAt: string | null
  usageCount?: number
  orgCount?: number
}

export interface ImagePropagationResult {
  updated: number
  cleared: number
  kept_custom: number
  linked: number
}

export interface AdminBusinessType {
  slug: string
  label: string
  icon: string
  hint: string
  color: string
  coverImage: string
  defaultTemplateSlug: string | null
  displayOrder: number
  isActive: boolean
  orgCount: number
}

export interface AdminTemplate {
  id: string
  slug: string
  businessType: string | null
  name: string
  tagline: string
  venueType: string
  icon: string
  color: string
  coverImage: string
  description: string
  displayOrder: number
  isActive: boolean
  categoryCount: number
  itemCount: number
}

export interface AdminTemplateDetail extends AdminTemplate {
  categories: { categoryId: string; displayOrder: number }[]
  items: { itemId: string; displayOrder: number; priceOverride: string | null }[]
}

export interface AdminStats {
  organizations: number
  organizations_active: number
  organizations_suspended: number
  organizations_onboarded: number
  users: number
  users_banned: number
  menus: number
  menus_listed: number
  items: number
  items_with_catalog: number
  tables: number
  qr_views: number
  views_30d: number
  catalog_items: number
  catalog_items_active: number
  catalog_items_with_image: number
  catalog_categories: number
  templates: number
  views_by_device: Record<string, number>
  views_daily: { day: string; count: number }[]
  signups_weekly: { week: string; count: number }[]
}

export const SUSPEND_REASON_PRESETS = [
  'Ödeme gecikmesi',
  'Sözleşme sona erdi',
  'Kullanım koşulları ihlali',
  'İşletme kapandı',
  'İşletme talebiyle donduruldu',
]

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Sahip',
  admin: 'Restoran yöneticisi',
  staff: 'Personel',
}

/** 14 AB alerjeni (katalog sözlüğü, qr-menu-seed/schema/vocab.json) */
export const EU_ALLERGENS = [
  'Gluten',
  'Süt Ürünleri',
  'Yumurta',
  'Balık',
  'Kabuklu Deniz Ürünleri',
  'Yumuşakçalar',
  'Yer Fıstığı',
  'Sert Kabuklu Yemişler',
  'Soya',
  'Kereviz',
  'Hardal',
  'Susam',
  'Sülfit',
  'Acı Bakla',
]

/** Katalog etiket sözlüğü (qr-menu-seed/schema/vocab.json) */
export const CATALOG_TAGS: { id: string; label: string }[] = [
  { id: 'hot', label: 'Sıcak' },
  { id: 'cold', label: 'Soğuk' },
  { id: 'caffeinated', label: 'Kafeinli' },
  { id: 'decaf', label: 'Kafeinsiz' },
  { id: 'alcoholic', label: 'Alkollü' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vejetaryen' },
  { id: 'gluten_free', label: 'Glutensiz' },
  { id: 'dairy_free', label: 'Süt Ürünü İçermez' },
  { id: 'sugar_free', label: 'Şekersiz' },
  { id: 'spicy', label: 'Acılı' },
  { id: 'kids', label: 'Çocuklar İçin' },
  { id: 'sharing', label: 'Paylaşımlık' },
  { id: 'seasonal', label: 'Mevsimlik' },
  { id: 'popular', label: 'Popüler' },
  { id: 'chef_choice', label: 'Şefin Önerisi' },
]

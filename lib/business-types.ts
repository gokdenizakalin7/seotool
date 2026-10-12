/**
 * İşletme türleri business_types tablosundan yönetilir (admin paneli, /api/business-types).
 * Aşağıdaki liste yalnızca tablo okunamazsa kullanılan yedek ve tohum verisidir.
 */
export type BusinessTypeId = string

export interface BusinessType {
  id: BusinessTypeId
  label: string
  icon: string
  hint: string
  color: string
  coverImage: string
  /** menu_templates.slug: bu işletme tipi için varsayılan (önerilen) şablon. Diğer şablonlar business_type ile listelenir. */
  templateId?: string
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'cafe',
    label: 'Kafe / All Day',
    icon: '☕',
    hint: 'Kahvaltı, kahve, tatlı, gün boyu menü',
    color: '#d97706',
    coverImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&h=600&fit=crop',
    templateId: 'kafe-bistro',
  },
  {
    id: 'restaurant',
    label: 'Restoran',
    icon: '🍽️',
    hint: 'Ana yemek ağırlıklı lokanta ve restoran',
    color: '#be123c',
    coverImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=600&fit=crop',
    templateId: 'aile-restorani',
  },
  {
    id: 'kebab',
    label: 'Kebapçı / Ocakbaşı',
    icon: '🔥',
    hint: 'Kebap, lahmacun, pide, meze',
    color: '#e11d48',
    coverImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=600&fit=crop',
    templateId: 'kebapci-ocakbasi',
  },
  {
    id: 'pub',
    label: 'Pub / Bar',
    icon: '🍸',
    hint: 'Kokteyl, bira, atıştırmalık',
    color: '#7c3aed',
    coverImage: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&h=600&fit=crop',
    templateId: 'bar-pub',
  },
  {
    id: 'nargile',
    label: 'Nargile Kafe',
    icon: '💨',
    hint: 'Nargile, çay, sıcak ve soğuk içecekler',
    color: '#0f766e',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=600&fit=crop',
    templateId: 'nargile-kafe',
  },
  {
    id: 'fastfood',
    label: 'Fast Food / Burger',
    icon: '🍔',
    hint: 'Burger, tavuk, menü kombinasyonları',
    color: '#ea580c',
    coverImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&h=600&fit=crop',
    templateId: 'burger-evi',
  },
  {
    id: 'bakery',
    label: 'Pastane / Fırın',
    icon: '🥐',
    hint: 'Pasta, börek, ekmek, tatlı',
    color: '#db2777',
    coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&h=600&fit=crop',
    templateId: 'pastane-firin',
  },
  {
    id: 'meyhane',
    label: 'Meyhane / Balık',
    icon: '🐟',
    hint: 'Meze, balık, rakı sofrası',
    color: '#0369a1',
    coverImage: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=1200&h=600&fit=crop',
    templateId: 'meyhane',
  },
  {
    id: 'other',
    label: 'Diğer',
    icon: '✨',
    hint: 'Listede olmayan işletme türü',
    color: '#e11d48',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop',
  },
]

export function getBusinessType(id?: string | null): BusinessType | undefined {
  return BUSINESS_TYPES.find((t) => t.id === id)
}

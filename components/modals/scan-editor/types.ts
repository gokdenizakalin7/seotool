import type { CatalogMatchInfo } from '@/lib/catalog-match'

export interface ParsedItem {
  name: string
  price: string
  calories?: number
  description?: string
  allergens?: string[]
  ingredients?: string[]
  image_url?: string
  /** Kataloğa bağlantı (eşleşme kabul edildiyse) */
  catalog_item_id?: string | null
  /** Sunucudan gelen eşleştirme bilgisi; yalnız editörde kullanılır, kaydedilmez */
  match?: CatalogMatchInfo
}

export interface ParsedCategory {
  name: string
  items: ParsedItem[]
}

/** Editör içinde kararlı kimlik taşıyan ürün */
export interface EditorItem extends ParsedItem {
  id: string
}

export interface EditorCategory {
  id: string
  name: string
  items: EditorItem[]
}

export interface EditorState {
  menuName: string
  categories: EditorCategory[]
}

export type ItemIssue = 'noName' | 'noPrice' | 'duplicate'

export const COMMON_ALLERGENS = [
  'Gluten',
  'Süt',
  'Yumurta',
  'Fıstık',
  'Fındık',
  'Ceviz',
  'Soya',
  'Balık',
  'Kabuklu deniz ürünü',
  'Susam',
  'Hardal',
  'Kereviz',
]

export type AccountStatus = 'active' | 'suspended' | 'pending' | 'rejected'

export type ProductTag =
  | 'hot'
  | 'cold'
  | 'caffeinated'
  | 'decaf'
  | 'alcoholic'
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'dairy_free'
  | 'sugar_free'
  | 'spicy'
  | 'kids'
  | 'sharing'
  | 'seasonal'
  | 'popular'
  | 'chef_choice'
  | 'discount'

export interface ProductVariation {
  id: string
  name: string
  price: string
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: string
  image_url: string
  calories?: number
  calorie_source?: 'auto' | 'manual' | 'detailed'
  allergens?: string[]
  ingredients?: string[]
  macros?: {
    protein: number
    carbs: number
    fat: number
  }
  tags?: ProductTag[]
  variations?: ProductVariation[]
  display_order: number
  is_available: boolean
  is_featured?: boolean
  /** Master katalog ürününe bağlantı (şablon/eşleştirme ile gelir); görsel yenilemede kullanılır */
  catalog_item_id?: string | null
  /** Yalnızca müşteri sayfasında: fiyat planı ya da kampanya indirimi varsa üstü çizili eski fiyat */
  original_price?: string
  /** Yalnızca müşteri sayfasında: kampanya içeriği ("1× Bira, 1× Patates") */
  bundle?: { name: string; quantity: number }[]
}

export interface MenuCategory {
  id: string
  name: string
  description?: string
  parent_id?: string | null
  icon?: string | null
  display_order: number
  is_active: boolean
  items: MenuItem[]
}

export interface Menu {
  id: string
  name: string
  description: string
  image_url: string
  is_listed: boolean
  available_days: number[]
  start_time?: string
  end_time?: string
  layout: 'grid' | 'list'
  created_at: string
  updated_at: string
  categories: MenuCategory[]
}

export interface QRCodeData {
  id: string
  name?: string
  table_number?: string
  area?: string
  qr_url?: string
  created_at: string
  last_regenerated_at?: string
  scans_count?: number
  views?: number
  menu_id?: string
  menu: {
    name: string
    organization: {
      subdomain: string
    }
  }
}

export interface WaiterCall {
  id: string
  table_number: string
  type: 'bill' | 'waiter' | 'water' | 'other'
  note?: string
  created_at: string
  status: 'pending' | 'resolved'
}

export interface Restaurant {
  id: string
  name: string
  subdomain: string
  currency: string
  status: AccountStatus
  /** Askıya alma sebebi (yalnızca status = 'suspended' iken anlamlı) */
  statusReason?: string
  statusChangedAt?: string | null
  role?: string
  ownerName?: string
  createdAt?: string
  businessType?: string
  onboardingStep?: string
  onboardingCompletedAt?: string | null
  tables?: any[]
  businessInfo?: {
    owner_name?: string
    email?: string
    phone?: string
    city?: string
    address?: string
    state?: string
    zipcode?: string
    wifi_name?: string
    wifi_password?: string
    instagramHandle?: string
    whatsappNumber?: string
    googleMapsUrl?: string
    googleReviewUrl?: string
    workingHours?: string
    /** İşletmenin iletişim e-postası (giriş e-postası `email` alanındadır) */
    contactEmail?: string
    websiteUrl?: string
    facebookUrl?: string
    tiktokHandle?: string
    xHandle?: string
    youtubeUrl?: string
    hours?: any
  }
  /** Sitedeki "Hakkımızda" metni; boşsa otomatik metin gösterilir */
  about?: {
    text: string
    source: 'ai' | 'manual' | 'template' | null
  }
  branding?: {
    primaryColor?: string
    logoUrl?: string
    bannerUrl?: string
    coverUrl?: string
    currency?: string
  }
}

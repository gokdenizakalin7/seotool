/**
 * Centralized application constants to eliminate magic strings/numbers
 * spread across multiple files. Import from here instead of hardcoding.
 */

/**
 * İşletme kullanıcılarının AI ile ürün görseli üretmesi (Cloudflare, /api/items/generate-image).
 * Kapalı: üretilen görseller şu an yeterince sağlıklı değil. Panel ve tarama editöründeki düğmeler gizlenir,
 * API isteği reddeder. Yeniden açmak için true yapmak yeterli.
 */
export const AI_ITEM_IMAGES_ENABLED = false

export const APP_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  RESTAURANT: 'restaurant',
} as const

export type AppRole = typeof APP_ROLES[keyof typeof APP_ROLES]

export const STORAGE_KEYS = {
  USER_ROLE: 'user_role',
  CURRENT_RESTAURANT: 'currentRestaurant',
  ALL_RESTAURANTS: 'all_restaurants',
  SYSTEM_USERS: 'system_users',
  SCAN_COUNT: 'qolay_scan_count',
  SCAN_DATE: 'qolay_scan_date',
} as const

export const TIME_RANGES = {
  SEVEN_DAYS: '7d',
  THIRTY_DAYS: '30d',
  NINETY_DAYS: '90d',
} as const

export const DEFAULTS = {
  CURRENCY: '₺',
  DEBOUNCE_MS: 400,
  MAX_PHOTOS: 10,
  DAILY_SCAN_LIMIT: 2,
  SESSION_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes
} as const

import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Admin panelinden değiştirilebilen platform ayarları (platform_settings tablosu).
 * Tablo yoksa veya anahtar tanımlı değilse varsayılan değer kullanılır.
 */

export interface PlatformSettings {
  signup_enabled: boolean
  image_gen_org_daily_cap: number
  image_gen_daily_cap: number
  suspended_menu_message: string
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  signup_enabled: true,
  image_gen_org_daily_cap: Number(process.env.IMAGE_GEN_ORG_DAILY_CAP) || 20,
  image_gen_daily_cap: Number(process.env.IMAGE_GEN_DAILY_CAP) || 150,
  suspended_menu_message: 'Bu menü geçici olarak hizmet dışıdır.',
}

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof PlatformSettings)[]

const CACHE_TTL_MS = 60_000
let cache: { value: PlatformSettings; expires: number } | null = null

export function clearPlatformSettingsCache() {
  cache = null
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const now = Date.now()
  if (cache && cache.expires > now) return cache.value

  const value: PlatformSettings = { ...DEFAULT_SETTINGS }
  const { data, error } = await supabaseAdmin.from('platform_settings').select('key, value')
  if (!error && data) {
    for (const row of data) {
      const key = row.key as keyof PlatformSettings
      if (!(key in DEFAULT_SETTINGS)) continue
      if (typeof row.value === typeof DEFAULT_SETTINGS[key]) (value as any)[key] = row.value
    }
  }
  cache = { value, expires: now + CACHE_TTL_MS }
  return value
}

export async function getSetting<K extends keyof PlatformSettings>(key: K): Promise<PlatformSettings[K]> {
  return (await getPlatformSettings())[key]
}

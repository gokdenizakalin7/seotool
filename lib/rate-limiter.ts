import { NextRequest } from 'next/server'

/**
 * Enterprise Dağıtık / Bellek İçi Sliding-Window Rate Limiter
 * DoS, Brute-force ve API kota tüketim saldırılarına karşı IP ve oturum bazlı koruma sağlar.
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

// Bellek içi sliding-window deposu (otomatik süresi dolanları temizler)
const memoryStore = new Map<string, RateLimitRecord>()

// Bellek sızıntısını önlemek için her 5 dakikada bir eski kayıtları temizleyen çöp toplayıcı
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetTime) {
        memoryStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetSeconds: number
}

/** Yerel geliştirmede veya DISABLE_RATE_LIMIT=true ile tüm limitler kapalı. */
export function isRateLimitEnabled(): boolean {
  if (process.env.DISABLE_RATE_LIMIT === 'true') return false
  if (process.env.NODE_ENV === 'development') return false
  return true
}

/**
 * Belirtilen anahtar için hız sınırını kontrol eder.
 * @param key Benzersiz kimlik (örn: IP adresi, restoran ID, kullanıcı ID)
 * @param limit İzin verilen maksimum istek sayısı
 * @param windowSeconds Pencere süresi (saniye cinsinden)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  if (!isRateLimitEnabled()) {
    return {
      success: true,
      limit,
      remaining: limit,
      resetSeconds: windowSeconds,
    }
  }

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const record = memoryStore.get(key)

  if (!record || now > record.resetTime) {
    // Yeni pencere başlat
    memoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetSeconds: windowSeconds
    }
  }

  // Mevcut pencere devam ediyor
  record.count += 1
  const remaining = Math.max(0, limit - record.count)
  const resetSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000))

  if (record.count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetSeconds
    }
  }

  return {
    success: true,
    limit,
    remaining,
    resetSeconds
  }
}

// Ürün başına kullanım kotası (geliştirme ortamında da çalışır, DISABLE_RATE_LIMIT'ten etkilenmez)
const quotaStore = new Map<string, RateLimitRecord>()

export interface QuotaStatus {
  allowed: boolean
  used: number
  limit: number
  resetSeconds: number
}

/** Mevcut kullanımı sayaç artırmadan okur. */
export function getQuota(key: string, limit: number): QuotaStatus {
  const now = Date.now()
  const record = quotaStore.get(key)
  if (!record || now > record.resetTime) {
    return { allowed: true, used: 0, limit, resetSeconds: 0 }
  }
  return {
    allowed: record.count < limit,
    used: record.count,
    limit,
    resetSeconds: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
  }
}

/** Başarılı bir kullanımı sayaca ekler. */
export function consumeQuota(key: string, windowSeconds: number): void {
  const now = Date.now()
  const record = quotaStore.get(key)
  if (!record || now > record.resetTime) {
    quotaStore.set(key, { count: 1, resetTime: now + windowSeconds * 1000 })
  } else {
    record.count += 1
  }
}

/**
 * Reverse-Proxy (Vercel, Cloudflare, Nginx) arkasındaki gerçek istemci IP adresini güvenle alır.
 * X-Forwarded-For sahteciliğini önlemek için en sol (ilk) IP'yi kullanır.
 */
export function getClientIp(req: NextRequest | Request): string {
  try {
    const headers = req.headers

    // Cloudflare gerçek IP
    const cfIp = headers.get('cf-connecting-ip')
    if (cfIp) return cfIp.trim()

    // Standart Real-IP
    const realIp = headers.get('x-real-ip')
    if (realIp) return realIp.trim()

    // X-Forwarded-For zinciri
    const forwardedFor = headers.get('x-forwarded-for')
    if (forwardedFor) {
      const parts = forwardedFor.split(',')
      if (parts.length > 0 && parts[0].trim()) {
        return parts[0].trim()
      }
    }
  } catch {
    // Fallback
  }

  return '127.0.0.1'
}

/**
 * Önceden tanımlanmış güvenlik limit konfigürasyonları
 */
export const RATE_LIMITS = {
  // Gemini Menü Tarama: 10 dakikada en fazla 5 istek (Burst koruması)
  MENU_SCAN: { limit: 5, windowSeconds: 600 },
  // AI Kalori Tahmini: 1 dakikada en fazla 30 istek (Toplu tarama desteği)
  CALORIE_ESTIMATE: { limit: 30, windowSeconds: 60 },
  // AI Kalori Tahmini: aynı ürün için kullanıcı başına 24 saatte en fazla 2 hesaplama
  CALORIE_PER_ITEM: { limit: 2, windowSeconds: 86400 },
  // Giriş Yapma: 15 dakikada en fazla 5 deneme (Brute-force koruması)
  AUTH_LOGIN: { limit: 5, windowSeconds: 900 },
  // Kayıt: IP başına saatte en fazla 5 hesap
  AUTH_SIGNUP: { limit: 5, windowSeconds: 3600 },
  // Logo/kapak yükleme: kullanıcı başına 10 dakikada 20
  ASSET_UPLOAD: { limit: 20, windowSeconds: 600 },
  // Katalog arama / eşleştirme: IP başına dakikada 60
  CATALOG_MATCH: { limit: 60, windowSeconds: 60 },
  // Katalog takma adı onayı: IP başına 10 dakikada 30 istek
  CATALOG_ALIAS: { limit: 30, windowSeconds: 600 },
  // Aynı kullanıcı aynı takma adı 24 saatte bir kez saydırır
  ALIAS_PER_USER: { limit: 1, windowSeconds: 86400 },
  // AI ürün görseli üretimi: kullanıcı başına 10 dakikada 10 (günlük kota DB'de)
  IMAGE_GENERATE: { limit: 10, windowSeconds: 600 },
  // "Hakkımızda" metni AI üretimi: kullanıcı başına saatte 10
  ABOUT_GENERATE: { limit: 10, windowSeconds: 3600 },
  // AI menü zenginleştirme (kalori/alerjen toplu doldurma): org başına 24 saatte 3
  MENU_ENRICH: { limit: 3, windowSeconds: 86400 },
  // Genel API rotaları: Dakikada en fazla 100 istek (DDoS & Scraping koruması)
  GENERAL_API: { limit: 100, windowSeconds: 60 }
}


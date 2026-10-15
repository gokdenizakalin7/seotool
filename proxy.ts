import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIp, RATE_LIMITS } from './lib/rate-limiter'
import { logSecurityEvent } from './lib/security-logger'

/**
 * Enterprise Next.js Root Güvenlik ve Kalkan Proxy (Castle Shield)
 * Tüm gelen HTTP trafiğini inceler, saldırı tarayıcılarını engeller,
 * rate limit uygular ve güvenlik başlıklarını (HSTS, CSP, X-Frame-Options) enjekte eder.
 * Next 16 proxy her zaman Node.js runtime'ında çalışır (runtime ayarı verilemez).
 */

// Saldırganların ve otomatik botların taradığı yasaklı dosya / yol kalıpları
const BLOCKED_PATH_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/\.aws/i,
  /\/\.ssh/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/phpmyadmin/i,
  /\/phpinfo/i,
  /\/server-status/i,
  /\/xmlrpc\.php/i,
  /\/\.\./,           // Path traversal (..)
  /%2e%2e/i,         // Encoded path traversal (..)
  /<script/i,        // XSS denemeleri
  /\.bak$/i,         // Yedek dosyaları
  /\.config$/i
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // 1. ZARARLI BOT / TARAYICI YOL KONTROLÜ (0 Tolerans - Anında 403 Blok)
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      logSecurityEvent({
        type: 'SUSPICIOUS_PATH_PROBE',
        ip,
        endpoint: pathname,
        details: { pattern: pattern.toString(), userAgent: request.headers.get('user-agent') }
      })

      return new NextResponse(
        JSON.stringify({ error: 'Erişim engellendi. Güvenlik politikası ihlali.', code: 'FORBIDDEN_PROBE' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // 2. CORS POLİTİKASI & PREFLIGHT (/api/*)
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'https://qolay.com',
    'https://www.qolay.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]
  
  let isAllowedOrigin = false
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      isAllowedOrigin = true
    } else {
      try {
        const originUrl = new URL(origin)
        if (originUrl.hostname.endsWith('.qolay.com')) {
          isAllowedOrigin = true
        }
      } catch (e) {
        // Invalid origin URL
      }
    }
  }

  if (pathname.startsWith('/api')) {
    if (request.method === 'OPTIONS') {
      const preflightHeaders = new Headers()
      if (isAllowedOrigin && origin) {
        preflightHeaders.set('Access-Control-Allow-Origin', origin)
        preflightHeaders.set('Access-Control-Allow-Credentials', 'true')
        preflightHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        preflightHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
        preflightHeaders.set('Access-Control-Max-Age', '86400')
      }
      return new NextResponse(null, { status: 204, headers: preflightHeaders })
    }

    // GENEL API RATE LIMIT KORUMASI (/api/*)
    const rateLimitKey = `rate_api_${ip}`
    const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.GENERAL_API.limit, RATE_LIMITS.GENERAL_API.windowSeconds)

    if (!rateCheck.success) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip,
        endpoint: pathname,
        details: { limit: rateCheck.limit, window: RATE_LIMITS.GENERAL_API.windowSeconds }
      })

      return new NextResponse(
        JSON.stringify({
          error: 'Çok fazla istek gönderildi. Lütfen bir süre bekleyin.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: rateCheck.resetSeconds
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds),
            'X-RateLimit-Limit': String(rateCheck.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateCheck.resetSeconds)
          }
        }
      )
    }
  }

  // 3. YANITA ENTERPRISE GÜVENLİK BAŞLIKLARI (SECURITY HEADERS) ENJEKTE ETME
  const response = NextResponse.next()

  // Clickjacking Koruması (Siteyi başkası iframe içinde açamaz)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')

  // MIME Sniffing Koruması (Zararlı dosyaların script olarak çalıştırılmasını engeller)
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Zorunlu HTTPS Şifrelemesi (HSTS: 2 yıl, preload)
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // Referrer Gizliliği (Hassas URL parametrelerinin dışarı sızmasını engeller)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Donanım Kısıtlama Politikası
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')

  // XSS Koruması
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Content-Security-Policy (CSP) - Raporlama modunda (Report-Only) ve sıkılaştırılmış
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: blob: https://images.unsplash.com https://*.googleusercontent.com https://*.unsplash.com https://*.supabase.co;
    font-src 'self' data: https:;
    connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com https://*.supabase.co;
    frame-src 'self' https://www.google.com https://maps.google.com;
    frame-ancestors 'self';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s{2,}/g, ' ').trim()

  response.headers.set('Content-Security-Policy-Report-Only', cspHeader)

  // CORS Yanıt Başlıkları
  if (pathname.startsWith('/api') && isAllowedOrigin && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
  }

  // Sunucu kimliğini gizle
  response.headers.delete('x-powered-by')

  return response
}

export const config = {
  matcher: [
    /*
     * Aşağıdaki yollar dışındaki tüm rotalarda proxy çalıştırılır:
     * - _next/static (statik dosyalar)
     * - _next/image (görsel optimizasyon)
     * - favicon.ico (ikon)
     * - catalog/ (katalog ürün görselleri; her görsel isteğinde proxy çalışmasın)
     */
    '/((?!_next/static|_next/image|favicon.ico|catalog/).*)'
  ]
}

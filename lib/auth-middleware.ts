import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { logSecurityEvent } from './security-logger'
import { getClientIp } from './rate-limiter'

/**
 * Sunucu taraflı kimlik doğrulama ve çoklu kiracı (IDOR) yetkilendirme modülü.
 *
 * Kimlik yalnızca Supabase tarafından imzalanmış erişim token'ından (Authorization: Bearer)
 * doğrulanır. Çerezler, localStorage veya istemcinin gönderdiği rol bilgisi ASLA güvenilmez.
 */

const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL || 'gokdenizakalin7@gmail.com'
).toLowerCase()

/** Kök sistem yöneticisi (SUPER_ADMIN_EMAIL): engellenemez, silinemez, e-postası değiştirilemez. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return (email || '').toLowerCase() === SUPER_ADMIN_EMAIL
}

/**
 * Admin panelinden açılan sistem yöneticilerinin app_metadata.role değeri.
 * app_metadata'yı yalnızca service role yazabilir; kullanıcı kendi yetkisini değiştiremez.
 */
export const SYSTEM_ADMIN_ROLE = 'super_admin'

/** Sistem yöneticisi: kök e-posta ya da app_metadata.role = super_admin */
export function isSystemAdmin(user: { email?: string | null; app_metadata?: Record<string, any> | null } | null | undefined): boolean {
  return !!user && (isSuperAdminEmail(user.email) || user.app_metadata?.role === SYSTEM_ADMIN_ROLE)
}

export interface AuthUser {
  id: string
  email: string
  isSuperAdmin: boolean
}

type Denied = { response: NextResponse }

function deny(status: number, error: string, code: string): Denied {
  return { response: NextResponse.json({ error, code }, { status }) }
}

/**
 * Bearer token'ı Supabase ile doğrular. Geçersizse null döner.
 */
// Doğrulanmış token'lar için kısa ömürlü bellek önbelleği: her API çağrısında
// Supabase'e ağ gidiş-dönüşü yapmayı önler (sayfa geçişlerindeki gecikmenin ana nedeni).
const TOKEN_CACHE_TTL_MS = 30_000
const TOKEN_CACHE_MAX = 500
const tokenCache = new Map<string, { user: AuthUser; expires: number }>()

async function getAuthUser(req: NextRequest | Request): Promise<AuthUser | null> {
  const header = req.headers.get('authorization')
  if (!header || !header.startsWith('Bearer ')) return null

  const token = header.slice(7).trim()
  if (!token) return null

  const now = Date.now()
  const cached = tokenCache.get(token)
  if (cached && cached.expires > now) return cached.user

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    tokenCache.delete(token)
    return null
  }

  const email = (data.user.email || '').toLowerCase()
  const user: AuthUser = {
    id: data.user.id,
    email,
    isSuperAdmin: isSystemAdmin(data.user),
  }

  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    for (const [k, v] of tokenCache) {
      if (v.expires <= now) tokenCache.delete(k)
    }
    if (tokenCache.size >= TOKEN_CACHE_MAX) tokenCache.clear()
  }
  tokenCache.set(token, { user, expires: now + TOKEN_CACHE_TTL_MS })
  return user
}

/**
 * Geçerli bir oturum zorunlu kılar. Yoksa 401 döner.
 */
export async function requireUser(
  req: NextRequest | Request
): Promise<{ user: AuthUser } | Denied> {
  const user = await getAuthUser(req)
  if (!user) {
    logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      ip: getClientIp(req as NextRequest),
      endpoint: new URL(req.url).pathname,
      details: { reason: 'Geçersiz veya eksik oturum' },
    })
    return deny(401, 'Bu işlem için giriş yapmanız gerekmektedir.', 'UNAUTHORIZED')
  }
  return { user }
}

/** Oturum zorunlu (requireUser ile aynı; panel yükleme uçları için). */
export async function requireAuth(
  req: NextRequest | Request
): Promise<{ user: AuthUser } | Denied> {
  return requireUser(req)
}

/**
 * Süper admin e-postası ile giriş zorunlu kılar.
 */
export async function requireSuperAdmin(
  req: NextRequest | Request
): Promise<{ user: AuthUser } | Denied> {
  const auth = await requireUser(req)
  if ('response' in auth) return auth

  if (!auth.user.isSuperAdmin) {
    logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      ip: getClientIp(req as NextRequest),
      userId: auth.user.id,
      endpoint: new URL(req.url).pathname,
      details: { reason: 'Süper Admin yetkisi eksik' },
    })
    return deny(403, 'Bu işlem yalnızca Süper Adminlere açıktır.', 'FORBIDDEN')
  }

  return auth
}

export interface OrgAccessOptions {
  /** Askıya alınmış restoranda da izin ver (yalnızca okuma uçları için). */
  allowSuspended?: boolean
}

/** Org askıdaysa sebebini döner. Migration 11 çalışmadıysa (sütun yok) askıda sayılmaz. */
export async function getOrgSuspension(organizationId: string): Promise<{ reason: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('status, status_reason')
    .eq('id', organizationId)
    .maybeSingle()
  if (error || !data || data.status !== 'suspended') return null
  return { reason: data.status_reason || '' }
}

/**
 * Kullanıcının verilen organizasyonun üyesi (veya süper admin) olmasını zorunlu kılar.
 * Askıya alınmış restoranda üyeler yazamaz (423 ORG_SUSPENDED); süper admin etkilenmez.
 */
export async function requireOrgAccess(
  req: NextRequest | Request,
  organizationId: string,
  opts: OrgAccessOptions = {}
): Promise<{ user: AuthUser; organizationId: string } | Denied> {
  const auth = await requireUser(req)
  if ('response' in auth) return auth
  return checkOrgAccess(req, auth.user, organizationId, opts)
}

/** requireOrgAccess'in doğrulanmış kullanıcıyla çalışan kısmı (token ikinci kez doğrulanmasın) */
async function checkOrgAccess(
  req: NextRequest | Request,
  user: AuthUser,
  organizationId: string,
  opts: OrgAccessOptions
): Promise<{ user: AuthUser; organizationId: string } | Denied> {
  if (user.isSuperAdmin) return { user, organizationId }

  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!data) {
    logSecurityEvent({
      type: 'IDOR_ACCESS_ATTEMPT',
      ip: getClientIp(req as NextRequest),
      userId: user.id,
      endpoint: new URL(req.url).pathname,
      details: { targetOrganizationId: organizationId },
    })
    return deny(
      403,
      'Bu restoranın verilerine erişim yetkiniz bulunmamaktadır.',
      'FORBIDDEN_RESOURCE'
    )
  }

  if (!opts.allowSuspended) {
    const suspended = await getOrgSuspension(organizationId)
    if (suspended) {
      return {
        response: NextResponse.json(
          {
            error: 'Hesabınız askıya alındığı için değişiklik yapılamaz.',
            code: 'ORG_SUSPENDED',
            reason: suspended.reason,
          },
          { status: 423 }
        ),
      }
    }
  }

  return { user, organizationId }
}

/**
 * Subdomain'den organizasyonu bulur ve erişim yetkisini doğrular.
 * Organizasyon yoksa 404 döner (otomatik oluşturma yapılmaz).
 */
export async function requireSubdomainAccess(
  req: NextRequest | Request,
  subdomain: string,
  opts: OrgAccessOptions = {}
): Promise<{ user: AuthUser; organizationId: string } | Denied> {
  // Kimlik doğrulama ve organizasyon sorgusu birbirinden bağımsız: paralel çalışır
  const [auth, { data: org }] = await Promise.all([
    requireUser(req),
    supabaseAdmin.from('organizations').select('id').eq('subdomain', subdomain).maybeSingle(),
  ])
  if ('response' in auth) return auth

  if (!org) return deny(404, 'Organizasyon bulunamadı.', 'ORG_NOT_FOUND')

  return checkOrgAccess(req, auth.user, org.id, opts)
}

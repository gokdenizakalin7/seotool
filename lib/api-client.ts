import { supabase } from '@/lib/supabase'
import { clearClientSession } from '@/lib/session'

async function getAccessToken(): Promise<string> {
  if (typeof window === 'undefined') return ''

  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) return data.session.access_token

  return localStorage.getItem('sb-access-token') || ''
}

// Sayfa geçişlerinde aynı verinin tekrar tekrar çekilmesini önleyen kısa ömürlü GET önbelleği.
// Aynı anda yapılan özdeş istekler de tek ağ isteğine indirilir.
const GET_CACHE_TTL_MS = 30_000
const CACHEABLE_PREFIXES = ['/api/auth/me', '/api/menus/load', '/api/tables/load', '/api/templates']
const responseCache = new Map<string, { expires: number; promise: Promise<Response> }>()

function isCacheable(url: string, options: RequestInit) {
  const method = (options.method || 'GET').toUpperCase()
  return method === 'GET' && CACHEABLE_PREFIXES.some(p => url.startsWith(p))
}

/** Çıkış / oturum değişiminde veya veri yazıldığında önbelleği temizler. */
export function clearApiCache() {
  responseCache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('api-cache-clear', clearApiCache)
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()

  // Yazma işlemlerinden sonra eski veriyi göstermemek için önbelleği temizle
  if (method !== 'GET') responseCache.clear()

  if (!isCacheable(url, options)) return authFetchUncached(url, options)

  const hit = responseCache.get(url)
  if (hit && hit.expires > Date.now()) {
    return hit.promise.then(r => r.clone())
  }

  const promise = authFetchUncached(url, options)
  responseCache.set(url, { expires: Date.now() + GET_CACHE_TTL_MS, promise })
  promise
    .then(r => { if (!r.ok) responseCache.delete(url) })
    .catch(() => responseCache.delete(url))
  return promise.then(r => r.clone())
}

async function authFetchUncached(url: string, options: RequestInit = {}) {
  const token = await getAccessToken()

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(url, { ...options, headers })

  // Askıdaki restoranda yazma denemesi: panel bandı kullanıcıyı bilgilendirir
  if (res.status === 423 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('org-suspended'))
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    const onLoginPage = window.location.pathname === '/login'
    if (!onLoginPage) {
      clearClientSession()
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
  }

  return res
}

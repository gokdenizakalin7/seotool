/**
 * Enterprise Client Session and Cookie Manager
 * Senkronize localStorage ve Güvenli Çerez (Cookie) yönetimi sağlar.
 */

export function syncClientSessionCookies() {
  // Artik cookie kullanmiyoruz, JWT Authorization basligi ile calisiyoruz.
}

export function setClientSession(params: { role: string; restaurant?: any; userId?: string }) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event('api-cache-clear'))
  localStorage.setItem('user_role', params.role)

  if (params.restaurant) {
    localStorage.setItem('currentRestaurant', JSON.stringify(params.restaurant))
  }

  if (params.userId) {
    localStorage.setItem('user_id', params.userId)
  }
}

export function clearClientSession() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event('api-cache-clear'))
  localStorage.removeItem('user_role')
  localStorage.removeItem('is_admin')
  localStorage.removeItem('is_admin_impersonating')
  localStorage.removeItem('admin_impersonate_org_id')
  localStorage.removeItem('currentRestaurant')
  localStorage.removeItem('user_id')

  // Eski çerezleri temizle
  document.cookie = 'user_role=; Path=/; Max-Age=0; SameSite=Lax'
  document.cookie = 'restaurant_id=; Path=/; Max-Age=0; SameSite=Lax'
  document.cookie = 'user_id=; Path=/; Max-Age=0; SameSite=Lax'
  document.cookie = 'qolay_csrf_token=; Path=/; Max-Age=0; SameSite=Lax'
}

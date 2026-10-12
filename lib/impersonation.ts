/**
 * Süper admin "Panele Gir": seçili restoran yalnızca istemcide tutulur.
 * Yetki sunucuda zaten var (requireOrgAccess süper admini her restorana alır).
 */
const KEY = 'admin_impersonate_org_id'

export function getImpersonatedOrgId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setImpersonatedOrgId(orgId: string) {
  localStorage.setItem(KEY, orgId)
  window.dispatchEvent(new Event('api-cache-clear'))
}

export function clearImpersonation() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  localStorage.removeItem('is_admin_impersonating')
  localStorage.removeItem('currentRestaurant')
  window.dispatchEvent(new Event('api-cache-clear'))
}

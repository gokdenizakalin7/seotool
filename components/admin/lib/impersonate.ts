import { setImpersonatedOrgId } from '@/lib/impersonation'
import { adminApi } from './admin-api'

/** "Panele Gir": denetim kaydı yazılır, seçili restoran işaretlenir ve restoran paneli açılır. */
export async function startImpersonation(orgId: string, navigate: (to: string) => void, to = '/dashboard/menu-editor') {
  await adminApi(`/api/admin/organizations/${orgId}/impersonate`, { method: 'POST' })
  setImpersonatedOrgId(orgId)
  localStorage.setItem('is_admin_impersonating', 'true')
  navigate(to)
}

import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeOrgStatus } from '@/lib/org-status'
import { isSuperAdminEmail, SYSTEM_ADMIN_ROLE } from '@/lib/auth-middleware'
import type { AdminUserRow } from '@/lib/admin-types'
import { isEmailTakenError } from './orgs'

export function mapUserRow(r: any): AdminUserRow {
  return {
    id: r.id,
    email: r.email || '',
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at || null,
    emailConfirmedAt: r.email_confirmed_at || null,
    bannedUntil: r.banned_until || null,
    ownerName: r.owner_name || '',
    mustChangePassword: !!r.must_change_password,
    isSuperAdmin: isSuperAdminEmail(r.email) || !!r.is_system_admin,
    isRootAdmin: isSuperAdminEmail(r.email),
    memberships: (r.memberships || []).map((m: any) => ({
      organizationId: m.organization_id,
      name: m.name,
      subdomain: m.subdomain,
      role: m.role,
      status: normalizeOrgStatus(m.status),
    })),
  }
}

/**
 * Admin'in belirlediği şifreyle onaylı kullanıcı açar; restoran oluşturulmaz (skip_org_create).
 * systemAdmin: true ise sistem yöneticisi olur. E-posta kayıtlıysa { taken: true } döner.
 */
export async function createAdminUser(input: {
  email: string
  password: string
  ownerName?: string
  mustChangePassword: boolean
  systemAdmin?: boolean
}): Promise<{ userId: string } | { taken: true }> {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      owner_name: input.ownerName || '',
      must_change_password: input.mustChangePassword,
      skip_org_create: true,
      created_by_admin: true,
    },
    ...(input.systemAdmin ? { app_metadata: { role: SYSTEM_ADMIN_ROLE } } : {}),
  })
  if (error || !created?.user) {
    if (isEmailTakenError(error)) return { taken: true }
    throw error || new Error('createUser boş döndü')
  }
  const userId = created.user.id

  // Tetikleyici skip_org_create bayrağını tanımıyorsa (migration 11 eksik) açtığı boş restoranı geri al
  const { data: auto } = await supabaseAdmin.from('organization_members').select('organization_id').eq('user_id', userId).maybeSingle()
  if (auto) {
    await supabaseAdmin.from('organizations').delete().eq('id', auto.organization_id)
  }
  return { userId }
}

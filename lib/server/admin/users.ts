import { isSuperAdminEmail } from '@/lib/auth-middleware'
import type { AdminUserRow } from '@/lib/admin-types'

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
    isSuperAdmin: isSuperAdminEmail(r.email),
    memberships: (r.memberships || []).map((m: any) => ({
      organizationId: m.organization_id,
      name: m.name,
      subdomain: m.subdomain,
      role: m.role,
      status: m.status === 'suspended' ? 'suspended' : 'active',
    })),
  }
}

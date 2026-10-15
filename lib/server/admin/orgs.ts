import { supabaseAdmin } from '@/lib/supabase-admin'
import { SLUG_RE, slugifyBusinessName } from '@/lib/site-url'
import { isSuperAdminEmail } from '@/lib/auth-middleware'
import type { AdminMember, AdminOrgRow, AuditLogEntry, MemberRole } from '@/lib/admin-types'

export const BUCKET = 'menu-images'

export function mapOrgOverviewRow(r: any): AdminOrgRow {
  return {
    id: r.id,
    name: r.name || '',
    subdomain: r.subdomain || '',
    ownerName: r.owner_name || '',
    phone: r.business_phone || '',
    city: r.city || '',
    businessType: r.business_type || null,
    logoUrl: r.logo_url || '',
    status: r.status === 'suspended' ? 'suspended' : 'active',
    statusReason: r.status_reason || '',
    statusChangedAt: r.status_changed_at || null,
    createdAt: r.created_at,
    onboardingCompleted: !!r.onboarding_completed_at,
    owner: r.owner_user_id
      ? {
          userId: r.owner_user_id,
          email: r.owner_email || '',
          lastSignInAt: r.owner_last_sign_in_at || null,
          bannedUntil: r.owner_banned_until || null,
          isSuperAdmin: isSuperAdminEmail(r.owner_email),
        }
      : null,
    memberCount: r.member_count ?? 0,
    menuCount: r.menu_count ?? 0,
    listedMenuCount: r.listed_menu_count ?? 0,
    itemCount: r.item_count ?? 0,
    tableCount: r.table_count ?? 0,
    qrViews: Number(r.qr_views ?? 0),
    views30d: Number(r.views_30d ?? 0),
  }
}

export function mapMemberRow(r: any): AdminMember {
  return {
    userId: r.user_id,
    email: r.email || '',
    role: (r.role || 'staff') as MemberRole,
    joinedAt: r.joined_at,
    lastSignInAt: r.last_sign_in_at || null,
    bannedUntil: r.banned_until || null,
    ownerName: r.owner_name || '',
    mustChangePassword: !!r.must_change_password,
  }
}

export function mapAuditRow(r: any): AuditLogEntry {
  return {
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    targetLabel: r.target_label,
    before: r.before,
    after: r.after,
    reason: r.reason,
    createdAt: r.created_at,
  }
}

export async function getOrgMembers(orgId: string): Promise<AdminMember[]> {
  const { data, error } = await supabaseAdmin.rpc('admin_organization_members', { p_org_id: orgId })
  if (error) throw new Error(`admin_organization_members: ${error.message}`)
  return (data || []).map(mapMemberRow)
}

export async function getOrgRow(orgId: string) {
  const { data, error } = await supabaseAdmin.from('organizations').select('*').eq('id', orgId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Türkçe karakterleri sadeleştirip site adresi biçimine çevirir (lib/site-url.ts ile aynı kural). */
export const slugifySubdomain = slugifyBusinessName

/** Site adresi biçimi (lib/site-url.ts SLUG_RE ile aynı) */
export const SUBDOMAIN_RE = SLUG_RE

export async function isSubdomainTaken(subdomain: string, exceptOrgId?: string) {
  let q = supabaseAdmin.from('organizations').select('id').eq('subdomain', subdomain)
  if (exceptOrgId) q = q.neq('id', exceptOrgId)
  const { data } = await q.maybeSingle()
  return !!data
}

/** Storage'daki bir klasörü (orgs/{id}/...) özyinelemeli siler. */
export async function removeStorageFolder(prefix: string): Promise<number> {
  let removed = 0
  const walk = async (dir: string): Promise<string[]> => {
    const out: string[] = []
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(dir, { limit: 100, offset })
      if (error || !data || data.length === 0) break
      for (const entry of data) {
        const path = `${dir}/${entry.name}`
        // Klasörlerin id'si null döner
        if (entry.id === null) out.push(...(await walk(path)))
        else out.push(path)
      }
      if (data.length < 100) break
    }
    return out
  }
  const files = await walk(prefix)
  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100)
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(chunk)
    if (!error) removed += chunk.length
  }
  return removed
}

/** Supabase hata mesajından "e-posta zaten kayıtlı" durumunu tanır. */
export function isEmailTakenError(err: { message?: string; code?: string } | null | undefined) {
  const msg = (err?.message || '').toLowerCase()
  return err?.code === 'email_exists' || msg.includes('already') || msg.includes('registered') || msg.includes('exists')
}

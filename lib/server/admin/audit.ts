import { supabaseAdmin } from '@/lib/supabase-admin'
import type { AuthUser } from '@/lib/auth-middleware'

export type AuditTargetType =
  | 'organization'
  | 'user'
  | 'member'
  | 'catalog_category'
  | 'catalog_item'
  | 'business_type'
  | 'template'
  | 'settings'

export interface AuditEntry {
  actor: AuthUser
  action: string
  targetType: AuditTargetType
  targetId?: string | null
  targetLabel?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
}

/** Yalnızca değişen alanları bırakır (before/after kayıtlarını küçük tutar). */
export function diffFields(before: Record<string, any> | null | undefined, after: Record<string, any>) {
  const b: Record<string, any> = {}
  const a: Record<string, any> = {}
  for (const key of Object.keys(after)) {
    const prev = before?.[key]
    if (JSON.stringify(prev ?? null) !== JSON.stringify(after[key] ?? null)) {
      b[key] = prev ?? null
      a[key] = after[key] ?? null
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 }
}

/** Denetim kaydı yazar. Hata asıl işlemi bozmaz, yalnızca loglanır. */
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    actor_id: entry.actor.id,
    actor_email: entry.actor.email,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  })
  if (error) console.error('admin audit log yazılamadı:', error.message)
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSuperAdminEmail } from '@/lib/auth-middleware'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { updateUserSchema } from '@/lib/server/admin/schemas'
import { isEmailTakenError } from '@/lib/server/admin/orgs'
import { logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

/** Süresiz engel: Supabase ban_duration saat cinsinden (~100 yıl) */
const BAN_FOREVER = '876000h'

async function loadUser(params: Ctx['params']) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return null
  const { data } = await supabaseAdmin.auth.admin.getUserById(id)
  return data?.user ?? null
}

/**
 * PATCH /api/admin/users/[id]
 * { email?, ownerName?, password?, mustChangePassword?, banned?, banReason? }
 * Şifreyi admin belirler ve kullanıcıya kendisi iletir; e-posta gönderilmez.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'user update', async (actor) => {
    const user = await loadUser(params)
    if (!user) return jsonError(404, 'Kullanıcı bulunamadı.', 'USER_NOT_FOUND')

    const body = await parseBody(request, updateUserSchema)
    if ('response' in body) return body.response
    const input = body.data

    const isSelf = user.id === actor.id
    if ((isSelf || isSuperAdminEmail(user.email)) && input.banned) {
      return jsonError(400, 'Süper admin hesabı engellenemez.', 'SELF_BAN')
    }
    if (isSuperAdminEmail(user.email) && input.email && input.email !== user.email) {
      return jsonError(400, 'Süper admin e-postası SUPER_ADMIN_EMAIL ortam değişkeninden gelir; buradan değiştirilemez.', 'SUPER_ADMIN_EMAIL')
    }

    const meta = { ...(user.user_metadata || {}) }
    const appMeta = { ...(user.app_metadata || {}) }
    const attrs: Record<string, any> = {}
    const before: Record<string, any> = {}
    const after: Record<string, any> = {}

    if (input.email && input.email !== user.email) {
      attrs.email = input.email
      attrs.email_confirm = true
      before.email = user.email
      after.email = input.email
    }
    if (input.ownerName !== undefined && input.ownerName !== (meta.owner_name || '')) {
      before.owner_name = meta.owner_name || ''
      after.owner_name = input.ownerName
      meta.owner_name = input.ownerName
    }
    if (input.password) {
      attrs.password = input.password
      after.password = '(yeni şifre belirlendi)'
    }
    if (input.mustChangePassword !== undefined && input.mustChangePassword !== !!meta.must_change_password) {
      before.must_change_password = !!meta.must_change_password
      after.must_change_password = input.mustChangePassword
      meta.must_change_password = input.mustChangePassword
    }
    if (input.banned !== undefined) {
      const currentlyBanned = !!user.banned_until && new Date(user.banned_until).getTime() > Date.now()
      if (input.banned !== currentlyBanned) {
        attrs.ban_duration = input.banned ? BAN_FOREVER : 'none'
        before.banned = currentlyBanned
        after.banned = input.banned
        appMeta.ban_reason = input.banned ? input.banReason || '' : null
        attrs.app_metadata = appMeta
      }
    }
    if ('owner_name' in after || 'must_change_password' in after) attrs.user_metadata = meta

    if (Object.keys(attrs).length === 0) return NextResponse.json({ changed: false })

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, attrs)
    if (error) {
      if (isEmailTakenError(error)) return jsonError(409, 'Bu e-posta başka bir kullanıcıda kayıtlı.', 'EMAIL_TAKEN')
      if ((error.message || '').toLowerCase().includes('password')) {
        return jsonError(400, `Şifre kabul edilmedi: ${error.message}`, 'WEAK_PASSWORD')
      }
      throw error
    }

    // Sahip adı restoran kaydında da görünür: tek sahip olduğu restoranda eşitle
    if ('owner_name' in after) {
      const { data: owned } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
      for (const m of owned || []) {
        await supabaseAdmin.from('organizations').update({ owner_name: input.ownerName }).eq('id', m.organization_id)
      }
    }

    const action = after.banned === true ? 'user.ban' : after.banned === false ? 'user.unban' : input.password ? 'user.password' : 'user.update'
    await logAdminAction({
      actor,
      action,
      targetType: 'user',
      targetId: user.id,
      targetLabel: data.user?.email || user.email || null,
      before,
      after,
      reason: input.banned ? input.banReason || null : null,
    })

    return NextResponse.json({ changed: true })
  })
}

/**
 * DELETE /api/admin/users/[id] — kullanıcı hesabını siler (üyelikler cascade).
 * Tek sahibi olduğu restoran kalırsa engellenir: önce restoranı silin ya da başka sahip atayın.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'user delete', async (actor) => {
    const user = await loadUser(params)
    if (!user) return jsonError(404, 'Kullanıcı bulunamadı.', 'USER_NOT_FOUND')
    if (user.id === actor.id || isSuperAdminEmail(user.email)) {
      return jsonError(400, 'Süper admin hesabı silinemez.', 'SELF_DELETE')
    }

    const { data: owned } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .eq('role', 'owner')
    for (const m of owned || []) {
      const { count } = await supabaseAdmin
        .from('organization_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('organization_id', m.organization_id)
        .eq('role', 'owner')
      if ((count ?? 0) <= 1) {
        const name = (m as any).organizations?.name || 'bir restoranın'
        return jsonError(
          409,
          `Kullanıcı "${name}" restoranının tek sahibi. Önce restoranı silin ya da başka bir üyeyi sahip yapın.`,
          'LAST_OWNER'
        )
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'user.delete',
      targetType: 'user',
      targetId: user.id,
      targetLabel: user.email || null,
      before: { email: user.email, owner_name: user.user_metadata?.owner_name || '' },
    })

    return NextResponse.json({ success: true })
  })
}

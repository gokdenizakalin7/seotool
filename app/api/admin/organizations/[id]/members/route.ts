import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { addMemberSchema, removeMemberSchema, updateMemberSchema } from '@/lib/server/admin/schemas'
import { getOrgMembers, getOrgRow } from '@/lib/server/admin/orgs'
import { createAdminUser } from '@/lib/server/admin/users'
import { logAdminAction } from '@/lib/server/admin/audit'
import { isSuperAdminEmail, isSystemAdmin } from '@/lib/auth-middleware'

type Ctx = { params: Promise<{ id: string }> }

/*
 * Bir kullanıcı tek bir restorana üye olabilir: /api/auth/me ve panel tek üyelik varsayar.
 * Bu yüzden başka restorana üye olan kullanıcı eklenmez; önce oradan çıkarılmalıdır.
 */

async function loadOrg(params: Ctx['params']) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return null
  return getOrgRow(id)
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('admin_find_user_by_email', { p_email: email })
  if (error) throw error
  return (data as string | null) ?? null
}

/** POST — mevcut kullanıcıyı ekle ya da yeni kullanıcı (admin'in belirlediği şifreyle) oluşturup ekle */
export async function POST(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'member add', async (actor) => {
    const org = await loadOrg(params)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const body = await parseBody(request, addMemberSchema)
    if ('response' in body) return body.response
    const input = body.data
    if (isSuperAdminEmail(input.email)) return jsonError(400, 'Sistem yöneticisine restoran atanamaz.', 'SUPER_ADMIN')

    let userId: string
    if (input.mode === 'existing') {
      const found = await findUserIdByEmail(input.email)
      if (!found) return jsonError(404, 'Bu e-posta ile kayıtlı kullanıcı yok. "Yeni kullanıcı" seçeneğini kullanın.', 'USER_NOT_FOUND')
      const { data: foundUser } = await supabaseAdmin.auth.admin.getUserById(found)
      if (isSystemAdmin(foundUser?.user)) return jsonError(400, 'Sistem yöneticisine restoran atanamaz.', 'SUPER_ADMIN')
      const { data: existing } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, organizations(name)')
        .eq('user_id', found)
        .maybeSingle()
      if (existing) {
        const name = (existing as any).organizations?.name || 'başka bir restoran'
        const same = existing.organization_id === org.id
        return jsonError(
          409,
          same ? 'Kullanıcı zaten bu restoranın üyesi.' : `Kullanıcı zaten "${name}" restoranına üye. Önce oradan çıkarın.`,
          'ALREADY_MEMBER'
        )
      }
      userId = found
    } else {
      const created = await createAdminUser(input)
      if ('taken' in created) {
        return jsonError(409, 'Bu e-posta ile zaten bir kullanıcı var. "Mevcut kullanıcı" seçeneğini kullanın.', 'EMAIL_TAKEN')
      }
      userId = created.userId
    }

    const { error: insErr } = await supabaseAdmin
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: userId, role: input.role })
    if (insErr) throw insErr

    await logAdminAction({
      actor,
      action: input.mode === 'new' ? 'member.create' : 'member.add',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
      after: { email: input.email, role: input.role },
    })

    return NextResponse.json({ members: await getOrgMembers(org.id) }, { status: 201 })
  })
}

/** PATCH { userId, role } — üyenin rolünü değiştir */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'member role', async (actor) => {
    const org = await loadOrg(params)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const body = await parseBody(request, updateMemberSchema)
    if ('response' in body) return body.response
    const { userId, role } = body.data

    const members = await getOrgMembers(org.id)
    const target = members.find((m) => m.userId === userId)
    if (!target) return jsonError(404, 'Üye bulunamadı.', 'MEMBER_NOT_FOUND')
    if (target.role === role) return NextResponse.json({ members })
    if (target.role === 'owner' && !members.some((m) => m.userId !== userId && m.role === 'owner')) {
      return jsonError(400, 'Restoranın en az bir sahibi olmalı. Önce başka bir üyeyi sahip yapın.', 'LAST_OWNER')
    }

    const { error } = await supabaseAdmin
      .from('organization_members')
      .update({ role })
      .eq('organization_id', org.id)
      .eq('user_id', userId)
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'member.role',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
      before: { email: target.email, role: target.role },
      after: { email: target.email, role },
    })

    return NextResponse.json({ members: await getOrgMembers(org.id) })
  })
}

/** DELETE { userId } — üyeyi restorandan çıkar (kullanıcı hesabı silinmez) */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'member remove', async (actor) => {
    const org = await loadOrg(params)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const body = await parseBody(request, removeMemberSchema)
    if ('response' in body) return body.response
    const { userId } = body.data

    const members = await getOrgMembers(org.id)
    const target = members.find((m) => m.userId === userId)
    if (!target) return jsonError(404, 'Üye bulunamadı.', 'MEMBER_NOT_FOUND')
    if (target.role === 'owner' && !members.some((m) => m.userId !== userId && m.role === 'owner')) {
      return jsonError(400, 'Son sahip çıkarılamaz. Önce başka bir üyeyi sahip yapın veya restoranı silin.', 'LAST_OWNER')
    }

    const { error } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('organization_id', org.id)
      .eq('user_id', userId)
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'member.remove',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
      before: { email: target.email, role: target.role },
    })

    return NextResponse.json({ members: await getOrgMembers(org.id) })
  })
}

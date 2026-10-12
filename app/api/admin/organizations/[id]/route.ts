import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { deleteOrganizationSchema, updateOrganizationSchema } from '@/lib/server/admin/schemas'
import { getOrgMembers, getOrgRow, isSubdomainTaken, mapAuditRow, removeStorageFolder } from '@/lib/server/admin/orgs'
import { diffFields, logAdminAction } from '@/lib/server/admin/audit'
import { profileToDbColumns } from '@/lib/restaurant-profile'
import { businessTypeExists } from '@/lib/server/business-types'
import type { AdminMenuSummary, AdminOrgDetail } from '@/lib/admin-types'

type Ctx = { params: Promise<{ id: string }> }

const idSchema = z.string().uuid()

/** GET /api/admin/organizations/[id] — restoran detayı: üyeler, menüler, masalar, işlem geçmişi */
export async function GET(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'organization detail', async () => {
    const { id } = await params
    if (!idSchema.safeParse(id).success) return jsonError(400, 'Geçersiz restoran kimliği.')

    const org = await getOrgRow(id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const [members, menusRes, tablesRes, auditRes, metaRes] = await Promise.all([
      getOrgMembers(id),
      supabaseAdmin
        .from('menus')
        .select('id, name, is_listed, updated_at, categories(id, items(id))')
        .eq('organization_id', id)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('qr_tables').select('id, name, views').eq('organization_id', id).order('created_at', { ascending: true }),
      supabaseAdmin
        .from('admin_audit_log')
        .select('*')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin.from('organization_admin_meta').select('note').eq('organization_id', id).maybeSingle(),
    ])

    const menus: AdminMenuSummary[] = (menusRes.data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      isListed: !!m.is_listed,
      categoryCount: (m.categories || []).length,
      itemCount: (m.categories || []).reduce((n: number, c: any) => n + (c.items || []).length, 0),
      updatedAt: m.updated_at,
    }))

    let statusChangedByEmail: string | null = null
    if (org.status_changed_by) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(org.status_changed_by)
      statusChangedByEmail = data?.user?.email || null
    }

    const detail: AdminOrgDetail = {
      org,
      adminNote: metaRes.data?.note || '',
      statusChangedByEmail,
      members,
      menus,
      tables: (tablesRes.data || []).map((t: any) => ({ id: t.id, name: t.name, views: t.views || 0 })),
      audit: (auditRes.data || []).map(mapAuditRow),
    }
    return NextResponse.json(detail)
  })
}

/** PATCH /api/admin/organizations/[id] — tüm profil alanları, subdomain, admin notu */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'organization update', async (actor) => {
    const { id } = await params
    if (!idSchema.safeParse(id).success) return jsonError(400, 'Geçersiz restoran kimliği.')

    const body = await parseBody(request, updateOrganizationSchema)
    if ('response' in body) return body.response
    const input = body.data

    const org = await getOrgRow(id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')
    if (input.businessType && !(await businessTypeExists(input.businessType, { includeInactive: true }))) {
      return jsonError(400, 'Geçersiz işletme türü.', 'VALIDATION')
    }

    const update: Record<string, any> = profileToDbColumns(input as Parameters<typeof profileToDbColumns>[0])
    if (input.businessType === '') update.business_type = null
    if (input.subdomain !== undefined && input.subdomain !== org.subdomain) {
      if (await isSubdomainTaken(input.subdomain, id)) {
        return jsonError(409, 'Bu subdomain başka bir restoran tarafından kullanılıyor.', 'SUBDOMAIN_TAKEN')
      }
      update.subdomain = input.subdomain
    }
    if (input.ownerName !== undefined) update.owner_name = input.ownerName
    if (input.state !== undefined) update.state = input.state
    if (input.zipcode !== undefined) update.zipcode = input.zipcode
    if (input.logoUrl !== undefined) update.logo_url = input.logoUrl
    if (input.coverUrl !== undefined) update.cover_url = input.coverUrl
    if (input.onboardingCompleted !== undefined) {
      update.onboarding_completed_at = input.onboardingCompleted ? org.onboarding_completed_at || new Date().toISOString() : null
    }

    const diff = diffFields(org, update)
    let noteChanged = false

    if (input.adminNote !== undefined) {
      const { data: meta } = await supabaseAdmin.from('organization_admin_meta').select('note').eq('organization_id', id).maybeSingle()
      if ((meta?.note || '') !== input.adminNote) {
        const { error } = await supabaseAdmin
          .from('organization_admin_meta')
          .upsert({ organization_id: id, note: input.adminNote, updated_at: new Date().toISOString(), updated_by: actor.id })
        if (error) throw error
        noteChanged = true
        diff.before.admin_note = meta?.note || ''
        diff.after.admin_note = input.adminNote
      }
    }

    if (!diff.changed && !noteChanged) return NextResponse.json({ organization: org, changed: false })

    let updated = org
    if (diff.changed) {
      const { data, error } = await supabaseAdmin.from('organizations').update(update).eq('id', id).select('*').single()
      if (error) {
        if (error.code === '23505') return jsonError(409, 'Bu subdomain kullanılıyor.', 'SUBDOMAIN_TAKEN')
        throw error
      }
      updated = data
    }

    await logAdminAction({
      actor,
      action: 'organization.update',
      targetType: 'organization',
      targetId: id,
      targetLabel: updated.name,
      before: diff.before,
      after: diff.after,
    })

    return NextResponse.json({ organization: updated, changed: true })
  })
}

/**
 * DELETE /api/admin/organizations/[id] { confirmSubdomain, deleteUsers }
 * Restoranı (menüler, masalar, üyelikler cascade) ve Storage dosyalarını siler.
 * deleteUsers: başka restorana üye olmayan kullanıcıların hesaplarını da siler.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'organization delete', async (actor) => {
    const { id } = await params
    if (!idSchema.safeParse(id).success) return jsonError(400, 'Geçersiz restoran kimliği.')

    const body = await parseBody(request, deleteOrganizationSchema)
    if ('response' in body) return body.response

    const org = await getOrgRow(id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')
    if (body.data.confirmSubdomain.trim() !== org.subdomain) {
      return jsonError(400, 'Onay için restoranın subdomain değerini aynen yazın.', 'CONFIRM_MISMATCH')
    }

    const members = await getOrgMembers(id)
    if (members.some((m) => m.email.toLowerCase() === actor.email)) {
      return jsonError(400, 'Kendi üyesi olduğunuz restoranı buradan silemezsiniz.', 'SELF_ORG')
    }

    // Silinecek kullanıcılar: yalnızca bu restorana üye olanlar
    let usersToDelete: string[] = []
    if (body.data.deleteUsers && members.length) {
      const { data: otherMemberships } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .in('user_id', members.map((m) => m.userId))
        .neq('organization_id', id)
      const keep = new Set((otherMemberships || []).map((m: any) => m.user_id))
      usersToDelete = members.map((m) => m.userId).filter((u) => !keep.has(u))
    }

    const { error } = await supabaseAdmin.from('organizations').delete().eq('id', id)
    if (error) throw error

    const removedFiles = await removeStorageFolder(`orgs/${id}`).catch((e) => {
      console.error('org storage cleanup:', e)
      return 0
    })

    let deletedUsers = 0
    for (const userId of usersToDelete) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (delErr) console.error('admin delete user:', userId, delErr)
      else deletedUsers++
    }

    await logAdminAction({
      actor,
      action: 'organization.delete',
      targetType: 'organization',
      targetId: id,
      targetLabel: org.name,
      before: { name: org.name, subdomain: org.subdomain, members: members.map((m) => m.email) },
      after: { removedFiles, deletedUsers },
    })

    return NextResponse.json({ success: true, removedFiles, deletedUsers })
  })
}

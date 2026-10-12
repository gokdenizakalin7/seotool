import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRpc } from '@/lib/server/fetch-all'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { createUserSchema } from '@/lib/server/admin/schemas'
import { getOrgRow } from '@/lib/server/admin/orgs'
import { logAdminAction } from '@/lib/server/admin/audit'
import { isSuperAdminEmail, SYSTEM_ADMIN_ROLE } from '@/lib/auth-middleware'
import { foldTurkish } from '@/lib/catalog-match'
import type { AdminUserRow } from '@/lib/admin-types'
import { createAdminUser, mapUserRow } from '@/lib/server/admin/users'

/**
 * Migration 12 öncesi admin_users_overview is_system_admin döndürmez: sistem yöneticileri
 * restoransız olduğundan yalnızca restoransız hesapların app_metadata'sı tek tek okunur.
 */
async function fillSystemAdminFlags(rows: any[]) {
  if (!rows.length || 'is_system_admin' in rows[0]) return
  const orphans = rows.filter((r) => !(r.memberships || []).length)
  await Promise.all(
    orphans.map(async (r) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(r.id)
      r.is_system_admin = data?.user?.app_metadata?.role === SYSTEM_ADMIN_ROLE
    })
  )
}

/** GET /api/admin/users?q=&filter=all|banned|orphan&page=&size= — tüm kullanıcılar ve üyelikleri */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'users list', async () => {
    const params = request.nextUrl.searchParams
    const q = foldTurkish((params.get('q') || '').trim())
    const filter = params.get('filter') || 'all'
    const page = Math.max(1, Number(params.get('page')) || 1)
    const size = Math.min(200, Math.max(1, Number(params.get('size')) || 50))

    let data: any[]
    try {
      data = await fetchAllRpc<any>(supabaseAdmin, 'admin_users_overview')
      await fillSystemAdminFlags(data)
    } catch (error) {
      console.error('admin_users_overview:', error)
      return jsonError(500, 'Kullanıcılar okunamadı. Migration 11 çalıştırıldı mı?', 'DB')
    }

    const now = Date.now()
    let rows: AdminUserRow[] = data.map(mapUserRow)
    const isBanned = (u: AdminUserRow) => !!u.bannedUntil && new Date(u.bannedUntil).getTime() > now
    const counts = {
      all: rows.length,
      banned: rows.filter(isBanned).length,
      orphan: rows.filter((u) => u.memberships.length === 0 && !u.isSuperAdmin).length,
    }

    if (filter === 'banned') rows = rows.filter(isBanned)
    if (filter === 'orphan') rows = rows.filter((u) => u.memberships.length === 0 && !u.isSuperAdmin)
    if (q) {
      rows = rows.filter((u) =>
        [u.email, u.ownerName, ...u.memberships.map((m) => m.name), ...u.memberships.map((m) => m.subdomain)]
          .filter(Boolean)
          .some((v) => foldTurkish(String(v)).includes(q))
      )
    }

    const total = rows.length
    rows = rows.slice((page - 1) * size, page * size)
    return NextResponse.json({ users: rows, total, page, size, counts })
  })
}

/**
 * POST /api/admin/users
 * { email, password, ownerName?, mustChangePassword?, role, organizationId? }
 * role = system_admin: restoransız sistem yöneticisi; diğer roller seçilen restorana eklenir.
 * Şifreyi admin belirler ve kullanıcıya kendisi iletir; e-posta gönderilmez.
 */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'user create', async (actor) => {
    const body = await parseBody(request, createUserSchema)
    if ('response' in body) return body.response
    const input = body.data
    if (isSuperAdminEmail(input.email)) {
      return jsonError(400, 'Sistem yöneticisi hesabı SUPER_ADMIN_EMAIL ile belirlenir; buradan oluşturulamaz ve restoran atanamaz.', 'SUPER_ADMIN')
    }

    const org = input.organizationId ? await getOrgRow(input.organizationId) : null
    if (input.organizationId && !org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const systemAdmin = input.role === 'system_admin'
    const created = await createAdminUser({ ...input, systemAdmin })
    if ('taken' in created) return jsonError(409, 'Bu e-posta ile zaten bir kullanıcı var.', 'EMAIL_TAKEN')

    if (org && input.role !== 'system_admin') {
      const { error } = await supabaseAdmin
        .from('organization_members')
        .insert({ organization_id: org.id, user_id: created.userId, role: input.role })
      if (error) {
        // Yarım kayıt bırakma: üyelik eklenemezse hesabı geri al
        await supabaseAdmin.auth.admin.deleteUser(created.userId)
        throw error
      }
    }

    await logAdminAction({
      actor,
      action: 'user.create',
      targetType: 'user',
      targetId: created.userId,
      targetLabel: input.email,
      after: {
        email: input.email,
        owner_name: input.ownerName || '',
        must_change_password: input.mustChangePassword,
        role: input.role,
        ...(org ? { organization: org.name } : {}),
      },
    })

    return NextResponse.json({ id: created.userId }, { status: 201 })
  })
}

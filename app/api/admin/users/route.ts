import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRpc } from '@/lib/server/fetch-all'
import { adminRoute, jsonError } from '@/lib/server/admin/http'
import { foldTurkish } from '@/lib/catalog-match'
import type { AdminUserRow } from '@/lib/admin-types'
import { mapUserRow } from '@/lib/server/admin/users'

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

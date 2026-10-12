import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError } from '@/lib/server/admin/http'
import { mapAuditRow } from '@/lib/server/admin/orgs'

/** GET /api/admin/audit?targetType=&targetId=&action=&q=&page=&size= — işlem geçmişi (en yeni önce) */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'audit', async () => {
    const p = request.nextUrl.searchParams
    const page = Math.max(1, Number(p.get('page')) || 1)
    const size = Math.min(200, Math.max(1, Number(p.get('size')) || 50))

    let q = supabaseAdmin.from('admin_audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    const targetType = p.get('targetType')
    const targetId = p.get('targetId')
    const action = p.get('action')
    const search = (p.get('q') || '').trim()
    if (targetType) q = q.eq('target_type', targetType)
    if (targetId) q = q.eq('target_id', targetId)
    if (action) q = q.like('action', `${action.replace(/[%_]/g, '')}%`)
    if (search) {
      const s = search.replace(/[%_,()]/g, ' ')
      q = q.or(`target_label.ilike.%${s}%,actor_email.ilike.%${s}%,reason.ilike.%${s}%`)
    }

    const { data, error, count } = await q.range((page - 1) * size, page * size - 1)
    if (error) {
      console.error('admin audit:', error)
      return jsonError(500, 'İşlem geçmişi okunamadı. Migration 11 çalıştırıldı mı?', 'DB')
    }
    return NextResponse.json({ entries: (data || []).map(mapAuditRow), total: count ?? 0, page, size })
  })
}

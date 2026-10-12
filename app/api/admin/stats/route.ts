import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError } from '@/lib/server/admin/http'

/** GET /api/admin/stats — gerçek platform sayıları (admin_platform_stats RPC) */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'stats', async () => {
    const { data, error } = await supabaseAdmin.rpc('admin_platform_stats')
    if (error) {
      console.error('admin_platform_stats:', error)
      return jsonError(500, 'İstatistikler okunamadı. Migration 11 çalıştırıldı mı?', 'DB')
    }
    return NextResponse.json({ stats: data })
  })
}

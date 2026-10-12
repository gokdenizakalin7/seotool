import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { adminRoute, isUniqueViolation, jsonError, parseBody } from '@/lib/server/admin/http'
import { businessTypeCreateSchema } from '@/lib/server/admin/schemas'
import { BUSINESS_TYPE_COLUMNS, businessTypeToDb, mapBusinessType } from '@/lib/server/admin/business-types'
import { logAdminAction } from '@/lib/server/admin/audit'

/** GET /api/admin/business-types — tümü (pasifler dahil) + kaç restoranın bu türde olduğu */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'business types', async () => {
    const [{ data, error }, orgs] = await Promise.all([
      supabaseAdmin.from('business_types').select(BUSINESS_TYPE_COLUMNS).order('display_order'),
      fetchAll<{ business_type: string | null }>(supabaseAdmin, 'organizations', 'business_type'),
    ])
    if (error) return jsonError(500, 'İşletme türleri okunamadı. Migration 11 çalıştırıldı mı?', 'DB')
    const counts = new Map<string, number>()
    for (const o of orgs) if (o.business_type) counts.set(o.business_type, (counts.get(o.business_type) || 0) + 1)
    return NextResponse.json({ businessTypes: (data || []).map((r) => mapBusinessType(r, counts.get(r.slug) || 0)) })
  })
}

/** POST /api/admin/business-types */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'business type create', async (actor) => {
    const body = await parseBody(request, businessTypeCreateSchema)
    if ('response' in body) return body.response
    const input = body.data

    let displayOrder = input.displayOrder
    if (displayOrder === undefined) {
      const { data: last } = await supabaseAdmin
        .from('business_types')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      displayOrder = (last?.display_order ?? 0) + 10
    }

    const { data, error } = await supabaseAdmin
      .from('business_types')
      .insert({ slug: input.slug, ...businessTypeToDb({ ...input, displayOrder }) })
      .select(BUSINESS_TYPE_COLUMNS)
      .single()
    if (error) {
      if (isUniqueViolation(error)) return jsonError(409, 'Bu kısa adla bir işletme türü zaten var.', 'SLUG_TAKEN')
      throw error
    }

    await logAdminAction({
      actor,
      action: 'business_type.create',
      targetType: 'business_type',
      targetId: data.slug,
      targetLabel: data.label,
      after: data,
    })
    return NextResponse.json({ businessType: mapBusinessType(data) }, { status: 201 })
  })
}

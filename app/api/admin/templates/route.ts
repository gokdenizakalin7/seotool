import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { adminRoute, isUniqueViolation, jsonError, parseBody } from '@/lib/server/admin/http'
import { templateCreateSchema } from '@/lib/server/admin/schemas'
import { TEMPLATE_COLUMNS, mapTemplate, templateToDb } from '@/lib/server/admin/templates'
import { logAdminAction } from '@/lib/server/admin/audit'

/** GET /api/admin/templates[?business_type=] — tüm şablonlar (pasifler dahil) + kategori/ürün sayıları */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'templates', async () => {
    const businessType = request.nextUrl.searchParams.get('business_type')
    let q = supabaseAdmin.from('menu_templates').select(TEMPLATE_COLUMNS).order('display_order')
    if (businessType) q = q.eq('business_type', businessType)
    const [{ data, error }, cats, items] = await Promise.all([
      q,
      fetchAll<{ template_id: string }>(supabaseAdmin, 'menu_template_categories', 'template_id', undefined, ['template_id', 'category_id']),
      fetchAll<{ template_id: string }>(supabaseAdmin, 'menu_template_items', 'template_id', undefined, ['template_id', 'item_id']),
    ])
    if (error) throw error
    const count = (rows: { template_id: string }[]) => {
      const m = new Map<string, number>()
      for (const r of rows) m.set(r.template_id, (m.get(r.template_id) || 0) + 1)
      return m
    }
    const catCounts = count(cats)
    const itemCounts = count(items)
    return NextResponse.json({
      templates: (data || []).map((t) => mapTemplate(t, { categories: catCounts.get(t.id), items: itemCounts.get(t.id) })),
    })
  })
}

/** POST /api/admin/templates — boş şablon; içerik /categories ve /items ile doldurulur */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'template create', async (actor) => {
    const body = await parseBody(request, templateCreateSchema)
    if ('response' in body) return body.response
    const input = body.data

    let displayOrder = input.displayOrder
    if (displayOrder === undefined) {
      const { data: last } = await supabaseAdmin
        .from('menu_templates')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      displayOrder = (last?.display_order ?? 0) + 10
    }

    const { data, error } = await supabaseAdmin
      .from('menu_templates')
      .insert({ slug: input.slug, ...templateToDb({ ...input, displayOrder }), admin_edited_at: new Date().toISOString() })
      .select(TEMPLATE_COLUMNS)
      .single()
    if (error) {
      if (isUniqueViolation(error)) return jsonError(409, 'Bu slug ile bir şablon zaten var.', 'SLUG_TAKEN')
      throw error
    }

    await logAdminAction({
      actor,
      action: 'template.create',
      targetType: 'template',
      targetId: data.id,
      targetLabel: data.name,
      after: { slug: data.slug, name: data.name, business_type: data.business_type },
    })
    return NextResponse.json({ template: mapTemplate(data) }, { status: 201 })
  })
}

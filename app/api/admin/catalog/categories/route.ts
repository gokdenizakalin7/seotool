import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { adminRoute, isUniqueViolation, jsonError, parseBody } from '@/lib/server/admin/http'
import { categoryCreateSchema } from '@/lib/server/admin/schemas'
import { CATEGORY_COLUMNS, catalogChanged, loadAllCategories, mapCategory } from '@/lib/server/admin/catalog'
import { logAdminAction } from '@/lib/server/admin/audit'

/** GET /api/admin/catalog/categories — tüm kategori ağacı (pasifler dahil) + doğrudan ürün sayıları */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'catalog categories', async () => {
    const [categories, items] = await Promise.all([
      loadAllCategories(),
      fetchAll<{ primary_category_id: string }>(supabaseAdmin, 'catalog_items', 'primary_category_id'),
    ])
    const counts = new Map<string, number>()
    for (const i of items) counts.set(i.primary_category_id, (counts.get(i.primary_category_id) || 0) + 1)
    return NextResponse.json({ categories: categories.map((c) => mapCategory(c, counts.get(c.id) || 0)) })
  })
}

/** POST /api/admin/catalog/categories — yeni kategori (en sona eklenir) */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'catalog category create', async (actor) => {
    const body = await parseBody(request, categoryCreateSchema)
    if ('response' in body) return body.response
    const input = body.data

    if (input.parentId) {
      const { data: parent } = await supabaseAdmin.from('catalog_categories').select('id').eq('id', input.parentId).maybeSingle()
      if (!parent) return jsonError(400, 'Üst kategori bulunamadı.')
    }

    let lastQ = supabaseAdmin.from('catalog_categories').select('display_order').order('display_order', { ascending: false }).limit(1)
    lastQ = input.parentId ? lastQ.eq('parent_id', input.parentId) : lastQ.is('parent_id', null)
    const { data: last } = await lastQ.maybeSingle()

    const { data, error } = await supabaseAdmin
      .from('catalog_categories')
      .insert({
        slug: input.slug,
        name: input.name,
        name_en: input.nameEn,
        icon: input.icon,
        parent_id: input.parentId ?? null,
        is_active: input.isActive,
        display_order: (last?.display_order ?? 0) + 10,
        admin_edited_at: new Date().toISOString(),
      })
      .select(CATEGORY_COLUMNS)
      .single()
    if (error) {
      if (isUniqueViolation(error)) return jsonError(409, 'Bu slug ile bir kategori zaten var.', 'SLUG_TAKEN')
      throw error
    }
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_category.create',
      targetType: 'catalog_category',
      targetId: data.id,
      targetLabel: data.name,
      after: { slug: data.slug, name: data.name, parent_id: data.parent_id },
    })
    return NextResponse.json({ category: mapCategory(data) }, { status: 201 })
  })
}

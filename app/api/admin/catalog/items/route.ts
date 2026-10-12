import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { adminRoute, isUniqueViolation, jsonError, parseBody } from '@/lib/server/admin/http'
import { itemCreateSchema } from '@/lib/server/admin/schemas'
import { ITEM_COLUMNS, attachUsage, catalogChanged, descendantIds, loadAllCategories, mapItem } from '@/lib/server/admin/catalog'
import { logAdminAction } from '@/lib/server/admin/audit'
import { foldTurkish } from '@/lib/catalog-match'
import type { AdminCatalogItem } from '@/lib/admin-types'

/**
 * GET /api/admin/catalog/items?q=&categoryId=&image=missing|has&active=all|active|inactive&page=&size=&usage=0
 * categoryId alt kategorileri de kapsar.
 */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'catalog items', async () => {
    const p = request.nextUrl.searchParams
    const q = foldTurkish((p.get('q') || '').trim())
    const categoryId = p.get('categoryId')
    const image = p.get('image')
    const active = p.get('active') || 'all'
    const page = Math.max(1, Number(p.get('page')) || 1)
    // Şablon editörü tüm kataloğu tek seferde ister (size=2000&usage=0)
    const size = Math.min(2000, Math.max(1, Number(p.get('size')) || 60))
    const withUsage = p.get('usage') !== '0'

    const rows = await fetchAll<any>(supabaseAdmin, 'catalog_items', ITEM_COLUMNS, (qb) => qb.order('display_order'))
    let items: AdminCatalogItem[] = rows.map(mapItem)

    if (categoryId) {
      const ids = descendantIds(await loadAllCategories(), categoryId)
      items = items.filter((i) => ids.has(i.categoryId))
    }
    if (image === 'missing') items = items.filter((i) => !i.imageUrl)
    if (image === 'has') items = items.filter((i) => !!i.imageUrl)
    if (active === 'active') items = items.filter((i) => i.isActive)
    if (active === 'inactive') items = items.filter((i) => !i.isActive)
    if (q) {
      items = items.filter((i) => [i.name, i.nameEn, i.slug].some((v) => foldTurkish(v || '').includes(q)))
    }

    const total = items.length
    const slice = items.slice((page - 1) * size, page * size)
    const pageItems = withUsage ? await attachUsage(slice) : slice
    return NextResponse.json({ items: pageItems, total, page, size })
  })
}

/** POST /api/admin/catalog/items — yeni katalog ürünü */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'catalog item create', async (actor) => {
    const body = await parseBody(request, itemCreateSchema)
    if ('response' in body) return body.response
    const input = body.data

    const { data: cat } = await supabaseAdmin.from('catalog_categories').select('id').eq('id', input.categoryId).maybeSingle()
    if (!cat) return jsonError(400, 'Kategori bulunamadı.')

    const { data: last } = await supabaseAdmin
      .from('catalog_items')
      .select('display_order')
      .eq('primary_category_id', input.categoryId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('catalog_items')
      .insert({
        slug: input.slug,
        primary_category_id: input.categoryId,
        name: input.name,
        name_en: input.nameEn,
        description: input.description,
        description_en: input.descriptionEn,
        price_suggested: input.priceSuggested,
        allergens: input.allergens,
        calories: input.calories ?? null,
        tags: input.tags,
        is_active: input.isActive,
        display_order: (last?.display_order ?? 0) + 10,
        admin_edited_at: now,
      })
      .select(ITEM_COLUMNS)
      .single()
    if (error) {
      if (isUniqueViolation(error)) return jsonError(409, 'Bu slug ile bir ürün zaten var.', 'SLUG_TAKEN')
      throw error
    }
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_item.create',
      targetType: 'catalog_item',
      targetId: data.id,
      targetLabel: data.name,
      after: { slug: data.slug, name: data.name },
    })
    return NextResponse.json({ item: mapItem(data) }, { status: 201 })
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { itemUpdateSchema } from '@/lib/server/admin/schemas'
import { ITEM_COLUMNS, attachUsage, catalogChanged, mapItem } from '@/lib/server/admin/catalog'
import { diffFields, logAdminAction } from '@/lib/server/admin/audit'
import { removeCatalogImageFile } from '@/lib/server/admin/catalog-image'

type Ctx = { params: Promise<{ id: string }> }

async function loadItem(params: Ctx['params']) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return null
  const { data } = await supabaseAdmin.from('catalog_items').select(ITEM_COLUMNS).eq('id', id).maybeSingle()
  return data
}

/** GET — tek ürün + kullanım sayısı */
export async function GET(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog item', async () => {
    const item = await loadItem(params)
    if (!item) return jsonError(404, 'Ürün bulunamadı.')
    const [withUsage] = await attachUsage([mapItem(item)])
    return NextResponse.json({ item: withUsage })
  })
}

/**
 * PATCH — ürün bilgileri. Restoranlara kopyalanmış ürünler etkilenmez (kopyalar bağımsızdır);
 * yalnızca görsel varsayılan olduğu sürece yayılır (bkz. /image).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog item update', async (actor) => {
    const item = await loadItem(params)
    if (!item) return jsonError(404, 'Ürün bulunamadı.')

    const body = await parseBody(request, itemUpdateSchema)
    if ('response' in body) return body.response
    const input = body.data

    const update: Record<string, any> = {}
    if (input.categoryId !== undefined) {
      const { data: cat } = await supabaseAdmin.from('catalog_categories').select('id').eq('id', input.categoryId).maybeSingle()
      if (!cat) return jsonError(400, 'Kategori bulunamadı.')
      update.primary_category_id = input.categoryId
    }
    if (input.name !== undefined) update.name = input.name
    if (input.nameEn !== undefined) update.name_en = input.nameEn
    if (input.description !== undefined) update.description = input.description
    if (input.descriptionEn !== undefined) update.description_en = input.descriptionEn
    if (input.priceSuggested !== undefined) update.price_suggested = input.priceSuggested
    if (input.allergens !== undefined) update.allergens = input.allergens
    if (input.calories !== undefined) update.calories = input.calories
    if (input.tags !== undefined) update.tags = input.tags
    if (input.isActive !== undefined) update.is_active = input.isActive
    if (input.displayOrder !== undefined) update.display_order = input.displayOrder

    const diff = diffFields(item, update)
    if (!diff.changed) return NextResponse.json({ item: mapItem(item) })

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('catalog_items')
      .update({ ...update, admin_edited_at: now, updated_at: now })
      .eq('id', item.id)
      .select(ITEM_COLUMNS)
      .single()
    if (error) throw error
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_item.update',
      targetType: 'catalog_item',
      targetId: item.id,
      targetLabel: data.name,
      before: diff.before,
      after: diff.after,
    })
    const [withUsage] = await attachUsage([mapItem(data)])
    return NextResponse.json({ item: withUsage })
  })
}

/**
 * DELETE — yalnızca hiçbir restoranda ve şablonda kullanılmayan ürün silinir; aksi halde pasifleştirin.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog item delete', async (actor) => {
    const item = await loadItem(params)
    if (!item) return jsonError(404, 'Ürün bulunamadı.')

    const [usage, templates] = await Promise.all([
      supabaseAdmin.from('items').select('id', { count: 'exact', head: true }).eq('catalog_item_id', item.id),
      supabaseAdmin.from('menu_template_items').select('template_id', { count: 'exact', head: true }).eq('item_id', item.id),
    ])
    const blockers: string[] = []
    if (usage.count) blockers.push(`${usage.count} restoran ürününe bağlı`)
    if (templates.count) blockers.push(`${templates.count} şablonda`)
    if (blockers.length) {
      return jsonError(409, `Ürün kullanımda (${blockers.join(', ')}). Silmek yerine pasifleştirin.`, 'IN_USE')
    }

    const { error } = await supabaseAdmin.from('catalog_items').delete().eq('id', item.id)
    if (error) throw error
    await removeCatalogImageFile(item.image_url)
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_item.delete',
      targetType: 'catalog_item',
      targetId: item.id,
      targetLabel: item.name,
      before: { slug: item.slug, name: item.name, image_url: item.image_url },
    })
    return NextResponse.json({ success: true })
  })
}

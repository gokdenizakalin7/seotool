import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { categoryUpdateSchema } from '@/lib/server/admin/schemas'
import { CATEGORY_COLUMNS, catalogChanged, descendantIds, loadAllCategories, mapCategory } from '@/lib/server/admin/catalog'
import { diffFields, logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

async function loadCategory(params: Ctx['params']) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return null
  const { data } = await supabaseAdmin.from('catalog_categories').select(CATEGORY_COLUMNS).eq('id', id).maybeSingle()
  return data
}

/** PATCH — ad, İngilizce ad, ikon, üst kategori (taşıma), aktif/pasif */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog category update', async (actor) => {
    const cat = await loadCategory(params)
    if (!cat) return jsonError(404, 'Kategori bulunamadı.')

    const body = await parseBody(request, categoryUpdateSchema)
    if ('response' in body) return body.response
    const input = body.data

    const update: Record<string, any> = {}
    if (input.name !== undefined) update.name = input.name
    if (input.nameEn !== undefined) update.name_en = input.nameEn
    if (input.icon !== undefined) update.icon = input.icon
    if (input.isActive !== undefined) update.is_active = input.isActive
    if (input.parentId !== undefined && input.parentId !== cat.parent_id) {
      if (input.parentId) {
        const all = await loadAllCategories()
        if (!all.some((c) => c.id === input.parentId)) return jsonError(400, 'Üst kategori bulunamadı.')
        if (descendantIds(all, cat.id).has(input.parentId)) {
          return jsonError(400, 'Kategori kendi altına taşınamaz.', 'CYCLE')
        }
      }
      update.parent_id = input.parentId
    }

    const diff = diffFields(cat, update)
    if (!diff.changed) return NextResponse.json({ category: mapCategory(cat) })

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('catalog_categories')
      .update({ ...update, admin_edited_at: now, updated_at: now })
      .eq('id', cat.id)
      .select(CATEGORY_COLUMNS)
      .single()
    if (error) throw error
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_category.update',
      targetType: 'catalog_category',
      targetId: cat.id,
      targetLabel: data.name,
      before: diff.before,
      after: diff.after,
    })
    return NextResponse.json({ category: mapCategory(data) })
  })
}

/**
 * DELETE — yalnızca boş kategori silinir (alt kategori, ürün veya şablon bağlantısı yoksa).
 * Dolu kategori için pasifleştirme önerilir.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog category delete', async (actor) => {
    const cat = await loadCategory(params)
    if (!cat) return jsonError(404, 'Kategori bulunamadı.')

    const [children, items, templates] = await Promise.all([
      supabaseAdmin.from('catalog_categories').select('id', { count: 'exact', head: true }).eq('parent_id', cat.id),
      supabaseAdmin.from('catalog_items').select('id', { count: 'exact', head: true }).eq('primary_category_id', cat.id),
      supabaseAdmin.from('menu_template_categories').select('template_id', { count: 'exact', head: true }).eq('category_id', cat.id),
    ])
    const blockers: string[] = []
    if (children.count) blockers.push(`${children.count} alt kategori`)
    if (items.count) blockers.push(`${items.count} ürün`)
    if (templates.count) blockers.push(`${templates.count} şablon`)
    if (blockers.length) {
      return jsonError(409, `Kategori boş değil (${blockers.join(', ')}). Silmek yerine pasifleştirin ya da önce içeriği taşıyın.`, 'NOT_EMPTY')
    }

    const { error } = await supabaseAdmin.from('catalog_categories').delete().eq('id', cat.id)
    if (error) throw error
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_category.delete',
      targetType: 'catalog_category',
      targetId: cat.id,
      targetLabel: cat.name,
      before: { slug: cat.slug, name: cat.name, parent_id: cat.parent_id },
    })
    return NextResponse.json({ success: true })
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { templateContentSchema } from '@/lib/server/admin/schemas'
import { logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PUT { categories: [{ categoryId, displayOrder }], items: [{ itemId, displayOrder, priceOverride? }] }
 * Şablon içeriğini tek transaction'da değiştirir (admin_set_template_content); hata olursa eski içerik kalır.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'template content', async (actor) => {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) return jsonError(400, 'Geçersiz şablon.')
    const { data: tpl } = await supabaseAdmin.from('menu_templates').select('id, name').eq('id', id).maybeSingle()
    if (!tpl) return jsonError(404, 'Şablon bulunamadı.')

    const body = await parseBody(request, templateContentSchema)
    if ('response' in body) return body.response

    const [{ count: catsBefore }, { count: itemsBefore }] = await Promise.all([
      supabaseAdmin.from('menu_template_categories').select('template_id', { count: 'exact', head: true }).eq('template_id', id),
      supabaseAdmin.from('menu_template_items').select('template_id', { count: 'exact', head: true }).eq('template_id', id),
    ])

    const { data, error } = await supabaseAdmin.rpc('admin_set_template_content', {
      p_template_id: id,
      p_categories: body.data.categories.map((c) => ({ category_id: c.categoryId, display_order: c.displayOrder })),
      p_items: body.data.items.map((i) => ({ item_id: i.itemId, display_order: i.displayOrder, price_override: i.priceOverride || null })),
    })
    if (error) {
      // 23503: olmayan kategori/ürün (bu arada silinmiş olabilir)
      if (error.code === '23503') return jsonError(409, 'Seçimdeki bir kategori ya da ürün artık katalogda yok. Sayfayı yenileyip tekrar deneyin.', 'STALE_SELECTION')
      throw error
    }
    const counts = data as { categories: number; items: number }

    await logAdminAction({
      actor,
      action: 'template.content',
      targetType: 'template',
      targetId: id,
      targetLabel: tpl.name,
      before: { categories: catsBefore ?? 0, items: itemsBefore ?? 0 },
      after: counts,
    })
    return NextResponse.json({ success: true, ...counts })
  })
}

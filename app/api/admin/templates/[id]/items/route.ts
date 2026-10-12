import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { templateItemsSchema } from '@/lib/server/admin/schemas'
import { logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

/** PUT { items: [{ itemId, displayOrder, priceOverride? }] } — şablonun ürün listesini tümüyle değiştirir */
export async function PUT(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'template items', async (actor) => {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) return jsonError(400, 'Geçersiz şablon.')
    const { data: tpl } = await supabaseAdmin.from('menu_templates').select('id, name').eq('id', id).maybeSingle()
    if (!tpl) return jsonError(404, 'Şablon bulunamadı.')

    const body = await parseBody(request, templateItemsSchema)
    if ('response' in body) return body.response
    const rows = body.data.items.map((i) => ({
      template_id: id,
      item_id: i.itemId,
      display_order: i.displayOrder,
      price_override: i.priceOverride || null,
    }))

    const { count: before } = await supabaseAdmin
      .from('menu_template_items')
      .select('template_id', { count: 'exact', head: true })
      .eq('template_id', id)
    const { error: delErr } = await supabaseAdmin.from('menu_template_items').delete().eq('template_id', id)
    if (delErr) throw delErr
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from('menu_template_items').insert(rows.slice(i, i + 500))
      if (error) throw error
    }

    await logAdminAction({
      actor,
      action: 'template.items',
      targetType: 'template',
      targetId: id,
      targetLabel: tpl.name,
      before: { count: before ?? 0 },
      after: { count: rows.length },
    })
    return NextResponse.json({ success: true, count: rows.length })
  })
}

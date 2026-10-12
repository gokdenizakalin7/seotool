import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { templateCategoriesSchema } from '@/lib/server/admin/schemas'
import { logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

/** PUT { categories: [{ categoryId, displayOrder }] } — şablonun kategori listesini tümüyle değiştirir */
export async function PUT(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'template categories', async (actor) => {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) return jsonError(400, 'Geçersiz şablon.')
    const { data: tpl } = await supabaseAdmin.from('menu_templates').select('id, name').eq('id', id).maybeSingle()
    if (!tpl) return jsonError(404, 'Şablon bulunamadı.')

    const body = await parseBody(request, templateCategoriesSchema)
    if ('response' in body) return body.response
    const rows = body.data.categories.map((c) => ({ template_id: id, category_id: c.categoryId, display_order: c.displayOrder }))

    const { count: before } = await supabaseAdmin
      .from('menu_template_categories')
      .select('template_id', { count: 'exact', head: true })
      .eq('template_id', id)
    const { error: delErr } = await supabaseAdmin.from('menu_template_categories').delete().eq('template_id', id)
    if (delErr) throw delErr
    if (rows.length) {
      const { error } = await supabaseAdmin.from('menu_template_categories').insert(rows)
      if (error) throw error
    }

    await logAdminAction({
      actor,
      action: 'template.categories',
      targetType: 'template',
      targetId: id,
      targetLabel: tpl.name,
      before: { count: before ?? 0 },
      after: { count: rows.length },
    })
    return NextResponse.json({ success: true, count: rows.length })
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { templateUpdateSchema } from '@/lib/server/admin/schemas'
import { TEMPLATE_COLUMNS, mapTemplate, templateToDb } from '@/lib/server/admin/templates'
import { diffFields, logAdminAction } from '@/lib/server/admin/audit'
import type { AdminTemplateDetail } from '@/lib/admin-types'

type Ctx = { params: Promise<{ id: string }> }

async function load(params: Ctx['params']) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return null
  const { data } = await supabaseAdmin.from('menu_templates').select(TEMPLATE_COLUMNS).eq('id', id).maybeSingle()
  return data
}

/** GET — şablon + seçili kategoriler ve ürünler (fiyat geçersiz kılmalarıyla) */
export async function GET(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'template detail', async () => {
    const tpl = await load(params)
    if (!tpl) return jsonError(404, 'Şablon bulunamadı.')
    const [cats, items] = await Promise.all([
      supabaseAdmin.from('menu_template_categories').select('category_id, display_order').eq('template_id', tpl.id).order('display_order'),
      supabaseAdmin.from('menu_template_items').select('item_id, display_order, price_override').eq('template_id', tpl.id).order('display_order'),
    ])
    if (cats.error) throw cats.error
    if (items.error) throw items.error
    const detail: AdminTemplateDetail = {
      ...mapTemplate(tpl, { categories: cats.data.length, items: items.data.length }),
      categories: cats.data.map((c) => ({ categoryId: c.category_id, displayOrder: c.display_order })),
      items: items.data.map((i) => ({ itemId: i.item_id, displayOrder: i.display_order, priceOverride: i.price_override })),
    }
    return NextResponse.json({ template: detail })
  })
}

/** PATCH — şablon bilgileri */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'template update', async (actor) => {
    const tpl = await load(params)
    if (!tpl) return jsonError(404, 'Şablon bulunamadı.')

    const body = await parseBody(request, templateUpdateSchema)
    if ('response' in body) return body.response
    const update = templateToDb(body.data)
    const diff = diffFields(tpl, update)
    if (!diff.changed) return NextResponse.json({ template: mapTemplate(tpl) })

    const { data, error } = await supabaseAdmin
      .from('menu_templates')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', tpl.id)
      .select(TEMPLATE_COLUMNS)
      .single()
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'template.update',
      targetType: 'template',
      targetId: tpl.id,
      targetLabel: data.name,
      before: diff.before,
      after: diff.after,
    })
    return NextResponse.json({ template: mapTemplate(data) })
  })
}

/** DELETE — şablonu siler (restoranlara kopyalanmış menüler etkilenmez). Varsayılan şablon olarak bağlıysa bağlantı kaldırılır. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'template delete', async (actor) => {
    const tpl = await load(params)
    if (!tpl) return jsonError(404, 'Şablon bulunamadı.')

    await supabaseAdmin.from('business_types').update({ default_template_slug: null }).eq('default_template_slug', tpl.slug)
    const { error } = await supabaseAdmin.from('menu_templates').delete().eq('id', tpl.id)
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'template.delete',
      targetType: 'template',
      targetId: tpl.id,
      targetLabel: tpl.name,
      before: { slug: tpl.slug, name: tpl.name, business_type: tpl.business_type },
    })
    return NextResponse.json({ success: true })
  })
}

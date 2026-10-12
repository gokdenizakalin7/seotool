import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { businessTypeUpdateSchema } from '@/lib/server/admin/schemas'
import { BUSINESS_TYPE_COLUMNS, businessTypeToDb, mapBusinessType } from '@/lib/server/admin/business-types'
import { diffFields, logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ slug: string }> }

async function load(params: Ctx['params']) {
  const { slug } = await params
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null
  const { data } = await supabaseAdmin.from('business_types').select(BUSINESS_TYPE_COLUMNS).eq('slug', slug).maybeSingle()
  return data
}

/** PATCH /api/admin/business-types/[slug] */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'business type update', async (actor) => {
    const bt = await load(params)
    if (!bt) return jsonError(404, 'İşletme türü bulunamadı.')

    const body = await parseBody(request, businessTypeUpdateSchema)
    if ('response' in body) return body.response

    const update = businessTypeToDb(body.data)
    if (update.default_template_slug) {
      const { data: tpl } = await supabaseAdmin.from('menu_templates').select('id').eq('slug', update.default_template_slug).maybeSingle()
      if (!tpl) return jsonError(400, 'Varsayılan şablon bulunamadı.')
    }
    const diff = diffFields(bt, update)
    if (!diff.changed) return NextResponse.json({ businessType: mapBusinessType(bt) })

    const { data, error } = await supabaseAdmin
      .from('business_types')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('slug', bt.slug)
      .select(BUSINESS_TYPE_COLUMNS)
      .single()
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'business_type.update',
      targetType: 'business_type',
      targetId: bt.slug,
      targetLabel: data.label,
      before: diff.before,
      after: diff.after,
    })
    return NextResponse.json({ businessType: mapBusinessType(data) })
  })
}

/** DELETE — bu türü kullanan restoran varsa engellenir (pasifleştirin) */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'business type delete', async (actor) => {
    const bt = await load(params)
    if (!bt) return jsonError(404, 'İşletme türü bulunamadı.')

    const { count } = await supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('business_type', bt.slug)
    if (count) {
      return jsonError(409, `${count} restoran bu türü kullanıyor. Silmek yerine pasifleştirin.`, 'IN_USE')
    }

    const { error } = await supabaseAdmin.from('business_types').delete().eq('slug', bt.slug)
    if (error) throw error

    await logAdminAction({
      actor,
      action: 'business_type.delete',
      targetType: 'business_type',
      targetId: bt.slug,
      targetLabel: bt.label,
      before: bt,
    })
    return NextResponse.json({ success: true })
  })
}

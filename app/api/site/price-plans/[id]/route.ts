import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { pricePlanInputSchema, subdomainField } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { updatePricePlan } from '@/lib/server/price-plan-store'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/site/price-plans/[id] — planın tamamını (kural, takvim, istisnalar) değiştirir */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const body = await parseJsonBody(request, pricePlanInputSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response

  try {
    const result = await updatePricePlan(access.organizationId, id, body.data)
    if ('error' in result && result.error) return jsonError(result.status, result.error)
    if ('dbError' in result) return dbErrorResponse('price-plans PATCH', result.dbError ?? null)
    return NextResponse.json({ plan: result.plan })
  } catch (err) {
    console.error('price-plans PATCH:', err)
    return jsonError(500, 'Fiyat planı kaydedilemedi.')
  }
}

/** DELETE /api/site/price-plans/[id]?subdomain= — elle seçili plansa fiyat modu otomatiğe döner */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const subdomain = subdomainField.safeParse(new URL(request.url).searchParams.get('subdomain'))
  if (!subdomain.success) return jsonError(400, 'subdomain gerekli.')
  const access = await requireSubdomainAccess(request, subdomain.data)
  if ('response' in access) return access.response
  const orgId = access.organizationId

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('price_mode, active_price_plan_id')
    .eq('id', orgId)
    .maybeSingle()
  if (org?.price_mode === 'manual' && org.active_price_plan_id === id) {
    await supabaseAdmin
      .from('organizations')
      .update({ price_mode: 'auto', price_manual_until: null, active_price_plan_id: null })
      .eq('id', orgId)
  }

  const { data, error } = await supabaseAdmin
    .from('price_plans')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('id')
    .maybeSingle()
  if (error) return dbErrorResponse('price-plans DELETE', error)
  if (!data) return jsonError(404, 'Fiyat planı bulunamadı.')
  return NextResponse.json({ success: true })
}

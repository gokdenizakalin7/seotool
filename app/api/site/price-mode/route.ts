import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { priceModeSchema } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { priceModeFromOrg } from '@/lib/server/site-data'

/**
 * POST /api/site/price-mode — fiyat modu.
 *  auto: takvim belirler (açık pencere yoksa normal fiyatlar).
 *  manual: seçilen plan (planId null = "Normal fiyatlar") until'e kadar takvimin önüne geçer; until null = süresiz.
 */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, priceModeSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response
  const orgId = access.organizationId
  const { mode, planId, until } = body.data

  if (mode === 'manual' && planId) {
    const { data: plan } = await supabaseAdmin
      .from('price_plans')
      .select('id')
      .eq('id', planId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!plan) return jsonError(404, 'Fiyat planı bulunamadı.')
  }
  if (mode === 'manual' && until && Date.parse(until) <= Date.now()) {
    return jsonError(400, 'Bitiş zamanı gelecekte olmalı.')
  }

  const update =
    mode === 'manual'
      ? { price_mode: 'manual', active_price_plan_id: planId || null, price_manual_until: until || null }
      : { price_mode: 'auto', active_price_plan_id: null, price_manual_until: null }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update(update)
    .eq('id', orgId)
    .select('price_mode, price_manual_until, active_price_plan_id')
    .single()
  if (error) return dbErrorResponse('price-mode POST', error)
  return NextResponse.json({ mode: priceModeFromOrg(data) })
}

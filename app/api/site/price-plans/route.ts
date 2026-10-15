import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { pricePlanInputSchema } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { loadPricePlans, priceModeFromOrg } from '@/lib/server/site-data'
import { createPricePlan } from '@/lib/server/price-plan-store'
import { isMissingSchemaError } from '@/lib/restaurant-profile'
import { nextScheduledWindow, resolveEffectivePlan } from '@/lib/price-plan'

/** GET /api/site/price-plans?subdomain= — planlar, fiyat modu, şu an geçerli plan ve sıradaki takvim penceresi */
export async function GET(request: Request) {
  const subdomain = new URL(request.url).searchParams.get('subdomain')
  if (!subdomain) return jsonError(400, 'subdomain gerekli.')
  const access = await requireSubdomainAccess(request, subdomain, { allowSuspended: true })
  if ('response' in access) return access.response

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('price_mode, price_manual_until, active_price_plan_id, currency')
    .eq('id', access.organizationId)
    .maybeSingle()
  if (error) return dbErrorResponse('price-plans GET', error)

  const plans = await loadPricePlans(access.organizationId)
  const mode = priceModeFromOrg(org)
  const now = new Date()
  const effective = resolveEffectivePlan(plans, mode, now)
  const next = nextScheduledWindow(plans, now)
  return NextResponse.json({
    plans,
    mode,
    currency: org?.currency || '₺',
    effective: { planId: effective.plan?.id ?? null, source: effective.source, until: effective.until ?? null },
    next: next ? { planId: next.plan.id, startsAt: next.startsAt.toISOString() } : null,
  })
}

/** POST /api/site/price-plans — yeni plan */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, pricePlanInputSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response

  try {
    const result = await createPricePlan(access.organizationId, body.data)
    if ('error' in result && result.error) return jsonError(result.status, result.error)
    if ('dbError' in result) return dbErrorResponse('price-plans POST', result.dbError ?? null)
    return NextResponse.json({ plan: result.plan }, { status: 201 })
  } catch (err: any) {
    if (isMissingSchemaError(err)) return dbErrorResponse('price-plans POST', err)
    console.error('price-plans POST:', err)
    return jsonError(500, 'Fiyat planı kaydedilemedi.')
  }
}

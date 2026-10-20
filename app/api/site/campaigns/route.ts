import { NextResponse } from 'next/server'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { campaignInputSchema } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { CAMPAIGN_SELECT, loadCampaigns } from '@/lib/server/site-data'
import { createCampaign } from '@/lib/server/campaign-store'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** GET /api/site/campaigns?subdomain= — tüm kampanyalar (pasifler dahil), ürünlerin güncel haliyle */
export async function GET(request: Request) {
  const subdomain = new URL(request.url).searchParams.get('subdomain')
  if (!subdomain) return jsonError(400, 'subdomain gerekli.')
  const access = await requireSubdomainAccess(request, subdomain, { allowSuspended: true })
  if ('response' in access) return access.response

  // Tablo ya da sütunlar yoksa (migration 15 / 18) loadCampaigns boş döner; panelin uyarı gösterebilmesi için ayrıca sına
  const probe = await supabaseAdmin.from('campaigns').select(CAMPAIGN_SELECT).limit(1)
  if (probe.error) return dbErrorResponse('campaigns GET', probe.error)

  const { data: org } = await supabaseAdmin.from('organizations').select('currency').eq('id', access.organizationId).maybeSingle()
  return NextResponse.json({ campaigns: await loadCampaigns(access.organizationId), currency: org?.currency || '₺' })
}

/** POST /api/site/campaigns — yeni kampanya */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, campaignInputSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response

  try {
    const result = await createCampaign(access.organizationId, body.data)
    if ('error' in result && result.error) return jsonError(result.status, result.error)
    if ('dbError' in result) return dbErrorResponse('campaigns POST', result.dbError ?? null)
    return NextResponse.json({ campaign: result.campaign }, { status: 201 })
  } catch (err) {
    console.error('campaigns POST:', err)
    return jsonError(500, 'Kampanya kaydedilemedi.')
  }
}

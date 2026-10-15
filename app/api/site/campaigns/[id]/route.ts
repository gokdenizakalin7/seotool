import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { campaignInputSchema, subdomainField } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { updateCampaign } from '@/lib/server/campaign-store'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/site/campaigns/[id] — kampanyanın tamamını (ürünler dahil) değiştirir */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const body = await parseJsonBody(request, campaignInputSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response

  try {
    const result = await updateCampaign(access.organizationId, id, body.data)
    if ('error' in result && result.error) return jsonError(result.status, result.error)
    if ('dbError' in result) return dbErrorResponse('campaigns PATCH', result.dbError ?? null)
    return NextResponse.json({ campaign: result.campaign })
  } catch (err) {
    console.error('campaigns PATCH:', err)
    return jsonError(500, 'Kampanya kaydedilemedi.')
  }
}

/** DELETE /api/site/campaigns/[id]?subdomain= */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const subdomain = subdomainField.safeParse(new URL(request.url).searchParams.get('subdomain'))
  if (!subdomain.success) return jsonError(400, 'subdomain gerekli.')
  const access = await requireSubdomainAccess(request, subdomain.data)
  if ('response' in access) return access.response

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('organization_id', access.organizationId)
    .select('id')
    .maybeSingle()
  if (error) return dbErrorResponse('campaigns DELETE', error)
  if (!data) return jsonError(404, 'Kampanya bulunamadı.')
  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { eventInputSchema, subdomainField } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { EVENT_SELECT, mapEventRow } from '@/lib/server/site-data'
import { removeOrgImage } from '@/lib/server/storage'
import { eventColumns, posterAllowed } from '@/lib/server/event-store'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/site/events/[id] — afiş değiştiyse eski dosya silinir */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const body = await parseJsonBody(request, eventInputSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response
  const orgId = access.organizationId
  if (!posterAllowed(orgId, body.data.posterUrl)) return jsonError(400, 'Geçersiz afiş görseli.')

  const { data: before } = await supabaseAdmin
    .from('events')
    .select('poster_url')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!before) return jsonError(404, 'Etkinlik bulunamadı.')

  const { data, error } = await supabaseAdmin
    .from('events')
    .update(eventColumns(body.data))
    .eq('id', id)
    .eq('organization_id', orgId)
    .select(EVENT_SELECT)
    .single()
  if (error) return dbErrorResponse('events PATCH', error)

  if (before.poster_url && before.poster_url !== (body.data.posterUrl || null)) await removeOrgImage(orgId, before.poster_url)
  return NextResponse.json({ event: mapEventRow(data) })
}

/** DELETE /api/site/events/[id]?subdomain= — afiş dosyası da silinir */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const subdomain = subdomainField.safeParse(new URL(request.url).searchParams.get('subdomain'))
  if (!subdomain.success) return jsonError(400, 'subdomain gerekli.')
  const access = await requireSubdomainAccess(request, subdomain.data)
  if ('response' in access) return access.response

  const { data, error } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', id)
    .eq('organization_id', access.organizationId)
    .select('poster_url')
    .maybeSingle()
  if (error) return dbErrorResponse('events DELETE', error)
  if (!data) return jsonError(404, 'Etkinlik bulunamadı.')
  await removeOrgImage(access.organizationId, data.poster_url)
  return NextResponse.json({ success: true })
}

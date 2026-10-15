import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { eventInputSchema } from '@/lib/site-schemas'
import { dbErrorResponse, jsonError, parseJsonBody } from '@/lib/server/site-api'
import { EVENT_SELECT, loadEvents, mapEventRow } from '@/lib/server/site-data'
import { eventColumns, posterAllowed } from '@/lib/server/event-store'

/** GET /api/site/events?subdomain= — tüm etkinlikler (geçmiş ve taslaklar dahil) */
export async function GET(request: Request) {
  const subdomain = new URL(request.url).searchParams.get('subdomain')
  if (!subdomain) return jsonError(400, 'subdomain gerekli.')
  const access = await requireSubdomainAccess(request, subdomain, { allowSuspended: true })
  if ('response' in access) return access.response

  const probe = await supabaseAdmin.from('events').select('id').limit(1)
  if (probe.error) return dbErrorResponse('events GET', probe.error)
  return NextResponse.json({ events: await loadEvents(access.organizationId) })
}

/** POST /api/site/events — yeni etkinlik */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, eventInputSchema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response
  if (!posterAllowed(access.organizationId, body.data.posterUrl)) return jsonError(400, 'Geçersiz afiş görseli.')

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({ organization_id: access.organizationId, ...eventColumns(body.data) })
    .select(EVENT_SELECT)
    .single()
  if (error) return dbErrorResponse('events POST', error)
  return NextResponse.json({ event: mapEventRow(data) }, { status: 201 })
}

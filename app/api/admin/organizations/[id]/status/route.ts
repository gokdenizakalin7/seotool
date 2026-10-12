import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { statusSchema } from '@/lib/server/admin/schemas'
import { getOrgRow } from '@/lib/server/admin/orgs'
import { logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/organizations/[id]/status { status, reason }
 * Askıya alınan restoranın müşteri menüsü kapanır, paneli salt-okunur olur. Sebep zorunlu.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'organization status', async (actor) => {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) return jsonError(400, 'Geçersiz restoran kimliği.')

    const body = await parseBody(request, statusSchema)
    if ('response' in body) return body.response
    const { status, reason } = body.data

    const org = await getOrgRow(id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const nextReason = status === 'suspended' ? reason : null
    if (org.status === status && (org.status_reason || null) === nextReason) {
      return NextResponse.json({ organization: org, changed: false })
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update({
        status,
        status_reason: nextReason,
        status_changed_at: new Date().toISOString(),
        status_changed_by: actor.id,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    await logAdminAction({
      actor,
      action: status === 'suspended' ? 'organization.suspend' : 'organization.activate',
      targetType: 'organization',
      targetId: id,
      targetLabel: org.name,
      before: { status: org.status, status_reason: org.status_reason },
      after: { status, status_reason: nextReason },
      reason: reason || null,
    })

    return NextResponse.json({ organization: data, changed: true })
  })
}

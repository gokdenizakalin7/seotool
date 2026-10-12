import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { getOrgRow } from '@/lib/server/admin/orgs'
import { logAdminAction } from '@/lib/server/admin/audit'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({ menuId: z.string().uuid(), isListed: z.boolean() })

/** PATCH { menuId, isListed } — restoranın menüsünü yayına al / yayından kaldır */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'menu listing', async (actor) => {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) return jsonError(400, 'Geçersiz restoran kimliği.')
    const org = await getOrgRow(id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')

    const body = await parseBody(request, schema)
    if ('response' in body) return body.response
    const { menuId, isListed } = body.data

    const { data: menu, error } = await supabaseAdmin
      .from('menus')
      .update({ is_listed: isListed, updated_at: new Date().toISOString() })
      .eq('id', menuId)
      .eq('organization_id', id)
      .select('id, name, is_listed')
      .maybeSingle()
    if (error) throw error
    if (!menu) return jsonError(404, 'Menü bulunamadı.')

    await logAdminAction({
      actor,
      action: 'organization.update',
      targetType: 'organization',
      targetId: id,
      targetLabel: org.name,
      before: { [`menu:${menu.name}:is_listed`]: !isListed },
      after: { [`menu:${menu.name}:is_listed`]: isListed },
    })
    return NextResponse.json({ menu })
  })
}

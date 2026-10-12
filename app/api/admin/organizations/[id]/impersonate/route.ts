import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminRoute, jsonError } from '@/lib/server/admin/http'
import { getOrgRow } from '@/lib/server/admin/orgs'
import { logAdminAction } from '@/lib/server/admin/audit'
import { orgRowToRestaurant } from '@/lib/restaurant-profile'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET  /api/admin/organizations/[id]/impersonate — "Panele Gir" sırasında restoran profilini verir.
 * POST /api/admin/organizations/[id]/impersonate — oturum başlangıcını denetim kaydına yazar.
 * Yetki sunucuda zaten var (requireOrgAccess süper admini her restorana alır); istemci yalnızca seçili restoranı tutar.
 */
async function load(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null
  return getOrgRow(id)
}

export async function GET(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'impersonate profile', async (actor) => {
    const org = await load((await params).id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')
    return NextResponse.json({ restaurant: orgRowToRestaurant(org, { email: actor.email, role: 'superadmin' }) })
  })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'impersonate start', async (actor) => {
    const org = await load((await params).id)
    if (!org) return jsonError(404, 'Restoran bulunamadı.', 'ORG_NOT_FOUND')
    await logAdminAction({
      actor,
      action: 'organization.impersonate',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
    })
    return NextResponse.json({ restaurant: orgRowToRestaurant(org, { email: actor.email, role: 'superadmin' }) })
  })
}

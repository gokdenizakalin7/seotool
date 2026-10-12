import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { createOrganizationSchema } from '@/lib/server/admin/schemas'
import { isEmailTakenError, isSubdomainTaken, mapOrgOverviewRow } from '@/lib/server/admin/orgs'
import { logAdminAction } from '@/lib/server/admin/audit'
import { foldTurkish } from '@/lib/catalog-match'
import type { AdminOrgRow } from '@/lib/admin-types'

/**
 * GET /api/admin/organizations?q=&status=active|suspended&page=1&size=50
 * Restoran listesi: sahip e-postası, durum + sebep, sayımlar.
 */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'organizations list', async () => {
    const params = request.nextUrl.searchParams
    const q = foldTurkish((params.get('q') || '').trim())
    const status = params.get('status')
    const page = Math.max(1, Number(params.get('page')) || 1)
    const size = Math.min(200, Math.max(1, Number(params.get('size')) || 50))

    const { data, error } = await supabaseAdmin.rpc('admin_organizations_overview')
    if (error) {
      console.error('admin_organizations_overview:', error)
      return jsonError(500, 'Restoranlar okunamadı. Migration 11 çalıştırıldı mı?', 'DB')
    }

    let rows: AdminOrgRow[] = ((data || []) as any[]).map(mapOrgOverviewRow)
    const counts = {
      all: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      suspended: rows.filter((r) => r.status === 'suspended').length,
    }

    if (status === 'active' || status === 'suspended') rows = rows.filter((r) => r.status === status)
    if (q) {
      rows = rows.filter((r) =>
        [r.name, r.subdomain, r.ownerName, r.owner?.email, r.phone, r.city]
          .filter(Boolean)
          .some((v) => foldTurkish(String(v)).includes(q))
      )
    }

    const total = rows.length
    rows = rows.slice((page - 1) * size, page * size)
    return NextResponse.json({ organizations: rows, total, page, size, counts })
  })
}

/**
 * POST /api/admin/organizations
 * Kullanıcı (admin'in belirlediği şifreyle) + restoran + sahip üyeliği oluşturur.
 * Org ve üyelik handle_new_user tetikleyicisiyle oluşur; ardından ek alanlar güncellenir.
 */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'organizations create', async (actor) => {
    const body = await parseBody(request, createOrganizationSchema)
    if ('response' in body) return body.response
    const input = body.data

    if (input.subdomain && (await isSubdomainTaken(input.subdomain))) {
      return jsonError(409, 'Bu subdomain başka bir restoran tarafından kullanılıyor.', 'SUBDOMAIN_TAKEN')
    }

    if (input.templateSlug) {
      const { data: tpl } = await supabaseAdmin.from('menu_templates').select('id').eq('slug', input.templateSlug).maybeSingle()
      if (!tpl) return jsonError(400, 'Seçilen şablon bulunamadı.', 'TEMPLATE_NOT_FOUND')
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        business_name: input.businessName,
        owner_name: input.ownerName,
        must_change_password: input.mustChangePassword,
        created_by_admin: true,
      },
    })
    if (createErr || !created?.user) {
      if (isEmailTakenError(createErr)) {
        return jsonError(409, 'Bu e-posta ile zaten bir kullanıcı var. Restoran detayından mevcut kullanıcıyı üye olarak ekleyebilirsiniz.', 'EMAIL_TAKEN')
      }
      console.error('admin createUser error:', createErr)
      return jsonError(500, 'Kullanıcı oluşturulamadı.')
    }
    const userId = created.user.id

    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (!member) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return jsonError(500, 'Restoran kaydı oluşturulamadı (tetikleyici üyelik açmadı).')
    }
    const orgId = member.organization_id as string

    const update: Record<string, unknown> = {}
    if (input.phone) update.business_phone = input.phone
    if (input.city) update.city = input.city
    if (input.businessType) update.business_type = input.businessType
    if (input.subdomain) update.subdomain = input.subdomain
    if (input.skipOnboarding) update.onboarding_completed_at = new Date().toISOString()
    if (Object.keys(update).length) {
      const { error } = await supabaseAdmin.from('organizations').update(update).eq('id', orgId)
      if (error) console.error('admin org post-create update:', error)
    }

    let templateApplied = false
    if (input.templateSlug) {
      const { error } = await supabaseAdmin.rpc('apply_catalog_template', {
        p_org_id: orgId,
        p_template_slug: input.templateSlug,
        p_menu_id: null,
      })
      if (error) console.error('admin apply template:', error)
      else templateApplied = true
    }

    const { data: org } = await supabaseAdmin.from('organizations').select('id, name, subdomain').eq('id', orgId).single()

    await logAdminAction({
      actor,
      action: 'organization.create',
      targetType: 'organization',
      targetId: orgId,
      targetLabel: org?.name || input.businessName,
      after: {
        name: input.businessName,
        subdomain: org?.subdomain,
        email: input.email,
        ownerName: input.ownerName,
        businessType: input.businessType || null,
        templateSlug: input.templateSlug || null,
        mustChangePassword: input.mustChangePassword,
      },
    })

    return NextResponse.json({ organization: org, userId, templateApplied }, { status: 201 })
  })
}

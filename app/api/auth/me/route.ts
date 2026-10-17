import { NextResponse, NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeOrgStatus } from '@/lib/org-status'
import { ORG_PROFILE_COLUMNS, ORG_PROFILE_COLUMNS_BASE, isMissingSchemaError, orgRowToRestaurant } from '@/lib/restaurant-profile'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response
    const { user } = auth

    // Üyelik ve restoran profili tek sorguda: her girişte / panel açılışında Supabase'e bir gidiş-dönüş daha az
    const selectMembership = (columns: string) =>
      supabaseAdmin
        .from('organization_members')
        .select(`organization_id, role, organizations (${columns})`)
        .eq('user_id', user.id)
        .maybeSingle()
    let joined = await selectMembership(ORG_PROFILE_COLUMNS)
    // Migration 15 (site sütunları) henüz çalıştırılmadıysa onsuz devam et
    if (joined.error && isMissingSchemaError(joined.error)) joined = await selectMembership(ORG_PROFILE_COLUMNS_BASE)

    let memberData = joined.data as { organization_id: string; role: string } | null
    let org: any = (joined.data as any)?.organizations ?? null
    if (joined.error) {
      // Migration 04 henüz çalıştırılmadıysa eski sütunlarla devam et (giriş bozulmasın)
      console.error('me: profil sütunları okunamadı, migration 04 çalıştırıldı mı?', joined.error.message)
      const member = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .maybeSingle()
      memberData = member.data
      org = null
      if (memberData) {
        const legacy = await supabaseAdmin
          .from('organizations')
          .select('id, name, subdomain, currency, business_phone, address, city, logo_url, cover_url, primary_color, wifi_name, wifi_password')
          .eq('id', memberData.organization_id)
          .maybeSingle()
        org = legacy.data ? { ...legacy.data, onboarding_completed_at: new Date().toISOString() } : null
      }
    }

    const memberRole = memberData?.role || 'restaurant'
    const role = user.isSuperAdmin ? 'superadmin' : memberRole

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role,
      organization: org
        ? {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain,
            business_phone: org.business_phone,
            onboardingCompleted: !!org.onboarding_completed_at,
            onboardingStep: org.onboarding_step || null,
            status: normalizeOrgStatus(org.status),
            statusReason: org.status_reason || '',
          }
        : null,
      restaurant: org ? orgRowToRestaurant(org, { email: user.email, role }) : null,
    })
  } catch (error: any) {
    console.error('Auth me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse, NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ORG_PROFILE_COLUMNS, orgRowToRestaurant } from '@/lib/restaurant-profile'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response
    const { user } = auth

    const { data: memberData } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    let org: any = null
    if (memberData) {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select(ORG_PROFILE_COLUMNS)
        .eq('id', memberData.organization_id)
        .maybeSingle()
      org = data
      if (error) {
        // Migration 04 henüz çalıştırılmadıysa eski sütunlarla devam et (giriş bozulmasın)
        console.error('me: profil sütunları okunamadı, migration 04 çalıştırıldı mı?', error.message)
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
            status: org.status === 'suspended' ? 'suspended' : 'active',
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

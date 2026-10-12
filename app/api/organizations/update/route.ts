import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireOrgAccess, requireUser } from '@/lib/auth-middleware'
import { businessTypeExists } from '@/lib/server/business-types'
import { profileToDbColumns, profileUpdateSchema, ORG_PROFILE_COLUMNS, orgRowToRestaurant } from '@/lib/restaurant-profile'

/** Eski istemci biçimini (businessInfo/branding) düz profil alanlarına çevirir. */
function flatten(body: any) {
  const b = body.businessInfo || {}
  const br = body.branding || {}
  return {
    name: body.name,
    currency: body.currency,
    businessType: body.businessType,
    phone: body.phone ?? b.phone,
    address: body.address ?? b.address,
    city: body.city ?? b.city,
    workingHours: body.workingHours ?? b.workingHours,
    googleMapsUrl: body.googleMapsUrl ?? b.googleMapsUrl,
    googleReviewUrl: body.googleReviewUrl ?? b.googleReviewUrl,
    instagramHandle: body.instagramHandle ?? b.instagramHandle,
    whatsappNumber: body.whatsappNumber ?? b.whatsappNumber,
    wifiName: body.wifiName ?? b.wifi_name,
    wifiPassword: body.wifiPassword ?? b.wifi_password,
    primaryColor: body.primaryColor ?? br.primaryColor,
    onboardingStep: body.onboardingStep,
    completeOnboarding: body.completeOnboarding,
  }
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subdomain, id } = body

    if (!subdomain && !id) {
      return NextResponse.json({ error: 'Organization ID or Subdomain is required' }, { status: 400 })
    }

    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    let lookup = supabase.from('organizations').select('id, name, subdomain, onboarding_completed_at')
    lookup = subdomain ? lookup.eq('subdomain', subdomain) : lookup.eq('id', id)
    const { data: org } = await lookup.maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Organizasyon bulunamadı.' }, { status: 404 })
    }

    const access = await requireOrgAccess(request, org.id)
    if ('response' in access) return access.response

    // Tanımsız ve boş-geçersiz değerleri ele
    const flat = Object.fromEntries(Object.entries(flatten(body)).filter(([, v]) => v !== undefined && v !== null))
    const parsed = profileUpdateSchema.safeParse(flat)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Gönderilen bilgiler geçersiz.' }, { status: 400 })
    }

    if (parsed.data.businessType && !(await businessTypeExists(parsed.data.businessType))) {
      return NextResponse.json({ error: 'Geçersiz işletme türü.' }, { status: 400 })
    }

    const updateData = profileToDbColumns(parsed.data)

    // Onboarding bitmeden işletme adı değişirse subdomain'i yeniden üret; bittikten sonra sabit kalır
    if (updateData.name && !org.onboarding_completed_at && updateData.name !== org.name) {
      const base = slugify(updateData.name) || `restoran-${org.id.slice(0, 8)}`
      let candidate = base
      for (let i = 1; i < 50; i++) {
        const { data: clash } = await supabase
          .from('organizations')
          .select('id')
          .eq('subdomain', candidate)
          .neq('id', org.id)
          .maybeSingle()
        if (!clash) break
        candidate = `${base}-${i}`
      }
      updateData.subdomain = candidate
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', org.id)
      .select(ORG_PROFILE_COLUMNS)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      organization: data,
      restaurant: orgRowToRestaurant(data, { email: auth.user.email }),
    })
  } catch (error: any) {
    console.error('Error updating organization:', error)
    return NextResponse.json({ error: 'Ayarlar güncellenemedi.' }, { status: 500 })
  }
}

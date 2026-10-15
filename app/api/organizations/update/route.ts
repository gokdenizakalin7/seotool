import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireOrgAccess, requireUser } from '@/lib/auth-middleware'
import { businessTypeExists } from '@/lib/server/business-types'
import { isReservedSlug, slugifyBusinessName } from '@/lib/site-url'
import {
  profileToDbColumns,
  profileUpdateSchema,
  ORG_PROFILE_COLUMNS,
  ORG_PROFILE_COLUMNS_BASE,
  ORG_SITE_COLUMNS,
  isMissingSchemaError,
  orgRowToRestaurant,
} from '@/lib/restaurant-profile'

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
    contactEmail: body.contactEmail ?? b.contactEmail,
    websiteUrl: body.websiteUrl ?? b.websiteUrl,
    facebookUrl: body.facebookUrl ?? b.facebookUrl,
    tiktokHandle: body.tiktokHandle ?? b.tiktokHandle,
    xHandle: body.xHandle ?? b.xHandle,
    youtubeUrl: body.youtubeUrl ?? b.youtubeUrl,
    aboutText: body.aboutText ?? body.about?.text,
    aboutSource: body.aboutSource ?? body.about?.source ?? undefined,
    wifiName: body.wifiName ?? b.wifi_name,
    wifiPassword: body.wifiPassword ?? b.wifi_password,
    primaryColor: body.primaryColor ?? br.primaryColor,
    onboardingStep: body.onboardingStep,
    completeOnboarding: body.completeOnboarding,
    siteSlug: body.siteSlug,
  }
}

const slugify = slugifyBusinessName

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
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Gönderilen bilgiler geçersiz.' }, { status: 400 })
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
        // Panel yollarıyla çakışan adlar (login, dashboard…) site adresi olamaz
        if (!isReservedSlug(candidate)) {
          const { data: clash } = await supabase
            .from('organizations')
            .select('id')
            .eq('subdomain', candidate)
            .neq('id', org.id)
            .maybeSingle()
          if (!clash) break
        }
        candidate = `${base}-${i}`
      }
      updateData.subdomain = candidate
    }

    // Site adresini yalnızca sistem yöneticisi değiştirebilir; eski adres geçmişe yazılır ve yönlendirilir (migration 14)
    if (parsed.data.siteSlug !== undefined && parsed.data.siteSlug !== org.subdomain) {
      if (!auth.user.isSuperAdmin) {
        return NextResponse.json({ error: 'Site adresini yalnızca sistem yöneticisi değiştirebilir.', code: 'FORBIDDEN' }, { status: 403 })
      }
      const { data: clash } = await supabase
        .from('organizations')
        .select('id')
        .eq('subdomain', parsed.data.siteSlug)
        .neq('id', org.id)
        .maybeSingle()
      if (clash) {
        return NextResponse.json({ error: 'Bu site adresi başka bir işletme tarafından kullanılıyor.', code: 'SLUG_TAKEN' }, { status: 409 })
      }
      updateData.subdomain = parsed.data.siteSlug
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 })
    }

    const runUpdate = (columns: string) =>
      supabase.from('organizations').update(updateData).eq('id', org.id).select(columns).single()
    let { data, error } = await runUpdate(ORG_PROFILE_COLUMNS)
    // Migration 15 çalışmadıysa: site alanları gönderilmediyse eski sütunlarla yeniden dene
    if (error && isMissingSchemaError(error)) {
      const usesSiteColumns = ORG_SITE_COLUMNS.split(', ').some((col) => col in updateData)
      if (usesSiteColumns) {
        return NextResponse.json(
          { error: 'Bu alanlar için veritabanı güncellemesi (migration 15) henüz uygulanmadı.' },
          { status: 503 }
        )
      }
      ;({ data, error } = await runUpdate(ORG_PROFILE_COLUMNS_BASE))
    }

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'Bu site adresi başka bir işletme tarafından kullanılıyor.', code: 'SLUG_TAKEN' }, { status: 409 })
      }
      throw error
    }

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

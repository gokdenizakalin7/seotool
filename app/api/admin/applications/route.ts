import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError } from '@/lib/server/admin/http'
import { normalizeOrgStatus } from '@/lib/org-status'
import { foldTurkish } from '@/lib/catalog-match'
import type { AdminApplication } from '@/lib/admin-types'

/**
 * GET /api/admin/applications?status=pending|rejected|all&q=
 * Kayıt başvuruları: /signup'tan kaydolup onay bekleyen (pending) ve reddedilen (rejected) işletmeler,
 * kayıt formu + kurulum sihirbazında toplanan tüm bilgilerle. ?summary=1 yalnızca sayımları döner (menü rozeti).
 * Onay / red: PATCH /api/admin/organizations/[id]/status { status: 'active' | 'rejected', reason }
 */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'applications list', async () => {
    const params = request.nextUrl.searchParams
    const status = params.get('status') || 'pending'
    const q = foldTurkish((params.get('q') || '').trim())
    const summary = params.get('summary') === '1'

    const { data, error } = await supabaseAdmin.rpc('admin_signup_applications')
    if (error) {
      console.error('admin_signup_applications:', error)
      return jsonError(500, 'Başvurular okunamadı. Migration 16 çalıştırıldı mı?', 'DB')
    }

    let rows: AdminApplication[] = (data || []).map(mapApplicationRow)
    const counts = {
      pending: rows.filter((r) => r.status === 'pending').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
    }
    if (summary) return NextResponse.json({ counts })

    if (status === 'pending' || status === 'rejected') rows = rows.filter((r) => r.status === status)
    if (q) {
      rows = rows.filter((r) =>
        [r.name, r.subdomain, r.ownerName, r.owner?.email, r.ownerPhone, r.businessPhone, r.city]
          .filter(Boolean)
          .some((v) => foldTurkish(String(v)).includes(q))
      )
    }
    return NextResponse.json({ applications: rows, counts })
  })
}

function mapApplicationRow(r: any): AdminApplication {
  return {
    id: r.id,
    name: r.name || '',
    subdomain: r.subdomain || '',
    status: normalizeOrgStatus(r.status),
    statusReason: r.status_reason || '',
    statusChangedAt: r.status_changed_at || null,
    createdAt: r.created_at,
    onboardingStep: r.onboarding_step || null,
    onboardingCompleted: !!r.onboarding_completed_at,
    ownerName: r.owner_name || '',
    ownerPhone: r.owner_phone || '',
    businessType: r.business_type || null,
    businessPhone: r.business_phone || '',
    address: r.address || '',
    city: r.city || '',
    workingHours: r.working_hours || '',
    googleMapsUrl: r.google_maps_url || '',
    googleReviewUrl: r.google_review_url || '',
    instagramHandle: r.instagram_handle || '',
    whatsappNumber: r.whatsapp_number || '',
    facebookUrl: r.facebook_url || '',
    tiktokHandle: r.tiktok_handle || '',
    xHandle: r.x_handle || '',
    youtubeUrl: r.youtube_url || '',
    contactEmail: r.contact_email || '',
    websiteUrl: r.website_url || '',
    wifiName: r.wifi_name || '',
    logoUrl: r.logo_url || '',
    coverUrl: r.cover_url || '',
    primaryColor: r.primary_color || '',
    aboutText: r.about_text || '',
    owner: r.owner_user_id
      ? {
          userId: r.owner_user_id,
          email: r.owner_email || '',
          createdAt: r.owner_created_at || null,
          lastSignInAt: r.owner_last_sign_in_at || null,
          termsVersion: r.terms_version || null,
          termsAcceptedAt: r.terms_accepted_at || null,
        }
      : null,
    menuCount: r.menu_count ?? 0,
    itemCount: r.item_count ?? 0,
  }
}

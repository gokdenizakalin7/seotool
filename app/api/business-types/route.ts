import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BUSINESS_TYPES, type BusinessType } from '@/lib/business-types'

/**
 * GET /api/business-types — aktif işletme türleri (onboarding, ayarlar, herkese açık menü).
 * Tablo yoksa (migration 11 öncesi) koddaki listeye düşer.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('business_types')
    .select('slug, label, icon, hint, color, cover_image, default_template_slug')
    .eq('is_active', true)
    .order('display_order')

  const types: BusinessType[] =
    error || !data?.length
      ? BUSINESS_TYPES
      : data.map((r) => ({
          id: r.slug,
          label: r.label,
          icon: r.icon || '',
          hint: r.hint || '',
          color: r.color || '#e11d48',
          coverImage: r.cover_image || '',
          templateId: r.default_template_slug || undefined,
        }))

  return NextResponse.json(
    { businessTypes: types },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  )
}

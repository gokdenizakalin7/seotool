import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { SLUG_RE, isReservedSlug } from '@/lib/site-url'

/**
 * GET /api/organizations/slug-available?subdomain=<mevcut adres>&slug=<aday>
 * Ayarlardaki "Site adresi" alanı yazarken sorar: boş mu, ayrılmış mı, biçimi geçerli mi.
 * Adresi yalnızca sistem yöneticisi değiştirebildiği için yalnızca o sorabilir.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const subdomain = searchParams.get('subdomain') || ''
  const slug = (searchParams.get('slug') || '').trim().toLowerCase()
  if (!subdomain) return NextResponse.json({ error: 'subdomain gerekli.' }, { status: 400 })

  const access = await requireSubdomainAccess(request, subdomain, { allowSuspended: true })
  if ('response' in access) return access.response
  if (!access.user.isSuperAdmin) return NextResponse.json({ error: 'Yetkiniz yok.' }, { status: 403 })

  if (slug.length < 2 || !SLUG_RE.test(slug)) return NextResponse.json({ available: false, reason: 'invalid' })
  if (isReservedSlug(slug)) return NextResponse.json({ available: false, reason: 'reserved' })

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('subdomain', slug)
    .neq('id', access.organizationId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Kontrol edilemedi.' }, { status: 500 })
  return NextResponse.json(data ? { available: false, reason: 'taken' } : { available: true })
}

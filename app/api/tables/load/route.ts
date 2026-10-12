import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const subdomain = new URL(request.url).searchParams.get('subdomain')
    if (!subdomain) {
      return NextResponse.json({ error: 'Subdomain parameter is missing' }, { status: 400 })
    }

    // Yalnızca restoranın üyesi (veya süper admin) okuyabilir
    const access = await requireSubdomainAccess(request, subdomain, { allowSuspended: true })
    if ('response' in access) return access.response

    const { data, error } = await supabase
      .from('qr_tables')
      .select('id, name, views')
      .eq('organization_id', access.organizationId)
      .order('created_at', { ascending: true })
    if (error) throw error

    return NextResponse.json({ tables: data || [] })
  } catch (error: any) {
    console.error('Tables load error:', error)
    return NextResponse.json({ error: 'Masalar yüklenemedi.' }, { status: 500 })
  }
}

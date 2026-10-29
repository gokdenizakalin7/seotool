import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { MENU_LOAD_SELECT, menuFingerprint } from '@/lib/server/menu-fingerprint'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')

    if (!subdomain) {
      return NextResponse.json({ error: 'Missing subdomain' }, { status: 400 })
    }

    // Yalnızca restoranın üyesi (veya süper admin) okuyabilir: yayında olmayan menüler de döner
    const access = await requireSubdomainAccess(request, subdomain, { allowSuspended: true })
    if ('response' in access) return access.response
    const orgData = { id: access.organizationId }

    // Menü + kategori + ürünler tek sorguda (eskiden 3 ardışık sorguydu)
    const { data: menusData, error: menusError } = await supabase
      .from('menus')
      .select(MENU_LOAD_SELECT)
      .eq('organization_id', orgData.id)
      .order('created_at', { ascending: true })
      .order('display_order', { ascending: true, referencedTable: 'categories' })
      .order('display_order', { ascending: true, referencedTable: 'categories.items' })

    if (menusError || !menusData || menusData.length === 0) {
      return NextResponse.json({ menus: [] })
    }

    // fingerprint: eski sekme koruması (bkz. lib/server/menu-fingerprint.ts); Kaydet bunu geri gönderir
    const menusWithDetails = menusData.map((menu: any) => ({
      ...menu,
      fingerprint: menuFingerprint(menu),
      categories: (menu.categories || []).map((cat: any) => ({
        ...cat,
        items: cat.items || [],
      })),
    }))

    return NextResponse.json({ menus: menusWithDetails })
  } catch (err: any) {
    console.error("Load error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

function deviceType(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return ua ? 'desktop' : 'unknown';
}

/** Menü görüntülemesini kaydeder: aynı IP aynı restoran için 30 dakikada bir sayılır. Hata akışı bozmaz. */
async function recordView(request: Request, orgId: string, menuId: string) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`menu_view_${ip}_${orgId}`, 1, 1800).success) return;
  const ua = request.headers.get('user-agent') || '';
  if (/bot|crawl|spider|preview/i.test(ua)) return;
  const { error } = await supabaseAdmin
    .from('menu_views')
    .insert({ menu_id: menuId, organization_id: orgId, device_type: deviceType(ua) });
  if (error) console.error('menu_views insert:', error.message);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const { data: org } = await supabaseAdmin.from('organizations').select('status').eq('id', orgId).maybeSingle();
    if ((org as any)?.status === 'suspended') {
      return NextResponse.json({ error: 'Menu suspended', suspended: true }, { status: 423 });
    }

    // Yalnızca yayında olan (is_listed = true) menüleri ve aktif kategorileri/ürünleri getirir
    const { data, error } = await supabaseAdmin
      .from('menus')
      .select(`
        id, name, description, image_url, layout,
        categories (
          id, name, description, display_order, is_active,
          items (
            id, name, description, price, image_url, allergens, calories, is_available, is_featured, display_order, tags
          )
        )
      `)
      .eq('organization_id', orgId)
      .eq('is_listed', true)
      .eq('categories.is_active', true)
      .eq('categories.items.is_available', true);

    if (error) {
      console.error('Error fetching public menus:', error);
      return NextResponse.json({ error: 'Menus not found' }, { status: 404 });
    }

    if (data && data.length) await recordView(request, orgId, data[0].id);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in public menus API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

function deviceType(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return ua ? 'desktop' : 'unknown';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TableRef = { id: string | null; name: string | null };

/**
 * Menü görüntülemesini kaydeder: aynı IP aynı restoran için 30 dakikada bir sayılır. Hata akışı bozmaz.
 * Masa QR'ından gelindiyse (?tid= / ?table=) o masanın okunma sayacı da artırılır.
 */
async function recordView(ip: string, ua: string, orgId: string, menuId: string, table: TableRef) {
  if (!checkRateLimit(`menu_view_${ip}_${orgId}`, 1, 1800).success) return;
  if (/bot|crawl|spider|preview/i.test(ua)) return;
  const { error } = await supabaseAdmin
    .from('menu_views')
    .insert({ menu_id: menuId, organization_id: orgId, device_type: deviceType(ua) });
  if (error) console.error('menu_views insert:', error.message);
  if (table.id || table.name) await bumpTableViews(orgId, table);
}

/**
 * Masa sayacını artırır. Kimlikle bulunur (masa adı değişse de basılı QR sayılır); eski QR'larda adla.
 * Atomik artış migration 13'teki increment_table_views ile; migration yoksa eski değer koşullu oku-yaz.
 */
async function bumpTableViews(orgId: string, table: TableRef) {
  const { error: rpcError } = await supabaseAdmin.rpc('increment_table_views', {
    p_org_id: orgId,
    p_table_id: table.id,
    p_name: table.id ? null : table.name,
  });
  if (!rpcError) return;
  if (rpcError.code !== 'PGRST202') return console.error('increment_table_views:', rpcError.message);

  for (let attempt = 0; attempt < 3; attempt++) {
    let query = supabaseAdmin.from('qr_tables').select('id, views').eq('organization_id', orgId);
    query = table.id ? query.eq('id', table.id) : query.eq('name', table.name as string);
    const { data: row } = await query.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!row) return;
    const current = row.views || 0;
    const { data: updated, error } = await supabaseAdmin
      .from('qr_tables')
      .update({ views: current + 1 })
      .eq('id', row.id)
      .eq('views', current)
      .select('id');
    if (error) return console.error('qr_tables views:', error.message);
    if (updated && updated.length) return;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const tid = searchParams.get('tid');
    const table: TableRef = {
      id: tid && UUID_RE.test(tid) ? tid : null,
      name: (searchParams.get('table') || '').trim().slice(0, 60) || null,
    };

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
      // Müşteri ilk menüyü görür: sıra sabit olsun, kategori/ürün sırası editördekiyle aynı olsun
      .order('created_at', { ascending: true })
      .order('display_order', { ascending: true, referencedTable: 'categories' })
      .order('display_order', { ascending: true, referencedTable: 'categories.items' })
      .eq('categories.is_active', true)
      .eq('categories.items.is_available', true);

    if (error) {
      console.error('Error fetching public menus:', error);
      return NextResponse.json({ error: 'Menus not found' }, { status: 404 });
    }

    // Sayım yanıtı bekletmez: müşteri menüyü analitik yazımları bitmeden alır
    if (data && data.length) {
      const ip = getClientIp(request);
      const ua = request.headers.get('user-agent') || '';
      const menuId = data[0].id;
      after(() => recordView(ip, ua, orgId, menuId, table));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in public menus API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

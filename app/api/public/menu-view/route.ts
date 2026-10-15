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
async function recordView(ip: string, ua: string, orgId: string, table: TableRef) {
  if (!checkRateLimit(`menu_view_${ip}_${orgId}`, 1, 1800).success) return;
  if (/bot|crawl|spider|preview/i.test(ua)) return;
  // Müşterinin gördüğü menü: yayındaki ilk menü
  const { data: menu } = await supabaseAdmin
    .from('menus')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_listed', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!menu) return;
  const { error } = await supabaseAdmin
    .from('menu_views')
    .insert({ menu_id: menu.id, organization_id: orgId, device_type: deviceType(ua) });
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

/**
 * POST /api/public/menu-view — müşteri menü sayfası açıldıktan sonra sendBeacon ile gönderilir.
 * Sayım yanıtı bekletmez; JS çalıştırmayan link önizlemeleri ve botlar sayılmaz.
 */
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const orgId = typeof body?.orgId === 'string' && UUID_RE.test(body.orgId) ? body.orgId : null;
  if (!orgId) {
    return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
  }
  const table: TableRef = {
    id: typeof body.tid === 'string' && UUID_RE.test(body.tid) ? body.tid : null,
    name: (typeof body.table === 'string' ? body.table : '').trim().slice(0, 60) || null,
  };

  const ip = getClientIp(request);
  const ua = request.headers.get('user-agent') || '';
  after(() => recordView(ip, ua, orgId, table));

  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSetting } from '@/lib/server/platform-settings';

const PUBLIC_COLUMNS =
  'id, name, status, logo_url, cover_url, primary_color, currency, address, city, business_phone, wifi_name, wifi_password, business_type, instagram_handle, whatsapp_number, google_maps_url, google_review_url, working_hours';
const LEGACY_COLUMNS =
  'id, name, logo_url, cover_url, primary_color, currency, address, city, business_phone, wifi_name, wifi_password';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json({ error: 'Subdomain is required' }, { status: 400 });
    }

    // Yalnızca güvenli alanları seçiyoruz. (Migration 04 çalışmadıysa eski sütunlara düş.)
    let { data, error } = await supabaseAdmin
      .from('organizations')
      .select(PUBLIC_COLUMNS)
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (error) {
      const legacy = await supabaseAdmin
        .from('organizations')
        .select(LEGACY_COLUMNS)
        .eq('subdomain', subdomain)
        .maybeSingle();
      data = legacy.data as any;
      error = legacy.error;
    }

    if (error || !data) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Askıya alınmış restoran: yalnızca ad/logo/renk ve "hizmet dışı" mesajı
    const { status, ...rest } = data as any;
    if (status === 'suspended') {
      return NextResponse.json({
        id: rest.id,
        name: rest.name,
        logo_url: rest.logo_url,
        primary_color: rest.primary_color,
        suspended: true,
        message: await getSetting('suspended_menu_message'),
      });
    }

    return NextResponse.json(rest);
  } catch (error) {
    console.error('Error fetching public restaurant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

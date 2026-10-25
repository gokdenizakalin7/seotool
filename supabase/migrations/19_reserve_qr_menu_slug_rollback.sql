-- ============================================
-- Migration 19 geri alma: is_reserved_slug() migration 14'teki listeye döner ("qr-menu" yeniden alınabilir).
-- Uygulama kodu app/qr-menu sayfalarını taşıdığı sürece bu adı alan işletmenin sitesi açılmaz; önce kodu geri alın.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_reserved_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(coalesce(p_slug, '')) = ANY (ARRAY[
        'about', 'account', 'activate', 'admin', 'api', 'app', 'apple-icon', 'assets', 'auth', 'ayarlar',
        'blog', 'business', 'catalog', 'contact', 'dashboard', 'destek', 'etkinlikler', 'events', 'favicon',
        'fiyatlar', 'fonts', 'gizlilik', 'gorsel-kaynaklari', 'hakkimizda', 'help', 'hesap', 'icon',
        'iletisim', 'kampanyalar', 'kosullar', 'kvkk', 'login', 'logout', 'manifest', 'menu', 'null',
        'onboarding', 'opengraph-image', 'panel', 'preview', 'pricing', 'privacy', 'public', 'qr',
        'register', 'robots', 'settings', 'signup', 'site', 'sitemap', 'static', 'support', 'terms',
        'twitter-image', 'undefined', 'www', 'yardim'
    ]::text[])
$$;

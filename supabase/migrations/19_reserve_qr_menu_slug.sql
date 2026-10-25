-- ============================================
-- 19. "qr-menu" ayrılmış ad: /qr-menu/<tür> tanıtım sayfaları (app/qr-menu) işletme sitesi adresiyle çakışmasın
-- lib/site-url.ts RESERVED_SLUGS ile AYNI liste (tests/site-url.spec.ts denetler)
--
-- Ön kontrol (bu adı almış işletme var mı; varsa önce yeniden adlandırın):
--   SELECT id, name, subdomain FROM organizations WHERE subdomain = 'qr-menu';
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
        'onboarding', 'opengraph-image', 'panel', 'preview', 'pricing', 'privacy', 'public', 'qr', 'qr-menu',
        'register', 'robots', 'settings', 'signup', 'site', 'sitemap', 'static', 'support', 'terms',
        'twitter-image', 'undefined', 'www', 'yardim'
    ]::text[])
$$;

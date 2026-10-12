-- ============================================
-- Migration 11: Süper admin paneli
-- Supabase SQL Editor'de çalıştırın. Geri alma: 11_admin_panel_rollback.sql
--
--  * organizations.status (+ sebep, kim, ne zaman): "Pasif" artık gerçek ve sebepli
--  * organization_admin_meta: yalnızca adminin gördüğü not (üyeler org satırını okuyabildiği için ayrı tablo)
--  * admin_audit_log: panelden yapılan her değişiklik
--  * business_types: işletme türleri artık DB'den yönetilir (lib/business-types.ts yalnızca yedek)
--  * platform_settings: panelden değiştirilebilen platform ayarları
--  * catalog_*.admin_edited_at: import script'i admin düzenlemelerini ezmez
--  * Katalog görseli yayılımı: admin'in Storage'a yüklediği varsayılan görseller de tanınır,
--    restoranın kendi yüklediği görsel asla ezilmez
--  * menu_views.organization_id + admin RPC'leri (liste, kullanıcılar, istatistik)
-- ============================================

-- --------------------------------------------
-- 1. organizations: hesap durumu
-- --------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason     text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended'));
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- Üyeler org_update politikasıyla kendi satırlarını güncelleyebiliyor: durum sütunlarını yalnızca
-- service role (admin API) değiştirebilsin.
CREATE OR REPLACE FUNCTION public.protect_org_status_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN new;
    END IF;

    IF TG_OP = 'INSERT' THEN
        new.status := 'active';
        new.status_reason := NULL;
        new.status_changed_at := NULL;
        new.status_changed_by := NULL;
        RETURN new;
    END IF;

    IF new.status IS DISTINCT FROM old.status
       OR new.status_reason IS DISTINCT FROM old.status_reason
       OR new.status_changed_at IS DISTINCT FROM old.status_changed_at
       OR new.status_changed_by IS DISTINCT FROM old.status_changed_by THEN
        RAISE EXCEPTION 'Hesap durumu yalnızca sistem yöneticisi tarafından değiştirilebilir.';
    END IF;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_org_status ON organizations;
CREATE TRIGGER trg_protect_org_status
    BEFORE INSERT OR UPDATE ON organizations
    FOR EACH ROW EXECUTE PROCEDURE public.protect_org_status_columns();

-- --------------------------------------------
-- 2. Yalnızca adminin gördüğü restoran notu
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS organization_admin_meta (
    organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    note            text NOT NULL DEFAULT '',
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid
);
ALTER TABLE organization_admin_meta ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- 3. Denetim kaydı (yalnızca service role; politika yok)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id    uuid,
    actor_email text,
    action      text NOT NULL,
    target_type text NOT NULL,
    target_id   text,
    target_label text,
    before      jsonb,
    after       jsonb,
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- 4. İşletme türleri
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS business_types (
    slug                  text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
    label                 text NOT NULL,
    icon                  text NOT NULL DEFAULT '',
    hint                  text NOT NULL DEFAULT '',
    color                 text NOT NULL DEFAULT '#e11d48',
    cover_image           text NOT NULL DEFAULT '',
    default_template_slug text,
    display_order         integer NOT NULL DEFAULT 0,
    is_active             boolean NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_types_read" ON business_types;
CREATE POLICY "business_types_read" ON business_types FOR SELECT
    TO anon, authenticated USING (is_active = true);

INSERT INTO business_types (slug, label, icon, hint, color, cover_image, default_template_slug, display_order) VALUES
    ('cafe',       'Kafe / All Day',       '☕', 'Kahvaltı, kahve, tatlı, gün boyu menü',     '#d97706', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&h=600&fit=crop', 'kafe-bistro',       10),
    ('restaurant', 'Restoran',             '🍽️', 'Ana yemek ağırlıklı lokanta ve restoran',   '#be123c', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=600&fit=crop', 'aile-restorani',    20),
    ('kebab',      'Kebapçı / Ocakbaşı',   '🔥', 'Kebap, lahmacun, pide, meze',               '#e11d48', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=600&fit=crop', 'kebapci-ocakbasi',  30),
    ('pub',        'Pub / Bar',            '🍸', 'Kokteyl, bira, atıştırmalık',               '#7c3aed', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&h=600&fit=crop', 'bar-pub',           40),
    ('nargile',    'Nargile Kafe',         '💨', 'Nargile, çay, sıcak ve soğuk içecekler',    '#0f766e', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=600&fit=crop', 'nargile-kafe',      50),
    ('fastfood',   'Fast Food / Burger',   '🍔', 'Burger, tavuk, menü kombinasyonları',       '#ea580c', 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&h=600&fit=crop', 'burger-evi',        60),
    ('bakery',     'Pastane / Fırın',      '🥐', 'Pasta, börek, ekmek, tatlı',                '#db2777', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&h=600&fit=crop', 'pastane-firin',     70),
    ('meyhane',    'Meyhane / Balık',      '🐟', 'Meze, balık, rakı sofrası',                 '#0369a1', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=1200&h=600&fit=crop', 'meyhane',           80),
    ('other',      'Diğer',                '✨', 'Listede olmayan işletme türü',              '#e11d48', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop', NULL,                90)
ON CONFLICT (slug) DO NOTHING;

-- --------------------------------------------
-- 5. Platform ayarları
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
    key        text PRIMARY KEY,
    value      jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid
);
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO platform_settings (key, value) VALUES
    ('signup_enabled',          'true'::jsonb),
    ('image_gen_org_daily_cap', '20'::jsonb),
    ('image_gen_daily_cap',     '150'::jsonb),
    ('suspended_menu_message',  '"Bu menü geçici olarak hizmet dışıdır."'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------
-- 6. Katalog: admin düzenleme işareti
-- --------------------------------------------
ALTER TABLE catalog_categories ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz;
ALTER TABLE catalog_items      ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz;

-- --------------------------------------------
-- 7. Katalog varsayılan görseli tanıma + yayılım
--    Varsayılan görsel iki biçimde olabilir:
--      /catalog/{slug}.webp?v=...                               (repo'daki statik görsel)
--      .../menu-images/catalog/{slug}-{8 hex}.webp              (admin panelinden yüklenen)
--    Bunların dışındaki her URL restoranın kendi görselidir ve asla ezilmez.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_catalog_default_image(p_url text, p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT coalesce(p_url, '') <> '' AND (
        p_url LIKE '/catalog/' || p_slug || '.webp%'
        OR p_url ~ ('/menu-images/catalog/' || p_slug || '-[0-9a-f]{8}\.webp([?#].*)?$')
    );
$$;

CREATE OR REPLACE FUNCTION public.backfill_catalog_item_images()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n       integer;
    v_cleared integer;
BEGIN
    UPDATE items i
    SET image_url = ci.image_url, updated_at = now()
    FROM catalog_items ci
    WHERE i.catalog_item_id = ci.id
      AND ci.is_active
      AND COALESCE(ci.image_url, '') <> ''
      AND i.image_url IS DISTINCT FROM ci.image_url
      AND (COALESCE(i.image_url, '') = '' OR public.is_catalog_default_image(i.image_url, ci.slug));
    GET DIAGNOSTICS v_n = ROW_COUNT;

    UPDATE items i
    SET image_url = '', updated_at = now()
    FROM catalog_items ci
    WHERE i.catalog_item_id = ci.id
      AND COALESCE(ci.image_url, '') = ''
      AND public.is_catalog_default_image(i.image_url, ci.slug);
    GET DIAGNOSTICS v_cleared = ROW_COUNT;

    RETURN v_n + v_cleared;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_catalog_item_images() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_catalog_item_images() TO service_role;

-- Tek katalog ürünü için yayılım. Dönüş: {updated, cleared, kept_custom, linked}
CREATE OR REPLACE FUNCTION public.backfill_catalog_item_image(p_catalog_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slug    text;
    v_url     text;
    v_updated integer := 0;
    v_cleared integer := 0;
    v_kept    integer := 0;
    v_linked  integer := 0;
BEGIN
    SELECT slug, coalesce(image_url, '') INTO v_slug, v_url
    FROM catalog_items WHERE id = p_catalog_item_id;
    IF v_slug IS NULL THEN
        RETURN jsonb_build_object('updated', 0, 'cleared', 0, 'kept_custom', 0, 'linked', 0);
    END IF;

    -- Admin görseli açıkça değiştirdi: ürün pasif olsa da bağlı varsayılan görseller güncellenir
    IF v_url <> '' THEN
        UPDATE items
        SET image_url = v_url, updated_at = now()
        WHERE catalog_item_id = p_catalog_item_id
          AND image_url IS DISTINCT FROM v_url
          AND (coalesce(image_url, '') = '' OR public.is_catalog_default_image(image_url, v_slug));
        GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
        UPDATE items
        SET image_url = '', updated_at = now()
        WHERE catalog_item_id = p_catalog_item_id
          AND public.is_catalog_default_image(image_url, v_slug);
        GET DIAGNOSTICS v_cleared = ROW_COUNT;
    END IF;

    SELECT count(*),
           count(*) FILTER (WHERE coalesce(image_url, '') <> '' AND NOT public.is_catalog_default_image(image_url, v_slug))
    INTO v_linked, v_kept
    FROM items WHERE catalog_item_id = p_catalog_item_id;

    RETURN jsonb_build_object('updated', v_updated, 'cleared', v_cleared, 'kept_custom', v_kept, 'linked', v_linked);
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_catalog_item_image(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_catalog_item_image(uuid) TO service_role;

-- --------------------------------------------
-- 8. menu_views: organizasyon bazlı analitik
-- --------------------------------------------
ALTER TABLE menu_views ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_menu_views_org_created ON menu_views(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_views_created ON menu_views(created_at DESC);

-- --------------------------------------------
-- 9. Admin RPC'leri (yalnızca service role)
-- --------------------------------------------

-- Restoran listesi: sahip e-postası, son giriş, sayımlar tek sorguda
CREATE OR REPLACE FUNCTION public.admin_organizations_overview()
RETURNS TABLE (
    id                uuid,
    name              text,
    subdomain         text,
    owner_name        text,
    business_phone    text,
    city              text,
    business_type     text,
    logo_url          text,
    status            text,
    status_reason     text,
    status_changed_at timestamptz,
    created_at        timestamptz,
    onboarding_completed_at timestamptz,
    owner_user_id     uuid,
    owner_email       text,
    owner_last_sign_in_at timestamptz,
    owner_banned_until timestamptz,
    member_count      integer,
    menu_count        integer,
    listed_menu_count integer,
    item_count        integer,
    table_count       integer,
    qr_views          bigint,
    views_30d         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        o.id, o.name, o.subdomain, o.owner_name, o.business_phone, o.city, o.business_type, o.logo_url,
        o.status, o.status_reason, o.status_changed_at, o.created_at, o.onboarding_completed_at,
        owner.user_id, owner.email, owner.last_sign_in_at, owner.banned_until,
        (SELECT count(*)::int FROM organization_members m WHERE m.organization_id = o.id),
        (SELECT count(*)::int FROM menus mn WHERE mn.organization_id = o.id),
        (SELECT count(*)::int FROM menus mn WHERE mn.organization_id = o.id AND mn.is_listed),
        (SELECT count(*)::int FROM items it JOIN categories c ON c.id = it.category_id JOIN menus mn ON mn.id = c.menu_id WHERE mn.organization_id = o.id),
        (SELECT count(*)::int FROM qr_tables t WHERE t.organization_id = o.id),
        (SELECT coalesce(sum(t.views), 0)::bigint FROM qr_tables t WHERE t.organization_id = o.id),
        (SELECT count(*)::bigint FROM menu_views v WHERE v.organization_id = o.id AND v.created_at > now() - interval '30 days')
    FROM organizations o
    LEFT JOIN LATERAL (
        SELECT m.user_id, u.email::text AS email, u.last_sign_in_at, u.banned_until
        FROM organization_members m
        JOIN auth.users u ON u.id = m.user_id
        WHERE m.organization_id = o.id
        ORDER BY (m.role = 'owner') DESC, m.created_at ASC
        LIMIT 1
    ) owner ON true
    ORDER BY o.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_organizations_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_organizations_overview() TO service_role;

-- Kullanıcı listesi: üyelikleriyle birlikte
CREATE OR REPLACE FUNCTION public.admin_users_overview()
RETURNS TABLE (
    id                 uuid,
    email              text,
    created_at         timestamptz,
    last_sign_in_at    timestamptz,
    email_confirmed_at timestamptz,
    banned_until       timestamptz,
    owner_name         text,
    must_change_password boolean,
    memberships        jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
        coalesce(u.raw_user_meta_data->>'owner_name', ''),
        coalesce((u.raw_user_meta_data->>'must_change_password')::boolean, false),
        coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'organization_id', o.id, 'name', o.name, 'subdomain', o.subdomain,
                'role', m.role, 'status', o.status
            ) ORDER BY m.created_at)
            FROM organization_members m JOIN organizations o ON o.id = m.organization_id
            WHERE m.user_id = u.id
        ), '[]'::jsonb)
    FROM auth.users u
    ORDER BY u.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_users_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_overview() TO service_role;

-- Bir restoranın üyeleri (e-posta ve giriş bilgileriyle)
CREATE OR REPLACE FUNCTION public.admin_organization_members(p_org_id uuid)
RETURNS TABLE (
    user_id         uuid,
    email           text,
    role            text,
    joined_at       timestamptz,
    last_sign_in_at timestamptz,
    banned_until    timestamptz,
    owner_name      text,
    must_change_password boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT m.user_id, u.email::text, m.role, m.created_at, u.last_sign_in_at, u.banned_until,
           coalesce(u.raw_user_meta_data->>'owner_name', ''),
           coalesce((u.raw_user_meta_data->>'must_change_password')::boolean, false)
    FROM organization_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = p_org_id
    ORDER BY (m.role = 'owner') DESC, m.created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.admin_organization_members(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_organization_members(uuid) TO service_role;

-- Platform istatistikleri
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT jsonb_build_object(
        'organizations',        (SELECT count(*) FROM organizations),
        'organizations_active', (SELECT count(*) FROM organizations WHERE status = 'active'),
        'organizations_suspended', (SELECT count(*) FROM organizations WHERE status = 'suspended'),
        'organizations_onboarded', (SELECT count(*) FROM organizations WHERE onboarding_completed_at IS NOT NULL),
        'users',                (SELECT count(*) FROM auth.users),
        'users_banned',         (SELECT count(*) FROM auth.users WHERE banned_until > now()),
        'menus',                (SELECT count(*) FROM menus),
        'menus_listed',         (SELECT count(*) FROM menus WHERE is_listed),
        'items',                (SELECT count(*) FROM items),
        'items_with_catalog',   (SELECT count(*) FROM items WHERE catalog_item_id IS NOT NULL),
        'tables',               (SELECT count(*) FROM qr_tables),
        'qr_views',             (SELECT coalesce(sum(views), 0) FROM qr_tables),
        'views_30d',            (SELECT count(*) FROM menu_views WHERE created_at > now() - interval '30 days'),
        'catalog_items',        (SELECT count(*) FROM catalog_items),
        'catalog_items_active', (SELECT count(*) FROM catalog_items WHERE is_active),
        'catalog_items_with_image', (SELECT count(*) FROM catalog_items WHERE coalesce(image_url, '') <> ''),
        'catalog_categories',   (SELECT count(*) FROM catalog_categories),
        'templates',            (SELECT count(*) FROM menu_templates),
        'views_by_device', coalesce((
            SELECT jsonb_object_agg(d, c) FROM (
                SELECT coalesce(nullif(device_type, ''), 'unknown') AS d, count(*) AS c
                FROM menu_views WHERE created_at > now() - interval '30 days'
                GROUP BY 1
            ) s
        ), '{}'::jsonb),
        'views_daily', coalesce((
            SELECT jsonb_agg(jsonb_build_object('day', day, 'count', c) ORDER BY day) FROM (
                SELECT g::date AS day,
                       (SELECT count(*) FROM menu_views v
                        WHERE v.created_at >= g AND v.created_at < g + interval '1 day') AS c
                FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') g
            ) s
        ), '[]'::jsonb),
        'signups_weekly', coalesce((
            SELECT jsonb_agg(jsonb_build_object('week', week, 'count', c) ORDER BY week) FROM (
                SELECT date_trunc('week', created_at)::date AS week, count(*) AS c
                FROM organizations WHERE created_at > now() - interval '12 weeks'
                GROUP BY 1
            ) s
        ), '[]'::jsonb)
    );
$$;
REVOKE ALL ON FUNCTION public.admin_platform_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO service_role;

-- Katalog ürünlerinin kaç restoran ürününe bağlı olduğu
CREATE OR REPLACE FUNCTION public.admin_catalog_usage(p_item_ids uuid[])
RETURNS TABLE (catalog_item_id uuid, usage_count bigint, org_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT i.catalog_item_id, count(*), count(DISTINCT mn.organization_id)
    FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN menus mn ON mn.id = c.menu_id
    WHERE i.catalog_item_id = ANY(p_item_ids)
    GROUP BY i.catalog_item_id;
$$;
REVOKE ALL ON FUNCTION public.admin_catalog_usage(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_catalog_usage(uuid[]) TO service_role;

-- --------------------------------------------
-- 10. handle_new_user: admin "yeni üye" eklerken ikinci restoran açmasın
--     (skip_org_create metadata bayrağı; gövdenin geri kalanı migration 04 ile aynı)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    org_id uuid;
    raw_name text;
    base_subdomain text;
    final_subdomain text;
    counter integer := 1;
BEGIN
    -- Admin panelinden mevcut bir restorana üye olarak eklenen kullanıcı için yeni restoran açılmaz
    IF coalesce((new.raw_user_meta_data->>'skip_org_create')::boolean, false) THEN
        RETURN new;
    END IF;

    raw_name := coalesce(new.raw_user_meta_data->>'business_name', '');

    base_subdomain := lower(translate(raw_name, 'ğüşıöçĞÜŞİÖÇ', 'gusiocGUSIOC'));
    base_subdomain := regexp_replace(base_subdomain, '[^a-z0-9]+', '-', 'g');
    base_subdomain := trim(both '-' from base_subdomain);
    base_subdomain := left(base_subdomain, 40);

    IF base_subdomain IS NULL OR base_subdomain = '' THEN
        base_subdomain := 'restoran-' || substr(new.id::text, 1, 8);
    END IF;

    final_subdomain := base_subdomain;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE subdomain = final_subdomain) LOOP
        final_subdomain := base_subdomain || '-' || counter;
        counter := counter + 1;
    END LOOP;

    INSERT INTO public.organizations (name, subdomain, owner_name)
    VALUES (
        coalesce(nullif(raw_name, ''), 'Restoranım'),
        final_subdomain,
        coalesce(new.raw_user_meta_data->>'owner_name', '')
    )
    RETURNING id INTO org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, new.id, 'owner');

    RETURN new;
END;
$$;

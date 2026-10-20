-- ============================================
-- Migration 16: Kayıt başvuruları — /signup'tan kaydolan işletme, sistem yöneticisi onaylayana kadar
-- "pending" (onay bekliyor) kalır ve sitesi yayınlanmaz; reddedilen başvuru "rejected" olur (panel salt-okunur).
-- Supabase SQL Editor'de çalıştırın. Geri alma: 16_signup_applications_rollback.sql
-- ÖNCE migration 15 çalışmış olmalı.
--
--  * organizations.status: 'pending' ve 'rejected' değerleri eklenir; owner_phone (başvuru sahibinin telefonu) eklenir.
--  * handle_new_user: kayıt formundan gelen kullanıcı (raw_user_meta_data.requires_approval = true) için işletme
--    'pending' açılır; admin panelinden açılan restoranlar 'active' kalır.
--  * protect_org_status_columns / org_write_guard: reddedilen işletme de askıdaki gibi salt-okunur.
--  * admin_platform_stats: bekleyen / reddedilen sayıları.
--  * admin_signup_applications(): başvuru listesi (tüm profil alanları + sahip e-postası ve giriş bilgisi).
--  * org_is_active değişmez: yalnızca 'active' işletmenin menüsü herkese açık okunur.
-- ============================================

-- --------------------------------------------
-- 1. Durum değerleri ve başvuru sahibinin telefonu
-- --------------------------------------------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_phone text;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check
    CHECK (status IN ('active', 'suspended', 'pending', 'rejected'));

-- --------------------------------------------
-- 2. Durum sütunlarını yalnızca service role değiştirir; askıdaki VE reddedilen işletme salt-okunur
-- --------------------------------------------
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

    -- Askıdaki ya da reddedilen işletmenin üyeleri hiçbir alanı değiştiremez (panel salt-okunur)
    IF old.status IN ('suspended', 'rejected') THEN
        RAISE EXCEPTION 'Hesap değişikliğe kapalı olduğu için kaydedilemedi.' USING ERRCODE = 'P0423';
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

CREATE OR REPLACE FUNCTION public.org_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org uuid;
    v_menu uuid;
    v_cat uuid;
BEGIN
    IF coalesce(auth.role(), '') = 'service_role' OR coalesce(auth.role(), '') = '' THEN
        RETURN coalesce(new, old);
    END IF;

    IF TG_TABLE_NAME IN ('menus', 'qr_tables') THEN
        v_org := CASE WHEN TG_OP = 'DELETE' THEN old.organization_id ELSE new.organization_id END;
    ELSIF TG_TABLE_NAME = 'categories' THEN
        v_menu := CASE WHEN TG_OP = 'DELETE' THEN old.menu_id ELSE new.menu_id END;
        SELECT organization_id INTO v_org FROM menus WHERE id = v_menu;
    ELSIF TG_TABLE_NAME = 'items' THEN
        v_cat := CASE WHEN TG_OP = 'DELETE' THEN old.category_id ELSE new.category_id END;
        SELECT m.organization_id INTO v_org FROM categories c JOIN menus m ON m.id = c.menu_id WHERE c.id = v_cat;
    END IF;

    IF v_org IS NOT NULL AND EXISTS (SELECT 1 FROM organizations WHERE id = v_org AND status IN ('suspended', 'rejected')) THEN
        RAISE EXCEPTION 'Hesap değişikliğe kapalı olduğu için kaydedilemedi.' USING ERRCODE = 'P0423';
    END IF;
    RETURN coalesce(new, old);
END;
$$;

-- --------------------------------------------
-- 3. Yeni kullanıcı tetikleyicisi: kayıt formundan gelen işletme onay bekler (14 gövdesi + durum + telefon)
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
    needs_approval boolean;
BEGIN
    -- Admin panelinden mevcut bir restorana üye olarak eklenen kullanıcı için yeni restoran açılmaz
    IF coalesce((new.raw_user_meta_data->>'skip_org_create')::boolean, false) THEN
        RETURN new;
    END IF;

    raw_name := coalesce(new.raw_user_meta_data->>'business_name', '');
    -- /signup kaydı (requires_approval) onay bekler; admin panelinden açılan restoran doğrudan aktif
    needs_approval := coalesce((new.raw_user_meta_data->>'requires_approval')::boolean, false);

    base_subdomain := lower(translate(raw_name, 'ğüşıöçĞÜŞİÖÇ', 'gusiocGUSIOC'));
    base_subdomain := regexp_replace(base_subdomain, '[^a-z0-9]+', '-', 'g');
    base_subdomain := trim(both '-' from left(trim(both '-' from base_subdomain), 36));

    IF base_subdomain IS NULL OR base_subdomain = '' THEN
        base_subdomain := 'restoran-' || substr(new.id::text, 1, 8);
    END IF;

    final_subdomain := base_subdomain;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE subdomain = final_subdomain)
          OR public.is_reserved_slug(final_subdomain) LOOP
        final_subdomain := base_subdomain || '-' || counter;
        counter := counter + 1;
    END LOOP;

    INSERT INTO public.organizations (name, subdomain, owner_name, owner_phone, status, status_changed_at)
    VALUES (
        coalesce(nullif(raw_name, ''), 'Restoranım'),
        final_subdomain,
        coalesce(new.raw_user_meta_data->>'owner_name', ''),
        nullif(new.raw_user_meta_data->>'owner_phone', ''),
        CASE WHEN needs_approval THEN 'pending' ELSE 'active' END,
        CASE WHEN needs_approval THEN now() ELSE NULL END
    )
    RETURNING id INTO org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, new.id, 'owner');

    RETURN new;
END;
$$;

-- --------------------------------------------
-- 4. Platform istatistikleri: bekleyen / reddedilen başvurular (11 gövdesi + iki sayım)
-- --------------------------------------------
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
        'organizations_pending',  (SELECT count(*) FROM organizations WHERE status = 'pending'),
        'organizations_rejected', (SELECT count(*) FROM organizations WHERE status = 'rejected'),
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
                -- Günler UTC (sunucu saat dilimine bağlı kalmasın): d bir tarih, sınırlar UTC gece yarısı
                SELECT d AS day,
                       (SELECT count(*) FROM menu_views v
                        WHERE v.created_at >= (d::timestamp AT TIME ZONE 'UTC')
                          AND v.created_at < ((d + 1)::timestamp AT TIME ZONE 'UTC')) AS c
                FROM (
                    SELECT ((now() AT TIME ZONE 'UTC')::date - n) AS d FROM generate_series(0, 29) n
                ) days
            ) s
        ), '[]'::jsonb),
        'signups_weekly', coalesce((
            SELECT jsonb_agg(jsonb_build_object('week', week, 'count', c) ORDER BY week) FROM (
                SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week, count(*) AS c
                FROM organizations WHERE created_at > now() - interval '12 weeks'
                GROUP BY 1
            ) s
        ), '[]'::jsonb)
    );
$$;
REVOKE ALL ON FUNCTION public.admin_platform_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO service_role;

-- --------------------------------------------
-- 5. Başvuru listesi: kayıt formunda ve kurulum sihirbazında toplanan her alan + sahip hesabı
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_signup_applications()
RETURNS TABLE (
    id                      uuid,
    name                    text,
    subdomain               text,
    status                  text,
    status_reason           text,
    status_changed_at       timestamptz,
    created_at              timestamptz,
    onboarding_step         text,
    onboarding_completed_at timestamptz,
    owner_name              text,
    owner_phone             text,
    business_type           text,
    business_phone          text,
    address                 text,
    city                    text,
    working_hours           text,
    google_maps_url         text,
    google_review_url       text,
    instagram_handle        text,
    whatsapp_number         text,
    facebook_url            text,
    tiktok_handle           text,
    x_handle                text,
    youtube_url             text,
    contact_email           text,
    website_url             text,
    wifi_name               text,
    logo_url                text,
    cover_url               text,
    primary_color           text,
    about_text              text,
    owner_user_id           uuid,
    owner_email             text,
    owner_created_at        timestamptz,
    owner_last_sign_in_at   timestamptz,
    terms_version           text,
    terms_accepted_at       text,
    menu_count              integer,
    item_count              integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        o.id, o.name, o.subdomain, o.status, o.status_reason, o.status_changed_at, o.created_at,
        o.onboarding_step, o.onboarding_completed_at,
        o.owner_name, o.owner_phone, o.business_type, o.business_phone, o.address, o.city, o.working_hours,
        o.google_maps_url, o.google_review_url, o.instagram_handle, o.whatsapp_number,
        o.facebook_url, o.tiktok_handle, o.x_handle, o.youtube_url, o.contact_email, o.website_url,
        o.wifi_name, o.logo_url, o.cover_url, o.primary_color, o.about_text,
        owner.user_id, owner.email, owner.created_at, owner.last_sign_in_at,
        owner.terms_version, owner.terms_accepted_at,
        (SELECT count(*)::int FROM menus mn WHERE mn.organization_id = o.id),
        (SELECT count(*)::int FROM items it JOIN categories c ON c.id = it.category_id JOIN menus mn ON mn.id = c.menu_id WHERE mn.organization_id = o.id)
    FROM organizations o
    LEFT JOIN LATERAL (
        SELECT m.user_id, u.email::text AS email, u.created_at, u.last_sign_in_at,
               u.raw_user_meta_data->>'terms_version' AS terms_version,
               u.raw_user_meta_data->>'terms_accepted_at' AS terms_accepted_at
        FROM organization_members m
        JOIN auth.users u ON u.id = m.user_id
        WHERE m.organization_id = o.id
        ORDER BY (m.role = 'owner') DESC, m.created_at ASC
        LIMIT 1
    ) owner ON true
    WHERE o.status IN ('pending', 'rejected')
    ORDER BY (o.status = 'pending') DESC, o.created_at DESC, o.id;
$$;
REVOKE ALL ON FUNCTION public.admin_signup_applications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_signup_applications() TO service_role;

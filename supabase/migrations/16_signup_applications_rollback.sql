-- ============================================
-- Migration 16 geri alma
-- DİKKAT: Onay bekleyen ve reddedilen işletmeler AKTİF yapılır (siteleri yayına girer); owner_phone silinir.
-- Önce uygulama kodunu bu migration'dan önceki sürüme döndürün.
-- ============================================

DROP FUNCTION IF EXISTS public.admin_signup_applications();

-- Durum değerleri: pending/rejected → active, kısıt 11 haline döner
UPDATE organizations SET status = 'active', status_reason = NULL WHERE status IN ('pending', 'rejected');
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended'));
ALTER TABLE organizations DROP COLUMN IF EXISTS owner_phone;

-- protect_org_status_columns: 11 gövdesi
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

    IF old.status = 'suspended' THEN
        RAISE EXCEPTION 'Hesap askıya alındığı için değişiklik yapılamaz.' USING ERRCODE = 'P0423';
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

-- org_write_guard: 11 gövdesi
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

    IF v_org IS NOT NULL AND EXISTS (SELECT 1 FROM organizations WHERE id = v_org AND status = 'suspended') THEN
        RAISE EXCEPTION 'Hesap askıya alındığı için değişiklik yapılamaz.' USING ERRCODE = 'P0423';
    END IF;
    RETURN coalesce(new, old);
END;
$$;

-- handle_new_user: 14 gövdesi
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
    IF coalesce((new.raw_user_meta_data->>'skip_org_create')::boolean, false) THEN
        RETURN new;
    END IF;

    raw_name := coalesce(new.raw_user_meta_data->>'business_name', '');

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

-- admin_platform_stats: 11 gövdesi
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

-- Migration 11 geri alma

-- handle_new_user: migration 04 sürümü
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

-- Herkese açık okuma politikaları: migration 01 / mvp sürümü
DROP POLICY IF EXISTS "menus_public_select" ON menus;
CREATE POLICY "menus_public_select" ON menus FOR SELECT USING (is_listed = true);
DROP POLICY IF EXISTS "categories_public_select" ON categories;
CREATE POLICY "categories_public_select" ON categories FOR SELECT
    USING (is_active = true AND menu_id IN (SELECT id FROM menus WHERE is_listed = true));
DROP POLICY IF EXISTS "items_public_select" ON items;
CREATE POLICY "items_public_select" ON items FOR SELECT
    USING (
        is_available = true AND
        category_id IN (
            SELECT c.id FROM categories c
            JOIN menus m ON c.menu_id = m.id
            WHERE m.is_listed = true AND c.is_active = true
        )
    );
DROP FUNCTION IF EXISTS public.org_is_active(uuid);
DROP FUNCTION IF EXISTS public.admin_set_template_content(uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.admin_find_user_by_email(text);
DROP FUNCTION IF EXISTS public.admin_catalog_usage(uuid[]);
DROP FUNCTION IF EXISTS public.admin_platform_stats();
DROP FUNCTION IF EXISTS public.admin_organization_members(uuid);
DROP FUNCTION IF EXISTS public.admin_users_overview();
DROP FUNCTION IF EXISTS public.admin_organizations_overview();
DROP FUNCTION IF EXISTS public.backfill_catalog_item_image(uuid);

-- backfill_catalog_item_images: migration 10 sürümüne dön
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
      AND (COALESCE(i.image_url, '') = '' OR i.image_url LIKE '/catalog/' || ci.slug || '.webp%');
    GET DIAGNOSTICS v_n = ROW_COUNT;

    UPDATE items i
    SET image_url = '', updated_at = now()
    FROM catalog_items ci
    WHERE i.catalog_item_id = ci.id
      AND COALESCE(ci.image_url, '') = ''
      AND i.image_url LIKE '/catalog/' || ci.slug || '.webp%';
    GET DIAGNOSTICS v_cleared = ROW_COUNT;

    RETURN v_n + v_cleared;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_catalog_item_images() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_catalog_item_images() TO service_role;

DROP FUNCTION IF EXISTS public.is_catalog_default_image(text, text);

DROP INDEX IF EXISTS idx_menu_views_created;
DROP INDEX IF EXISTS idx_menu_views_org_created;
ALTER TABLE menu_views DROP COLUMN IF EXISTS organization_id;

ALTER TABLE menu_templates     DROP COLUMN IF EXISTS admin_edited_at;
ALTER TABLE catalog_items      DROP COLUMN IF EXISTS admin_edited_at;
ALTER TABLE catalog_categories DROP COLUMN IF EXISTS admin_edited_at;

DROP TABLE IF EXISTS platform_settings;
DROP TABLE IF EXISTS business_types;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS organization_admin_meta;

DROP TRIGGER IF EXISTS trg_org_write_guard ON menus;
DROP TRIGGER IF EXISTS trg_org_write_guard ON categories;
DROP TRIGGER IF EXISTS trg_org_write_guard ON items;
DROP TRIGGER IF EXISTS trg_org_write_guard ON qr_tables;
DROP FUNCTION IF EXISTS public.org_write_guard();
DROP TRIGGER IF EXISTS trg_protect_org_status ON organizations;
DROP FUNCTION IF EXISTS public.protect_org_status_columns();
DROP INDEX IF EXISTS idx_organizations_status;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations
  DROP COLUMN IF EXISTS status_changed_by,
  DROP COLUMN IF EXISTS status_changed_at,
  DROP COLUMN IF EXISTS status_reason,
  DROP COLUMN IF EXISTS status;

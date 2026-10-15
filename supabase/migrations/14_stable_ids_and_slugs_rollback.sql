-- ============================================
-- Migration 14 geri alma
--  * sync_menus_transaction 08 gövdesine döner (her kayıtta kategorileri silip yeniden ekler).
--    Not: migration 15 uygulandıysa önce 15_business_site_rollback.sql çalıştırılmalı.
--  * handle_new_user 11 gövdesine döner.
--  * Ayrılmış ad kısıtı, slug geçmişi ve is_reserved_slug kaldırılır. Migration sırasında
--    yeniden adlandırılan işletmeler ESKİ adlarına geri DÖNMEZ (gerekirse geçmiş tablosundan bakın).
-- ============================================

-- sync_menus_transaction: 08 gövdesi
CREATE OR REPLACE FUNCTION public.sync_menus_transaction(p_org_id uuid, p_menus jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_menu          jsonb;
    v_menu_id       uuid;
    v_cat           jsonb;
    v_cat_id        uuid;
    v_item          jsonb;
    v_is_new        boolean;
    v_id_map        jsonb := '{}'::jsonb;
    v_cat_map       jsonb;
    v_client_id     text;
    v_cat_client_id text;
    v_parent_client text;
    v_parent_id     uuid;
BEGIN
    FOR v_menu IN SELECT * FROM jsonb_array_elements(COALESCE(p_menus, '[]'::jsonb))
    LOOP
        v_client_id := v_menu->>'id';
        v_is_new := v_client_id IS NULL OR v_client_id LIKE 'menu-%';

        IF v_is_new THEN
            INSERT INTO menus (organization_id, name, description, image_url, is_listed, layout)
            VALUES (
                p_org_id,
                COALESCE(v_menu->>'name', 'Menü'),
                COALESCE(v_menu->>'description', ''),
                COALESCE(v_menu->>'image_url', ''),
                COALESCE((v_menu->>'is_listed')::boolean, TRUE),
                COALESCE(v_menu->>'layout', 'grid')
            ) RETURNING id INTO v_menu_id;
        ELSE
            v_menu_id := v_client_id::uuid;
            UPDATE menus
            SET name        = COALESCE(v_menu->>'name', 'Menü'),
                description = COALESCE(v_menu->>'description', ''),
                image_url   = COALESCE(v_menu->>'image_url', ''),
                is_listed   = COALESCE((v_menu->>'is_listed')::boolean, TRUE),
                layout      = COALESCE(v_menu->>'layout', 'grid'),
                updated_at  = now()
            WHERE id = v_menu_id AND organization_id = p_org_id;

            -- Başka işletmenin menüsünü silmeyi önle
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Menu % not found for organization %', v_menu_id, p_org_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;

        IF v_client_id IS NOT NULL THEN
            v_id_map := v_id_map || jsonb_build_object(v_client_id, v_menu_id::text);
        END IF;

        DELETE FROM categories WHERE menu_id = v_menu_id;
        v_cat_map := '{}'::jsonb;

        FOR v_cat IN SELECT * FROM jsonb_array_elements(COALESCE(v_menu->'categories', '[]'::jsonb))
        LOOP
            v_cat_client_id := v_cat->>'id';
            v_parent_client := NULLIF(v_cat->>'parent_id', '');
            v_parent_id := NULL;
            IF v_parent_client IS NOT NULL AND v_cat_map ? v_parent_client THEN
                v_parent_id := (v_cat_map->>v_parent_client)::uuid;
            END IF;

            INSERT INTO categories (menu_id, parent_id, name, description, icon, display_order, is_active)
            VALUES (
                v_menu_id,
                v_parent_id,
                v_cat->>'name',
                COALESCE(v_cat->>'description', ''),
                NULLIF(v_cat->>'icon', ''),
                COALESCE((v_cat->>'display_order')::integer, 0),
                COALESCE((v_cat->>'is_active')::boolean, TRUE)
            ) RETURNING id INTO v_cat_id;

            IF v_cat_client_id IS NOT NULL THEN
                v_cat_map := v_cat_map || jsonb_build_object(v_cat_client_id, v_cat_id::text);
            END IF;

            FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_cat->'items', '[]'::jsonb))
            LOOP
                INSERT INTO items (
                    category_id, name, description, price, image_url,
                    allergens, calories, tags,
                    is_available, is_featured, display_order, catalog_item_id
                ) VALUES (
                    v_cat_id,
                    v_item->>'name',
                    COALESCE(v_item->>'description', ''),
                    COALESCE(v_item->>'price', '0'),
                    COALESCE(v_item->>'image_url', ''),
                    CASE WHEN jsonb_typeof(v_item->'allergens') = 'array'
                         THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'allergens'))
                         ELSE '{}'::text[] END,
                    CASE WHEN jsonb_typeof(v_item->'calories') = 'number'
                         THEN (v_item->>'calories')::numeric::integer
                         ELSE NULL END,
                    CASE WHEN jsonb_typeof(v_item->'tags') = 'array'
                         THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'tags'))
                         ELSE '{}'::text[] END,
                    COALESCE((v_item->>'is_available')::boolean, TRUE),
                    COALESCE((v_item->>'is_featured')::boolean, FALSE),
                    COALESCE((v_item->>'display_order')::integer, 0),
                    -- Katalog bağlantısı: geçersiz/sarkık id sessizce NULL olur (FK hatası yok)
                    CASE WHEN (v_item->>'catalog_item_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         THEN (SELECT ci.id FROM catalog_items ci WHERE ci.id = (v_item->>'catalog_item_id')::uuid)
                         ELSE NULL END
                );
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN v_id_map;
END;
$$;

-- API yalnızca service role ile çağırıyor; istemcilerin doğrudan çağırmasını kapat
REVOKE ALL ON FUNCTION public.sync_menus_transaction(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_menus_transaction(uuid, jsonb) TO service_role;

-- handle_new_user: 11 gövdesi
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

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subdomain_not_reserved;
DROP TRIGGER IF EXISTS trg_org_slug_history ON public.organizations;
DROP FUNCTION IF EXISTS public.record_org_slug_change();
DROP TABLE IF EXISTS public.organization_slug_history;
DROP FUNCTION IF EXISTS public.is_reserved_slug(text);

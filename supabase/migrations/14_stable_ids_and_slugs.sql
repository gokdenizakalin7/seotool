-- ============================================
-- Migration 14: Sabit menü kimlikleri + ayrılmış işletme adları (slug)
-- Supabase SQL Editor'de çalıştırın. Geri alma: 14_stable_ids_and_slugs_rollback.sql
--
--  * sync_menus_transaction artık kategorileri silip yeniden eklemiyor: kimliği bu menüye ait olan
--    kategori/ürün GÜNCELLENİR, diğerleri eklenir, gönderilmeyenler silinir. Ürün ve kategori kimlikleri
--    kayıtlar arasında sabit kalır (kampanyalar ve fiyat planı istisnaları bu kimliklere bağlanır).
--    Dönen idMap artık menü + kategori + ürün geçici kimliklerini içerir (düz { istemciId: gerçekId }).
--  * İşletme sitesi qolay.com/<slug> adresinde yayınlandığı için panel yollarıyla (login, dashboard…)
--    çakışan adlar ayrılır; mevcut çakışan işletmeler "-isletme" ekiyle yeniden adlandırılır ve eski adları
--    organization_slug_history üzerinden yeni adrese yönlendirilir.
--
-- ÖNCE YEDEK ALIN:
--   CREATE TABLE backup_14_categories AS SELECT * FROM categories;
--   CREATE TABLE backup_14_items      AS SELECT * FROM items;
--
-- Ön kontrol (yeniden adlandırılacak işletmeler; is_reserved_slug oluşturulduktan sonra):
--   SELECT id, name, subdomain FROM organizations WHERE public.is_reserved_slug(subdomain);
-- ============================================

-- --------------------------------------------
-- 1. sync_menus_transaction: kimlik koruyan upsert
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_menus_transaction(p_org_id uuid, p_menus jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uuid_re        constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    v_menu           jsonb;
    v_menu_id        uuid;
    v_cat            jsonb;
    v_cat_id         uuid;
    v_item           jsonb;
    v_item_id        uuid;
    v_is_new         boolean;
    v_id_map         jsonb := '{}'::jsonb;
    v_cat_map        jsonb;
    v_client_id      text;
    v_cat_client_id  text;
    v_item_client_id text;
    v_parent_client  text;
    v_parent_id      uuid;
    v_kept_cats      uuid[];
    v_kept_items     uuid[];
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

            -- Başka işletmenin menüsünü değiştirmeyi önle
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Menu % not found for organization %', v_menu_id, p_org_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;

        IF v_client_id IS NOT NULL THEN
            v_id_map := v_id_map || jsonb_build_object(v_client_id, v_menu_id::text);
        END IF;

        v_cat_map    := '{}'::jsonb;
        v_kept_cats  := '{}'::uuid[];
        v_kept_items := '{}'::uuid[];

        FOR v_cat IN SELECT * FROM jsonb_array_elements(COALESCE(v_menu->'categories', '[]'::jsonb))
        LOOP
            v_cat_client_id := v_cat->>'id';
            v_cat_id := NULL;

            -- Üst kategori listede daha önce gelmiş olmalı (05/08 ile aynı kural; döngüyü önler)
            v_parent_client := NULLIF(v_cat->>'parent_id', '');
            v_parent_id := NULL;
            IF v_parent_client IS NOT NULL AND v_cat_map ? v_parent_client THEN
                v_parent_id := (v_cat_map->>v_parent_client)::uuid;
            END IF;

            -- Bu menüye ait mevcut kategori: yerinde güncelle (aynı kimlik ikinci kez gelirse yeni kayıt olur)
            IF v_cat_client_id ~* v_uuid_re THEN
                UPDATE categories
                SET parent_id     = v_parent_id,
                    name          = v_cat->>'name',
                    description   = COALESCE(v_cat->>'description', ''),
                    icon          = NULLIF(v_cat->>'icon', ''),
                    display_order = COALESCE((v_cat->>'display_order')::integer, 0),
                    is_active     = COALESCE((v_cat->>'is_active')::boolean, TRUE),
                    updated_at    = now()
                WHERE id = v_cat_client_id::uuid
                  AND menu_id = v_menu_id
                  AND NOT (id = ANY (v_kept_cats))
                RETURNING id INTO v_cat_id;
            END IF;

            IF v_cat_id IS NULL THEN
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
            END IF;

            v_kept_cats := v_kept_cats || v_cat_id;
            IF v_cat_client_id IS NOT NULL THEN
                v_cat_map := v_cat_map || jsonb_build_object(v_cat_client_id, v_cat_id::text);
                v_id_map  := v_id_map  || jsonb_build_object(v_cat_client_id, v_cat_id::text);
            END IF;

            FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_cat->'items', '[]'::jsonb))
            LOOP
                v_item_client_id := v_item->>'id';
                v_item_id := NULL;

                -- Bu menüdeki mevcut ürün: yerinde güncelle (kategori değiştirebilir)
                IF v_item_client_id ~* v_uuid_re THEN
                    UPDATE items
                    SET category_id     = v_cat_id,
                        name            = v_item->>'name',
                        description     = COALESCE(v_item->>'description', ''),
                        price           = COALESCE(v_item->>'price', '0'),
                        image_url       = COALESCE(v_item->>'image_url', ''),
                        allergens       = CASE WHEN jsonb_typeof(v_item->'allergens') = 'array'
                                               THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'allergens'))
                                               ELSE '{}'::text[] END,
                        calories        = CASE WHEN jsonb_typeof(v_item->'calories') = 'number'
                                               THEN (v_item->>'calories')::numeric::integer
                                               ELSE NULL END,
                        tags            = CASE WHEN jsonb_typeof(v_item->'tags') = 'array'
                                               THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'tags'))
                                               ELSE '{}'::text[] END,
                        is_available    = COALESCE((v_item->>'is_available')::boolean, TRUE),
                        is_featured     = COALESCE((v_item->>'is_featured')::boolean, FALSE),
                        display_order   = COALESCE((v_item->>'display_order')::integer, 0),
                        catalog_item_id = CASE WHEN (v_item->>'catalog_item_id') ~* v_uuid_re
                                               THEN (SELECT ci.id FROM catalog_items ci WHERE ci.id = (v_item->>'catalog_item_id')::uuid)
                                               ELSE NULL END,
                        updated_at      = now()
                    WHERE id = v_item_client_id::uuid
                      AND category_id IN (SELECT c.id FROM categories c WHERE c.menu_id = v_menu_id)
                      AND NOT (id = ANY (v_kept_items))
                    RETURNING id INTO v_item_id;
                END IF;

                IF v_item_id IS NULL THEN
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
                        CASE WHEN (v_item->>'catalog_item_id') ~* v_uuid_re
                             THEN (SELECT ci.id FROM catalog_items ci WHERE ci.id = (v_item->>'catalog_item_id')::uuid)
                             ELSE NULL END
                    ) RETURNING id INTO v_item_id;
                END IF;

                v_kept_items := v_kept_items || v_item_id;
                IF v_item_client_id IS NOT NULL THEN
                    v_id_map := v_id_map || jsonb_build_object(v_item_client_id, v_item_id::text);
                END IF;
            END LOOP;
        END LOOP;

        -- Gönderilmeyenleri sil: önce ürünler, sonra kategoriler. Korunan alt kategoriler ve taşınan ürünler
        -- yukarıda yeni üst/kategoriye bağlandığı için CASCADE onları silmez.
        DELETE FROM items i
         USING categories c
         WHERE i.category_id = c.id
           AND c.menu_id = v_menu_id
           AND NOT (i.id = ANY (v_kept_items));

        DELETE FROM categories
         WHERE menu_id = v_menu_id
           AND NOT (id = ANY (v_kept_cats));
    END LOOP;

    RETURN v_id_map;
END;
$$;

-- API yalnızca service role ile çağırıyor; istemcilerin doğrudan çağırmasını kapat
REVOKE ALL ON FUNCTION public.sync_menus_transaction(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_menus_transaction(uuid, jsonb) TO service_role;

-- --------------------------------------------
-- 2. Ayrılmış adlar (lib/site-url.ts RESERVED_SLUGS ile aynı liste)
-- --------------------------------------------
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

-- --------------------------------------------
-- 3. Slug geçmişi: ad değişince eski adres yeni adrese yönlendirilir (basılı QR'lar bozulmasın)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_slug_history (
    old_slug        text PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    changed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_slug_history_org ON public.organization_slug_history(organization_id);
-- Politika yok: yalnızca service role okur/yazar
ALTER TABLE public.organization_slug_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_org_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.subdomain IS DISTINCT FROM OLD.subdomain THEN
        -- Yeni ad artık canlı bir adres; geçmişte başka işletmeye yönlendiriyorsa kaldır
        DELETE FROM organization_slug_history WHERE old_slug = NEW.subdomain;
        IF coalesce(OLD.subdomain, '') <> '' THEN
            INSERT INTO organization_slug_history (old_slug, organization_id, changed_at)
            VALUES (OLD.subdomain, NEW.id, now())
            ON CONFLICT (old_slug) DO UPDATE
               SET organization_id = EXCLUDED.organization_id,
                   changed_at      = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_slug_history ON public.organizations;
CREATE TRIGGER trg_org_slug_history
    AFTER UPDATE OF subdomain ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.record_org_slug_change();

-- --------------------------------------------
-- 4. Ayrılmış ada sahip mevcut işletmeleri yeniden adlandır (eski ad geçmişe yazılır)
-- --------------------------------------------
DO $$
DECLARE
    r record;
    v_base text;
    v_candidate text;
    v_counter integer;
BEGIN
    FOR r IN SELECT id, subdomain FROM organizations WHERE public.is_reserved_slug(subdomain) LOOP
        v_base := trim(both '-' from left(r.subdomain, 32)) || '-isletme';
        v_candidate := v_base;
        v_counter := 1;
        WHILE EXISTS (SELECT 1 FROM organizations WHERE subdomain = v_candidate) LOOP
            v_candidate := v_base || '-' || v_counter;
            v_counter := v_counter + 1;
        END LOOP;
        UPDATE organizations SET subdomain = v_candidate WHERE id = r.id;
        RAISE NOTICE 'Yeniden adlandırıldı: % -> %', r.subdomain, v_candidate;
    END LOOP;
END;
$$;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subdomain_not_reserved;
ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_subdomain_not_reserved CHECK (NOT public.is_reserved_slug(subdomain));

-- --------------------------------------------
-- 5. handle_new_user: ayrılmış adları atla; önce kısalt sonra tireleri kırp (ad "-" ile bitmesin)
--    (gövdenin geri kalanı migration 11 ile aynı)
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

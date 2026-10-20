-- ============================================
-- Migration 17: Ürün bileşenleri (items.ingredients)
-- Supabase SQL Editor'de çalıştırın. Geri alma: 17_item_ingredients_rollback.sql
-- ÖNCE migration 14 çalışmış olmalı (aşağıdaki sync_menus_transaction gövdesi 14'ün kimlik koruyan upsert'i).
--
--  * Tarım ve Orman Bakanlığı düzenlemesi: menüde her ürünün ana bileşenleri yazılmalı. Tarama ve editör
--    bileşenleri string[] olarak gönderiyordu ama sütun yoktu ve RPC alanı yok sayıyordu; kayıttan sonra
--    bileşenler kayboluyor, müşteri sayfasına hiç ulaşmıyordu.
--  * Sütun text[] (allergens ve tags ile aynı tür, RPC'de aynı jsonb → text[] dönüşümü). Sıralı düz metin
--    listesi; jsonb'nin esnekliğine gerek yok ve istemci tipi (string[]) doğrudan eşleşiyor.
--  * NOT NULL DEFAULT '{}': mevcut ürünler boş listeyle dolar, okuyucular null kontrolü yapmak zorunda kalmaz.
--  * sync_menus_transaction: ürün UPDATE ve INSERT yolları ingredients'ı yazar. Gönderilmeyen ya da dizi
--    olmayan değer '{}' olur (allergens/tags ile aynı tam değiştirme kuralı).
--  * apply_catalog_template değişmez: katalog ürünlerinde bileşen yok, eklenen ürünler varsayılan '{}' alır.
--  * Uygulama kodu (lib/server/public-menu.ts) yeni sütunu açıkça seçtiği için bu migration koddan ÖNCE
--    çalıştırılmalı; aksi halde müşteri sayfasında menü boş görünür.
-- ============================================

-- --------------------------------------------
-- 1. Sütun
-- --------------------------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS ingredients text[] NOT NULL DEFAULT '{}';

-- --------------------------------------------
-- 2. sync_menus_transaction: 14 gövdesi + ingredients
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
                        ingredients     = CASE WHEN jsonb_typeof(v_item->'ingredients') = 'array'
                                               THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'ingredients'))
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
                        allergens, ingredients, calories, tags,
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
                        CASE WHEN jsonb_typeof(v_item->'ingredients') = 'array'
                             THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'ingredients'))
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

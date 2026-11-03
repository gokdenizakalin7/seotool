-- ============================================
-- Migration 21: Katalog ürünlerinde bileşenler (catalog_items.ingredients)
-- Supabase SQL Editor'de çalıştırın. Geri alma: 21_catalog_ingredients_rollback.sql
-- ÖNCE migration 17 (items.ingredients) ve 08 (apply_catalog_template'in catalog_item_id yazan gövdesi) çalışmış olmalı.
--
--  * Sorun: Bakanlık kuralı gereği her üründe bileşen yazmalı, ama katalogda bileşen alanı yoktu. Şablonla kurulan
--    her işletme (Aliyano, Şamua, 1366 Cafe) bileşensiz başlıyor; bileşenler ancak panelden AI ile dolduruluyordu.
--  * catalog_items.ingredients text[] NOT NULL DEFAULT '{}' (items.ingredients ile aynı tür ve kural).
--  * apply_catalog_template: 08 gövdesi + ingredients (şablon ürünleri bileşenleriyle kopyalanır).
--  * backfill_catalog_item_ingredients(p_item_id): kataloğa bağlı olup bileşeni BOŞ olan işletme ürünlerine katalog
--    bileşenlerini yazar. İşletmenin kendi yazdığı bileşenlere dokunmaz (görsel yayılımındaki "varsayılan korunur" kuralı).
--    Admin katalogda bileşen düzenleyince o ürün için, toplu doldurma scriptinden sonra tümü için çağrılır.
--  * Tarama (app/api/scan-menu) ve eşleştirme indeksi (lib/server/catalog-matcher.ts) bu sütunu okur; sütun yoksa
--    kod bileşensiz devam eder, bu yüzden migration ile deploy sırası serbesttir.
-- ============================================

-- --------------------------------------------
-- 1. Sütun
-- --------------------------------------------
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS ingredients text[] NOT NULL DEFAULT '{}';

-- --------------------------------------------
-- 2. Bağlı işletme ürünlerine yayma (yalnız bileşeni boş olanlara)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_catalog_item_ingredients(p_item_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n integer;
BEGIN
    UPDATE items i
    SET ingredients = ci.ingredients, updated_at = now()
    FROM catalog_items ci
    WHERE i.catalog_item_id = ci.id
      AND (p_item_id IS NULL OR ci.id = p_item_id)
      AND cardinality(ci.ingredients) > 0
      AND cardinality(i.ingredients) = 0;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_catalog_item_ingredients(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_catalog_item_ingredients(uuid) TO service_role;

-- --------------------------------------------
-- 3. apply_catalog_template: 08 gövdesi + ingredients
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_catalog_template(
    p_org_id        uuid,
    p_template_slug text,
    p_menu_id       uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tpl        menu_templates%ROWTYPE;
    v_menu_id    uuid;
    v_main       record;
    v_sub        record;
    v_main_id    uuid;
    v_cat_id     uuid;
    v_main_order integer := 0;
    v_sub_order  integer;
    v_cat_count  integer := 0;
    v_item_count integer := 0;
    v_n          integer;
BEGIN
    SELECT * INTO v_tpl FROM menu_templates WHERE slug = p_template_slug AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', p_template_slug USING ERRCODE = 'P0002';
    END IF;

    IF p_menu_id IS NULL THEN
        INSERT INTO menus (organization_id, name, description, image_url, is_listed, layout)
        VALUES (
            p_org_id,
            COALESCE(NULLIF(v_tpl.venue_type, ''), v_tpl.name) || ' Menüsü',
            COALESCE(v_tpl.tagline, ''),
            COALESCE(v_tpl.cover_image, ''),
            TRUE,
            'grid'
        ) RETURNING id INTO v_menu_id;
    ELSE
        -- Başka işletmenin menüsüne yazmayı önle
        UPDATE menus
        SET name        = COALESCE(NULLIF(v_tpl.venue_type, ''), v_tpl.name) || ' Menüsü',
            description = COALESCE(v_tpl.tagline, ''),
            image_url   = COALESCE(NULLIF(v_tpl.cover_image, ''), image_url, ''),
            updated_at  = now()
        WHERE id = p_menu_id AND organization_id = p_org_id
        RETURNING id INTO v_menu_id;

        IF v_menu_id IS NULL THEN
            RAISE EXCEPTION 'Menu % not found for organization %', p_menu_id, p_org_id
                USING ERRCODE = '42501';
        END IF;

        DELETE FROM categories WHERE menu_id = v_menu_id;  -- items/alt kategoriler CASCADE
    END IF;

    -- Şablondaki her kategori için: derinlik, seviye-2 atası, şablon içinde yaprak mı?
    CREATE TEMP TABLE _tpl_cats ON COMMIT DROP AS
    WITH RECURSIVE chain AS (
        SELECT cc.id AS leaf_id, cc.id AS cur_id, cc.parent_id AS cur_parent, 1 AS depth
        FROM catalog_categories cc
        JOIN menu_template_categories mtc ON mtc.category_id = cc.id AND mtc.template_id = v_tpl.id
        UNION ALL
        SELECT ch.leaf_id, p.id, p.parent_id, ch.depth + 1
        FROM chain ch
        JOIN catalog_categories p ON p.id = ch.cur_parent
    ),
    -- ch.depth = yaprağın kendisinden yukarı adım sayısı; kökten derinlik = en büyük adım
    stats AS (
        SELECT leaf_id, max(depth) AS total_depth FROM chain GROUP BY leaf_id
    ),
    lvl AS (
        SELECT ch.leaf_id, ch.cur_id, (s.total_depth - ch.depth + 1) AS level
        FROM chain ch JOIN stats s USING (leaf_id)
    )
    SELECT
        mtc.category_id                                        AS category_id,
        s.total_depth                                          AS depth,
        l2.cur_id                                              AS l2_id,
        mtc.display_order                                      AS display_order,
        NOT EXISTS (
            SELECT 1 FROM menu_template_categories m2
            JOIN catalog_categories c2 ON c2.id = m2.category_id
            WHERE m2.template_id = v_tpl.id AND c2.parent_id = mtc.category_id
        )                                                      AS is_tpl_leaf
    FROM menu_template_categories mtc
    JOIN stats s ON s.leaf_id = mtc.category_id
    LEFT JOIN lvl l2 ON l2.leaf_id = mtc.category_id AND l2.level = 2
    WHERE mtc.template_id = v_tpl.id AND s.total_depth >= 2;   -- kökler hariç

    -- Ana başlıklar: ürün taşıyan şablon yaprağının seviye-2 atası (veya kendisi seviye 2 ise o)
    FOR v_main IN
        SELECT cc.id AS catalog_id, cc.name, cc.icon,
               COALESCE(
                   (SELECT t.display_order FROM _tpl_cats t WHERE t.category_id = cc.id),
                   cc.display_order
               ) AS ord
        FROM catalog_categories cc
        WHERE cc.id IN (
            SELECT t.l2_id FROM _tpl_cats t
            WHERE t.is_tpl_leaf
              AND EXISTS (
                  SELECT 1 FROM menu_template_items mti
                  JOIN catalog_items ci ON ci.id = mti.item_id AND ci.is_active = true
                  WHERE mti.template_id = v_tpl.id AND ci.primary_category_id = t.category_id
              )
        )
        ORDER BY ord, cc.name
    LOOP
        v_main_order := v_main_order + 1;

        INSERT INTO categories (menu_id, parent_id, name, description, icon, display_order, is_active)
        VALUES (v_menu_id, NULL, v_main.name, '', v_main.icon, v_main_order, TRUE)
        RETURNING id INTO v_main_id;
        v_cat_count := v_cat_count + 1;

        -- Seviye-2 kategorinin kendisi yapraksa ürünler doğrudan ana başlığa
        INSERT INTO items (category_id, name, description, price, image_url,
                           allergens, ingredients, calories, tags, is_available, is_featured, display_order, catalog_item_id)
        SELECT v_main_id, ci.name, COALESCE(ci.description, ''),
               COALESCE(mti.price_override, ci.price_suggested, '0'),
               COALESCE(ci.image_url, ''),
               COALESCE(ci.allergens, '{}'), COALESCE(ci.ingredients, '{}'), ci.calories, COALESCE(ci.tags, '{}'),
               TRUE, FALSE,
               (row_number() OVER (ORDER BY mti.display_order, ci.name))::integer,
               ci.id
        FROM menu_template_items mti
        JOIN catalog_items ci ON ci.id = mti.item_id AND ci.is_active = true
        WHERE mti.template_id = v_tpl.id AND ci.primary_category_id = v_main.catalog_id;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_item_count := v_item_count + v_n;

        -- Alt başlıklar: bu ana başlığın altındaki (seviye >= 3) şablon yaprakları
        v_sub_order := 0;
        FOR v_sub IN
            SELECT cc.id AS catalog_id, cc.name, cc.icon, t.display_order AS ord
            FROM _tpl_cats t
            JOIN catalog_categories cc ON cc.id = t.category_id
            WHERE t.l2_id = v_main.catalog_id
              AND t.depth >= 3
              AND t.is_tpl_leaf
              AND EXISTS (
                  SELECT 1 FROM menu_template_items mti
                  JOIN catalog_items ci ON ci.id = mti.item_id AND ci.is_active = true
                  WHERE mti.template_id = v_tpl.id AND ci.primary_category_id = cc.id
              )
            ORDER BY t.display_order, cc.name
        LOOP
            v_sub_order := v_sub_order + 1;

            INSERT INTO categories (menu_id, parent_id, name, description, icon, display_order, is_active)
            VALUES (v_menu_id, v_main_id, v_sub.name, '', v_sub.icon, v_sub_order, TRUE)
            RETURNING id INTO v_cat_id;
            v_cat_count := v_cat_count + 1;

            INSERT INTO items (category_id, name, description, price, image_url,
                               allergens, ingredients, calories, tags, is_available, is_featured, display_order, catalog_item_id)
            SELECT v_cat_id, ci.name, COALESCE(ci.description, ''),
                   COALESCE(mti.price_override, ci.price_suggested, '0'),
                   COALESCE(ci.image_url, ''),
                   COALESCE(ci.allergens, '{}'), COALESCE(ci.ingredients, '{}'), ci.calories, COALESCE(ci.tags, '{}'),
                   TRUE, FALSE,
                   (row_number() OVER (ORDER BY mti.display_order, ci.name))::integer,
                   ci.id
            FROM menu_template_items mti
            JOIN catalog_items ci ON ci.id = mti.item_id AND ci.is_active = true
            WHERE mti.template_id = v_tpl.id AND ci.primary_category_id = v_sub.catalog_id;
            GET DIAGNOSTICS v_n = ROW_COUNT;
            v_item_count := v_item_count + v_n;
        END LOOP;
    END LOOP;

    DROP TABLE IF EXISTS _tpl_cats;

    RETURN jsonb_build_object(
        'menu_id', v_menu_id,
        'categories', v_cat_count,
        'items', v_item_count
    );
END;
$$;

-- API yalnızca service role ile çağırır (işletme yetkisi API'de doğrulanır)
REVOKE ALL ON FUNCTION public.apply_catalog_template(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

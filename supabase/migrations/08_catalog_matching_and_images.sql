-- ============================================
-- Migration 08: Katalog eşleştirme + katalog görselleri
--   * items.catalog_item_id (kataloğa geri bağlantı)
--   * catalog_item_aliases (işletme onaylarından öğrenilen takma adlar)
--   * catalog_unmatched_log + catalog_candidates view (katalogda olmayan adlar)
--   * RPC: confirm_catalog_aliases, set_catalog_item_images, backfill_catalog_item_images
--   * sync_menus_transaction ve apply_catalog_template: catalog_item_id yazar (tam gövde, 05/07'den)
-- Önkoşul: 05, 06, 07. Geri alma: 08_catalog_matching_and_images_rollback.sql
-- ============================================

-- --------------------------------------------
-- 1. items.catalog_item_id
-- --------------------------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_items_catalog_item ON items(catalog_item_id);

-- --------------------------------------------
-- 2. Öğrenilen takma adlar (yalnız service role; RLS açık, politika yok)
--    alias_norm = lib/catalog-match.ts normalizeDishName() çıktısı (uygulama hesaplar)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_item_aliases (
    alias_norm    text NOT NULL,
    item_id       uuid NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    alias         text NOT NULL,
    source        text NOT NULL DEFAULT 'confirmed' CHECK (source IN ('seed', 'confirmed')),
    confirmations integer NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (alias_norm, item_id)
);
CREATE INDEX IF NOT EXISTS idx_catalog_item_aliases_item ON catalog_item_aliases(item_id);
ALTER TABLE catalog_item_aliases ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- 3. Eşleşmeyen adlar (append-only) + kürasyon görünümü
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_unmatched_log (
    id            bigserial PRIMARY KEY,
    name          text NOT NULL,
    name_norm     text NOT NULL,
    category_name text,
    best_slug     text,
    best_score    numeric(4,3),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_unmatched_norm ON catalog_unmatched_log(name_norm);
ALTER TABLE catalog_unmatched_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW catalog_candidates WITH (security_invoker = true) AS
    SELECT name_norm,
           min(name)        AS name,
           count(*)         AS seen_count,
           max(created_at)  AS last_seen_at
    FROM catalog_unmatched_log
    GROUP BY name_norm;
REVOKE ALL ON catalog_candidates FROM PUBLIC, anon, authenticated;

-- --------------------------------------------
-- 4. RPC: takma ad onayı (çiftler çağıran tarafta tekilleştirilir)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_catalog_aliases(p_pairs jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n integer;
BEGIN
    INSERT INTO catalog_item_aliases (alias_norm, item_id, alias)
    SELECT p->>'alias_norm', (p->>'item_id')::uuid, p->>'alias'
    FROM jsonb_array_elements(COALESCE(p_pairs, '[]'::jsonb)) p
    JOIN catalog_items ci ON ci.id = (p->>'item_id')::uuid AND ci.is_active
    WHERE COALESCE(p->>'alias_norm', '') <> ''
    ON CONFLICT (alias_norm, item_id) DO UPDATE
        SET confirmations = catalog_item_aliases.confirmations + 1,
            updated_at    = now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_catalog_aliases(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_catalog_aliases(jsonb) TO service_role;

-- --------------------------------------------
-- 5. RPC: katalog görsel URL'lerini yaz ({slug, image_url}[])
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_catalog_item_images(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated integer;
    v_missing jsonb;
BEGIN
    UPDATE catalog_items ci
    SET image_url = r.image_url, updated_at = now()
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS r(slug text, image_url text)
    WHERE ci.slug = r.slug AND ci.image_url IS DISTINCT FROM r.image_url;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    SELECT COALESCE(jsonb_agg(r.slug), '[]'::jsonb) INTO v_missing
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS r(slug text, image_url text)
    WHERE NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.slug = r.slug);

    RETURN jsonb_build_object('updated', v_updated, 'missing', v_missing);
END;
$$;
REVOKE ALL ON FUNCTION public.set_catalog_item_images(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_catalog_item_images(jsonb) TO service_role;

-- --------------------------------------------
-- 6. RPC: bağlı işletme ürünlerine katalog görselini doldur
--    Kullanıcının yüklediği fotoğrafı ezmez; yalnız boş veya aynı katalog görselinin eski ?v= sürümü.
-- --------------------------------------------
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

    -- Katalog görseli kaldırıldıysa (apply.ts --clear) bağlı ürünlerdeki eski katalog URL'sini de temizle
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

-- --------------------------------------------
-- 7. sync_menus_transaction: tam gövde (05) + catalog_item_id
-- --------------------------------------------
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

-- --------------------------------------------
-- 8. apply_catalog_template: tam gövde (07) + catalog_item_id = ci.id
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
                           allergens, calories, tags, is_available, is_featured, display_order, catalog_item_id)
        SELECT v_main_id, ci.name, COALESCE(ci.description, ''),
               COALESCE(mti.price_override, ci.price_suggested, '0'),
               COALESCE(ci.image_url, ''),
               COALESCE(ci.allergens, '{}'), ci.calories, COALESCE(ci.tags, '{}'),
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
                               allergens, calories, tags, is_available, is_featured, display_order, catalog_item_id)
            SELECT v_cat_id, ci.name, COALESCE(ci.description, ''),
                   COALESCE(mti.price_override, ci.price_suggested, '0'),
                   COALESCE(ci.image_url, ''),
                   COALESCE(ci.allergens, '{}'), ci.calories, COALESCE(ci.tags, '{}'),
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
GRANT EXECUTE ON FUNCTION public.apply_catalog_template(uuid, text, uuid) TO service_role;

-- --------------------------------------------
-- 9. Tek seferlik backfill: şablondan kopyalanmış mevcut ürünler
--    (apply_catalog_template adı aynen kopyalar; katalog adları benzersiz)
-- --------------------------------------------
UPDATE items i
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE i.catalog_item_id IS NULL
  AND ci.is_active
  AND i.name = ci.name
  AND (SELECT count(*) FROM catalog_items c2 WHERE c2.name = ci.name AND c2.is_active) = 1;

-- Katalog görselleri yüklendikten sonra (scripts/catalog-images/apply.ts bunu zaten çağırır):
-- SELECT public.backfill_catalog_item_images();

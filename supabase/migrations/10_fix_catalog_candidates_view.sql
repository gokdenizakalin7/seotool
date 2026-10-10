-- 10: (a) catalog_candidates görünümü anon/authenticated'a açıktı (RLS'i owner olarak atlıyordu).
ALTER VIEW catalog_candidates SET (security_invoker = true);
REVOKE ALL ON catalog_candidates FROM PUBLIC, anon, authenticated;

-- (b) backfill_catalog_item_images: katalog görseli temizlenince bağlı ürünlerdeki eski URL de temizlenir
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

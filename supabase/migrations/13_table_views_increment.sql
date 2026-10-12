-- ============================================
-- Migration 13: Masa QR okunma sayacı için atomik artış
-- Supabase SQL Editor'de çalıştırın. Geri alma: 13_table_views_increment_rollback.sql
--
--  * increment_table_views tek UPDATE ile views = views + 1 yapar; eşzamanlı okutmalarda sayım kaybolmaz.
--  * Masa kimliğiyle (yeni QR'lar) ya da adıyla (eski basılı QR'lar) bulunur.
--  * Migration çalıştırılmasa da menü çalışır; /api/public/menus eski oku-yaz yöntemine düşer.
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_table_views(
    p_org_id   uuid,
    p_table_id uuid,
    p_name     text
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE qr_tables
       SET views = COALESCE(views, 0) + 1
     WHERE id = (
        SELECT id FROM qr_tables
         WHERE organization_id = p_org_id
           AND ((p_table_id IS NOT NULL AND id = p_table_id)
             OR (p_table_id IS NULL AND name = p_name))
         ORDER BY created_at
         LIMIT 1
     );
$$;

REVOKE ALL ON FUNCTION public.increment_table_views(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_table_views(uuid, uuid, text) TO service_role;

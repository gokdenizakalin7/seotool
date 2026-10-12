-- Migration 13 geri alma: atomik masa sayacı kaldırılır
-- (/api/public/menus eski oku-yaz yöntemiyle saymaya devam eder)

DROP FUNCTION IF EXISTS public.increment_table_views(uuid, uuid, text);

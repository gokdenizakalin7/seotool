-- ============================================
-- Migration 22 geri alma: kalıcı hız sınırı tablosu ve fonksiyonu silinir.
-- Kod fonksiyon yokken bellek içi sınıra döner; ek bir adım gerekmez.
-- ============================================

DROP FUNCTION IF EXISTS public.consume_rate_limits(jsonb);
DROP TABLE IF EXISTS public.rate_limit_hits;

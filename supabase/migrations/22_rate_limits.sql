-- ============================================
-- Migration 22: Kalıcı hız sınırı (e-posta ve hesap uçları)
-- Supabase SQL Editor'de çalıştırın. Geri alma: 22_rate_limits_rollback.sql
--
--  * Sorun: lib/rate-limiter.ts sayaçları sunucu belleğinde tutuyor. Vercel'de her sunucu örneğinin kendi sayacı
--    var ve deploy / soğuk başlangıçta sıfırlanıyor; şifre yenileme e-postası yağdırmak ya da Resend'in günlük
--    kotasını doldurmak mümkündü.
--  * rate_limit_hits: her izin verilen istek için (anahtar, zaman) satırı. Anahtarlar e-posta ve IP içermez, SHA-256
--    özetleridir (lib/server/persistent-rate-limit.ts). RLS açık ve politika yok: yalnızca service role okur/yazar.
--  * consume_rate_limits(p_rules): kurallar [{key, limit, window}] birlikte denetlenir; biri doluysa hiçbiri
--    sayılmaz ve dolu anahtar + kaç saniye sonra açılacağı döner. Aynı anahtara eşzamanlı isteklerde sayım
--    yarışmasın diye anahtar başına işlem kilidi alınır. Eski satırlar ara sıra silinir (en uzun pencere 1 gün).
--  * Kod bu fonksiyon yokken bellek içi sınıra döner; migration ile deploy sırası serbesttir.
-- ============================================

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    key        text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_key_created_idx ON public.rate_limit_hits (key, created_at DESC);
CREATE INDEX IF NOT EXISTS rate_limit_hits_created_idx ON public.rate_limit_hits (created_at);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_hits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limits(p_rules jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rule   jsonb;
    v_key    text;
    v_limit  integer;
    v_window integer;
    v_count  integer;
    v_oldest timestamptz;
BEGIN
    IF jsonb_typeof(p_rules) <> 'array' OR jsonb_array_length(p_rules) = 0 THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Kilitler anahtar sırasıyla alınır (iki istek ters sırada kilitleyip birbirini beklemesin)
    FOR v_key IN SELECT DISTINCT r->>'key' FROM jsonb_array_elements(p_rules) r ORDER BY 1 LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
    END LOOP;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules) LOOP
        v_key    := v_rule->>'key';
        v_limit  := (v_rule->>'limit')::integer;
        v_window := (v_rule->>'window')::integer;

        SELECT count(*), min(created_at) INTO v_count, v_oldest
        FROM rate_limit_hits
        WHERE key = v_key AND created_at > now() - make_interval(secs => v_window);

        IF v_count >= v_limit THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'key', v_key,
                'retry_after', greatest(1, ceil(extract(epoch FROM (v_oldest + make_interval(secs => v_window) - now())))::integer)
            );
        END IF;
    END LOOP;

    INSERT INTO rate_limit_hits (key)
    SELECT r->>'key' FROM jsonb_array_elements(p_rules) r;

    IF random() < 0.02 THEN
        DELETE FROM rate_limit_hits WHERE created_at < now() - interval '2 days';
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- API yalnızca service role ile çağırır
REVOKE ALL ON FUNCTION public.consume_rate_limits(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limits(jsonb) TO service_role;

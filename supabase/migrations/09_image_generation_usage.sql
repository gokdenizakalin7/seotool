-- ============================================
-- Migration 09: İşletmeye özel AI görsel üretimi için kalıcı günlük kota
--   scope = 'org:<uuid>' veya 'global'; gün UTC (Cloudflare ücretsiz havuzu 00:00 UTC'de sıfırlanır)
--   Kota önce düşülür, üretim başarısızsa release ile geri verilir.
-- Geri alma: 09_image_generation_usage_rollback.sql
-- ============================================

CREATE TABLE IF NOT EXISTS image_generation_usage (
    scope      text NOT NULL,
    day        date NOT NULL,
    count      integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, day)
);
ALTER TABLE image_generation_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_image_generation_quota(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'org_used',    COALESCE((SELECT count FROM image_generation_usage WHERE scope = 'org:' || p_org_id::text AND day = (now() AT TIME ZONE 'UTC')::date), 0),
        'global_used', COALESCE((SELECT count FROM image_generation_usage WHERE scope = 'global' AND day = (now() AT TIME ZONE 'UTC')::date), 0)
    );
$$;

CREATE OR REPLACE FUNCTION public.consume_image_generation_quota(p_org_id uuid, p_org_cap integer, p_global_cap integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day    date := (now() AT TIME ZONE 'UTC')::date;
    v_scope  text := 'org:' || p_org_id::text;
    v_org    integer;
    v_global integer;
BEGIN
    INSERT INTO image_generation_usage (scope, day, count) VALUES (v_scope, v_day, 0) ON CONFLICT DO NOTHING;
    INSERT INTO image_generation_usage (scope, day, count) VALUES ('global', v_day, 0) ON CONFLICT DO NOTHING;

    -- Satır kilitleri: eşzamanlı isteklerde kota aşımı olmaz
    SELECT count INTO v_org    FROM image_generation_usage WHERE scope = v_scope  AND day = v_day FOR UPDATE;
    SELECT count INTO v_global FROM image_generation_usage WHERE scope = 'global' AND day = v_day FOR UPDATE;

    IF v_org >= p_org_cap OR v_global >= p_global_cap THEN
        RETURN jsonb_build_object('allowed', false, 'org_used', v_org, 'global_used', v_global);
    END IF;

    UPDATE image_generation_usage SET count = count + 1, updated_at = now() WHERE scope = v_scope  AND day = v_day;
    UPDATE image_generation_usage SET count = count + 1, updated_at = now() WHERE scope = 'global' AND day = v_day;
    RETURN jsonb_build_object('allowed', true, 'org_used', v_org + 1, 'global_used', v_global + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_image_generation_quota(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
    UPDATE image_generation_usage SET count = GREATEST(count - 1, 0), updated_at = now()
    WHERE scope = 'org:' || p_org_id::text AND day = v_day;
    UPDATE image_generation_usage SET count = GREATEST(count - 1, 0), updated_at = now()
    WHERE scope = 'global' AND day = v_day;
END;
$$;

REVOKE ALL ON FUNCTION public.get_image_generation_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_image_generation_quota(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_image_generation_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_image_generation_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_image_generation_quota(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_image_generation_quota(uuid) TO service_role;

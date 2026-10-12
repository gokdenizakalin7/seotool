-- ============================================
-- Migration 12: Panelden açılan sistem yöneticileri
-- Supabase SQL Editor'de çalıştırın. Geri alma: 12_system_admins_rollback.sql
--
--  * Sistem yöneticisi yetkisi auth.users.raw_app_meta_data->>'role' = 'super_admin' ile tutulur
--    (yalnızca service role yazabilir). SUPER_ADMIN_EMAIL kök yönetici olarak kalır.
--  * admin_users_overview artık is_system_admin döner. Migration çalıştırılmasa da panel
--    çalışır; kullanıcı listesi bu bilgiyi restoransız hesaplar için tek tek okur.
-- ============================================

-- Dönüş tipi değiştiği için önce düşürülür
DROP FUNCTION IF EXISTS public.admin_users_overview();

CREATE OR REPLACE FUNCTION public.admin_users_overview()
RETURNS TABLE (
    id                 uuid,
    email              text,
    created_at         timestamptz,
    last_sign_in_at    timestamptz,
    email_confirmed_at timestamptz,
    banned_until       timestamptz,
    owner_name         text,
    must_change_password boolean,
    memberships        jsonb,
    is_system_admin    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
        coalesce(u.raw_user_meta_data->>'owner_name', ''),
        coalesce((u.raw_user_meta_data->>'must_change_password')::boolean, false),
        coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'organization_id', o.id, 'name', o.name, 'subdomain', o.subdomain,
                'role', m.role, 'status', o.status
            ) ORDER BY m.created_at)
            FROM organization_members m JOIN organizations o ON o.id = m.organization_id
            WHERE m.user_id = u.id
        ), '[]'::jsonb),
        coalesce(u.raw_app_meta_data->>'role', '') = 'super_admin'
    FROM auth.users u
    ORDER BY u.created_at DESC, u.id;
$$;
REVOKE ALL ON FUNCTION public.admin_users_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_overview() TO service_role;

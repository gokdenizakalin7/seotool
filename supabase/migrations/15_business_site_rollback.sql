-- ============================================
-- Migration 15 geri alma
-- DİKKAT: Etkinlikler, kampanyalar, fiyat planları ve işletmelerin iletişim / hakkımızda alanları SİLİNİR.
-- Önce uygulama kodunu bu migration'dan önceki sürüme döndürün (yeni sütunları seçen kod giriş akışını bozar).
-- ============================================

ALTER TABLE organizations DROP COLUMN IF EXISTS active_price_plan_id;

DROP TABLE IF EXISTS public.events;
DROP TABLE IF EXISTS public.campaign_items;
DROP TABLE IF EXISTS public.campaigns;
DROP TABLE IF EXISTS public.price_plan_item_overrides;
DROP TABLE IF EXISTS public.price_plans;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_price_mode_check;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_about_source_check;

ALTER TABLE organizations
    DROP COLUMN IF EXISTS price_manual_until,
    DROP COLUMN IF EXISTS price_mode,
    DROP COLUMN IF EXISTS youtube_url,
    DROP COLUMN IF EXISTS x_handle,
    DROP COLUMN IF EXISTS tiktok_handle,
    DROP COLUMN IF EXISTS facebook_url,
    DROP COLUMN IF EXISTS website_url,
    DROP COLUMN IF EXISTS contact_email,
    DROP COLUMN IF EXISTS about_source,
    DROP COLUMN IF EXISTS about_text;

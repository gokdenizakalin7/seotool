-- ============================================
-- Migration 18 geri alma
-- DİKKAT: Kampanya türü, ürün bazında kampanya fiyatları ve gün/saat takvimleri SİLİNİR. İndirimli ürün
-- kampanyaları paket olarak kalır (fiyatı en düşük ürün fiyatı); geri almadan önce bunları silin ya da düzenleyin.
-- Önce uygulama kodunu bu migration'dan önceki sürüme döndürün (lib/server/site-data.ts sütunları seçiyor;
-- kod geri alınmadan çalıştırılırsa müşteri menüsünde kampanyalar görünmez).
-- ============================================

ALTER TABLE public.campaign_items DROP CONSTRAINT IF EXISTS campaign_items_price_check;
ALTER TABLE public.campaign_items DROP COLUMN IF EXISTS price;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_schedule_check;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_kind_check;
ALTER TABLE public.campaigns
    DROP COLUMN IF EXISTS schedule,
    DROP COLUMN IF EXISTS kind;

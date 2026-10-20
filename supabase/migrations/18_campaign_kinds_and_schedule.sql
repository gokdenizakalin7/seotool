-- ============================================
-- Migration 18: Kampanya türü (paket / indirimli ürünler) ve haftalık gün/saat takvimi
-- Supabase SQL Editor'de çalıştırın. Geri alma: 18_campaign_kinds_and_schedule_rollback.sql
-- ÖNCE migration 15 çalışmış olmalı.
--
--  * Kampanyalar yalnızca paketti ("Bira + Patates 170 ₺"): seçilen ürünlerin toplamı tek fiyata.
--    "Tuborg ve Efes 165 ₺" gibi her ürünün ayrı ayrı indirimli satıldığı kampanya kurulamıyordu; iki ürün
--    seçilince indirim ikisinin toplamı üzerinden gösteriliyordu.
--  * campaigns.kind: 'bundle' (paket, mevcut davranış) | 'per_item' (indirimli ürünler). Mevcut kayıtlar
--    'bundle' olur, davranışları değişmez.
--  * campaign_items.price: per_item'da o ürünün kampanya fiyatı (ürünlere ayrı fiyat verilebilir).
--    Paketlerde NULL; paket fiyatı campaigns.price'ta kalır. per_item'da campaigns.price = en düşük ürün
--    fiyatı (sütun NOT NULL; yalnızca sıralama/özet için).
--  * campaigns.schedule: haftalık pencereler, price_plans.schedule ile aynı biçim
--    [{ "days": [1,2,3,4,5,6,7], "start": "00:00", "end": "19:00" }]  (ISO gün: 1 = Pazartesi, İstanbul saati).
--    Boş dizi = her gün, tüm gün. 00:00–00:00 = o günün tamamı; bitiş başlangıçtan önceyse ertesi güne taşar.
--  * Yalnızca sütun ekler (varsayılanlarla); eski uygulama kodu bu migration'dan sonra da çalışır. Yeni kod
--    sütunları seçtiği için bu migration koddan ÖNCE çalıştırılmalı; aksi halde müşteri menüsünde kampanyalar
--    görünmez, panel "veritabanı güncellemesi bekleniyor" der.
-- ============================================

ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS kind     text  NOT NULL DEFAULT 'bundle',
    ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_kind_check;
ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_kind_check CHECK (kind IN ('bundle', 'per_item'));
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_schedule_check;
ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_schedule_check CHECK (jsonb_typeof(schedule) = 'array');

ALTER TABLE public.campaign_items
    ADD COLUMN IF NOT EXISTS price numeric(10, 2);

ALTER TABLE public.campaign_items DROP CONSTRAINT IF EXISTS campaign_items_price_check;
ALTER TABLE public.campaign_items
    ADD CONSTRAINT campaign_items_price_check CHECK (price IS NULL OR price >= 0);

-- ============================================
-- Migration 15: İşletme sitesi — iletişim/hakkımızda alanları, fiyat planları, kampanyalar, etkinlikler
-- Supabase SQL Editor'de çalıştırın. Geri alma: 15_business_site_rollback.sql
-- ÖNCE migration 14 çalışmış olmalı (ürün kimlikleri kayıtlar arasında sabit kalsın; kampanyalar ve
-- fiyat istisnaları items.id'ye bağlanır).
--
--  * Yeni tablolarda RLS açık ama politika yok: okuma/yazma yalnızca service role ile (API route'ları
--    ve sunucu yükleyicileri), admin_audit_log ile aynı yaklaşım.
--  * Uygulama kodu yeni sütunları seçtiği için bu migration koddan ÖNCE çalıştırılmalı.
-- ============================================

-- --------------------------------------------
-- 1. İşletme: iletişim, hakkımızda ve fiyat modu
-- --------------------------------------------
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS about_text         text,
    ADD COLUMN IF NOT EXISTS about_source       text,
    ADD COLUMN IF NOT EXISTS contact_email      text,
    ADD COLUMN IF NOT EXISTS website_url        text,
    ADD COLUMN IF NOT EXISTS facebook_url       text,
    ADD COLUMN IF NOT EXISTS tiktok_handle      text,
    ADD COLUMN IF NOT EXISTS x_handle           text,
    ADD COLUMN IF NOT EXISTS youtube_url        text,
    ADD COLUMN IF NOT EXISTS price_mode         text NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS price_manual_until timestamptz;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_about_source_check;
ALTER TABLE organizations
    ADD CONSTRAINT organizations_about_source_check CHECK (about_source IS NULL OR about_source IN ('ai', 'manual', 'template'));
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_price_mode_check;
ALTER TABLE organizations
    ADD CONSTRAINT organizations_price_mode_check CHECK (price_mode IN ('auto', 'manual'));

-- --------------------------------------------
-- 2. Fiyat planları
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_plans (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                  text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    banner_text           text,
    adjustment_type       text NOT NULL CHECK (adjustment_type IN ('percent', 'fixed')),
    -- İşaretli: +10 artış, -10 indirim
    adjustment_value      numeric(10, 2) NOT NULL,
    rounding              text NOT NULL DEFAULT 'none' CHECK (rounding IN ('none', '1', '5', '10')),
    excluded_category_ids uuid[] NOT NULL DEFAULT '{}',
    -- [{ "days": [5], "start": "20:00", "end": "02:00" }]  (ISO gün: 1 = Pazartesi)
    schedule              jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(schedule) = 'array'),
    schedule_enabled      boolean NOT NULL DEFAULT false,
    display_order         integer NOT NULL DEFAULT 0,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (adjustment_type <> 'percent' OR adjustment_value BETWEEN -90 AND 500)
);
CREATE INDEX IF NOT EXISTS idx_price_plans_org ON public.price_plans(organization_id, display_order);
ALTER TABLE public.price_plans ENABLE ROW LEVEL SECURITY;

-- Ürün bazında istisna: price NULL = bu ürüne plan uygulanmaz
CREATE TABLE IF NOT EXISTS public.price_plan_item_overrides (
    plan_id uuid NOT NULL REFERENCES price_plans(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    price   numeric(10, 2) CHECK (price IS NULL OR price >= 0),
    PRIMARY KEY (plan_id, item_id)
);
-- Menü kaydı ürün sildiğinde CASCADE bu index'i kullanır
CREATE INDEX IF NOT EXISTS idx_price_plan_overrides_item ON public.price_plan_item_overrides(item_id);
ALTER TABLE public.price_plan_item_overrides ENABLE ROW LEVEL SECURITY;

-- Elle seçilen plan (price_mode = 'manual'); plan silinirse NULL olur
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS active_price_plan_id uuid REFERENCES price_plans(id) ON DELETE SET NULL;

-- --------------------------------------------
-- 3. Kampanyalar (işletmenin kendi ürünlerinden paketler)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
    description     text NOT NULL DEFAULT '',
    price           numeric(10, 2) NOT NULL CHECK (price >= 0),
    image_url       text,
    is_active       boolean NOT NULL DEFAULT true,
    display_order   integer NOT NULL DEFAULT 0,
    valid_from      timestamptz,
    valid_until     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns(organization_id, display_order);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.campaign_items (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id   uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    -- Ürün menüden silinirse NULL olur; kampanya müşteriden gizlenir, panelde uyarı görünür
    item_id       uuid REFERENCES items(id) ON DELETE SET NULL,
    -- Kayıt anındaki ürün adı (ürün silinse de panelde ne olduğu görünsün)
    item_name     text NOT NULL,
    quantity      smallint NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
    display_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign ON public.campaign_items(campaign_id, display_order);
CREATE INDEX IF NOT EXISTS idx_campaign_items_item ON public.campaign_items(item_id);
ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- 4. Etkinlikler (canlı müzik, maç yayını…)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title           text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
    description     text NOT NULL DEFAULT '',
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz,
    repeat_weekly   boolean NOT NULL DEFAULT false,
    -- Haftalık tekrarın son günü (İstanbul takvim günü)
    repeat_until    date,
    poster_url      text,
    is_published    boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_events_org_start ON public.events(organization_id, starts_at);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

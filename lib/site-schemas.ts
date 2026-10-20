import { z } from 'zod'

/**
 * İşletme sitesi modüllerinin (fiyat planı, kampanya, etkinlik) doğrulama şemaları.
 * API route'ları ve panel formları aynı şemayı kullanır.
 */

const clean = (max: number) => z.string().transform((s) => s.replace(/[<>]/g, '').trim().slice(0, max))
const isoDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Geçersiz tarih')
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih')
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı')
/** Site görselleri: yalnızca https adresi ya da yerel katalog görseli (data: URL kabul edilmez) */
const imageUrl = z
  .string()
  .max(2048)
  .refine((s) => s.startsWith('https://') || s.startsWith('/catalog/'), 'Geçersiz görsel adresi')

export const subdomainField = z.string().trim().min(1).max(64)

/* ---------------- Fiyat planları ---------------- */

export const scheduleWindowSchema = z
  .object({
    days: z.array(z.number().int().min(1).max(7)).min(1, 'En az bir gün seçin').max(7),
    start: clock,
    end: clock,
  })
  .refine((w) => w.start !== w.end, 'Başlangıç ve bitiş saati aynı olamaz')

export const pricePlanInputSchema = z
  .object({
    subdomain: subdomainField,
    name: clean(60).pipe(z.string().min(1, 'Plan adı gerekli')),
    bannerText: clean(140).nullable().optional(),
    adjustmentType: z.enum(['percent', 'fixed']),
    adjustmentValue: z.number().finite().min(-100000).max(100000),
    rounding: z.enum(['none', '1', '5', '10']).default('none'),
    excludedCategoryIds: z.array(z.uuid()).max(300).default([]),
    schedule: z.array(scheduleWindowSchema).max(14).default([]),
    scheduleEnabled: z.boolean().default(false),
    displayOrder: z.number().int().min(0).max(10000).optional(),
    overrides: z
      .array(z.object({ itemId: z.uuid(), price: z.number().min(0).max(1_000_000).nullable() }))
      .max(2000)
      .default([]),
  })
  .refine(
    (p) => p.adjustmentType !== 'percent' || (p.adjustmentValue >= -90 && p.adjustmentValue <= 500),
    'Yüzde değişim -%90 ile +%500 arasında olmalı'
  )

export type PricePlanInput = z.infer<typeof pricePlanInputSchema>

export const priceModeSchema = z.object({
  subdomain: subdomainField,
  mode: z.enum(['auto', 'manual']),
  planId: z.uuid().nullable().optional(),
  until: isoDateTime.nullable().optional(),
})

/* ---------------- Kampanyalar ---------------- */

const campaignPrice = z.number().finite().min(0).max(1_000_000)

/** Fiyat planı penceresinden farkı: başlangıç = bitiş (00:00–00:00) o günün tamamı demek */
const campaignWindowSchema = z.object({
  days: z.array(z.number().int().min(1).max(7)).min(1, 'En az bir gün seçin').max(7),
  start: clock,
  end: clock,
})

export const campaignInputSchema = z
  .object({
    subdomain: subdomainField,
    kind: z.enum(['bundle', 'per_item']).default('bundle'),
    name: clean(80).pipe(z.string().min(2, 'Kampanya adı en az 2 karakter olmalı')),
    description: clean(300).default(''),
    /** Paket fiyatı; indirimli ürünlerde her ürünün kendi fiyatı var */
    price: campaignPrice.nullable().optional(),
    imageUrl: imageUrl.nullable().optional(),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).max(10000).optional(),
    validFrom: isoDateTime.nullable().optional(),
    validUntil: isoDateTime.nullable().optional(),
    schedule: z.array(campaignWindowSchema).max(7).default([]),
    items: z
      .array(z.object({ itemId: z.uuid(), quantity: z.number().int().min(1).max(20), price: campaignPrice.nullable().optional() }))
      .min(1, 'En az bir ürün seçin')
      .max(30, 'En fazla 30 ürün'),
  })
  .refine(
    (c) => !c.validFrom || !c.validUntil || Date.parse(c.validUntil) > Date.parse(c.validFrom),
    'Bitiş tarihi başlangıçtan sonra olmalı'
  )
  .refine((c) => c.kind !== 'bundle' || c.price != null, 'Kampanya fiyatı gerekli')
  .refine((c) => c.kind !== 'bundle' || c.items.length <= 10, 'Bir pakette en fazla 10 ürün olabilir')
  .refine((c) => c.kind !== 'per_item' || c.items.every((i) => i.price != null), 'Her ürün için kampanya fiyatı girin')

export type CampaignInput = z.infer<typeof campaignInputSchema>

/* ---------------- Etkinlikler ---------------- */

export const eventInputSchema = z
  .object({
    subdomain: subdomainField,
    title: clean(120).pipe(z.string().min(2, 'Etkinlik adı en az 2 karakter olmalı')),
    description: clean(1000).default(''),
    startsAt: isoDateTime,
    endsAt: isoDateTime.nullable().optional(),
    repeatWeekly: z.boolean().default(false),
    repeatUntil: dateOnly.nullable().optional(),
    posterUrl: imageUrl.nullable().optional(),
    isPublished: z.boolean().default(true),
  })
  .refine((e) => !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt), 'Bitiş başlangıçtan sonra olmalı')

export type EventInput = z.infer<typeof eventInputSchema>

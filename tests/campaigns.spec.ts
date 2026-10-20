import { test, expect } from '@playwright/test'
import {
  applyItemDealsToMenu,
  buildCampaignCategory,
  campaignNormalTotal,
  describeCampaignSchedule,
  campaignSavingsPercent,
  campaignStatus,
  isCampaignLive,
  suggestCampaignName,
  CAMPAIGN_CATEGORY_ID,
  type Campaign,
} from '../lib/campaigns'
import type { Menu } from '../lib/types'

const beer = { id: 'beer', name: 'Bira', price: '120 ₺', image_url: '/catalog/bira.webp', is_available: true, category_id: 'c1' }
const fries = { id: 'fries', name: 'Patates', price: '80 ₺', image_url: '', is_available: true, category_id: 'c2' }

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: 'k1',
  kind: 'bundle',
  name: 'Bira + Patates',
  description: '',
  price: 170,
  imageUrl: null,
  isActive: true,
  displayOrder: 0,
  validFrom: null,
  validUntil: null,
  schedule: [],
  items: [
    { itemId: 'beer', name: 'Bira', quantity: 1, item: beer },
    { itemId: 'fries', name: 'Patates', quantity: 1, item: fries },
  ],
  ...over,
})

test('normal toplam, avantaj ve ad önerisi', () => {
  expect(campaignNormalTotal(campaign().items, (c) => c.item?.price)).toBe(200)
  expect(campaignNormalTotal([{ itemId: 'beer', name: 'Bira', quantity: 2, item: beer }], (c) => c.item?.price)).toBe(240)
  expect(campaignNormalTotal(campaign().items, () => 'S:50/L:70')).toBeNull()
  expect(campaignSavingsPercent(170, 200)).toBe(15)
  expect(campaignSavingsPercent(200, 200)).toBeNull()
  expect(suggestCampaignName([{ name: 'Bira', quantity: 2 }, { name: 'Patates', quantity: 1 }])).toBe('2× Bira + Patates')
})

test('durum ve görünürlük', () => {
  const now = new Date('2026-10-16T12:00:00Z')
  expect(campaignStatus(campaign())).toBe('ok')
  expect(campaignStatus(campaign({ items: [{ itemId: null, name: 'Bira', quantity: 1, item: null }] }))).toBe('missing_item')
  expect(campaignStatus(campaign({ items: [{ itemId: 'beer', name: 'Bira', quantity: 1, item: { ...beer, is_available: false } }] }))).toBe(
    'unavailable_item'
  )
  expect(isCampaignLive(campaign(), now)).toBe(true)
  expect(isCampaignLive(campaign({ isActive: false }), now)).toBe(false)
  expect(isCampaignLive(campaign({ validUntil: '2026-10-15T00:00:00Z' }), now)).toBe(false)
  expect(isCampaignLive(campaign({ validFrom: '2026-10-17T00:00:00Z' }), now)).toBe(false)
})

test('menü için sözde kategori: plan uygulanmış fiyatlarla normal toplam', () => {
  const shown: Record<string, string> = { beer: '144 ₺', fries: '96 ₺' } // +%20 plan
  const cat = buildCampaignCategory([campaign(), campaign({ id: 'k2', isActive: false })], {
    priceOf: (c) => (c.item ? shown[c.item.id] : null),
  })
  expect(cat?.id).toBe(CAMPAIGN_CATEGORY_ID)
  expect(cat?.items).toHaveLength(1)
  expect(cat?.items[0]).toMatchObject({
    id: 'campaign:k1',
    price: '170 ₺',
    original_price: '240 ₺',
    image_url: '/catalog/bira.webp',
    bundle: [
      { name: 'Bira', quantity: 1 },
      { name: 'Patates', quantity: 1 },
    ],
  })
  expect(buildCampaignCategory([campaign({ isActive: false })], { priceOf: () => null })).toBeNull()
})

const tuborg = { id: 'tuborg', name: 'Tuborg', price: '200 ₺', image_url: '/catalog/tuborg.webp', is_available: true, category_id: 'biralar' }
const efes = { id: 'efes', name: 'Efes', price: '190 ₺', image_url: '', is_available: true, category_id: 'biralar' }
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

// "Haftanın her günü 19:00'a kadar Tuborg ve Efes 165 ₺"
const happyHour = (over: Partial<Campaign> = {}): Campaign =>
  campaign({
    id: 'hh',
    kind: 'per_item',
    name: 'Happy Hour',
    price: 165,
    schedule: [{ days: ALL_DAYS, start: '00:00', end: '19:00' }],
    items: [
      { itemId: 'tuborg', name: 'Tuborg', quantity: 1, price: 165, item: tuborg },
      { itemId: 'efes', name: 'Efes', quantity: 1, price: 165, item: efes },
    ],
    ...over,
  })

// 2026-10-16 Cuma; İstanbul UTC+3
const friday15 = new Date('2026-10-16T12:00:00Z')
const friday20 = new Date('2026-10-16T17:00:00Z')

test('haftalık takvim: gün ve saat (İstanbul)', () => {
  expect(isCampaignLive(happyHour(), friday15)).toBe(true)
  expect(isCampaignLive(happyHour(), friday20)).toBe(false)
  // 00:00–00:00 = seçilen günlerin tamamı
  expect(isCampaignLive(campaign({ schedule: [{ days: [5], start: '00:00', end: '00:00' }] }), friday20)).toBe(true)
  expect(isCampaignLive(campaign({ schedule: [{ days: [6, 7], start: '00:00', end: '00:00' }] }), friday15)).toBe(false)
  // Gece yarısını aşan: Perşembe 22:00–02:00 → Cuma 01:00'de açık
  expect(isCampaignLive(campaign({ schedule: [{ days: [4], start: '22:00', end: '02:00' }] }), new Date('2026-10-15T22:00:00Z'))).toBe(true)

  expect(describeCampaignSchedule([])).toBeNull()
  expect(describeCampaignSchedule([{ days: ALL_DAYS, start: '00:00', end: '19:00' }])).toBe('Her gün · 00:00–19:00')
  expect(describeCampaignSchedule([{ days: [6, 7], start: '00:00', end: '00:00' }])).toBe('Hafta sonu · tüm gün')
  expect(describeCampaignSchedule([{ days: [1, 3], start: '17:00', end: '00:00' }])).toBe('Pzt, Çar · 17:00–24:00')
})

test('indirimli ürünler: her ürün ayrı ayrı kendi kampanya fiyatıyla', () => {
  const priceOf = (c: { item?: { price: string } | null }) => c.item?.price
  const cat = buildCampaignCategory([happyHour()], { now: friday15, priceOf })
  expect(cat?.items).toHaveLength(2)
  expect(cat?.items[0]).toMatchObject({ id: 'campaign:hh:tuborg', name: 'Tuborg', price: '165 ₺', description: 'Happy Hour' })
  expect(cat?.items[1]).toMatchObject({ id: 'campaign:hh:efes', name: 'Efes', price: '165 ₺' })
  // Eski fiyat üstü çizili gösterilmez
  expect(cat?.items.map((i) => i.original_price)).toEqual([undefined, undefined])
  expect(cat?.items[0].bundle).toBeUndefined()

  // Saat dışında kategori yok
  expect(buildCampaignCategory([happyHour()], { now: friday20, priceOf })).toBeNull()

  // Tükenen ürün tek başına gizlenir, kampanya sürer; normalden pahalı olan gösterilmez
  const partial = happyHour({
    items: [
      { itemId: 'tuborg', name: 'Tuborg', quantity: 1, price: 165, item: { ...tuborg, is_available: false } },
      { itemId: 'efes', name: 'Efes', quantity: 1, price: 165, item: efes },
      { itemId: 'beer', name: 'Bira', quantity: 1, price: 130, item: beer },
    ],
  })
  expect(buildCampaignCategory([partial], { now: friday15, priceOf })?.items.map((i) => i.name)).toEqual(['Efes'])
})

test('indirimli ürünler menüdeki kendi kategorisinde de uygulanır', () => {
  const menu = {
    id: 'm',
    name: 'Menü',
    categories: [
      {
        id: 'biralar',
        name: 'Biralar',
        display_order: 0,
        is_active: true,
        items: [
          { id: 'tuborg', name: 'Tuborg', price: '200 ₺', description: '', image_url: '', display_order: 0, is_available: true },
          { id: 'efes', name: 'Efes', price: '171 ₺', original_price: '190 ₺', description: '', image_url: '', display_order: 1, is_available: true },
          { id: 'beer', name: 'Bira', price: '120 ₺', description: '', image_url: '', display_order: 2, is_available: true },
        ],
      },
    ],
  } as unknown as Menu

  const during = applyItemDealsToMenu(menu, [happyHour()], { now: friday15 })
  expect(during.categories[0].items.map((i) => [i.price, i.original_price])).toEqual([
    ['165 ₺', undefined],
    // Fiyat planının üstü çizili fiyatı da kalkar
    ['165 ₺', undefined],
    ['120 ₺', undefined],
  ])
  expect(applyItemDealsToMenu(menu, [happyHour()], { now: friday20 })).toBe(menu)
  // Plan daha ucuza indirdiyse kampanya uygulanmaz
  expect(applyItemDealsToMenu(menu, [happyHour({ items: [{ itemId: 'beer', name: 'Bira', quantity: 1, price: 130, item: beer }] })], { now: friday15 })
    .categories[0].items[2].price).toBe('120 ₺')
})

test('paketin ayrı ayrı toplamı o an indirimdeki ürünün indirimli fiyatıyla', () => {
  const bundle = campaign({
    id: 'p1',
    name: 'Tuborg + Patates',
    price: 230,
    items: [
      { itemId: 'tuborg', name: 'Tuborg', quantity: 1, item: tuborg },
      { itemId: 'fries', name: 'Patates', quantity: 1, item: fries },
    ],
  })
  const priceOf = (c: { item?: { price: string } | null }) => c.item?.price
  const items = buildCampaignCategory([bundle, happyHour()], { now: friday15, priceOf })?.items || []
  expect(items.find((i) => i.id === 'campaign:p1')?.original_price).toBe('245 ₺')
  expect(buildCampaignCategory([bundle], { now: friday15, priceOf })?.items[0].original_price).toBe('280 ₺')
})

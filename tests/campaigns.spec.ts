import { test, expect } from '@playwright/test'
import {
  buildCampaignCategory,
  campaignNormalTotal,
  campaignSavingsPercent,
  campaignStatus,
  isCampaignLive,
  suggestCampaignName,
  CAMPAIGN_CATEGORY_ID,
  type Campaign,
} from '../lib/campaigns'

const beer = { id: 'beer', name: 'Bira', price: '120 ₺', image_url: '/catalog/bira.webp', is_available: true, category_id: 'c1' }
const fries = { id: 'fries', name: 'Patates', price: '80 ₺', image_url: '', is_available: true, category_id: 'c2' }

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: 'k1',
  name: 'Bira + Patates',
  description: '',
  price: 170,
  imageUrl: null,
  isActive: true,
  displayOrder: 0,
  validFrom: null,
  validUntil: null,
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

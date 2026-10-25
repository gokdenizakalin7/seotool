import { test, expect } from '@playwright/test'
import { applyStoredImages, remapMenuIds } from '../lib/menu-ids'
import type { Menu } from '../lib/types'

test('kayıttan dönen kimlikler menüye uygulanır', () => {
  const menu = {
    id: 'menu-1',
    categories: [
      { id: 'cat-1', parent_id: null, items: [{ id: 'item-1' }, { id: 'u-keep' }] },
      { id: 'cat-2', parent_id: 'cat-1', items: [{ id: 'item-new' }] },
    ],
  } as unknown as Menu
  const out = remapMenuIds(menu, { 'menu-1': 'M', 'cat-1': 'C1', 'cat-2': 'C2', 'item-1': 'I1' })
  expect(out.id).toBe('M')
  expect(out.categories.map((c) => [c.id, c.parent_id])).toEqual([
    ['C1', null],
    ['C2', 'C1'],
  ])
  expect(out.categories[0].items.map((i) => i.id)).toEqual(['I1', 'u-keep'])
  // Haritada olmayan (kayıt sürerken eklenen) kimlik olduğu gibi kalır
  expect(out.categories[1].items[0].id).toBe('item-new')
  expect(remapMenuIds(menu, {})).toBe(menu)
})

test('Storage\'a yüklenen fotoğraf adresi yalnızca hâlâ base64 duran görselin yerine geçer', () => {
  const menu = {
    id: 'M',
    categories: [
      {
        id: 'C',
        items: [
          { id: 'I1', image_url: 'data:image/webp;base64,AAA' },
          { id: 'I2', image_url: 'data:image/webp;base64,BBB' },
          { id: 'I3', image_url: 'https://x/yeni-secilen.webp' },
        ],
      },
    ],
  } as unknown as Menu
  const out = applyStoredImages(menu, { I1: 'https://x/i1.webp', I3: 'https://x/i3.webp' })
  expect(out.categories[0].items.map((i) => i.image_url)).toEqual([
    'https://x/i1.webp',
    'data:image/webp;base64,BBB',
    // Kayıt sürerken başka fotoğraf seçildi: korunur
    'https://x/yeni-secilen.webp',
  ])
  expect(applyStoredImages(menu, {})).toBe(menu)
})

import { test, expect } from '@playwright/test'
import { remapMenuIds } from '../lib/menu-ids'
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

import { test, expect } from '@playwright/test'
import {
  buildCatalogIndex,
  categoryRoot,
  foldTurkish,
  isComboName,
  normalizeDishName,
  rankCandidates,
  searchCatalog,
  tokenSortKey,
  trigramSimilarity,
  type CatalogCategoryRow,
  type CatalogItemRow,
} from '../lib/catalog-match'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const categories: CatalogCategoryRow[] = [
  { id: 'c-root-y', parent_id: null, slug: 'yiyecekler', name: 'Yiyecekler' },
  { id: 'c-root-i', parent_id: null, slug: 'icecekler', name: 'İçecekler' },
  { id: 'c-ana', parent_id: 'c-root-y', slug: 'ana-yemekler', name: 'Ana Yemekler' },
  { id: 'c-pide', parent_id: 'c-ana', slug: 'pideler', name: 'Pideler' },
  { id: 'c-makarna', parent_id: 'c-ana', slug: 'makarnalar', name: 'Makarnalar' },
  { id: 'c-durum', parent_id: 'c-ana', slug: 'durumler', name: 'Dürümler' },
  { id: 'c-burger', parent_id: 'c-ana', slug: 'burgerler', name: 'Burgerler' },
  { id: 'c-soguk', parent_id: 'c-root-i', slug: 'soguk-icecekler', name: 'Soğuk İçecekler' },
  { id: 'c-ayran', parent_id: 'c-soguk', slug: 'ayran-ve-sutlu-icecekler', name: 'Ayran ve Sütlü İçecekler' },
  { id: 'c-soguk-cay', parent_id: 'c-soguk', slug: 'soguk-caylar', name: 'Soğuk Çaylar' },
  { id: 'c-soguk-kahve', parent_id: 'c-soguk', slug: 'soguk-kahveler', name: 'Soğuk Kahveler' },
  { id: 'c-sicak', parent_id: 'c-root-i', slug: 'sicak-icecekler', name: 'Sıcak İçecekler' },
  { id: 'c-cay', parent_id: 'c-sicak', slug: 'siyah-caylar', name: 'Siyah Çaylar' },
  { id: 'c-enerji', parent_id: 'c-soguk', slug: 'enerji-icecekleri', name: 'Enerji İçecekleri' },
  { id: 'c-corba', parent_id: 'c-root-y', slug: 'corbalar', name: 'Çorbalar' },
  { id: 'c-su', parent_id: 'c-soguk', slug: 'sular', name: 'Sular' },
]

const row = (n: number, slug: string, name: string, name_en: string, cat: string, image = true): CatalogItemRow => ({
  id: uuid(n),
  slug,
  name,
  name_en,
  image_url: image ? `/catalog/${slug}.webp?v=abcd1234` : '',
  primary_category_id: cat,
  calories: 300,
  allergens: [],
  description: '',
  display_order: n,
})

const items: CatalogItemRow[] = [
  row(1, 'kiymali-pide', 'Kıymalı Pide', 'Minced Meat Pide', 'c-pide'),
  row(2, 'kasarli-pide', 'Kaşarlı Pide', 'Cheese Pide', 'c-pide'),
  row(3, 'pesto-soslu-makarna', 'Pesto Soslu Makarna', 'Pesto Pasta', 'c-makarna'),
  row(4, 'bolonez-soslu-makarna', 'Bolonez Soslu Makarna', 'Bolognese Pasta', 'c-makarna'),
  row(5, 'tavuk-doner-durum', 'Tavuk Döner Dürüm', 'Chicken Döner Wrap', 'c-durum'),
  row(6, 'tavuk-durum', 'Tavuk Dürüm', 'Chicken Wrap', 'c-durum'),
  row(7, 'ayran', 'Ayran', 'Ayran', 'c-ayran'),
  row(8, 'cay', 'Çay', 'Turkish Tea', 'c-cay'),
  row(9, 'seftalili-soguk-cay', 'Şeftalili Soğuk Çay', 'Peach Iced Tea', 'c-soguk-cay'),
  row(10, 'iced-latte', 'Iced Latte', 'Iced Latte', 'c-soguk-kahve'),
  row(11, 'red-bull-sugarfree', 'Red Bull Sugarfree', 'Red Bull Sugarfree', 'c-enerji'),
  row(12, 'klasik-burger', 'Klasik Burger', 'Classic Burger', 'c-burger'),
  row(13, 'penne-arrabiata', 'Penne Arrabiata', 'Penne Arrabbiata', 'c-makarna'),
  row(14, 'mercimek-corbasi', 'Mercimek Çorbası', 'Red Lentil Soup', 'c-corba'),
  row(15, 'su-33-cl', 'Su 33 cl', 'Water 33 cl', 'c-su'),
  row(16, 'su-50-cl', 'Su 50 cl', 'Water 50 cl', 'c-su'),
  row(17, 'ice-tea-seftali', 'Ice Tea Şeftali', 'Peach Iced Tea', 'c-soguk-cay'),
]

const index = buildCatalogIndex(items, categories, [
  { alias_norm: 'seftali soguk cay', item_id: uuid(9), confirmations: 2 },
  { alias_norm: 'spesiyal burger', item_id: uuid(12), confirmations: 1 },
])

test.describe('normalizasyon', () => {
  test('foldTurkish: İ asla i + birleşik nokta üretmez', () => {
    expect(foldTurkish('KIYMALI PİDE')).toBe('kiymali pide')
    expect(foldTurkish('İskender')).toBe('iskender')
    expect(foldTurkish('Iced Latte')).toBe('iced latte')
    expect(foldTurkish('İ').includes('̇')).toBe(false)
  })
  test('normalizeDishName: parantez, boy, hacim ve sayılar temizlenir', () => {
    expect(normalizeDishName('KIYMALI PİDE (BÜYÜK)')).toBe('kiymali pide')
    expect(normalizeDishName('Ayran 300ml')).toBe('ayran')
    expect(normalizeDishName('Çay (Bardak)')).toBe('cay')
    expect(normalizeDishName('Büyük Boy Lahmacun')).toBe('lahmacun')
    expect(normalizeDishName('Makarna (Pesto)')).toBe('makarna pesto')
    expect(normalizeDishName('Su')).toBe('su')
    expect(normalizeDishName('Tek')).toBe('tek')
  })
  test('tokenSortKey ve isComboName', () => {
    expect(tokenSortKey('durum tavuk doner')).toBe(tokenSortKey('tavuk doner durum'))
    expect(isComboName('Döner + Ayran')).toBe(true)
    expect(isComboName('Burger Menü')).toBe(true)
    expect(isComboName('Kıymalı Pide')).toBe(false)
  })
  test('trigram benzerliği kelime sırasından bağımsız', () => {
    const a = trigramSimilarity('makarna pesto', 'pesto soslu makarna')
    expect(a).toBeGreaterThan(0.6)
    expect(trigramSimilarity('makarna pesto', 'pesto makarna')).toBe(1)
  })
  test('categoryRoot', () => {
    expect(categoryRoot('Soğuk İçecekler')).toBe('icecekler')
    expect(categoryRoot('Sıcak Mezeler')).toBe('yiyecekler')
    expect(categoryRoot('Spesiyallerimiz')).toBeNull()
  })
})

test.describe('rankCandidates', () => {
  test('tam eşleşme (boy ve hacim farkıyla) → auto', () => {
    expect(rankCandidates({ name: 'KIYMALI PİDE (BÜYÜK)', category: 'Pideler' }, index)).toMatchObject({ level: 'auto', top: { slug: 'kiymali-pide' } })
    expect(rankCandidates({ name: 'Ayran 300ml' }, index)).toMatchObject({ level: 'auto', top: { slug: 'ayran' } })
    expect(rankCandidates({ name: 'Çay (Bardak)' }, index)).toMatchObject({ level: 'auto', top: { slug: 'cay' } })
  })
  test('"Makarna (Pesto)" → pesto-soslu-makarna (dolgu kelime + kelime sırası)', () => {
    const r = rankCandidates({ name: 'Makarna (Pesto)', category: 'Makarnalar' }, index)
    expect(r.level).toBe('auto')
    expect(r.top?.slug).toBe('pesto-soslu-makarna')
  })
  test('kelime sırası farklı → token_sort auto', () => {
    const r = rankCandidates({ name: 'Dürüm Tavuk Döner' }, index)
    expect(r.level).toBe('auto')
    expect(r.top?.slug).toBe('tavuk-doner-durum')
    expect(r.top?.via).toBe('token_sort')
  })
  test('İngilizce ad name_en ile eşleşir', () => {
    expect(rankCandidates({ name: 'ICED LATTE' }, index)).toMatchObject({ level: 'auto', top: { slug: 'iced-latte' } })
  })
  test('kategori çekirdeği: "Kıymalı" @ Pideler → Kıymalı Pide', () => {
    const r = rankCandidates({ name: 'Kıymalı', category: 'Pideler' }, index)
    expect(r.level).toBe('auto')
    expect(r.top?.slug).toBe('kiymali-pide')
    expect(r.top?.via).toBe('category_core')
  })
  test('belirsiz → suggest (sahibi karar verir)', () => {
    const r = rankCandidates({ name: 'Tavuk Döner Dürüm Menü' }, index)
    expect(r.level).toBe('suggest') // combo adı en fazla suggest
    const r2 = rankCandidates({ name: 'Soğuk Çay Şeftali' }, index)
    expect(['auto', 'suggest']).toContain(r2.level)
    expect(['seftalili-soguk-cay', 'ice-tea-seftali']).toContain(r2.top?.slug)
  })
  test('alias: 2 onay → auto, 1 onay → öneri', () => {
    const r = rankCandidates({ name: 'Şeftali Soğuk Çay' }, index)
    expect(r.level).toBe('auto')
    expect(r.top?.via).toBe('alias')
    const r2 = rankCandidates({ name: 'Spesiyal Burger' }, index)
    expect(r2.level).toBe('suggest')
    expect(r2.top?.slug).toBe('klasik-burger')
  })
  test('işletme adı jetonları atılır', () => {
    const r = rankCandidates({ name: 'Medusa Tavuk Dürüm', menuName: 'Medusa Cafe' }, index)
    expect(r.top?.slug).toBe('tavuk-durum')
  })
  test('kök çatışması cezası ve eşleşme yok', () => {
    const r = rankCandidates({ name: 'Zeytinyağlı Enginar', category: 'Ana Yemekler' }, index)
    expect(r.level).toBe('none')
    expect(r.top).toBeUndefined()
    const r2 = rankCandidates({ name: 'Ayran', category: 'Ana Yemekler' }, index)
    expect(r2.level).toBe('auto') // tam eşleşmede kök cezası uygulanmaz
  })
  test('aile jetonu: "Makarna (Arrabiata)" @ Makarnalar → Penne Arrabiata', () => {
    const r = rankCandidates({ name: 'Makarna (Arrabiata)', category: 'Makarnalar' }, index)
    expect(r.level).toBe('auto')
    expect(r.top?.slug).toBe('penne-arrabiata')
  })
  test('iyelik eki kökü: "Mercimek" @ Çorbalar → Mercimek Çorbası', () => {
    const r = rankCandidates({ name: 'Mercimek', category: 'Çorbalar' }, index)
    expect(r.level).toBe('auto')
    expect(r.top?.slug).toBe('mercimek-corbasi')
  })
  test('hacim eşitliği: "Su 0,5 lt" → Su 50 cl', () => {
    expect(rankCandidates({ name: 'Su 0,5 lt' }, index).top?.slug).toBe('su-50-cl')
    expect(rankCandidates({ name: 'Su 33cl' }, index).top?.slug).toBe('su-33-cl')
  })
  test('eş anlamlı: "Soğuk Çay Şeftali" ↔ "Ice Tea Şeftali"', () => {
    const r = rankCandidates({ name: 'Şeftalili Buzlu Çay' }, index)
    expect(['ice-tea-seftali', 'seftalili-soguk-cay']).toContain(r.top?.slug)
    expect(rankCandidates({ name: 'Ice Tea Şeftali' }, index).top?.slug).toBe('ice-tea-seftali')
  })
  test('kısa adlar yalnızca tam eşleşir', () => {
    expect(rankCandidates({ name: 'Çay' }, index).level).toBe('auto')
    expect(rankCandidates({ name: 'Çayı' }, index).level).not.toBe('auto')
  })
})

test.describe('searchCatalog', () => {
  test('önek ve içerme araması', () => {
    const r = searchCatalog('pide', index, 8)
    expect(r.map((m) => m.slug)).toEqual(expect.arrayContaining(['kiymali-pide', 'kasarli-pide']))
    expect(searchCatalog('latte', index)[0]?.slug).toBe('iced-latte')
    expect(searchCatalog('x', index)).toEqual([])
  })
})

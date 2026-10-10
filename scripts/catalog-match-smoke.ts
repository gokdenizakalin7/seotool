/**
 * Eşleştirici duman testi — seed.json'dan indeks kurar (DB gerekmez), örnek adları puanlar.
 *   npm run catalog:match:smoke -- "Makarna (Pesto)|Makarnalar" "KIYMALI PİDE (BÜYÜK)|Pideler" ...
 *   (argüman yoksa yerleşik örnekler)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildCatalogIndex, rankCandidates, type CatalogCategoryRow, type CatalogItemRow } from '../lib/catalog-match'

const seedPath = process.env.SEED_FILE ? resolve(process.env.SEED_FILE) : resolve(process.cwd(), '../qr-menu-seed/dist/seed.json')
const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
  categories: { slug: string; parent: string | null; name: string }[]
  items: { slug: string; primary_category: string; name: string; name_en: string; description: string; calories: number; allergens: string[]; display_order: number }[]
}

const catId = (slug: string) => `cat:${slug}`
const categories: CatalogCategoryRow[] = seed.categories.map((c) => ({ id: catId(c.slug), parent_id: c.parent ? catId(c.parent) : null, slug: c.slug, name: c.name }))
const items: CatalogItemRow[] = seed.items.map((it, i) => ({
  id: `item:${it.slug}`,
  slug: it.slug,
  name: it.name,
  name_en: it.name_en,
  image_url: '',
  primary_category_id: catId(it.primary_category),
  calories: it.calories,
  allergens: it.allergens,
  description: it.description,
  display_order: it.display_order ?? i,
}))

const t0 = Date.now()
const index = buildCatalogIndex(items, categories)
console.log(`indeks: ${index.entries.length} ürün, ${Date.now() - t0} ms\n`)

const DEFAULTS = [
  'Makarna (Pesto)|Makarnalar',
  'KIYMALI PİDE (BÜYÜK)|Pideler',
  'Kıymalı|Pideler',
  'Dürüm Tavuk Döner|Dürümler',
  'Ayran 300ml|İçecekler',
  'Çay (Bardak)|Sıcak İçecekler',
  'Iced Latte|Soğuk Kahveler',
  'Soğuk Çay Şeftali|Soğuk İçecekler',
  'Medusa Special Burger|Burgerler',
  'Döner + Ayran|Menüler',
  'Red Bull Sugarfree|İçecekler',
  'Redbull|İçecekler',
  'Adana|Kebaplar',
  'Lahmacun Acılı|Lahmacunlar',
  'Cheesecake Limonlu|Tatlılar',
  'Su 0.5 lt|İçecekler',
  'Kola|Soğuk İçecekler',
  'Türk Kahvesi Duble|Sıcak İçecekler',
  'Künefe Kaymaklı|Tatlılar',
  'Mercimek|Çorbalar',
]
const samples = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS
const t1 = Date.now()
for (const s of samples) {
  const [name, category] = s.split('|')
  const r = rankCandidates({ name, category, menuName: 'Medusa Cafe' }, index)
  const top = r.top ? `${r.top.slug} (${r.top.score}, ${r.top.via})` : '-'
  const alt = r.candidates.slice(0, 3).map((c) => `${c.slug}:${c.score}`).join(', ')
  console.log(`${name.padEnd(28)} [${(category || '').padEnd(16)}] → ${r.level.padEnd(7)} ${top}  | ${alt}`)
}
console.log(`\n${samples.length} sorgu, ${Date.now() - t1} ms`)

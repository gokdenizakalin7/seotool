/**
 * dist/seed.json → Supabase katalog ve şablon tabloları (slug'a göre upsert).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed/import-catalog.ts [--dry-run] [--prune]
 *
 *   --dry-run   Hiç yazmaz, sayıları basar.
 *   --prune     Seed'de olmayan catalog_categories / catalog_items / menu_templates satırlarını
 *               is_active=false yapar (silmez). Admin panelinde oluşturulan/düzenlenenler hariç.
 *   --force     Admin panelinde düzenlenmiş satırları da seed'deki haliyle ezer.
 *
 * Veritabanı katalogun ana kaynağıdır: admin_edited_at dolu satırlar (admin paneli) varsayılan olarak
 * atlanır; yalnızca seed'deki yeni slug'lar eklenir ve dokunulmamış satırlar güncellenir.
 *   SEED_FILE   Varsayılan: ../dist/seed.json (seed reposunda `node scripts/build.mjs`); projede SEED_FILE verin.
 *   SEED_INCLUDE_EN=false   name_en / description_en alanlarını atlar (06 migration'ı yoksa).
 *
 * Bu dosya projeye kopyalanabilir; tek bağımlılık @supabase/supabase-js.
 * Şablon bağlantıları (menu_template_categories / menu_template_items) her şablon için
 * silinip yeniden yazılır — seed, şablonun tek doğruluk kaynağıdır.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

type SeedCategory = { slug: string; parent: string | null; name: string; name_en: string; icon: string; display_order: number };
type SeedItem = {
  slug: string; primary_category: string; name: string; name_en: string; description: string; description_en: string;
  price_suggested: string; calories: number; allergens: string[]; tags: string[]; image_url: string; display_order: number;
};
type SeedTemplate = {
  slug: string; business_type: string; name: string; tagline: string; venue_type: string; icon: string; color: string;
  cover_image: string; description: string; display_order: number;
  categories: { category: string; display_order: number }[];
  items: { item: string; display_order: number; price_override?: string }[];
};
type Seed = { categories: SeedCategory[]; items: SeedItem[]; templates: SeedTemplate[] };

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const PRUNE = args.has('--prune');
const FORCE = args.has('--force');
const INCLUDE_EN = process.env.SEED_INCLUDE_EN !== 'false';
const SEED_FILE = process.env.SEED_FILE ?? resolve(dirname(fileURLToPath(import.meta.url)), '../dist/seed.json');

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const seed: Seed = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
console.log(`${SEED_FILE}: ${seed.categories.length} kategori, ${seed.items.length} ürün, ${seed.templates.length} şablon${DRY ? ' (dry-run)' : ''}`);

const chunk = <T,>(arr: T[], n = 200): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function upsertAll<T extends { slug: string }>(table: string, rows: T[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (DRY) {
    rows.forEach((r) => ids.set(r.slug, `dry:${r.slug}`));
    return ids;
  }
  for (const part of chunk(rows)) {
    const { data, error } = await db.from(table).upsert(part, { onConflict: 'slug' }).select('id, slug');
    if (error) throw new Error(`${table} upsert: ${error.message}${/name_en|description_en/.test(error.message) ? ' — supabase/migrations/06_catalog_i18n.sql çalıştır ya da SEED_INCLUDE_EN=false ver' : ''}`);
    for (const r of data ?? []) ids.set(r.slug, r.id);
  }
  return ids;
}

/** Admin panelinde düzenlenmiş satırlar: slug → id. Sütun yoksa (migration 11 öncesi) boş. */
async function loadAdminEdited(table: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (FORCE) return out;
  const { data, error } = await db.from(table).select('id, slug').not('admin_edited_at', 'is', null);
  if (error) {
    console.warn(`${table}: admin_edited_at okunamadı (${error.message}); tüm satırlar seed'den yazılacak`);
    return out;
  }
  for (const r of data ?? []) out.set(r.slug, r.id);
  return out;
}

async function main() {
  const [editedCats, editedItems, editedTpls] = await Promise.all([
    loadAdminEdited('catalog_categories'),
    loadAdminEdited('catalog_items'),
    loadAdminEdited('menu_templates'),
  ]);
  if (editedCats.size + editedItems.size + editedTpls.size) {
    console.log(`admin düzenlemesi korunuyor: ${editedCats.size} kategori, ${editedItems.size} ürün, ${editedTpls.size} şablon (--force ile ezilir)`);
  }

  // 1) Kategoriler — iki geçiş: önce parent_id olmadan id al, sonra parent_id ile tekrar upsert.
  const catBase = seed.categories.map((c) => ({
    slug: c.slug, name: c.name, icon: c.icon, display_order: c.display_order, is_active: true,
    ...(INCLUDE_EN ? { name_en: c.name_en } : {}),
  }));
  const catIds = await upsertAll('catalog_categories', catBase.filter((c) => !editedCats.has(c.slug)).map((c) => ({ ...c, parent_id: null })));
  for (const [slug, id] of editedCats) catIds.set(slug, id);
  await upsertAll('catalog_categories', seed.categories
    .map((c, i) => ({ ...catBase[i], parent_id: c.parent ? catIds.get(c.parent) ?? null : null }))
    .filter((c) => !editedCats.has(c.slug)));
  console.log(`catalog_categories: ${catIds.size}`);

  // 2) Ürünler
  const itemRows = seed.items.map((it) => {
    const cat = catIds.get(it.primary_category);
    if (!cat) throw new Error(`${it.slug}: kategori ${it.primary_category} bulunamadı`);
    return {
      slug: it.slug, primary_category_id: cat, name: it.name, description: it.description,
      // image_url bilerek gönderilmez: katalog görselleri scripts/catalog-images/apply.ts tarafından yazılır;
      // PostgREST upsert yalnız verilen sütunları günceller, böylece import görselleri silmez.
      price_suggested: it.price_suggested, allergens: it.allergens, calories: it.calories,
      tags: it.tags, display_order: it.display_order, is_active: true,
      ...(INCLUDE_EN ? { name_en: it.name_en, description_en: it.description_en } : {}),
    };
  });
  const itemIds = await upsertAll('catalog_items', itemRows.filter((r) => !editedItems.has(r.slug)));
  for (const [slug, id] of editedItems) itemIds.set(slug, id);
  console.log(`catalog_items: ${itemIds.size}`);

  // 3) Şablonlar
  const tplIds = await upsertAll('menu_templates', seed.templates.filter((t) => !editedTpls.has(t.slug)).map((t) => ({
    slug: t.slug, business_type: t.business_type, name: t.name, tagline: t.tagline, venue_type: t.venue_type,
    icon: t.icon, color: t.color, cover_image: t.cover_image, description: t.description,
    display_order: t.display_order, is_active: true,
  })));
  for (const [slug, id] of editedTpls) tplIds.set(slug, id);
  console.log(`menu_templates: ${tplIds.size}`);

  // 4) Şablon bağlantıları — şablon başına sil + yaz
  let linkCats = 0, linkItems = 0;
  for (const t of seed.templates) {
    if (editedTpls.has(t.slug)) continue; // admin panelinde içeriği düzenlenmiş şablon
    const tid = tplIds.get(t.slug)!;
    const cats = t.categories.map((c) => ({ template_id: tid, category_id: catIds.get(c.category), display_order: c.display_order }));
    const items = t.items.map((i) => ({ template_id: tid, item_id: itemIds.get(i.item), display_order: i.display_order, price_override: i.price_override ?? null }));
    const bad = [...cats.filter((c) => !c.category_id), ...items.filter((i) => !i.item_id)];
    if (bad.length) throw new Error(`${t.slug}: çözümlenemeyen referans`);
    if (!DRY) {
      for (const [table, rows] of [['menu_template_categories', cats], ['menu_template_items', items]] as const) {
        const del = await db.from(table).delete().eq('template_id', tid);
        if (del.error) throw new Error(`${table} delete: ${del.error.message}`);
        for (const part of chunk(rows as any[])) {
          const ins = await db.from(table).insert(part);
          if (ins.error) throw new Error(`${table} insert (${t.slug}): ${ins.error.message}`);
        }
      }
    }
    linkCats += cats.length;
    linkItems += items.length;
  }
  console.log(`menu_template_categories: ${linkCats}, menu_template_items: ${linkItems}`);

  // 5) Prune — seed dışında kalanları pasifleştir
  if (PRUNE && !DRY) {
    for (const [table, keep] of [
      ['catalog_items', [...itemIds.keys()]],
      ['catalog_categories', [...catIds.keys()]],
      ['menu_templates', [...tplIds.keys()]],
    ] as const) {
      const { data, error } = await db.from(table).select('slug').eq('is_active', true);
      if (error) throw new Error(`${table} select: ${error.message}`);
      const edited = table === 'catalog_items' ? editedItems : table === 'catalog_categories' ? editedCats : editedTpls;
      const stale = (data ?? []).map((r) => r.slug).filter((s) => !keep.includes(s) && !edited.has(s));
      if (stale.length) {
        const upd = await db.from(table).update({ is_active: false }).in('slug', stale);
        if (upd.error) throw new Error(`${table} prune: ${upd.error.message}`);
      }
      console.log(`${table} prune: ${stale.length} pasif`);
    }
  }
  console.log('tamam');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

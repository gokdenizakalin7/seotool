/**
 * manifest.json → catalog_items.image_url (+ bağlı işletme ürünlerine backfill) + public/catalog/credits.json
 *
 *   npm run catalog:images:apply -- [--dry-run] [--only a,b] [--clear a,b] [--no-backfill]
 *
 *   SUPABASE_URL (veya NEXT_PUBLIC_SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY gerekir (.env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { catalogImageUrl } from '../../lib/image-url'
import { CREDITS_PATH, loadManifest, loadSeed, parseArgs } from './common'

async function main() {
  const args = parseArgs()
  const dry = args.has('dry-run')
  const only = new Set(args.list('only'))
  const clear = args.list('clear')
  const noBackfill = args.has('no-backfill')

  const manifest = loadManifest()
  const seed = loadSeed()
  const nameBySlug = new Map(seed.items.map((it) => [it.slug, it.name]))

  const rows = Object.entries(manifest.items)
    .filter(([slug]) => only.size === 0 || only.has(slug))
    .map(([slug, m]) => ({ slug, image_url: catalogImageUrl(slug, m.hash) }))
  for (const slug of clear) rows.push({ slug, image_url: '' })

  // Atıf dosyası: yalnız stok kaynaklı görseller
  const credits = Object.entries(manifest.items)
    .filter(([, m]) => m.credit)
    .map(([slug, m]) => ({
      slug,
      name: nameBySlug.get(slug) || slug,
      source: m.credit!.source === 'pixabay' ? 'Pixabay' : 'Openverse',
      source_url: m.credit!.source_url,
      creator: m.credit!.creator,
      license: m.credit!.license,
      license_url: m.credit!.license_url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  console.log(`${rows.length} katalog satırı güncellenecek, ${credits.length} atıf${dry ? ' (dry-run)' : ''}`)
  if (dry) {
    for (const r of rows.slice(0, 10)) console.log('  ', r.slug, '→', r.image_url)
    if (rows.length > 10) console.log(`   … +${rows.length - 10}`)
    return
  }

  mkdirSync(dirname(CREDITS_PATH), { recursive: true })
  writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2) + '\n')
  console.log(`credits.json yazıldı (${credits.length})`)

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli')
  const db = createClient(url, key, { auth: { persistSession: false } })

  let updated = 0
  const missing: string[] = []
  for (let i = 0; i < rows.length; i += 300) {
    const part = rows.slice(i, i + 300)
    const { data, error } = await db.rpc('set_catalog_item_images', { p_rows: part })
    if (error) throw new Error(`set_catalog_item_images: ${error.message} (08 migration'ı çalıştı mı?)`)
    const r = (data || {}) as { updated?: number; missing?: string[] }
    updated += r.updated || 0
    missing.push(...(r.missing || []))
  }
  console.log(`catalog_items.image_url: ${updated} güncellendi, ${missing.length} slug bulunamadı${missing.length ? `: ${missing.slice(0, 10).join(', ')}` : ''}`)

  if (!noBackfill) {
    const { data, error } = await db.rpc('backfill_catalog_item_images')
    if (error) throw new Error(`backfill_catalog_item_images: ${error.message}`)
    console.log(`işletme ürünleri backfill: ${data ?? 0} satır`)
  }
  console.log('tamam')
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})

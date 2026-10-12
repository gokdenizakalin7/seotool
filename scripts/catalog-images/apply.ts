/**
 * manifest.json → catalog_items.image_url (+ bağlı işletme ürünlerine backfill) + public/catalog/credits.json
 *
 *   npm run catalog:images:apply -- [--dry-run] [--only a,b] [--clear a,b] [--no-backfill] [--force]
 *
 *   Admin panelinden yüklenen/üretilen görseller (Storage'daki menu-images/catalog/…) korunur;
 *   --force verilirse manifest'teki statik görselle ezilir.
 *
 *   SUPABASE_URL (veya NEXT_PUBLIC_SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY gerekir (.env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { catalogImageUrl } from '../../lib/image-url'
import { CREDITS_PATH, loadManifest, loadSeed, parseArgs } from './common'

const SOURCE_LABEL: Record<string, string> = { pixabay: 'Pixabay', openverse: 'Openverse', wikimedia: 'Wikimedia Commons' }

async function main() {
  const args = parseArgs()
  const dry = args.has('dry-run')
  const only = new Set(args.list('only'))
  const clear = args.list('clear')
  const noBackfill = args.has('no-backfill')
  const force = args.has('force')

  const manifest = loadManifest()
  const seed = loadSeed()
  const nameBySlug = new Map(seed.items.map((it) => [it.slug, it.name]))

  const rows = Object.entries(manifest.items)
    .filter(([slug]) => only.size === 0 || only.has(slug))
    .map(([slug, m]) => ({ slug, image_url: catalogImageUrl(slug, m.hash, m.single) }))
  for (const slug of clear) rows.push({ slug, image_url: '' })

  // Atıf dosyası: yalnız stok kaynaklı görseller
  const credits = Object.entries(manifest.items)
    .filter(([, m]) => m.credit)
    .map(([slug, m]) => ({
      slug,
      name: nameBySlug.get(slug) || slug,
      source: SOURCE_LABEL[m.credit!.source] || m.credit!.source,
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

  // Görseli admin panelinden yönetilen ürünler korunur: Storage'a yüklenmiş görseller ve
  // admin'in yüklediği/ürettiği/kaldırdığı (denetim kaydı olan) görseller
  let toWrite = rows
  if (!force) {
    const { data: current, error } = await db.from('catalog_items').select('slug, image_url').like('image_url', '%/menu-images/catalog/%')
    if (error) throw new Error(`catalog_items okunamadı: ${error.message}`)
    const adminImages = new Set((current || []).map((r) => r.slug))
    const { data: logged, error: logErr } = await db
      .from('admin_audit_log')
      .select('target_id')
      .eq('target_type', 'catalog_item')
      .like('action', 'catalog_item.image_%')
    if (logErr) console.warn(`admin_audit_log okunamadı (${logErr.message}); yalnızca Storage görselleri korunuyor`)
    const loggedIds = [...new Set((logged || []).map((r) => r.target_id).filter(Boolean))]
    for (let i = 0; i < loggedIds.length; i += 200) {
      const { data: managed } = await db.from('catalog_items').select('slug').in('id', loggedIds.slice(i, i + 200))
      for (const r of managed || []) adminImages.add(r.slug)
    }
    toWrite = rows.filter((r) => !adminImages.has(r.slug))
    if (rows.length !== toWrite.length) {
      console.log(`${rows.length - toWrite.length} ürünün admin panelinden yönetilen görseli korunuyor (--force ile ezilir)`)
    }
  }

  let updated = 0
  const missing: string[] = []
  for (let i = 0; i < toWrite.length; i += 300) {
    const part = toWrite.slice(i, i + 300)
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

/**
 * Katalog görselleri — toplu üretim (yeniden başlatılabilir).
 *
 *   npm run catalog:images -- --backend stock|pollinations|cloudflare|drawthings [seçenekler]
 *
 *   --missing            manifest'te olmayan ürünler (stok turundan sonra AI turu için)
 *   --size 768|1024      AI üretim boyutu (çıktı her zaman 768 + 320 px webp)
 *   --limit N            en fazla N ürün
 *   --only a,b           yalnız bu slug'lar
 *   --category <slug>    kategori alt ağacı
 *   --shard k/n          slug hash'ine göre parça (paralel backend'ler için)
 *   --force              manifest'te olsa da yeniden üret
 *   --retry-failed       failures.json'dakileri dene
 *   --dry-run            ağ yok; prompt ve seed'leri yazdır
 *   --budget-neurons N   Cloudflare günlük nöron bütçesi (varsayılan 9600)
 *   --concurrency N
 *
 * Çıkış kodu 3: kota/limit nedeniyle durdu (ertesi gün aynı komutla devam edin).
 */
import { buildCatalogPrompt } from '../../lib/catalog-image-prompt'
import { estimateKleinNeurons } from '../../lib/server/cloudflare-image'
import { cloudflareBackend } from './backends/cloudflare'
import { drawThingsBackend } from './backends/drawthings'
import { pollinationsBackend } from './backends/pollinations'
import { stockBackend } from './backends/stock'
import {
  backoffMs,
  buildChains,
  hash16,
  itemLabel,
  loadFailures,
  loadManifest,
  loadOverrides,
  loadSeed,
  parseArgs,
  processImage,
  removeImages,
  saveFailures,
  saveManifest,
  shardOf,
  sleep,
  subtreeSlugs,
  todayUtc,
  writeImages,
} from './common'
import { BackendError, type Backend, type BackendName, type GenerateContext, type SeedItem } from './types'

const BACKENDS: Record<BackendName, Backend> = {
  stock: stockBackend,
  pollinations: pollinationsBackend,
  cloudflare: cloudflareBackend,
  drawthings: drawThingsBackend,
}

const MAX_ATTEMPTS = 5

async function main() {
  const args = parseArgs()
  const backendName = args.str('backend') as BackendName | undefined
  if (!backendName || !BACKENDS[backendName]) {
    console.error('Kullanım: --backend stock|pollinations|cloudflare|drawthings  (ayrıntı: dosya başı)')
    process.exit(2)
  }
  const backend = BACKENDS[backendName]
  const dryRun = args.has('dry-run')
  const force = args.has('force')
  const missingOnly = args.has('missing')
  const retryFailed = args.has('retry-failed')
  const size = args.num('size', backendName === 'cloudflare' ? 1024 : 1024)
  const limit = args.num('limit', Infinity)
  const only = new Set(args.list('only'))
  const category = args.str('category')
  const shard = args.str('shard')
  const budgetNeurons = args.num('budget-neurons', 9600)
  const concurrency = Math.max(1, args.num('concurrency', backend.concurrency))

  const seed = loadSeed()
  const chains = buildChains(seed.categories)
  const overrides = loadOverrides()
  const manifest = loadManifest()
  const failures = loadFailures()

  let items: SeedItem[] = [...seed.items].sort((a, b) => a.slug.localeCompare(b.slug))
  if (only.size) items = items.filter((it) => only.has(it.slug))
  if (category) {
    const sub = subtreeSlugs(seed.categories, category)
    items = items.filter((it) => sub.has(it.primary_category))
  }
  if (shard) {
    const [k, n] = shard.split('/').map(Number)
    if (!(k >= 0 && n > 0 && k < n)) throw new Error('--shard k/n biçiminde olmalı (0 ≤ k < n)')
    items = items.filter((it) => shardOf(it.slug, n) === k)
  }
  if (retryFailed) items = items.filter((it) => failures[it.slug])
  else if (!force && only.size === 0) {
    // Bu backend'de zaten "uygun sonuç yok" denen ürünler tekrar denenmez (kota israfı); --retry-failed ile denenir
    const before = items.length
    items = items.filter((it) => !(failures[it.slug]?.backend === backendName && failures[it.slug]?.kind === 'nomatch'))
    if (before !== items.length) console.log(`${backendName}: daha önce eşleşmeyen ${before - items.length} ürün atlandı`)
  }
  if (!force) {
    items = items.filter((it) => {
      const m = manifest.items[it.slug]
      if (!m) return true
      if (missingOnly) return false
      return false
    })
  }
  if (backendName === 'stock') {
    // Marka/etiket riski: alkollü içecekler (kokteyl ve shot hariç), enerji ve gazlı içecekler stok aramasına girmez
    const skipCats = new Set<string>()
    for (const root of ['alkollu-icecekler', 'enerji-icecekleri', 'gazli-icecekler']) for (const sl of subtreeSlugs(seed.categories, root)) skipCats.add(sl)
    for (const keep of ['kokteyller', 'shotlar']) skipCats.delete(keep)
    const before = items.length
    items = items.filter((it) => !overrides[it.slug]?.skipStock && !skipCats.has(it.primary_category))
    if (before !== items.length) console.log(`stok: ${before - items.length} markalı/alkollü ürün atlandı (overrides.skipStock + kategori)`)
  }
  if (Number.isFinite(limit)) items = items.slice(0, limit)

  console.log(`${backendName}: ${items.length} ürün${dryRun ? ' (dry-run)' : ''}, boyut ${size}, paralellik ${concurrency}`)
  if (items.length === 0) return

  const ctxOf = (it: SeedItem): GenerateContext => {
    const chain = chains.chainOf(it.primary_category)
    const override = overrides[it.slug]
    const built = buildCatalogPrompt(it, chain.map((c) => c.slug), override)
    return {
      item: it,
      chainSlugs: chain.map((c) => c.slug),
      chainNames: chain.map((c) => c.name),
      chainNamesEn: chain.map((c) => c.name_en),
      prompt: built.prompt,
      seed: built.seed,
      size,
      override,
    }
  }

  if (dryRun) {
    for (const it of items) {
      const ctx = ctxOf(it)
      console.log(`\n${itemLabel(it)}\n  seed=${ctx.seed}\n  ${ctx.prompt.slice(0, 220)}${ctx.prompt.length > 220 ? '…' : ''}`)
    }
    return
  }

  let cursor = 0
  let ok = 0
  let failed = 0
  let stopReason: string | null = null
  let lastStart = 0

  const worker = async () => {
    while (!stopReason) {
      const it = items[cursor++]
      if (!it) return
      const ctx = ctxOf(it)

      if (backendName === 'cloudflare') {
        const est = estimateKleinNeurons(size, size)
        const used = manifest.cloudflare.neurons[todayUtc()] || 0
        if (used + est > budgetNeurons) {
          stopReason = `Cloudflare günlük nöron bütçesi (${budgetNeurons}) doldu: ${used} kullanıldı`
          return
        }
      }

      let attempt = 0
      while (!stopReason) {
        attempt++
        const wait = lastStart + backend.minIntervalMs - Date.now()
        if (wait > 0) await sleep(wait)
        lastStart = Date.now()
        try {
          const r = await backend.generate(ctx)
          const { main, thumb } = await processImage(r.bytes)
          writeImages(it.slug, main, thumb)
          manifest.items[it.slug] = {
            hash: hash16(main),
            bytes: main.length,
            thumbBytes: thumb.length,
            backend: backendName,
            model: r.model,
            promptVersion: 1,
            seed: ctx.seed,
            ...(r.credit ? { credit: r.credit } : {}),
            generatedAt: new Date().toISOString(),
          }
          if (backendName === 'cloudflare') {
            const d = todayUtc()
            manifest.cloudflare.neurons[d] = (manifest.cloudflare.neurons[d] || 0) + estimateKleinNeurons(size, size)
          }
          delete failures[it.slug]
          saveManifest(manifest)
          saveFailures(failures)
          ok++
          console.log(`✓ ${itemLabel(it)} ← ${r.model}${r.credit ? ` [${r.credit.source}]` : ''}`)
          break
        } catch (e) {
          const err = e instanceof BackendError ? e : new BackendError(String((e as Error)?.message || e), 'transient')
          if (err.kind === 'quota') {
            stopReason = err.message
            failures[it.slug] = { error: err.message, kind: err.kind, backend: backendName, attempts: attempt, at: new Date().toISOString() }
            break
          }
          if (err.kind === 'rate') {
            const ms = err.retryAfterMs ?? 20_000
            console.log(`… ${itemLabel(it)}: hız limiti, ${Math.round(ms / 1000)} sn bekleniyor`)
            await sleep(ms)
            attempt-- // beklemeler deneme sayılmaz
            continue
          }
          if ((err.kind === 'transient' || err.kind === 'capacity') && attempt < MAX_ATTEMPTS) {
            const ms = err.retryAfterMs ?? backoffMs(attempt)
            console.log(`… ${itemLabel(it)}: ${err.message} (deneme ${attempt}/${MAX_ATTEMPTS}, ${Math.round(ms / 1000)} sn)`)
            await sleep(ms)
            continue
          }
          failures[it.slug] = { error: err.message, kind: err.kind, backend: backendName, attempts: attempt, at: new Date().toISOString() }
          if (force && manifest.items[it.slug]) {
            // Yeniden değerlendirme başarısız: eski (gevşek) sonucu tutma
            delete manifest.items[it.slug]
            removeImages(it.slug)
            saveManifest(manifest)
          }
          saveFailures(failures)
          failed++
          console.log(`✗ ${itemLabel(it)}: ${err.message}`)
          if (err.kind === 'fatal' && /tanımlı değil|bağlanılamadı|geçersiz|gerekli/.test(err.message)) {
            stopReason = err.message
          }
          break
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  saveManifest(manifest)
  saveFailures(failures)
  console.log(`\nbitti: ${ok} üretildi, ${failed} başarısız, manifest ${Object.keys(manifest.items).length} ürün`)
  if (stopReason) {
    console.log(`DURDU: ${stopReason}`)
    process.exit(3)
  }
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})

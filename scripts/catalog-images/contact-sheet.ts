/** Görsel QA sayfası: scripts/catalog-images/.work/sheet.html (L2 kategoriye göre gruplu). */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildChains, loadFailures, loadManifest, loadSeed, WORK_DIR } from './common'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const seed = loadSeed()
const chains = buildChains(seed.categories)
const manifest = loadManifest()
const failures = loadFailures()

const groups = new Map<string, string[]>()
for (const it of [...seed.items].sort((a, b) => a.slug.localeCompare(b.slug))) {
  const chain = chains.chainOf(it.primary_category)
  const l2 = chain.length >= 2 ? chain[chain.length - 2].name : chain[0]?.name || '?'
  const leaf = chain[0]?.name || '?'
  const m = manifest.items[it.slug]
  const f = failures[it.slug]
  const cell = m
    ? `<figure><img loading="lazy" src="../../../public/catalog/${it.slug}-s.webp?v=${m.hash}" alt=""><figcaption><b>${esc(it.name)}</b><br><code>${it.slug}</code><br><small>${esc(leaf)} · ${m.backend}${m.credit ? ` · ${m.credit.source}` : ''}</small></figcaption></figure>`
    : `<figure class="missing"><div class="ph">${f ? esc(f.kind) : 'yok'}</div><figcaption><b>${esc(it.name)}</b><br><code>${it.slug}</code><br><small>${esc(leaf)}${f ? ` · ${esc(f.error.slice(0, 60))}` : ''}</small></figcaption></figure>`
  groups.set(l2, [...(groups.get(l2) || []), cell])
}

const done = Object.keys(manifest.items).length
const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Katalog görselleri QA</title>
<style>body{font:13px system-ui;margin:20px;background:#fafafa}h2{margin:28px 0 10px}figure{display:inline-block;width:150px;margin:6px;vertical-align:top;background:#fff;border:1px solid #ddd;border-radius:8px;padding:6px}img{width:138px;height:138px;object-fit:cover;border-radius:6px;display:block}.ph{width:138px;height:138px;display:flex;align-items:center;justify-content:center;background:#eee;color:#999;border-radius:6px}.missing{border-color:#f99}figcaption{margin-top:4px;line-height:1.3}code{font-size:10px;color:#666}small{color:#777}</style>
<h1>Katalog görselleri — ${done}/${seed.items.length} üretildi, ${Object.keys(failures).length} başarısız</h1>
${[...groups.entries()].map(([l2, cells]) => `<h2>${esc(l2)} <small>(${cells.length})</small></h2>${cells.join('')}`).join('\n')}
</html>`

mkdirSync(WORK_DIR, { recursive: true })
const out = resolve(WORK_DIR, 'sheet.html')
writeFileSync(out, html)
console.log(`yazıldı: ${out}`)

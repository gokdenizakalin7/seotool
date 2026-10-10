/** Katalog görsel üretimi — seed, manifest, görsel işleme ve CLI yardımcıları */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { FailureEntry, Manifest, Override, Seed, SeedCategory, SeedItem } from './types'

export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
export const PROJECT_ROOT = resolve(SCRIPT_DIR, '../..')
export const PUBLIC_CATALOG_DIR = resolve(PROJECT_ROOT, 'public/catalog')
export const WORK_DIR = resolve(SCRIPT_DIR, '.work')
export const MANIFEST_PATH = resolve(SCRIPT_DIR, 'manifest.json')
export const FAILURES_PATH = resolve(SCRIPT_DIR, 'failures.json')
export const OVERRIDES_PATH = resolve(SCRIPT_DIR, 'overrides.json')
export const CREDITS_PATH = resolve(PUBLIC_CATALOG_DIR, 'credits.json')

export const MAIN_SIZE = 768
export const THUMB_SIZE = 320

/* ───────────── CLI ───────────── */

export interface Args {
  flags: Record<string, string | boolean>
  has(name: string): boolean
  str(name: string, def?: string): string | undefined
  num(name: string, def: number): number
  list(name: string): string[]
}

export function parseArgs(argv = process.argv.slice(2)): Args {
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      flags[a.slice(2)] = next
      i++
    } else flags[a.slice(2)] = true
  }
  return {
    flags,
    has: (n) => n in flags,
    str: (n, def) => (typeof flags[n] === 'string' ? (flags[n] as string) : def),
    num: (n, def) => (typeof flags[n] === 'string' && !Number.isNaN(Number(flags[n])) ? Number(flags[n]) : def),
    list: (n) => (typeof flags[n] === 'string' ? (flags[n] as string).split(',').map((s) => s.trim()).filter(Boolean) : []),
  }
}

/* ───────────── Seed ───────────── */

export function seedPath(): string {
  return process.env.SEED_FILE ? resolve(process.env.SEED_FILE) : resolve(PROJECT_ROOT, '../qr-menu-seed/dist/seed.json')
}

export function loadSeed(): Seed {
  const p = seedPath()
  if (!existsSync(p)) throw new Error(`Seed bulunamadı: ${p} (SEED_FILE verin ya da seed reposunda node scripts/build.mjs çalıştırın)`)
  return JSON.parse(readFileSync(p, 'utf8')) as Seed
}

export interface CategoryChains {
  bySlug: Map<string, SeedCategory>
  /** yaprak slug → yapraktan köke slug zinciri */
  chainOf(leaf: string): SeedCategory[]
}

export function buildChains(categories: SeedCategory[]): CategoryChains {
  const bySlug = new Map(categories.map((c) => [c.slug, c]))
  const cache = new Map<string, SeedCategory[]>()
  return {
    bySlug,
    chainOf(leaf) {
      const hit = cache.get(leaf)
      if (hit) return hit
      const chain: SeedCategory[] = []
      const seen = new Set<string>()
      for (let cur = bySlug.get(leaf); cur && !seen.has(cur.slug); cur = cur.parent ? bySlug.get(cur.parent) : undefined) {
        seen.add(cur.slug)
        chain.push(cur)
      }
      cache.set(leaf, chain)
      return chain
    },
  }
}

/** Kategori alt ağacı: verilen slug ve altındaki tüm kategoriler */
export function subtreeSlugs(categories: SeedCategory[], rootSlug: string): Set<string> {
  const out = new Set<string>([rootSlug])
  let grew = true
  while (grew) {
    grew = false
    for (const c of categories) {
      if (c.parent && out.has(c.parent) && !out.has(c.slug)) {
        out.add(c.slug)
        grew = true
      }
    }
  }
  return out
}

/* ───────────── Manifest / failures / overrides ───────────── */

export function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, items: {}, cloudflare: { neurons: {} } }
  const m = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Partial<Manifest>
  return { version: 1, items: m.items || {}, cloudflare: { neurons: m.cloudflare?.neurons || {} } }
}

export function saveManifest(m: Manifest): void {
  const sorted: Manifest = { version: 1, items: {}, cloudflare: m.cloudflare }
  for (const k of Object.keys(m.items).sort()) sorted.items[k] = m.items[k]
  writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n')
}

export function loadFailures(): Record<string, FailureEntry> {
  if (!existsSync(FAILURES_PATH)) return {}
  return JSON.parse(readFileSync(FAILURES_PATH, 'utf8')) as Record<string, FailureEntry>
}

export function saveFailures(f: Record<string, FailureEntry>): void {
  writeFileSync(FAILURES_PATH, JSON.stringify(f, null, 2) + '\n')
}

export function loadOverrides(): Record<string, Override> {
  if (!existsSync(OVERRIDES_PATH)) return {}
  return JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) as Record<string, Override>
}

/* ───────────── Görsel işleme ───────────── */

export async function processImage(bytes: Buffer): Promise<{ main: Buffer; thumb: Buffer }> {
  const base = sharp(bytes, { failOn: 'none' }).rotate()
  const main = await base.clone().resize(MAIN_SIZE, MAIN_SIZE, { fit: 'cover', position: 'attention' }).webp({ quality: 75, effort: 5 }).toBuffer()
  const thumb = await sharp(main).resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' }).webp({ quality: 70, effort: 5 }).toBuffer()
  return { main, thumb }
}

export function writeImages(slug: string, main: Buffer, thumb: Buffer): void {
  mkdirSync(PUBLIC_CATALOG_DIR, { recursive: true })
  writeFileSync(resolve(PUBLIC_CATALOG_DIR, `${slug}.webp`), main)
  writeFileSync(resolve(PUBLIC_CATALOG_DIR, `${slug}-s.webp`), thumb)
}

export function removeImages(slug: string): void {
  for (const f of [`${slug}.webp`, `${slug}-s.webp`]) {
    const p = resolve(PUBLIC_CATALOG_DIR, f)
    if (existsSync(p)) rmSync(p)
  }
}

export function hash16(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

/* ───────────── Genel ───────────── */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function backoffMs(attempt: number): number {
  const base = Math.min(32_000, 2_000 * 2 ** (attempt - 1))
  return base + Math.floor(Math.random() * 1_000)
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Slug'a göre deterministik parça: --shard k/n */
export function shardOf(slug: string, n: number): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return h % n
}

export function itemLabel(it: SeedItem): string {
  return `${it.slug} (${it.name})`
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export function retryAfterMs(res: Response, fallbackMs: number): number {
  const h = res.headers.get('retry-after')
  if (!h) return fallbackMs
  const n = Number(h)
  if (!Number.isNaN(n)) return Math.max(1_000, n * 1000)
  const d = Date.parse(h)
  return Number.isNaN(d) ? fallbackMs : Math.max(1_000, d - Date.now())
}

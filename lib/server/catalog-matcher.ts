/**
 * Katalog Eşleştirici — Server Only
 *
 * Katalog indeksini (ürünler + kategori yolu + takma adlar) süreç içinde önbellekler ve
 * taranan/yazılan ürün adlarını kataloğa eşler. Hiçbir zaman fırlatmaz: hata halinde
 * eşleşme "none" döner (fail-open) ki tarama akışı bozulmasın.
 *
 * Kapatma: CATALOG_MATCH_DISABLED=1. Gemini belirsiz-bant kararı: CATALOG_MATCH_LLM (varsayılan açık).
 */
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { geminiJson, GEMINI_TEXT_MODELS } from '@/lib/server/gemini'
import {
  buildCatalogIndex,
  normalizeBasic,
  normalizeDishName,
  rankCandidates,
  searchCatalog,
  type CatalogAliasRow,
  type CatalogCategoryRow,
  type CatalogIndex,
  type CatalogItemRow,
  type CatalogMatch,
  type CatalogMatchInfo,
} from '@/lib/catalog-match'

const INDEX_TTL_MS = Number(process.env.CATALOG_INDEX_TTL_MS) || 10 * 60_000
const LLM_MAX_ITEMS = 150
const LLM_TIMEOUT_MS = 8000
const LLM_PROMOTE_MIN_SCORE = 0.7
const UNMATCHED_LOG_MAX = 200

let cache: { index: CatalogIndex; expires: number } | null = null
let inflight: Promise<CatalogIndex> | null = null

async function loadIndex(): Promise<CatalogIndex> {
  const [items, categories, aliases] = await Promise.all([
    fetchAll<CatalogItemRow>(
      supabaseAdmin,
      'catalog_items',
      'id, slug, name, name_en, image_url, primary_category_id, calories, allergens, description, display_order',
      (q) => q.eq('is_active', true)
    ),
    fetchAll<CatalogCategoryRow>(supabaseAdmin, 'catalog_categories', 'id, parent_id, slug, name'),
    fetchAll<CatalogAliasRow>(supabaseAdmin, 'catalog_item_aliases', 'alias_norm, item_id, confirmations').catch((e) => {
      // 08 migration'ı henüz çalışmadıysa takma adsız devam et
      console.warn('[catalog-match] alias tablosu okunamadı:', e?.message || e)
      return [] as CatalogAliasRow[]
    }),
  ])
  return buildCatalogIndex(items, categories, aliases)
}

export async function getCatalogIndex(): Promise<CatalogIndex> {
  const now = Date.now()
  if (cache && cache.expires > now) return cache.index
  if (inflight) return inflight
  inflight = loadIndex()
    .then((index) => {
      cache = { index, expires: Date.now() + INDEX_TTL_MS }
      return index
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function invalidateCatalogIndex(): void {
  cache = null
}

function isDisabled(): boolean {
  const v = (process.env.CATALOG_MATCH_DISABLED || '').toLowerCase()
  return v === '1' || v === 'true'
}

function isLlmEnabled(): boolean {
  const v = (process.env.CATALOG_MATCH_LLM ?? '').toLowerCase()
  if (v === '') return true
  return !['0', 'false', 'off', 'no'].includes(v)
}

export interface ScanMatchInput {
  name: string
  category?: string | null
}

const NONE: CatalogMatchInfo = { level: 'none', candidates: [] }

/** Taranan ürünleri sırayla eşler; aynı ad+kategori tek kez hesaplanır. Asla fırlatmaz. */
export async function matchScannedItems(
  items: ScanMatchInput[],
  ctx: { menuName?: string | null } = {}
): Promise<CatalogMatchInfo[]> {
  if (items.length === 0) return []
  if (isDisabled()) return items.map(() => ({ ...NONE, candidates: [] }))
  try {
    const index = await getCatalogIndex()
    const memo = new Map<string, CatalogMatchInfo>()
    const infos = items.map((it) => {
      const key = `${normalizeDishName(it.name)}|${normalizeBasic(it.category || '')}`
      const hit = memo.get(key)
      if (hit) return { ...hit, candidates: [...hit.candidates] }
      const info = rankCandidates({ name: it.name, category: it.category, menuName: ctx.menuName }, index)
      memo.set(key, info)
      return { ...info, candidates: [...info.candidates] }
    })
    if (isLlmEnabled() && process.env.GEMINI_API_KEY) {
      await llmDisambiguate(items, infos).catch((e) => console.warn('[catalog-match] Gemini atlandı:', e?.message || e))
    }
    return infos
  } catch (e: any) {
    console.warn('[catalog-match] fail-open:', e?.message || e)
    return items.map(() => ({ ...NONE, candidates: [] }))
  }
}

/**
 * Belirsiz banttaki (suggest) ürünler için tek metin çağrısı.
 * Terfi kuralı: seçim mevcut en iyi adayla aynı ve skor ≥ 0,70 → auto (via 'llm');
 * başka aday → başa alınır ama suggest kalır; null/geçersiz → değişmez.
 */
async function llmDisambiguate(items: ScanMatchInput[], infos: CatalogMatchInfo[]): Promise<void> {
  const targets = infos
    .map((info, i) => ({ info, i }))
    .filter(({ info }) => info.level === 'suggest' && info.candidates.length > 0)
    .slice(0, LLM_MAX_ITEMS)
  if (targets.length === 0) return

  const rows = targets.map(
    ({ info, i }) =>
      `${i} | ${items[i].name} | ${items[i].category || '-'} | ${info.candidates
        .map((c) => `${c.slug} = ${c.name} (${c.category})`)
        .join('; ')}`
  )
  const prompt = `Bir restoran menüsünden okunan ürün adlarını master katalogdaki ürünlerle eşleştiriyorsun.
Her satır: index | menüdeki ürün adı | menüdeki kategori | aday katalog ürünleri (slug = ad (kategori)).
Kural: Yalnızca aynı yemek/içecek olduğundan eminsen adayın slug'ını seç; boy, porsiyon veya küçük yazım farkları aynı üründür.
Farklı bir yemekse, birleşik menüyse (ör. "Döner + Ayran") veya emin değilsen null döndür. Aday listesi dışından slug uydurma.

${rows.join('\n')}

Yanıtı yalnızca şu JSON şemasında ver: {"picks":[{"i":number,"slug":string|null}]}`

  const out = await geminiJson<{ picks?: { i: number; slug: string | null }[] }>([{ text: prompt }], {
    models: GEMINI_TEXT_MODELS,
    timeoutMs: LLM_TIMEOUT_MS,
  })
  for (const p of out?.picks || []) {
    const info = infos[p?.i as number]
    if (!info || info.level !== 'suggest' || !p.slug) continue
    const cand = info.candidates.find((c) => c.slug === p.slug)
    if (!cand) continue
    const promoted: CatalogMatch = { ...cand, via: 'llm' }
    if (info.top && cand.item_id === info.top.item_id) {
      if (cand.score >= LLM_PROMOTE_MIN_SCORE) {
        info.level = 'auto'
        info.top = promoted
      }
    } else {
      info.candidates = [promoted, ...info.candidates.filter((c) => c.item_id !== cand.item_id)]
      info.top = promoted
    }
  }
}

export async function searchCatalogServer(q: string, limit = 8): Promise<CatalogMatch[]> {
  if (isDisabled()) return []
  const index = await getCatalogIndex()
  return searchCatalog(q, index, limit)
}

export interface UnmatchedRow {
  name: string
  category_name?: string | null
  best_slug?: string | null
  best_score?: number | null
}

/** Eşleşmeyen adları kürasyon için kaydeder (fire-and-forget). */
export function logUnmatched(rows: UnmatchedRow[]): void {
  const payload = rows
    .filter((r) => r.name && r.name.trim())
    .slice(0, UNMATCHED_LOG_MAX)
    .map((r) => ({
      name: r.name.trim().slice(0, 120),
      name_norm: normalizeDishName(r.name),
      category_name: r.category_name ? r.category_name.slice(0, 80) : null,
      best_slug: r.best_slug || null,
      best_score: r.best_score ?? null,
    }))
  if (payload.length === 0) return
  void supabaseAdmin
    .from('catalog_unmatched_log')
    .insert(payload)
    .then(({ error }) => {
      if (error) console.warn('[catalog-match] unmatched log yazılamadı:', error.message)
    })
}

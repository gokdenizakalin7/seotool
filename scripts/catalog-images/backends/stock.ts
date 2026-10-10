/**
 * Stok fotoğraf backend'i — Pixabay + Openverse araması, Gemini vision hakem.
 *  - Pixabay: anahtar anında ücretsiz, 100 istek/dk; görsel indirilmek zorunda (hotlink yasak) → zaten public/catalog'a yazıyoruz.
 *  - Openverse: anahtarsız çalışır (isteğe bağlı OPENVERSE_CLIENT_ID/SECRET); yalnız by, by-sa, cc0, pdm lisansları.
 *  - Hakem: Gemini'ye adayların küçük halleri gönderilir; "hangisi açıkça bu yemek?" → confidence < 0,7 ise nomatch.
 * Marka/etiket riski taşıyan ürünler (overrides.skipStock) bu backend'e girmez.
 */
import { geminiJson, GeminiError } from '../../../lib/server/gemini'
import { BackendError, type Backend, type GenerateContext, type GenerateResult, type ImageCredit } from '../types'
import { fetchWithTimeout, retryAfterMs } from '../common'

interface Candidate {
  source: 'pixabay' | 'openverse'
  thumbUrl: string
  fullUrl: string
  width: number
  height: number
  credit: ImageCredit
}

const MAX_CANDIDATES = 8
const MIN_SIDE = 600
const JUDGE_MIN_CONFIDENCE = Number(process.env.STOCK_JUDGE_MIN_CONFIDENCE) || 0.8
let consecutiveGeminiRate = 0

/**
 * Hakem modelleri. Uygulamanın kendi tarama/kalori modelleri (gemini-3.5-flash, -lite) bilerek dışarıda:
 * toplu iş aynı anahtarın ücretsiz kotasını tüketip canlı menü taramasını bozmasın.
 * Model başına kota ayrıdır; biri 429 verirse sıradaki denenir. STOCK_JUDGE_MODELS ile değiştirilebilir.
 */
const JUDGE_MODELS = (process.env.STOCK_JUDGE_MODELS || 'gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-flash-latest,gemma-4-31b-it')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

async function searchPixabay(q: string): Promise<Candidate[]> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) return []
  const url =
    `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q.slice(0, 100))}` +
    `&image_type=photo&safesearch=true&min_width=800&per_page=10&lang=en`
  const res = await fetchWithTimeout(url, {}, 30_000)
  if (res.status === 429) throw new BackendError('Pixabay hız limiti', 'rate', retryAfterMs(res, 60_000))
  if (!res.ok) throw new BackendError(`Pixabay HTTP ${res.status}`, res.status >= 500 ? 'transient' : 'fatal')
  const data: any = await res.json()
  return (data?.hits || []).map((h: any) => ({
    source: 'pixabay' as const,
    thumbUrl: h.webformatURL,
    fullUrl: h.largeImageURL || h.webformatURL,
    width: h.imageWidth || 0,
    height: h.imageHeight || 0,
    credit: {
      source: 'pixabay' as const,
      source_url: h.pageURL,
      creator: h.user || null,
      license: 'Pixabay Content License',
      license_url: 'https://pixabay.com/service/license-summary/',
    },
  }))
}

let openverseToken: { token: string; expires: number } | null = null
async function openverseAuth(): Promise<string | null> {
  const id = process.env.OPENVERSE_CLIENT_ID?.trim()
  const secret = process.env.OPENVERSE_CLIENT_SECRET?.trim()
  if (!id || !secret) return null
  if (openverseToken && openverseToken.expires > Date.now()) return openverseToken.token
  const res = await fetchWithTimeout('https://api.openverse.org/v1/auth_tokens/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }).toString(),
  })
  if (!res.ok) return null
  const data: any = await res.json()
  openverseToken = { token: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000 }
  return openverseToken.token
}

async function searchOpenverse(q: string): Promise<Candidate[]> {
  const token = await openverseAuth()
  // Not: category=photograph filtresi sonuçların çoğunu eler (kategori alanı boş kayıtlar); hakem zaten eliyor
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q.slice(0, 200))}` +
    `&license=by,by-sa,cc0,pdm&page_size=12&mature=false`
  const headers: Record<string, string> = { 'User-Agent': 'qr-menu-catalog-images/1.0 (contact: projeyonetim@sabah.com.tr)' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetchWithTimeout(url, { headers }, 30_000)
  if (res.status === 429) throw new BackendError('Openverse hız limiti', 'rate', retryAfterMs(res, 60_000))
  if (!res.ok) throw new BackendError(`Openverse HTTP ${res.status}`, res.status >= 500 ? 'transient' : 'fatal')
  const data: any = await res.json()
  return (data?.results || [])
    .filter((r: any) => r.url && (r.thumbnail || r.url))
    .map((r: any) => ({
      source: 'openverse' as const,
      thumbUrl: r.thumbnail || r.url,
      fullUrl: r.url,
      width: r.width || 0,
      height: r.height || 0,
      credit: {
        source: 'openverse' as const,
        source_url: r.foreign_landing_url || r.url,
        creator: r.creator || null,
        license: `CC ${String(r.license || '').toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`.trim(),
        license_url: r.license_url || null,
      },
    }))
}

async function fetchAsInline(url: string): Promise<{ mime_type: string; data: string } | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'qr-menu-catalog-images/1.0' } }, 30_000)
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 4_000_000) return null
    return { mime_type: ct, data: buf.toString('base64') }
  } catch {
    return null
  }
}

interface Verdict {
  best: number
  confidence: number
  reason?: string
}

async function judge(ctx: GenerateContext, candidates: Candidate[]): Promise<Verdict> {
  const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = []
  const chain = ctx.chainNamesEn.slice().reverse().join(' › ')
  parts.push({
    text:
      `You are a strict photo editor choosing ONE stock photo for a restaurant's digital menu.\n` +
      `Item: "${ctx.item.name_en || ctx.item.name}" (Turkish name: "${ctx.item.name}"). Category: ${chain}.\n` +
      `Description: ${ctx.item.description_en || ctx.item.description || '-'}\n\n` +
      `Candidate photos are numbered from 0. A candidate is acceptable ONLY if ALL of these hold:\n` +
      `1. It clearly shows exactly this dish or drink, and that item is the main subject filling most of the frame (not one element of a table spread, not a different dish).\n` +
      `2. It looks appetizing, sharp and well lit, like a menu photo (no dark, blurry, messy or amateur snapshots).\n` +
      `3. NOTHING with text or branding is visible anywhere: no logos, printed cups, bottles with labels, packaging, menus, signs, watermarks.\n` +
      `4. No people, hands, faces or body parts; not a collage, illustration, drawing or screenshot.\n` +
      `Pick the best acceptable candidate. If none satisfies all four rules, answer best = -1. Be conservative: a wrong photo is worse than no photo.\n` +
      `Answer strictly as JSON: {"best": number, "confidence": number between 0 and 1 (how sure you are that the chosen photo satisfies all four rules), "reason": string}`,
  })
  let n = 0
  for (const c of candidates) {
    const inline = await fetchAsInline(c.thumbUrl)
    if (!inline) continue
    parts.push({ text: `Candidate ${n}:` })
    parts.push({ inline_data: inline })
    c.thumbUrl = `#${n}` // sıralama hakeme göre
    n++
  }
  if (n === 0) return { best: -1, confidence: 0 }
  try {
    const v = await geminiJson<Verdict>(parts, { models: JUDGE_MODELS, timeoutMs: 45_000 })
    consecutiveGeminiRate = 0
    return { best: Number(v?.best ?? -1), confidence: Number(v?.confidence ?? 0), reason: v?.reason }
  } catch (e) {
    if (e instanceof GeminiError && e.status === 429) {
      consecutiveGeminiRate++
      if (consecutiveGeminiRate >= 5) throw new BackendError('Gemini günlük kotası dolmuş görünüyor; yarın devam edin', 'quota')
      throw new BackendError('Gemini hız limiti (hakem)', 'rate', 60_000)
    }
    throw new BackendError(`Gemini hakem hatası: ${(e as Error).message}`, 'transient')
  }
}

export const stockBackend: Backend = {
  name: 'stock',
  concurrency: 2,
  minIntervalMs: 800,
  async generate(ctx: GenerateContext): Promise<GenerateResult> {
    if (ctx.override?.skipStock) throw new BackendError('marka/etiket riski: stok aramasına alınmadı', 'nomatch')
    if (!process.env.GEMINI_API_KEY) throw new BackendError('GEMINI_API_KEY gerekli (stok hakemi)', 'fatal')

    // Sorgular daraltandan genişleyene: "Spicy Lahmacun" → "Acılı Lahmacun" → "Lahmacun"; hakem genel sonuçları eler
    const en = (ctx.item.name_en || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    const enWords = en.split(' ').filter(Boolean)
    const queries = [
      en,
      ctx.item.name,
      enWords.length > 2 ? enWords.slice(-2).join(' ') : '',
      enWords.length > 1 && enWords[enWords.length - 1].length >= 4 ? enWords[enWords.length - 1] : '',
    ].filter((q, i, a) => q && a.indexOf(q) === i)
    const pool: Candidate[] = []
    const seenUrl = new Set<string>()
    for (const q of queries) {
      const [px, ov] = await Promise.all([
        searchPixabay(q).catch((e) => {
          if (e instanceof BackendError && e.kind === 'rate') throw e
          return [] as Candidate[]
        }),
        searchOpenverse(q).catch((e) => {
          if (e instanceof BackendError && e.kind === 'rate') throw e
          return [] as Candidate[]
        }),
      ])
      for (const c of [...px, ...ov]) {
        if (seenUrl.has(c.fullUrl) || Math.min(c.width, c.height) < MIN_SIDE) continue
        seenUrl.add(c.fullUrl)
        pool.push(c)
      }
      if (pool.length >= MAX_CANDIDATES) break
    }
    const candidates = pool.slice(0, MAX_CANDIDATES)
    if (candidates.length === 0) throw new BackendError('stokta aday bulunamadı', 'nomatch')

    const verdict = await judge(ctx, candidates)
    const judged = candidates.filter((c) => c.thumbUrl.startsWith('#'))
    const pick = verdict.best >= 0 ? judged[verdict.best] : undefined
    if (!pick || verdict.confidence < JUDGE_MIN_CONFIDENCE) {
      throw new BackendError(`hakem uygun fotoğraf bulmadı (güven ${verdict.confidence.toFixed(2)}${verdict.reason ? `: ${verdict.reason}` : ''})`, 'nomatch')
    }

    const res = await fetchWithTimeout(pick.fullUrl, { headers: { 'User-Agent': 'qr-menu-catalog-images/1.0' } }, 60_000)
    if (!res.ok) throw new BackendError(`fotoğraf indirilemedi (HTTP ${res.status})`, 'transient')
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < 10_000) throw new BackendError('indirilen fotoğraf çok küçük', 'transient')
    return { bytes, model: `${pick.source}+gemini-judge`, credit: pick.credit }
  },
}

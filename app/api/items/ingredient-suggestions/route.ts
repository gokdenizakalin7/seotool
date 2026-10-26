import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { sanitizeText } from '@/lib/sanitizer'
import { geminiJson, GEMINI_TEXT_MODELS } from '@/lib/server/gemini'
import { pendingSuggestions, uniqueIngredients } from '@/lib/ingredients'

export const maxDuration = 30

const MAX_SUGGESTIONS = 20
const CACHE_TTL_MS = 24 * 60 * 60_000
const CACHE_MAX = 500

const bodySchema = z.object({
  subdomain: z.string().min(1).max(80),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  current: z.array(z.string().max(80)).max(60).optional(),
})

// Aynı ürün (ad + kategori) için Gemini bir kez çağrılır; liste işletmeden bağımsızdır
const cache = new Map<string, { list: string[]; expires: number }>()

function cacheKey(name: string, category: string): string {
  return `${name}|${category}`.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()
}

async function suggest(name: string, description: string, category: string): Promise<string[]> {
  const key = cacheKey(name, category)
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.list

  const prompt = `Bir restoran/kafe/bar menüsündeki ürün için olası bileşenleri listele.
Ürün: ${name}
Kategori: ${category || '-'}
Açıklama: ${description || '-'}

Önce ürünün ana malzemelerini, ardından işletmelerin bu ürüne sıkça eklediği yan ve isteğe bağlı malzemeleri yaz
(baharat, sos, garnitür, süsleme; ör. köfte için pul biber, kimyon, maydanoz). İçecekte içeriği ve süslemeyi yaz.
Kurallar: Türkçe, her madde 1-3 kelime, ilk harfi büyük, marka adı yok, gramaj yok, tekrar yok, en fazla ${MAX_SUGGESTIONS} madde.
Yanıtı yalnızca şu JSON şemasında ver: {"ingredients": string[]}`

  const out = await geminiJson<{ ingredients?: unknown }>([{ text: prompt }], { models: GEMINI_TEXT_MODELS, timeoutMs: 12_000, temperature: 0.3 })
  const list = uniqueIngredients(Array.isArray(out?.ingredients) ? out.ingredients.filter((x): x is string => typeof x === 'string') : []).slice(0, MAX_SUGGESTIONS)
  if (list.length) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(key, { list, expires: Date.now() + CACHE_TTL_MS })
  }
  return list
}

/**
 * POST /api/items/ingredient-suggestions { subdomain, name, description?, category?, current? }
 * Ürün düzenleme ekranı için olası bileşenler (ana + isteğe bağlı); zaten seçili olanlar çıkarılır.
 * Gemini yoksa ya da yanıt vermezse boş liste döner (elle ekleme her zaman çalışır).
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  const body = parsed.data

  const access = await requireSubdomainAccess(req, sanitizeText(body.subdomain, 80))
  if ('response' in access) return access.response

  const rl = checkRateLimit(`ingredient_suggest_${access.user.id}`, RATE_LIMITS.INGREDIENT_SUGGEST.limit, RATE_LIMITS.INGREDIENT_SUGGEST.windowSeconds)
  if (!rl.success) {
    return NextResponse.json({ error: 'Çok hızlı istek, biraz bekleyin.' }, { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } })
  }

  const name = sanitizeText(body.name, 120)
  const description = body.description ? sanitizeText(body.description, 500) : ''
  const category = body.category ? sanitizeText(body.category, 80) : ''
  const current = (body.current || []).map((s) => sanitizeText(s, 80))

  try {
    const list = await suggest(name, description, category)
    return NextResponse.json({ suggestions: pendingSuggestions(list, current) })
  } catch (e: any) {
    console.warn('[ingredient-suggestions] Gemini atlandı:', e?.message || e)
    return NextResponse.json({ suggestions: [], unavailable: true })
  }
}

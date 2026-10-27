import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { getQuota, consumeQuota, RATE_LIMITS } from '@/lib/rate-limiter'
import { sanitizeText } from '@/lib/sanitizer'

export const maxDuration = 120

// Çağrı başına işlenen ürün sayısı; batch'ler paralel gider, her batch tek Gemini isteğidir
const MAX_PER_CALL = 100
const BATCH_SIZE = 20
const GEMINI_TIMEOUT_MS = 45_000

/**
 * Mod: hangi boş alanın AI ile doldurulacağı. Her modun kendi günlük hakkı vardır (MENU_ENRICH: 3/gün).
 *  nutrition   → kalorisi girilmemiş ürünler: kalori + alerjen + bileşen
 *  ingredients → bileşeni boş ürünler: yalnızca bileşen
 *  description → açıklaması boş ürünler: yalnızca 1 cümlelik tanıtım
 */
const MODES = ['nutrition', 'ingredients', 'description'] as const
type EnrichMode = (typeof MODES)[number]

interface EnrichItem {
  id: string
  name: string
  description: string
  category_name: string
}

interface GeminiResult {
  id: string
  calories?: number
  allergens?: string[]
  ingredients?: string[]
  description?: string
}

interface EnrichedItem {
  id: string
  calories?: number
  allergens?: string[]
  ingredients?: string[]
  description?: string
}

const itemsJson = (items: EnrichItem[]) =>
  JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, description: i.description || '', category: i.category_name })))

// Bileşen ve açıklama kuralları menü taramasıyla (app/api/scan-menu) aynı
const INGREDIENT_RULES = `- Ürün açıklamasında malzeme yazıyorsa onları AYNEN ve aynı sırayla kullan; kendinden ekleme ya da çıkarma yapma.
- Yazmıyorsa ürünün ana malzemelerini tahmin et (örn: pesto soslu makarna → ["Makarna", "Krema", "Fesleğen", "Çam fıstığı", "Parmesan peyniri"], latte → ["Espresso", "Süt"], şişe bira → ["Su", "Arpa maltı", "Şerbetçiotu", "Maya"], votka → ["Votka"]).
- Her madde 1-3 kelime, ilk harfi büyük, gramaj ve marka yok, en fazla 8 madde. Gerçekten tahmin edilemiyorsa boş dizi [].`

function buildPrompt(mode: EnrichMode, items: EnrichItem[]): string {
  if (mode === 'ingredients') {
    return `Sen uzman bir şef ve menü editörüsün.
Aşağıdaki restoran/bar menü ürünlerinin her biri için müşteri menüsünde "Bileşenler:" olarak gösterilecek ana bileşenleri Türkçe bir dizi olarak yaz.
${INGREDIENT_RULES}

Ürün listesi (JSON):
${itemsJson(items)}

Yanıtını tam olarak şu JSON formatında ver (başka metin ekleme), her ürün için "id" alanını aynen kopyala:
[
  { "id": "ürün id", "ingredients": ["Malzeme1", "Malzeme2"] }
]`
  }
  if (mode === 'description') {
    return `Sen deneyimli bir menü metin yazarısın.
Aşağıdaki restoran/bar menü ürünlerinin her biri için müşteri menüsünde ürün adının altında görünecek kısa bir açıklama yaz.
- İştah açıcı, Türkçe, 1 cümle, en fazla ~120 karakter: pişirme/sunum şekli, lezzet karakteri, porsiyon ya da servis bilgisi.
- Bileşenleri virgülle sıralayan bir liste YAZMA (bileşenler ayrı gösteriliyor).
- Uydurma iddia yazma ("kömür ateşinde", "ev yapımı", "günlük taze", "ödüllü", yıl/yaş gibi ürün adında olmayan bilgiler).
- Ürün adındaki bilgiyi (hacim "70 cl", "Tek/Duble", yıl "12 Years") doğru kullan; şişe/kadeh/shot servisini adına göre belirt.
- Alkollü içeceklerde aşırı tüketimi özendiren ifade kullanma.
(Örnek: Cafe de Paris Soslu Penne → "Tereyağlı, otlu Cafe de Paris sosuyla buluşan penne; üzerine parmesan rendesi." Filtre Kahve → "Taze çekilmiş çekirdekten demlenen, yumuşak içimli filtre kahve." Absolut 70 cl → "İsveç'in klasik, yumuşak içimli votkası; 70 cl şişe servis.")

Ürün listesi (JSON):
${itemsJson(items)}

Yanıtını tam olarak şu JSON formatında ver (başka metin ekleme), her ürün için "id" alanını aynen kopyala:
[
  { "id": "ürün id", "description": "Açıklama cümlesi." }
]`
  }
  return `Sen uzman bir diyetisyen ve gıda güvenliği uzmanısın.
Aşağıdaki restoran/bar menü ürünleri için:
1. Her ürünün 1 kişilik standart porsiyon bazında tahmini kalorisini (kcal) hesapla. Su gibi kalorisiz ürünler için 0 ver.
2. Her ürünün olası alerjenlerini Türkçe olarak listele. Yaygın alerjenler: Gluten, Süt Ürünleri, Yumurta, Fıstık, Ağaç Yemişi, Soya, Balık, Kabuklu Deniz Ürünü, Kereviz, Hardal, Susam, Kükürt Dioksit. Alerjen yoksa boş dizi döndür.
3. Her ürünün ana bileşenlerini (malzemelerini) Türkçe olarak kısa listele (en fazla 6 madde).

İçecekler için standart servis porsiyonunu baz al.
Alkollü içecekler için standart bardak/shot porsiyonunu baz al.

Ürün listesi (JSON):
${itemsJson(items)}

Yanıtını tam olarak şu JSON formatında ver (başka metin ekleme), her ürün için "id" alanını aynen kopyala:
[
  {
    "id": "ürün id",
    "calories": 123,
    "allergens": ["Alerjen1"],
    "ingredients": ["Malzeme1"]
  }
]`
}

async function callGemini(
  mode: EnrichMode,
  items: EnrichItem[],
  apiKey: string,
  batchNum: number
): Promise<GeminiResult[] | null> {
  const prompt = buildPrompt(mode, items)

  // Hızlı/az yüklü modeller önce; 503 (overloaded) ve timeout'ta sıradakine geçilir
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ]
  for (const model of models) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
    try {
      console.log(`[enrich] Batch ${batchNum}: ${model} çağrılıyor (${items.length} ürün)...`)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: mode === 'description' ? 0.4 : 0.1,
          },
        }),
      })

      if (!res.ok) {
        console.log(`[enrich] Batch ${batchNum}: ${model} HTTP ${res.status}`)
        continue
      }
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        console.log(`[enrich] Batch ${batchNum}: ${model} boş yanıt`)
        continue
      }
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        console.log(`[enrich] Batch ${batchNum}: ${model} dizi dönmedi`)
        continue
      }
      console.log(`[enrich] Batch ${batchNum}: ${model} başarılı, ${parsed.length} sonuç`)
      return parsed
    } catch (e: any) {
      console.log(`[enrich] Batch ${batchNum}: ${model} hata: ${e?.name === 'AbortError' ? `${GEMINI_TIMEOUT_MS / 1000}s timeout` : e?.message}`)
    } finally {
      clearTimeout(timeout)
    }
  }
  return null
}

const cleanList = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((a) => typeof a === 'string').map((a) => a.trim()).filter(Boolean) : null

async function processBatch(
  mode: EnrichMode,
  batch: EnrichItem[],
  apiKey: string,
  batchNum: number
): Promise<{ enriched: EnrichedItem[]; failed: number }> {
  const results = await callGemini(mode, batch, apiKey, batchNum)
  if (!results) return { enriched: [], failed: batch.length }

  const validIds = new Set(batch.map((i) => i.id))
  const enriched: EnrichedItem[] = []

  await Promise.all(
    results.map(async (result) => {
      // Gemini yalnızca gönderdiğimiz ürünleri güncelleyebilir
      if (!result?.id || !validIds.has(result.id)) return

      // Her mod yalnızca kendi alanlarını yazar; dolu alanın üzerine yazmamak için koşul sorguda da var
      const updateData: Record<string, unknown> = {}
      if (mode === 'nutrition') {
        const calories = Number(result.calories)
        if (Number.isFinite(calories) && calories >= 0 && calories <= 10000) updateData.calories = Math.round(calories)
        const allergens = cleanList(result.allergens)
        if (allergens) updateData.allergens = allergens
        const ingredients = cleanList(result.ingredients)
        if (ingredients) updateData.ingredients = ingredients.slice(0, 8)
      } else if (mode === 'ingredients') {
        const ingredients = cleanList(result.ingredients)
        if (ingredients?.length) updateData.ingredients = ingredients.slice(0, 8)
      } else {
        const description = sanitizeText(typeof result.description === 'string' ? result.description.trim() : '', 255)
        if (description) updateData.description = description
      }
      if (Object.keys(updateData).length === 0) return

      let q = supabaseAdmin.from('items').update(updateData).eq('id', result.id)
      if (mode === 'nutrition') q = q.is('calories', null)
      else if (mode === 'ingredients') q = q.eq('ingredients', '{}')
      else q = q.or('description.is.null,description.eq.')
      const { error } = await q
      if (error) {
        console.error(`[enrich] DB update hatası (${result.id}):`, error.message)
        return
      }
      enriched.push({ id: result.id, ...(updateData as Omit<EnrichedItem, 'id'>) })
    })
  )

  // DB hatası alanlar ve Gemini'nin yanıtta atladıkları başarısız sayılır
  return { enriched, failed: batch.length - enriched.length }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { subdomain } = body
  if (!subdomain || typeof subdomain !== 'string') {
    return NextResponse.json({ error: 'subdomain gerekli.' }, { status: 400 })
  }
  const mode: EnrichMode = body.mode == null ? 'nutrition' : body.mode
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: 'Geçersiz mod.' }, { status: 400 })
  }
  const LABEL = { nutrition: 'kalori ve alerjen', ingredients: 'bileşen', description: 'açıklama' }[mode]

  const access = await requireSubdomainAccess(req, subdomain)
  if ('response' in access) return access.response
  const orgId = access.organizationId

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API anahtarı yapılandırılmamış.' }, { status: 500 })
  }

  const quotaKey = mode === 'nutrition' ? `menu_enrich_${orgId}` : `menu_enrich_${mode}_${orgId}`
  const quota = getQuota(quotaKey, RATE_LIMITS.MENU_ENRICH.limit)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Günlük AI ${LABEL} doldurma limitine ulaştınız (${quota.limit}/gün). ${Math.ceil(quota.resetSeconds / 3600)} saat sonra tekrar deneyebilirsiniz.`,
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: 0,
      },
      { status: 429 }
    )
  }

  const { data: menus, error: menuError } = await supabaseAdmin
    .from('menus')
    .select('id, categories(id, name, items(id, name, description, calories, ingredients))')
    .eq('organization_id', orgId)

  if (menuError || !menus) {
    console.error('[enrich] Menü sorgu hatası:', menuError)
    return NextResponse.json({ error: 'Menü verileri okunamadı.' }, { status: 500 })
  }

  // Alanı boş ürünler (kalori: hiç girilmemiş; 0 = girilmiş sayılır, örn. su)
  const needs = (item: any): boolean =>
    mode === 'nutrition'
      ? item.calories == null
      : mode === 'ingredients'
        ? !Array.isArray(item.ingredients) || item.ingredients.length === 0
        : !String(item.description || '').trim()
  const itemsToEnrich: EnrichItem[] = []
  for (const menu of menus) {
    for (const cat of (menu as any).categories || []) {
      for (const item of cat.items || []) {
        if (needs(item)) {
          itemsToEnrich.push({
            id: item.id,
            name: item.name,
            description: item.description || '',
            category_name: cat.name,
          })
        }
      }
    }
  }
  console.log(`[enrich] ${subdomain} (${mode}): ${itemsToEnrich.length} ürün bekliyor`)

  if (itemsToEnrich.length === 0) {
    return NextResponse.json({
      success: true,
      enrichedCount: 0,
      failedCount: 0,
      totalRemaining: 0,
      enriched: [],
      message: `Tüm ürünlerde ${LABEL} bilgisi zaten mevcut.`,
      remaining: RATE_LIMITS.MENU_ENRICH.limit - quota.used,
    })
  }

  const itemsThisCall = itemsToEnrich.slice(0, MAX_PER_CALL)
  const batches: EnrichItem[][] = []
  for (let i = 0; i < itemsThisCall.length; i += BATCH_SIZE) {
    batches.push(itemsThisCall.slice(i, i + BATCH_SIZE))
  }

  const results = await Promise.all(batches.map((batch, idx) => processBatch(mode, batch, apiKey, idx + 1)))
  const enriched = results.flatMap((r) => r.enriched)
  const enrichedCount = enriched.length
  const failedCount = results.reduce((sum, r) => sum + r.failed, 0)
  const totalRemaining = itemsToEnrich.length - enrichedCount

  // Kota yalnızca menü tamamen dolduğunda düşer; yarım kalan/başarısız çağrılar hak harcamaz
  const consumed = enrichedCount > 0 && totalRemaining === 0
  if (consumed) consumeQuota(quotaKey, RATE_LIMITS.MENU_ENRICH.windowSeconds)

  console.log(`[enrich] Tamamlandı: ${enrichedCount} başarılı, ${failedCount} başarısız, ${totalRemaining} kalan`)

  const message =
    enrichedCount === 0
      ? 'AI servisi şu an yanıt vermedi, lütfen biraz sonra tekrar deneyin.'
      : totalRemaining > 0
        ? `${enrichedCount} ürün güncellendi, ${totalRemaining} ürün kaldı — tekrar tıklayın.`
        : `${enrichedCount} ürüne ${LABEL} bilgisi eklendi.`

  return NextResponse.json({
    success: enrichedCount > 0,
    enrichedCount,
    failedCount,
    totalProcessed: itemsThisCall.length,
    totalRemaining,
    enriched,
    remaining: Math.max(0, RATE_LIMITS.MENU_ENRICH.limit - quota.used - (consumed ? 1 : 0)),
    message,
  })
}

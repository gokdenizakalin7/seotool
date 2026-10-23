import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { getQuota, consumeQuota, RATE_LIMITS } from '@/lib/rate-limiter'

export const maxDuration = 120

// Çağrı başına işlenen ürün sayısı; batch'ler paralel gider, her batch tek Gemini isteğidir
const MAX_PER_CALL = 100
const BATCH_SIZE = 20
const GEMINI_TIMEOUT_MS = 45_000

interface EnrichItem {
  id: string
  name: string
  description: string
  category_name: string
}

interface GeminiResult {
  id: string
  calories: number
  allergens: string[]
  ingredients: string[]
}

interface EnrichedItem {
  id: string
  calories?: number
  allergens?: string[]
  ingredients?: string[]
}

async function callGemini(
  items: EnrichItem[],
  apiKey: string,
  batchNum: number
): Promise<GeminiResult[] | null> {
  const prompt = `Sen uzman bir diyetisyen ve gıda güvenliği uzmanısın.
Aşağıdaki restoran/bar menü ürünleri için:
1. Her ürünün 1 kişilik standart porsiyon bazında tahmini kalorisini (kcal) hesapla. Su gibi kalorisiz ürünler için 0 ver.
2. Her ürünün olası alerjenlerini Türkçe olarak listele. Yaygın alerjenler: Gluten, Süt Ürünleri, Yumurta, Fıstık, Ağaç Yemişi, Soya, Balık, Kabuklu Deniz Ürünü, Kereviz, Hardal, Susam, Kükürt Dioksit. Alerjen yoksa boş dizi döndür.
3. Her ürünün ana bileşenlerini (malzemelerini) Türkçe olarak kısa listele (en fazla 6 madde).

İçecekler için standart servis porsiyonunu baz al.
Alkollü içecekler için standart bardak/shot porsiyonunu baz al.

Ürün listesi (JSON):
${JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, description: i.description || '', category: i.category_name })))}

Yanıtını tam olarak şu JSON formatında ver (başka metin ekleme), her ürün için "id" alanını aynen kopyala:
[
  {
    "id": "ürün id",
    "calories": 123,
    "allergens": ["Alerjen1"],
    "ingredients": ["Malzeme1"]
  }
]`

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
            temperature: 0.1,
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

async function processBatch(
  batch: EnrichItem[],
  apiKey: string,
  batchNum: number
): Promise<{ enriched: EnrichedItem[]; failed: number }> {
  const results = await callGemini(batch, apiKey, batchNum)
  if (!results) return { enriched: [], failed: batch.length }

  const validIds = new Set(batch.map((i) => i.id))
  const enriched: EnrichedItem[] = []

  await Promise.all(
    results.map(async (result) => {
      // Gemini yalnızca gönderdiğimiz ürünleri güncelleyebilir
      if (!result?.id || !validIds.has(result.id)) return

      const updateData: Record<string, unknown> = {}
      const calories = Number(result.calories)
      if (Number.isFinite(calories) && calories >= 0 && calories <= 10000) {
        updateData.calories = Math.round(calories)
      }
      if (Array.isArray(result.allergens)) {
        updateData.allergens = result.allergens.filter((a) => typeof a === 'string').map((a) => a.trim()).filter(Boolean)
      }
      if (Array.isArray(result.ingredients)) {
        updateData.ingredients = result.ingredients.filter((a) => typeof a === 'string').map((a) => a.trim()).filter(Boolean)
      }
      if (Object.keys(updateData).length === 0) return

      const { error } = await supabaseAdmin.from('items').update(updateData).eq('id', result.id)
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

  const access = await requireSubdomainAccess(req, subdomain)
  if ('response' in access) return access.response
  const orgId = access.organizationId

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API anahtarı yapılandırılmamış.' }, { status: 500 })
  }

  const quotaKey = `menu_enrich_${orgId}`
  const quota = getQuota(quotaKey, RATE_LIMITS.MENU_ENRICH.limit)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Günlük AI zenginleştirme limitine ulaştınız (${quota.limit}/gün). ${Math.ceil(quota.resetSeconds / 3600)} saat sonra tekrar deneyebilirsiniz.`,
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: 0,
      },
      { status: 429 }
    )
  }

  const { data: menus, error: menuError } = await supabaseAdmin
    .from('menus')
    .select('id, categories(id, name, items(id, name, description, calories))')
    .eq('organization_id', orgId)

  if (menuError || !menus) {
    console.error('[enrich] Menü sorgu hatası:', menuError)
    return NextResponse.json({ error: 'Menü verileri okunamadı.' }, { status: 500 })
  }

  // Kalorisi hiç girilmemiş ürünler (0 = girilmiş sayılır, örn. su)
  const itemsToEnrich: EnrichItem[] = []
  for (const menu of menus) {
    for (const cat of (menu as any).categories || []) {
      for (const item of cat.items || []) {
        if (item.calories == null) {
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
  console.log(`[enrich] ${subdomain}: ${itemsToEnrich.length} ürün zenginleştirme bekliyor`)

  if (itemsToEnrich.length === 0) {
    return NextResponse.json({
      success: true,
      enrichedCount: 0,
      failedCount: 0,
      totalRemaining: 0,
      enriched: [],
      message: 'Tüm ürünlerde kalori ve alerjen bilgisi zaten mevcut.',
      remaining: RATE_LIMITS.MENU_ENRICH.limit - quota.used,
    })
  }

  const itemsThisCall = itemsToEnrich.slice(0, MAX_PER_CALL)
  const batches: EnrichItem[][] = []
  for (let i = 0; i < itemsThisCall.length; i += BATCH_SIZE) {
    batches.push(itemsThisCall.slice(i, i + BATCH_SIZE))
  }

  const results = await Promise.all(batches.map((batch, idx) => processBatch(batch, apiKey, idx + 1)))
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
        : `${enrichedCount} ürüne kalori ve alerjen bilgisi eklendi.`

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

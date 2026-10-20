import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { validateBase64Image } from '@/lib/file-validator'
import { sanitizeText, sanitizePrice } from '@/lib/sanitizer'
import { logSecurityEvent } from '@/lib/security-logger'
import { requireUser } from '@/lib/auth-middleware'
import { logUnmatched, matchScannedItems } from '@/lib/server/catalog-matcher'
import type { CatalogMatchInfo } from '@/lib/catalog-match'

export const maxDuration = 60

export async function GET() {
  const hasEnvKey = !!process.env.GEMINI_API_KEY
  return NextResponse.json({ hasKey: hasEnvKey })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // 0. OTURUM ZORUNLU (Gemini maliyetini yetkisiz kullanıma karşı koru)
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  // 1. RATE LIMIT KORUMASI (10 dakikada en fazla 5 tarama)
  const rateLimitKey = `scan_menu_${ip}`
  const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.MENU_SCAN.limit, RATE_LIMITS.MENU_SCAN.windowSeconds)

  if (!rateCheck.success) {
    logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      ip,
      endpoint: '/api/scan-menu',
      details: { limit: rateCheck.limit, window: RATE_LIMITS.MENU_SCAN.windowSeconds }
    })

    return NextResponse.json(
      {
        error: `Menü tarama hız limitine ulaştınız. Lütfen ${Math.ceil(rateCheck.resetSeconds / 60)} dakika sonra tekrar deneyin.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateCheck.resetSeconds
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.resetSeconds),
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateCheck.resetSeconds)
        }
      }
    )
  }

  try {
    const body = await req.json()
    const { images } = body

    const apiKey = process.env.GEMINI_API_KEY?.trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API anahtarı sunucu ortamında (.env.local) bulunamadı. Lütfen GEMINI_API_KEY tanımlayın.' },
        { status: 500 }
      )
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Taranacak menü görseli bulunamadı.' },
        { status: 400 }
      )
    }

    if (images.length > 10) {
      return NextResponse.json(
        { error: 'Tek seferde en fazla 10 adet menü fotoğrafı yükleyebilirsiniz.' },
        { status: 400 }
      )
    }

    // 2. DOSYA VE MAGIC BYTES DOĞRULAMASI
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      if (!img?.data) {
        return NextResponse.json(
          { error: `Fotoğraf #${i + 1} verisi eksik.` },
          { status: 400 }
        )
      }
      const validation = validateBase64Image(img.data)
      if (!validation.isValid) {
        logSecurityEvent({
          type: 'INVALID_FILE_UPLOAD',
          ip,
          endpoint: '/api/scan-menu',
          details: { index: i, error: validation.error }
        })
        return NextResponse.json(
          { error: `Fotoğraf #${i + 1} doğrulanamadı: ${validation.error}` },
          { status: 400 }
        )
      }
      // Doğrulanmış mime türünü kaydet
      img.mimeType = validation.mimeType
    }

    const promptText = `Sen uzman bir restoran ve kafe menü ayrıştırıcısısın.
Görüntülenen menü fotoğraflarını dikkatle analiz et.
Menüdeki tüm kategori başlıklarını ve her kategorinin altındaki ürünleri ve varsa fiyatlarını çıkar.

Önemli Kurallar:
1. Menüde yan yana sütunlar/kolonlar varsa sütunları ASLA birbirine karıştırma. Her sütunun başlık ve ürünlerini bağımsız ve doğru sırayla grupla.
2. Kafe/restoran adı veya logonun kendisi (örneğin "MEDUSA CAFE") kategori veya ürün DEĞİLDİR. Menü adı olarak menuName alanına ata.
3. Arka plandaki masa, sigara paketi, su şişesi, "sigara içmek öldürür", wifi şifresi gibi menü dışı tüm metinleri tamamen yok say.
4. Alt kısımdaki yemek/kahve fotoğraflarını veya dekoratif yazıları ürün sanma.
5. Fiyatlar: Eğer menüdeki fiyat kutucukları boşsa veya beyaz şeritle kapatılmışsa price alanını "" (boş) bırak. Fiyat yazıyorsa para birimiyle yaz (örneğin "120 ₺").
6. Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü) ve parantezli detayları (ör: "(French press)", "(Sütlü)") eksiksiz ve temiz yaz.
7. Menüdeki hiçbir geçerli kategoriyi ve ürünü atlama.
8. Kaloriler: Her ürün için uzman bir diyetisyen gibi düşünerek, Türk mutfağı ve restoran standartlarına göre 1 kişilik porsiyon bazında ortalama kalori değerini (kcal) tahmin et. Ürün genellikle garnitürle (ör: burgerin yanındaki patates) sunuluyorsa kaloriyi buna göre hesapla. İçeceklerde standart fincan/bardak porsiyonunu baz al.
11. Alerjenler: Her ürün için içerik tahmini yaparak Türkçe isimleriyle olası alerjenleri bir dizi (array) olarak döndür. (Örn: ["Gluten", "Süt", "Yumurta", "Fıstık", "Deniz Ürünü", "Soya"]). Eğer tahmin edilemiyorsa veya alerjen yoksa boş dizi [] döndür.
12. Açıklama: Her ürün için ürünün ana bileşenlerini (içindeki malzemeleri) açıkça belirten kısa bir açıklama yaz (maksimum 1-2 cümle). Sos, karışım veya özel bir bileşen varsa onun da içeriğini açıkla. (Örnek: Cafe de Paris Soslu Penne → "Penne makarna, Cafe de Paris sosu (tereyağı, hardal, kapari, maydanoz, sarımsak), parmesan peyniri rendesi." Filtre Kahve → "Taze çekilmiş Arabica kahve çekirdeği, sıcak su ile demleme.")
13. Bileşenler: Her ürün için ana malzemeleri (bileşenlerini) Türkçe olarak bir dizi (array) halinde döndür. Ürünün içerisindeki temel malzemeleri yaz (örn: pesto soslu makarna → ["Makarna", "Krema", "Fesleğen", "Çam fıstığı", "Parmesan peyniri"]). İçeceklerde de ana malzemeleri belirt (örn: latte → ["Espresso", "Süt"]). Malzeme tahmin edilemiyorsa boş dizi [] döndür.

Lütfen çıktıyı tam olarak şu JSON şemasında ver:
{
  "menuName": "string",
  "categories": [
    {
      "name": "string",
      "items": [
        {
          "name": "string",
          "description": "string",
          "price": "string",
          "calories": "number (tahmini 1 porsiyon kcal, eğer tahmin edemiyorsan null yaz)",
          "allergens": ["string", "string"],
          "ingredients": ["string", "string"]
        }
      ]
    }
  ]
}`

    const parts: any[] = [{ text: promptText }]

    for (const img of images) {
      const base64Idx = img.data.indexOf('base64,')
      const cleanData = (base64Idx !== -1 ? img.data.substring(base64Idx + 7) : img.data).trim()
      parts.push({
        inline_data: {
          mime_type: img.mimeType || 'image/jpeg',
          data: cleanData
        }
      })
    }

    // Aktif modeller
    // Model başına ücretsiz kota ayrıdır; ilk ikisi 429 verirse yedeklere geçilir
    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite'
    ]

    let lastError: any = null
    let responseText = ''

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1
            }
          })
        })

        if (!res.ok) {
          lastError = `HTTP ${res.status}`
          continue
        }

        const data = await res.json()
        const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (rawContent) {
          responseText = rawContent
          break
        }
      } catch (e: any) {
        lastError = e?.message || String(e)
      }
    }

    if (!responseText) {
      return NextResponse.json(
        { error: 'Görüntü analiz edilemedi. Lütfen daha net bir fotoğraf yükleyin veya daha sonra tekrar deneyin.' },
        { status: 500 }
      )
    }

    let parsedResult
    try {
      parsedResult = JSON.parse(responseText)
    } catch {
      const jsonMatch = responseText.match(/```json([\s\S]*?)```/) || responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[1] || jsonMatch[0])
      } else {
        throw new Error('Geçerli bir menü JSON yanıtı ayrıştırılamadı.')
      }
    }

    // Çıktıları XSS ve injection saldırılarına karşı sanitize et
    const sanitizedMenuName = sanitizeText(parsedResult.menuName || 'Taranan Menü', 100)
    type ScannedItem = {
      name: string
      description: string
      price: string
      calories: number | null
      allergens: string[]
      ingredients: string[]
      image_url: string
      catalog_item_id: string | null
      match: CatalogMatchInfo
    }
    const cleanedCategories: { name: string; items: ScannedItem[] }[] = (parsedResult.categories || []).map((cat: any) => ({
      name: sanitizeText(cat.name || 'Genel', 80),
      items: (cat.items || []).map((item: any): ScannedItem => ({
        name: sanitizeText(item.name || '', 120),
        description: sanitizeText(item.description || '', 255),
        price: sanitizePrice(item.price || ''),
        calories: typeof item.calories === 'number' ? item.calories : null,
        allergens: Array.isArray(item.allergens) ? item.allergens.map((a: any) => sanitizeText(String(a), 50)) : [],
        ingredients: Array.isArray(item.ingredients) ? item.ingredients.map((i: any) => sanitizeText(String(i), 80)) : [],
        image_url: '',
        catalog_item_id: null,
        match: { level: 'none', candidates: [] },
      }))
    }))

    // 3. KATALOG EŞLEŞTİRME: otomatik eşleşenlere katalog görseli + bağlantı; asla fırlatmaz (fail-open)
    const flat = cleanedCategories.flatMap((c, ci) => c.items.map((it, ii) => ({ ci, ii, name: it.name, category: c.name })))
    const infos = await matchScannedItems(flat, { menuName: sanitizedMenuName })
    const unmatched: { name: string; category_name: string; best_slug: string | null; best_score: number | null }[] = []
    flat.forEach((f, k) => {
      const info = infos[k]
      const it = cleanedCategories[f.ci].items[f.ii]
      it.match = info
      if (info.level === 'auto' && info.top) {
        it.catalog_item_id = info.top.item_id
        it.image_url = info.top.image_url || ''
      } else if (info.level === 'none' && it.name) {
        unmatched.push({
          name: it.name,
          category_name: f.category,
          best_slug: info.candidates[0]?.slug ?? null,
          best_score: info.candidates[0]?.score ?? null,
        })
      }
    })
    if (unmatched.length) logUnmatched(unmatched)

    return NextResponse.json({
      success: true,
      menuName: sanitizedMenuName,
      categories: cleanedCategories
    })
  } catch (error: any) {
    console.error('Scan Menu Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Menü taranırken beklenmeyen bir hata oluştu.' },
      { status: 500 }
    )
  }
}

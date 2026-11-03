import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, getQuota, consumeQuota, RATE_LIMITS } from '@/lib/rate-limiter'
import { sanitizeText } from '@/lib/sanitizer'
import { logSecurityEvent } from '@/lib/security-logger'
import { requirePanelUser } from '@/lib/auth-middleware'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // Oturum zorunlu (Gemini maliyetini yetkisiz kullanıma karşı koru)
  const auth = await requirePanelUser(req)
  if ('response' in auth) return auth.response

  // Rate Limit: 1 dakikada en fazla 30 kalori tahmini
  const rateLimitKey = `calorie_estimate_${ip}`
  const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.CALORIE_ESTIMATE.limit, RATE_LIMITS.CALORIE_ESTIMATE.windowSeconds)

  if (!rateCheck.success) {
    logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      ip,
      endpoint: '/api/estimate-calories',
      details: { limit: rateCheck.limit, window: RATE_LIMITS.CALORIE_ESTIMATE.windowSeconds }
    })

    return NextResponse.json(
      {
        error: `Kalori hesaplama hız limitine ulaştınız. Lütfen ${rateCheck.resetSeconds} saniye sonra tekrar deneyin.`,
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
    const { mode, itemName, ingredients, categoryHint } = body

    const apiKey = process.env.GEMINI_API_KEY?.trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API anahtarı sunucu ortamında (.env.local) bulunamadı.' },
        { status: 500 }
      )
    }

    if (!itemName || typeof itemName !== 'string' || itemName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Geçerli bir ürün adı belirtilmelidir.' },
        { status: 400 }
      )
    }

    const cleanItemName = sanitizeText(itemName.trim(), 150)
    const cleanCategory = categoryHint ? sanitizeText(categoryHint.trim(), 100) : ''

    // Ürün başına kota: aynı kullanıcı + aynı ürün adı için en fazla 2 hesaplama
    const itemKey = cleanItemName.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
    const quotaKey = `calorie_item_${auth.user.id}_${itemKey}`
    const quota = getQuota(quotaKey, RATE_LIMITS.CALORIE_PER_ITEM.limit)
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `"${cleanItemName}" için en fazla ${quota.limit} kez hesaplama yapabilirsiniz. Değeri elle düzenleyebilir veya başka bir ürün için hesaplayabilirsiniz.`,
          code: 'ITEM_QUOTA_EXCEEDED',
          used: quota.used,
          limit: quota.limit,
        },
        { status: 429 }
      )
    }
    const cleanIngredients = ingredients ? sanitizeText(ingredients.trim(), 1000) : ''

    let promptText: string

    if (mode === 'detailed' && cleanIngredients) {
      promptText = `Sen uzman bir beslenme diyetisyenisin ve gıda kalori hesaplama konusunda derin bilgiye sahipsin.
Aşağıdaki restoran menü ürününün toplam kalori değerini, verilen malzeme listesi ve gramajlarına göre hassas bir şekilde hesapla.

Ürün adı: ${cleanItemName}
${cleanCategory ? `Kategori: ${cleanCategory}` : ''}
Malzemeler ve gramajlar: ${cleanIngredients}

Kurallar:
1. Her malzemenin gramajına göre kalori hesapla ve toplamını ver.
2. Pişirme yöntemi (kızartma, ızgara vb.) kaloriyi etkiler, bunu da hesaba kat.
3. Eğer gramaj belirtilmemişse, o malzeme için Türk mutfağındaki standart restoran porsiyon miktarını varsay.
4. Yanıtını SADECE aşağıdaki JSON formatında ver, başka hiçbir şey yazma:

{"calories": 745, "confidence": "high", "note": "Hesaplama detayı: [kısa özet]"}`
    } else {
      promptText = `Sen uzman bir beslenme diyetisyenisin.
Aşağıdaki restoran menü ürününün 1 kişilik standart porsiyon için ortalama kalori değerini (kcal) tahmin et.

Ürün adı: ${cleanItemName}
${cleanCategory ? `Kategori: ${cleanCategory}` : ''}

Kurallar:
1. Türk mutfağı ve restoran standartlarına göre 1 kişilik porsiyon baz al.
2. Eğer ürün yanında garnitür ile servis ediliyorsa (ör: burger = patates kızartması dahil), garnitürü de dahil et.
3. İçeceklerde standart bardak/fincan porsiyonunu baz al.
4. Gerçekçi ve tutarlı bir tahmin yap.
5. Yanıtını SADECE aşağıdaki JSON formatında ver, başka hiçbir şey yazma:

{"calories": 650, "confidence": "high"}`
    }

    const modelsToTry = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ]

    let lastError: any = null
    let responseText = ''

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1
            }
          })
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          lastError = errData?.error?.message || `HTTP ${res.status}`
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
        { error: `Gemini API hatası: ${lastError || 'Yanıt alınamadı.'}` },
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
        throw new Error('Geçerli bir kalori JSON yanıtı ayrıştırılamadı.')
      }
    }

    const calories = parseInt(parsedResult.calories)
    if (isNaN(calories) || calories <= 0 || calories > 10000) {
      return NextResponse.json(
        { error: 'Geçersiz kalori değeri hesaplandı.' },
        { status: 500 }
      )
    }

    // Yalnızca başarılı hesaplamalar kotadan düşer
    consumeQuota(quotaKey, RATE_LIMITS.CALORIE_PER_ITEM.windowSeconds)

    return NextResponse.json({
      success: true,
      calories,
      remaining: Math.max(0, RATE_LIMITS.CALORIE_PER_ITEM.limit - (quota.used + 1)),
      confidence: parsedResult.confidence || 'medium',
      note: parsedResult.note || undefined
    })
  } catch (error: any) {
    console.error('Calorie Estimate Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Kalori hesaplanırken beklenmeyen bir hata oluştu.' },
      { status: 500 }
    )
  }
}

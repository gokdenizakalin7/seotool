import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { geminiJson } from '@/lib/server/gemini'
import { getBusinessTypeInfo } from '@/lib/server/public-menu'
import { jsonError, parseJsonBody } from '@/lib/server/site-api'
import { subdomainField } from '@/lib/site-schemas'
import { buildAboutTemplate, businessTypePhrase } from '@/lib/about-template'

const schema = z.object({ subdomain: subdomainField })

/** Metinden yasak karakterleri ve fazla boşluğu temizler */
function cleanAbout(text: string): string {
  return text
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2000)
}

/**
 * POST /api/site/about/generate — "Hakkımızda" metni önerisi. İşletme türü, adı, şehri, menü kategorileri ve
 * öne çıkan ürünlerinden Gemini ile yazılır; anahtar yoksa ya da hata olursa şablon metin döner.
 * KAYDETMEZ: panel metni gösterir, işletme düzenleyip profil güncellemesiyle kaydeder.
 */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, schema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response

  const rl = checkRateLimit(`about_${access.user.id}`, RATE_LIMITS.ABOUT_GENERATE.limit, RATE_LIMITS.ABOUT_GENERATE.windowSeconds)
  if (!rl.success) return jsonError(429, 'Çok fazla deneme yaptınız; biraz sonra tekrar deneyin.')

  const [{ data: org }, { data: menus }] = await Promise.all([
    supabaseAdmin.from('organizations').select('name, business_type, city, working_hours').eq('id', access.organizationId).maybeSingle(),
    supabaseAdmin
      .from('menus')
      .select('categories ( name, parent_id, is_active, items ( name, is_featured, is_available ) )')
      .eq('organization_id', access.organizationId)
      .eq('is_listed', true)
      .order('created_at', { ascending: true })
      .limit(1),
  ])
  if (!org) return jsonError(404, 'İşletme bulunamadı.')

  const cats = ((menus?.[0] as any)?.categories || []).filter((c: any) => c.is_active !== false)
  const categories: string[] = cats.filter((c: any) => !c.parent_id && c.items?.length).map((c: any) => c.name)
  const allItems = cats.flatMap((c: any) => c.items || []).filter((i: any) => i.is_available !== false)
  const featured: string[] = allItems.filter((i: any) => i.is_featured).map((i: any) => i.name)
  const sampleItems: string[] = (featured.length ? featured : allItems.map((i: any) => i.name)).slice(0, 8)
  const typeInfo = await getBusinessTypeInfo(org.business_type)

  const templateInput = {
    name: org.name,
    businessType: org.business_type,
    typeLabel: typeInfo.label,
    city: org.city,
    categories,
    featured,
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ text: buildAboutTemplate(templateInput), source: 'template' })
  }

  const facts = [
    `İşletme adı: ${org.name}`,
    `İşletme türü: ${businessTypePhrase(org.business_type, typeInfo.label)}`,
    org.city ? `Şehir: ${org.city}` : null,
    org.working_hours ? `Çalışma saatleri: ${org.working_hours}` : null,
    categories.length ? `Menü kategorileri: ${categories.slice(0, 10).join(', ')}` : null,
    sampleItems.length ? `Öne çıkan ürünler: ${sampleItems.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `Bir işletmenin web sitesindeki "Hakkımızda" bölümü için Türkçe metin yaz.

Bilgiler:
${facts}

Kurallar:
- "Biz" ağzından, sıcak ve samimi ama abartısız bir dil kullan.
- 2 kısa paragraf, toplam 350-600 karakter. Paragrafları boş satırla ayır.
- Yalnızca verilen bilgileri kullan: kuruluş yılı, ödül, şef adı, adres gibi verilmeyen bilgiler UYDURMA.
- Emoji, başlık, madde işareti ve tırnak kullanma.
- Yanıtı yalnızca şu JSON olarak ver: {"about": "metin"}`

  try {
    const result = await geminiJson<{ about?: string }>([{ text: prompt }], { temperature: 0.7, timeoutMs: 12000 })
    const text = cleanAbout(String(result?.about || ''))
    if (text.length >= 80) return NextResponse.json({ text, source: 'ai' })
  } catch (err: any) {
    console.warn('about generate:', err?.message || err)
  }
  return NextResponse.json({ text: buildAboutTemplate(templateInput), source: 'template' })
}

import { NextResponse } from 'next/server'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { isDataImageUrl, storeItemDataUrl } from '@/lib/server/localize-item-images'

// Panelde seçilen ürün fotoğrafı (sıkıştırılmış base64) hemen Storage'a yüklenir; menüye yalnızca adres girer.
// Böylece kayıt isteği küçük kalır (Vercel istek gövdesi sınırı 4,5 MB) ve tarayıcı taslağı şişmez.
const MAX_DATA_URL_CHARS = 4_000_000

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const subdomain = typeof body?.subdomain === 'string' ? body.subdomain : ''
  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : ''
  if (!subdomain) return NextResponse.json({ error: 'subdomain gerekli.' }, { status: 400 })
  if (!isDataImageUrl(dataUrl)) return NextResponse.json({ error: 'Geçerli bir görsel gönderilmedi.' }, { status: 400 })
  if (dataUrl.length > MAX_DATA_URL_CHARS) return NextResponse.json({ error: 'Görsel çok büyük.' }, { status: 413 })

  const access = await requireSubdomainAccess(request, subdomain)
  if ('response' in access) return access.response

  try {
    const url = await storeItemDataUrl(access.organizationId, dataUrl)
    return NextResponse.json({ url })
  } catch (e) {
    console.error('menus/upload-image:', (e as Error).message)
    return NextResponse.json({ error: 'Görsel yüklenemedi.' }, { status: 500 })
  }
}

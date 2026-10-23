import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MEDIA_BUCKET, pathFromPublicUrl } from '@/lib/server/storage'
import { isCatalogImage } from '@/lib/image-url'

/**
 * Dış adreslerden (ör. işletmenin eski sitesinden crawl edilen) ürün görsellerini indirir,
 * 768px WebP'ye çevirip orgs/{orgId}/items/ altına yükler ve ürün adreslerini günceller.
 * Hotlink edilen 1-2 MB'lık orijinaller editörü ve müşteri menüsünü çok yavaşlatıyordu.
 */

const ITEM_IMAGE_SIZE = 768
const CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 20_000
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export interface LocalizeResult {
  itemsTotal: number
  uniqueImages: number
  converted: number
  failed: number
  sourceBytes: number
  resultBytes: number
  errors: string[]
}

function isExternalImage(url: unknown): url is string {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
  if (isCatalogImage(url) || pathFromPublicUrl(url)) return false
  return true
}

async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = res.headers.get('content-type') || ''
    if (!type.startsWith('image/')) throw new Error(`görsel değil (${type || 'tür yok'})`)
    const len = Number(res.headers.get('content-length') || 0)
    if (len > MAX_SOURCE_BYTES) throw new Error('dosya çok büyük')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_SOURCE_BYTES) throw new Error('dosya çok büyük')
    return buf
  } finally {
    clearTimeout(timeout)
  }
}

async function toItemWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE, { fit: 'cover' })
    .webp({ quality: 78 })
    .toBuffer()
}

async function uploadItemImage(orgId: string, webp: Buffer): Promise<string> {
  const path = `orgs/${orgId}/items/${randomUUID()}.webp`
  const { error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (error) throw new Error(`yükleme: ${error.message}`)
  return supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function localizeOrgItemImages(orgId: string): Promise<LocalizeResult> {
  const { data: menus, error } = await supabaseAdmin
    .from('menus')
    .select('id, categories(id, items(id, image_url))')
    .eq('organization_id', orgId)
  if (error) throw new Error(`Menü okunamadı: ${error.message}`)

  // Aynı görseli kullanan ürünler tek indirme/yükleme paylaşır
  const idsByUrl = new Map<string, string[]>()
  let itemsTotal = 0
  for (const menu of menus || []) {
    for (const cat of (menu as any).categories || []) {
      for (const item of cat.items || []) {
        if (!isExternalImage(item.image_url)) continue
        itemsTotal++
        const ids = idsByUrl.get(item.image_url) || []
        ids.push(item.id)
        idsByUrl.set(item.image_url, ids)
      }
    }
  }

  const result: LocalizeResult = {
    itemsTotal,
    uniqueImages: idsByUrl.size,
    converted: 0,
    failed: 0,
    sourceBytes: 0,
    resultBytes: 0,
    errors: [],
  }
  const queue = [...idsByUrl.entries()]

  const worker = async () => {
    for (;;) {
      const next = queue.shift()
      if (!next) return
      const [url, ids] = next
      try {
        const source = await downloadImage(url)
        const webp = await toItemWebp(source)
        const publicUrl = await uploadItemImage(orgId, webp)
        const { error: updErr } = await supabaseAdmin.from('items').update({ image_url: publicUrl }).in('id', ids)
        if (updErr) throw new Error(`DB: ${updErr.message}`)
        result.converted += ids.length
        result.sourceBytes += source.length
        result.resultBytes += webp.length
      } catch (e: any) {
        result.failed += ids.length
        if (result.errors.length < 20) result.errors.push(`${url.split('/').pop()}: ${e?.message || e}`)
        console.warn('[localize-images]', url, e?.message || e)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

  console.log(
    `[localize-images] org ${orgId}: ${result.converted}/${itemsTotal} ürün, ` +
      `${(result.sourceBytes / 1048576).toFixed(1)} MB → ${(result.resultBytes / 1048576).toFixed(1)} MB, ${result.failed} hata`
  )
  return result
}

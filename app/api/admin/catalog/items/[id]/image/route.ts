import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { itemImageSchema } from '@/lib/server/admin/schemas'
import { ITEM_COLUMNS, catalogChanged, loadAllCategories, mapItem } from '@/lib/server/admin/catalog'
import {
  CATALOG_IMAGE_SIZE,
  removeCatalogImageFile,
  setCatalogItemImage,
  toCatalogWebp,
  uploadCatalogImage,
} from '@/lib/server/admin/catalog-image'
import { logAdminAction } from '@/lib/server/admin/audit'
import { validateBase64Image } from '@/lib/file-validator'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { buildCatalogPrompt, STYLE_SUFFIX } from '@/lib/catalog-image-prompt'
import { CloudflareImageError, generateCloudflareImage } from '@/lib/server/cloudflare-image'

export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

async function loadItem(params: Ctx['params']) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return null
  const { data } = await supabaseAdmin.from('catalog_items').select(ITEM_COLUMNS).eq('id', id).maybeSingle()
  return data
}

/** Yapraktan köke kategori slug zinciri (görsel stili için) */
async function categoryChain(categoryId: string): Promise<string[]> {
  const all = await loadAllCategories()
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain: string[] = []
  for (let cur = byId.get(categoryId); cur && chain.length < 10; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
    chain.push(cur.slug)
  }
  return chain
}

/**
 * POST /api/admin/catalog/items/[id]/image
 *   { mode: 'upload', dataUrl }      — admin'in yüklediği fotoğraf
 *   { mode: 'generate', prompt? }    — Cloudflare Workers AI ile üretim
 * Görsel varsayılan olarak kataloğa yazılır; restoranların kendi yüklediği görseller korunur.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog item image', async (actor) => {
    const item = await loadItem(params)
    if (!item) return jsonError(404, 'Ürün bulunamadı.')

    const body = await parseBody(request, itemImageSchema)
    if ('response' in body) return body.response
    const input = body.data

    let webp: Buffer
    if (input.mode === 'upload') {
      const v = validateBase64Image(input.dataUrl)
      if (!v.isValid) return jsonError(400, v.error || 'Geçersiz görsel.', 'INVALID_IMAGE')
      const raw = Buffer.from(input.dataUrl.slice(input.dataUrl.indexOf('base64,') + 7), 'base64')
      webp = await toCatalogWebp(raw)
    } else {
      if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
        return jsonError(503, 'AI görsel üretimi bu sunucuda yapılandırılmamış.', 'NOT_CONFIGURED')
      }
      const rl = checkRateLimit(`admin_imggen_${actor.id}`, RATE_LIMITS.IMAGE_GENERATE.limit, RATE_LIMITS.IMAGE_GENERATE.windowSeconds)
      if (!rl.success) return jsonError(429, 'Çok hızlı üretim isteği, biraz bekleyin.', 'RATE_LIMIT')

      const built = buildCatalogPrompt(item, await categoryChain(item.primary_category_id))
      const prompt = input.prompt?.trim() ? `${input.prompt.trim()}, ${STYLE_SUFFIX}` : built.prompt
      try {
        const raw = await generateCloudflareImage({
          prompt,
          width: CATALOG_IMAGE_SIZE,
          height: CATALOG_IMAGE_SIZE,
          steps: 4,
          // Her üretimde farklı sonuç: aynı seed aynı görseli verirdi
          seed: Math.floor(Math.random() * 2_000_000_000),
        })
        webp = await toCatalogWebp(raw)
      } catch (e) {
        if (e instanceof CloudflareImageError && e.kind !== 'fatal') {
          return jsonError(503, 'Görsel servisi şu an yoğun ya da günlük kota doldu, birazdan tekrar deneyin.', 'PROVIDER_BUSY')
        }
        throw e
      }
    }

    const url = await uploadCatalogImage(item.slug, webp)
    const propagation = await setCatalogItemImage(item.id, url)
    if (item.image_url && item.image_url !== url) await removeCatalogImageFile(item.image_url)
    catalogChanged()

    await logAdminAction({
      actor,
      action: input.mode === 'upload' ? 'catalog_item.image_upload' : 'catalog_item.image_generate',
      targetType: 'catalog_item',
      targetId: item.id,
      targetLabel: item.name,
      before: { image_url: item.image_url || '' },
      after: { image_url: url, ...propagation },
    })

    const { data: fresh } = await supabaseAdmin.from('catalog_items').select(ITEM_COLUMNS).eq('id', item.id).single()
    return NextResponse.json({ item: mapItem(fresh), propagation })
  })
}

/** DELETE — katalog görselini kaldırır; restoranlarda yalnızca varsayılan görsel olarak duranlar temizlenir. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return adminRoute(request, 'catalog item image delete', async (actor) => {
    const item = await loadItem(params)
    if (!item) return jsonError(404, 'Ürün bulunamadı.')
    if (!item.image_url) return NextResponse.json({ item: mapItem(item), propagation: null })

    const propagation = await setCatalogItemImage(item.id, '')
    await removeCatalogImageFile(item.image_url)
    catalogChanged()

    await logAdminAction({
      actor,
      action: 'catalog_item.image_remove',
      targetType: 'catalog_item',
      targetId: item.id,
      targetLabel: item.name,
      before: { image_url: item.image_url },
      after: { image_url: '', ...propagation },
    })

    const { data: fresh } = await supabaseAdmin.from('catalog_items').select(ITEM_COLUMNS).eq('id', item.id).single()
    return NextResponse.json({ item: mapItem(fresh), propagation })
  })
}

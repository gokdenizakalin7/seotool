import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BUCKET } from './orgs'
import type { ImagePropagationResult } from '@/lib/admin-types'

/**
 * Admin panelinden yüklenen katalog varsayılan görselleri.
 * Yol: menu-images/catalog/{slug}-{8 hex}.webp — is_catalog_default_image() (migration 11) bu biçimi tanır,
 * böylece restoranların kendi yüklediği görseller yayılımda asla ezilmez.
 */

export const CATALOG_IMAGE_SIZE = 768
const STORAGE_PREFIX = 'catalog/'
const PUBLIC_MARKER = `/object/public/${BUCKET}/`

export async function toCatalogWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(CATALOG_IMAGE_SIZE, CATALOG_IMAGE_SIZE, { fit: 'cover' })
    .webp({ quality: 78 })
    .toBuffer()
}

export async function uploadCatalogImage(slug: string, webp: Buffer): Promise<string> {
  const hash = createHash('sha256').update(webp).digest('hex').slice(0, 8)
  const path = `${STORAGE_PREFIX}${slug}-${hash}.webp`
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: true })
  if (error) throw new Error(`Görsel yüklenemedi: ${error.message}`)
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Yalnızca Storage'daki katalog görselini siler; repo'daki statik /catalog/ dosyalarına dokunmaz. */
export async function removeCatalogImageFile(url: string | null | undefined): Promise<void> {
  if (!url) return
  const i = url.indexOf(PUBLIC_MARKER)
  if (i === -1) return
  const path = url.slice(i + PUBLIC_MARKER.length).split('?')[0]
  if (!path.startsWith(STORAGE_PREFIX)) return
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path])
  if (error) console.error('katalog görseli silinemedi:', path, error.message)
}

/** Görseli kataloğa yazar ve bağlı restoran ürünlerine (yalnızca varsayılan görselliler) yayar. */
export async function setCatalogItemImage(itemId: string, url: string): Promise<ImagePropagationResult> {
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('catalog_items')
    .update({ image_url: url, admin_edited_at: now, updated_at: now })
    .eq('id', itemId)
  if (error) throw error

  const { data, error: rpcErr } = await supabaseAdmin.rpc('backfill_catalog_item_image', { p_catalog_item_id: itemId })
  if (rpcErr) {
    console.error('backfill_catalog_item_image:', rpcErr.message)
    return { updated: 0, cleared: 0, kept_custom: 0, linked: 0 }
  }
  return data as ImagePropagationResult
}

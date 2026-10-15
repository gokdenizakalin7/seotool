import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateBase64Image } from '@/lib/file-validator'

/** İşletme görselleri (logo, kapak, etkinlik afişi) Supabase Storage'da tek bir herkese açık bucket'ta */
export const MEDIA_BUCKET = 'menu-images'

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Herkese açık adresten bucket içi yol; bu bucket'a ait değilse null */
export function pathFromPublicUrl(url?: string | null): string | null {
  if (!url) return null
  const marker = `/object/public/${MEDIA_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

/** Adres bu işletmenin klasöründe mi (ör. orgs/{orgId}/events/) */
export function isOrgMediaUrl(url: string | null | undefined, orgId: string, folder = ''): boolean {
  const path = pathFromPublicUrl(url)
  return !!path && path.startsWith(`orgs/${orgId}/${folder}`)
}

export type UploadResult = { url: string; path: string } | { error: string; status: number }

/** base64 görseli doğrular (sihirli bayt), boyutu sınırlar ve orgs/{orgId}/{folder}/{uuid}.{ext} olarak yükler */
export async function uploadOrgImage(orgId: string, folder: string, dataUrl: unknown, maxBytes: number): Promise<UploadResult> {
  const v = validateBase64Image(dataUrl as string)
  if (!v.isValid || !v.mimeType || !EXT[v.mimeType]) return { error: v.error || 'Geçersiz görsel.', status: 400 }

  const raw = String(dataUrl)
  const buffer = Buffer.from(raw.slice(raw.indexOf('base64,') + 7), 'base64')
  if (buffer.length > maxBytes) {
    return { error: `Görsel çok büyük (en fazla ${Math.round(maxBytes / 1024 / 1024)} MB).`, status: 413 }
  }

  const path = `orgs/${orgId}/${folder}/${crypto.randomUUID()}.${EXT[v.mimeType]}`
  const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(path, buffer, { contentType: v.mimeType, upsert: false })
  if (error) {
    console.error('uploadOrgImage:', error)
    return { error: 'Görsel yüklenemedi.', status: 500 }
  }
  const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Yalnızca bu işletmenin klasöründeki dosyayı siler (başka adresleri sessizce yok sayar) */
export async function removeOrgImage(orgId: string, url: string | null | undefined): Promise<void> {
  const path = pathFromPublicUrl(url)
  if (!path || !path.startsWith(`orgs/${orgId}/`)) return
  const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([path])
  if (error) console.warn('removeOrgImage:', error.message)
}

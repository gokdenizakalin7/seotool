import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser, requireOrgAccess } from '@/lib/auth-middleware'
import { validateBase64Image } from '@/lib/file-validator'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { MEDIA_BUCKET, pathFromPublicUrl } from '@/lib/server/storage'

const BUCKET = MEDIA_BUCKET
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_BYTES = 2 * 1024 * 1024 // sıkıştırılmış logo/kapak için yeterli

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const rl = checkRateLimit(`asset_${auth.user.id}`, RATE_LIMITS.ASSET_UPLOAD.limit, RATE_LIMITS.ASSET_UPLOAD.windowSeconds)
    if (!rl.success) {
      return NextResponse.json({ error: 'Çok fazla yükleme yaptınız, biraz bekleyin.' }, { status: 429 })
    }

    const { kind, dataUrl, organizationId } = await request.json()
    if (kind !== 'logo' && kind !== 'cover') {
      return NextResponse.json({ error: 'Geçersiz görsel türü.' }, { status: 400 })
    }

    // Organizasyonu üyelikten çöz (istemci kimliğine güvenme)
    let orgId: string | undefined = organizationId
    if (!orgId || !auth.user.isSuperAdmin) {
      const { data: m } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', auth.user.id)
        .maybeSingle()
      if (!auth.user.isSuperAdmin) orgId = m?.organization_id
    }
    if (!orgId) return NextResponse.json({ error: 'Restoran bulunamadı.' }, { status: 404 })

    const access = await requireOrgAccess(request, orgId)
    if ('response' in access) return access.response

    const v = validateBase64Image(dataUrl)
    if (!v.isValid || !v.mimeType) {
      return NextResponse.json({ error: v.error || 'Geçersiz görsel.' }, { status: 400 })
    }

    const b64 = String(dataUrl).slice(String(dataUrl).indexOf('base64,') + 7)
    const buffer = Buffer.from(b64, 'base64')
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Görsel çok büyük (en fazla 2 MB).' }, { status: 413 })
    }

    const column = kind === 'logo' ? 'logo_url' : 'cover_url'
    const path = `orgs/${orgId}/${kind}-${Date.now()}.${EXT[v.mimeType]}`

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: v.mimeType, upsert: false })
    if (upErr) {
      console.error('asset upload error:', upErr)
      return NextResponse.json({ error: 'Görsel yüklenemedi.' }, { status: 500 })
    }

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    const { data: old } = await supabaseAdmin.from('organizations').select(column).eq('id', orgId).maybeSingle()
    const { error: dbErr } = await supabaseAdmin
      .from('organizations')
      .update({ [column]: pub.publicUrl })
      .eq('id', orgId)
    if (dbErr) {
      await supabaseAdmin.storage.from(BUCKET).remove([path])
      return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 })
    }

    const oldPath = pathFromPublicUrl((old as any)?.[column])
    if (oldPath && oldPath.startsWith(`orgs/${orgId}/`)) {
      await supabaseAdmin.storage.from(BUCKET).remove([oldPath])
    }

    return NextResponse.json({ success: true, url: pub.publicUrl })
  } catch (err) {
    console.error('assets error:', err)
    return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 })
  }
}

/** Logo / kapağı kaldırır. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response
    const kind = new URL(request.url).searchParams.get('kind')
    if (kind !== 'logo' && kind !== 'cover') {
      return NextResponse.json({ error: 'Geçersiz görsel türü.' }, { status: 400 })
    }
    // Süper admin "Panele Gir" sırasında hedef restoranı belirtir; diğerleri üyelikten çözülür
    let orgId = auth.user.isSuperAdmin ? new URL(request.url).searchParams.get('organizationId') : null
    if (!orgId) {
      const { data: m } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', auth.user.id)
        .maybeSingle()
      orgId = m?.organization_id ?? null
    }
    if (!orgId) return NextResponse.json({ error: 'Restoran bulunamadı.' }, { status: 404 })

    const access = await requireOrgAccess(request, orgId)
    if ('response' in access) return access.response

    const column = kind === 'logo' ? 'logo_url' : 'cover_url'
    const { data: old } = await supabaseAdmin.from('organizations').select(column).eq('id', orgId).maybeSingle()
    await supabaseAdmin.from('organizations').update({ [column]: null }).eq('id', orgId)
    const oldPath = pathFromPublicUrl((old as any)?.[column])
    if (oldPath && oldPath.startsWith(`orgs/${orgId}/`)) {
      await supabaseAdmin.storage.from(BUCKET).remove([oldPath])
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 })
  }
}

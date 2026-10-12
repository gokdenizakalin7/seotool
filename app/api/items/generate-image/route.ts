import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { sanitizeText } from '@/lib/sanitizer'
import { buildItemPrompt } from '@/lib/catalog-image-prompt'
import { CloudflareImageError, generateCloudflareImage } from '@/lib/server/cloudflare-image'
import { getPlatformSettings } from '@/lib/server/platform-settings'

export const maxDuration = 60

const BUCKET = 'menu-images'
const OUTPUT_SIZE = 512

async function caps() {
  const s = await getPlatformSettings()
  return { org: s.image_gen_org_daily_cap, global: s.image_gen_daily_cap }
}

const bodySchema = z.object({
  subdomain: z.string().min(1).max(80),
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
})

function nextUtcMidnight(): string {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.toISOString()
}

async function quotaSnapshot(orgId: string) {
  const { data } = await supabaseAdmin.rpc('get_image_generation_quota', { p_org_id: orgId })
  const used = (data || {}) as { org_used?: number; global_used?: number }
  const cap = await caps()
  return {
    orgRemaining: Math.max(0, cap.org - (used.org_used ?? 0)),
    globalRemaining: Math.max(0, cap.global - (used.global_used ?? 0)),
    resetsAt: nextUtcMidnight(),
  }
}

/** GET /api/items/generate-image?subdomain=… — kalan günlük kota */
export async function GET(req: NextRequest) {
  const subdomain = sanitizeText(req.nextUrl.searchParams.get('subdomain') || '', 80)
  if (!subdomain) return NextResponse.json({ error: 'subdomain gerekli.' }, { status: 400 })
  const access = await requireSubdomainAccess(req, subdomain, { allowSuspended: true })
  if ('response' in access) return access.response
  try {
    return NextResponse.json({ configured: !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN), ...(await quotaSnapshot(access.organizationId)) })
  } catch (e) {
    console.error('image quota error:', e)
    return NextResponse.json({ error: 'Kota okunamadı.' }, { status: 500 })
  }
}

/**
 * POST /api/items/generate-image { subdomain, name, description?, category? }
 * Cloudflare Workers AI (ücretsiz havuz) ile 512x512 ürün görseli üretir, Storage'a yazar, URL döner.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  const body = parsed.data

  const access = await requireSubdomainAccess(req, sanitizeText(body.subdomain, 80))
  if ('response' in access) return access.response
  const { user, organizationId } = access

  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    return NextResponse.json({ error: 'AI görsel üretimi bu sunucuda yapılandırılmamış.', code: 'NOT_CONFIGURED' }, { status: 503 })
  }

  const rl = checkRateLimit(`imggen_${user.id}`, RATE_LIMITS.IMAGE_GENERATE.limit, RATE_LIMITS.IMAGE_GENERATE.windowSeconds)
  if (!rl.success) {
    return NextResponse.json({ error: 'Çok hızlı üretim isteği, biraz bekleyin.' }, { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } })
  }

  const name = sanitizeText(body.name, 120)
  const description = body.description ? sanitizeText(body.description, 300) : ''
  const category = body.category ? sanitizeText(body.category, 80) : ''

  // Kota önce düşülür; üretim başarısızsa geri verilir
  const cap = await caps()
  const { data: quota, error: quotaErr } = await supabaseAdmin.rpc('consume_image_generation_quota', {
    p_org_id: organizationId,
    p_org_cap: cap.org,
    p_global_cap: cap.global,
  })
  if (quotaErr) {
    console.error('consume_image_generation_quota error:', quotaErr)
    return NextResponse.json({ error: 'Kota kontrol edilemedi.' }, { status: 500 })
  }
  const q = (quota || {}) as { allowed?: boolean; org_used?: number; global_used?: number }
  if (!q.allowed) {
    return NextResponse.json(
      {
        error: 'Günlük AI görsel kotası doldu. Yarın tekrar deneyin ya da fotoğraf yükleyin.',
        code: 'QUOTA_EXCEEDED',
        orgRemaining: Math.max(0, cap.org - (q.org_used ?? 0)),
        globalRemaining: Math.max(0, cap.global - (q.global_used ?? 0)),
        resetsAt: nextUtcMidnight(),
      },
      { status: 429 }
    )
  }

  const release = () => supabaseAdmin.rpc('release_image_generation_quota', { p_org_id: organizationId }).then(() => undefined, () => undefined)

  try {
    const { prompt, seed } = buildItemPrompt({ name, description, category })
    const raw = await generateCloudflareImage({ prompt, width: OUTPUT_SIZE, height: OUTPUT_SIZE, steps: 4, seed })
    const webp = await sharp(raw).resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' }).webp({ quality: 78 }).toBuffer()

    const path = `orgs/${organizationId}/items/${randomUUID()}.webp`
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (upErr) {
      await release()
      console.error('generated image upload error:', upErr)
      return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 })
    }
    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      success: true,
      url: pub.publicUrl,
      orgRemaining: Math.max(0, cap.org - (q.org_used ?? 0)),
      globalRemaining: Math.max(0, cap.global - (q.global_used ?? 0)),
      resetsAt: nextUtcMidnight(),
    })
  } catch (e: any) {
    await release()
    if (e instanceof CloudflareImageError) {
      if (e.kind === 'quota') {
        return NextResponse.json({ error: 'Günlük AI görsel kotası doldu (Cloudflare). Yarın tekrar deneyin.', code: 'PROVIDER_QUOTA' }, { status: 503 })
      }
      if (e.kind === 'capacity' || e.kind === 'rate' || e.kind === 'transient') {
        return NextResponse.json({ error: 'Görsel servisi şu an yoğun, birazdan tekrar deneyin.', code: 'PROVIDER_BUSY' }, { status: 503 })
      }
    }
    console.error('generate-image error:', e)
    return NextResponse.json({ error: 'Görsel üretilemedi.' }, { status: 500 })
  }
}

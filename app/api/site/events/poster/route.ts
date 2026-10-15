import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { subdomainField } from '@/lib/site-schemas'
import { jsonError, parseJsonBody } from '@/lib/server/site-api'
import { uploadOrgImage } from '@/lib/server/storage'

const MAX_BYTES = 3 * 1024 * 1024 // istemcide sıkıştırılmış afiş için yeterli

const schema = z.object({ subdomain: subdomainField, dataUrl: z.string().min(32).max(6_000_000) })

/** POST /api/site/events/poster — afişi yükler, adresini döner (etkinlik kaydedilirken bu adres gönderilir) */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, schema)
  if ('response' in body) return body.response
  const access = await requireSubdomainAccess(request, body.data.subdomain)
  if ('response' in access) return access.response

  const rl = checkRateLimit(`asset_${access.user.id}`, RATE_LIMITS.ASSET_UPLOAD.limit, RATE_LIMITS.ASSET_UPLOAD.windowSeconds)
  if (!rl.success) return jsonError(429, 'Çok fazla yükleme yaptınız, biraz bekleyin.')

  const result = await uploadOrgImage(access.organizationId, 'events', body.data.dataUrl, MAX_BYTES)
  if ('error' in result) return jsonError(result.status, result.error)
  return NextResponse.json({ url: result.url }, { status: 201 })
}

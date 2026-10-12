/**
 * Cloudflare Workers AI görsel üretimi (REST). Sunucu rotası ve toplu script ortak kullanır.
 * Ücretsiz havuz: 10.000 nöron/gün (00:00 UTC'de sıfırlanır).
 * flux-2-klein-4b: 26,05 nöron / 512x512 çıktı karosu. 512² ≈ 26, 1024² ≈ 104 nöron.
 */

export type CloudflareImageModel = '@cf/black-forest-labs/flux-2-klein-4b' | '@cf/black-forest-labs/flux-1-schnell'

export const CF_DEFAULT_MODEL: CloudflareImageModel = '@cf/black-forest-labs/flux-2-klein-4b'
export const CF_KLEIN_NEURONS_PER_TILE = 26.05

export type CloudflareErrorKind = 'quota' | 'capacity' | 'rate' | 'transient' | 'fatal'

export class CloudflareImageError extends Error {
  constructor(message: string, public kind: CloudflareErrorKind, public status?: number, public code?: number) {
    super(message)
    this.name = 'CloudflareImageError'
  }
}

export interface CloudflareImageRequest {
  prompt: string
  width?: number
  height?: number
  steps?: number
  seed?: number
  model?: CloudflareImageModel
}

export function estimateKleinNeurons(width: number, height: number): number {
  return Math.ceil(width / 512) * Math.ceil(height / 512) * CF_KLEIN_NEURONS_PER_TILE
}

function classify(status: number, code?: number): CloudflareErrorKind {
  // 3036: hesap kotası, 4006: günlük ücretsiz 10.000 nöron bitti (00:00 UTC'de sıfırlanır)
  if (status === 429 && (code === 3036 || code === 4006)) return 'quota'
  if (status === 429 && code === 3040) return 'capacity'
  if (status === 429) return 'rate'
  if (status === 408 || status >= 500) return 'transient'
  return 'fatal'
}

/** JSON gövdeyi dener; model JSON kabul etmezse (400) multipart/form-data ile tekrar dener. */
export async function generateCloudflareImage(req: CloudflareImageRequest, env = process.env): Promise<Buffer> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const token = env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountId || !token) throw new CloudflareImageError('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN tanımlı değil', 'fatal')

  const model = req.model ?? CF_DEFAULT_MODEL
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`
  const fields: Record<string, string | number> = { prompt: req.prompt }
  if (model === '@cf/black-forest-labs/flux-1-schnell') {
    fields.steps = Math.min(8, req.steps ?? 4)
  } else {
    fields.width = req.width ?? 512
    fields.height = req.height ?? 512
    fields.steps = req.steps ?? 4
  }
  if (req.seed != null) fields.seed = req.seed

  const attempt = async (asMultipart: boolean): Promise<Response> => {
    if (!asMultipart) {
      return fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    }
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
    return fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  }

  let res = await attempt(false)
  if (res.status === 400) {
    const errText = await res.text().catch(() => '')
    if (/multipart|form-data|5004|3003/i.test(errText)) res = await attempt(true)
    else throw new CloudflareImageError(`Cloudflare 400: ${errText.slice(0, 200)}`, 'fatal', 400)
  }

  if (!res.ok) {
    let code: number | undefined
    let message = `Cloudflare HTTP ${res.status}`
    try {
      const j: any = await res.json()
      code = j?.errors?.[0]?.code
      message = j?.errors?.[0]?.message || message
    } catch {
      /* gövde JSON değil */
    }
    throw new CloudflareImageError(message, classify(res.status, code), res.status, code)
  }

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const j: any = await res.json()
    const b64: string | undefined = j?.result?.image ?? j?.result?.images?.[0]
    if (!b64) throw new CloudflareImageError('Cloudflare yanıtında görsel yok', 'transient')
    return Buffer.from(b64, 'base64')
  }
  return Buffer.from(await res.arrayBuffer())
}

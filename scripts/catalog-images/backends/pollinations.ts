/** Pollinations — tongyi-mai/z-image-turbo (0,004 Pollen/görsel, 60 istek/dk). Anahtar: POLLINATIONS_API_KEY (sk_). */
import { BackendError, type Backend, type GenerateContext, type GenerateResult } from '../types'
import { fetchWithTimeout, retryAfterMs } from '../common'

const MODEL = 'tongyi-mai/z-image-turbo'

export const pollinationsBackend: Backend = {
  name: 'pollinations',
  concurrency: 3,
  minIntervalMs: 1_100,
  async generate(ctx: GenerateContext): Promise<GenerateResult> {
    const key = process.env.POLLINATIONS_API_KEY?.trim()
    if (!key) throw new BackendError('POLLINATIONS_API_KEY tanımlı değil (enter.pollinations.ai → API key)', 'fatal')
    const size = ctx.size || 1024
    const url =
      `https://gen.pollinations.ai/image/${encodeURIComponent(ctx.prompt)}` +
      `?model=${encodeURIComponent(MODEL)}&width=${size}&height=${size}&seed=${ctx.seed}&nologo=true`
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${key}` } }, 120_000)
    if (res.status === 429) throw new BackendError('Pollinations hız limiti', 'rate', retryAfterMs(res, 20_000))
    if (res.status === 402 || res.status === 403) throw new BackendError(`Pollinations Pollen bitti / yetki yok (HTTP ${res.status})`, 'quota')
    if (res.status === 401) throw new BackendError('Pollinations anahtarı geçersiz', 'fatal')
    if (res.status >= 500) throw new BackendError(`Pollinations HTTP ${res.status}`, 'transient')
    if (!res.ok) throw new BackendError(`Pollinations HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`, 'fatal')
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) throw new BackendError(`Pollinations görsel döndürmedi (${ct})`, 'transient')
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < 2_000) throw new BackendError('Pollinations boş/placeholder görsel döndürdü', 'transient')
    return { bytes, model: MODEL }
  },
}

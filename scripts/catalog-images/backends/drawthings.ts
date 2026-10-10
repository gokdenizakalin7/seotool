/** Yerel Draw Things (Mac) — HTTP API: Ayarlar → API Server (varsayılan 127.0.0.1:7860), A1111 uyumlu txt2img. */
import { BackendError, type Backend, type GenerateContext, type GenerateResult } from '../types'
import { fetchWithTimeout } from '../common'

export const drawThingsBackend: Backend = {
  name: 'drawthings',
  concurrency: 1,
  minIntervalMs: 0,
  async generate(ctx: GenerateContext): Promise<GenerateResult> {
    const base = (process.env.DRAWTHINGS_URL || 'http://127.0.0.1:7860').replace(/\/$/, '')
    let res: Response
    try {
      res = await fetchWithTimeout(
        `${base}/sdapi/v1/txt2img`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: ctx.prompt, width: ctx.size, height: ctx.size, steps: 8, seed: ctx.seed, batch_size: 1 }),
        },
        300_000
      )
    } catch (e: any) {
      if (/ECONNREFUSED|fetch failed/i.test(String(e?.message || e)))
        throw new BackendError('Draw Things\'e bağlanılamadı: uygulamayı açın ve Ayarlar → API Server (HTTP) seçeneğini etkinleştirin', 'fatal')
      throw new BackendError(`Draw Things: ${String(e?.message || e)}`, 'transient')
    }
    if (!res.ok) throw new BackendError(`Draw Things HTTP ${res.status}`, res.status >= 500 ? 'transient' : 'fatal')
    const data: any = await res.json()
    const b64: string | undefined = data?.images?.[0]
    if (!b64) throw new BackendError('Draw Things yanıtında görsel yok', 'transient')
    return { bytes: Buffer.from(b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64, 'base64'), model: 'drawthings/local' }
  },
}

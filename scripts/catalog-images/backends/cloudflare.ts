/** Cloudflare Workers AI — flux-2-klein-4b. Nöron defteri generate.ts'de tutulur. */
import { CloudflareImageError, generateCloudflareImage, CF_DEFAULT_MODEL } from '../../../lib/server/cloudflare-image'
import { BackendError, type Backend, type GenerateContext, type GenerateResult } from '../types'

export const cloudflareBackend: Backend = {
  name: 'cloudflare',
  concurrency: 2,
  minIntervalMs: 300,
  async generate(ctx: GenerateContext): Promise<GenerateResult> {
    try {
      const bytes = await generateCloudflareImage({ prompt: ctx.prompt, width: ctx.size, height: ctx.size, steps: 4, seed: ctx.seed })
      return { bytes, model: CF_DEFAULT_MODEL }
    } catch (e) {
      if (e instanceof CloudflareImageError) {
        const retry = e.kind === 'rate' ? 15_000 : e.kind === 'capacity' ? 30_000 : undefined
        throw new BackendError(`Cloudflare: ${e.message}${e.code ? ` (kod ${e.code})` : ''}`, e.kind, retry)
      }
      throw new BackendError(`Cloudflare: ${(e as Error).message}`, 'transient')
    }
  },
}

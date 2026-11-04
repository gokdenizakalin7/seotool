import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, isRateLimitEnabled } from '@/lib/rate-limiter'

/**
 * Kalıcı hız sınırı: sayaçlar Supabase'de (migration 22, consume_rate_limits). Bellek içi sınırın aksine tüm
 * sunucu örneklerinde ortaktır ve deploy'da sıfırlanmaz. E-posta gönderimi ve hesap uçları için.
 *
 * Kurallar birlikte denetlenir: biri doluysa hiçbiri sayılmaz. Anahtardaki e-posta/IP gibi kişisel değerler
 * veritabanına SHA-256 özeti olarak yazılır. Fonksiyon yoksa (migration çalışmadı) ya da Supabase'e ulaşılamazsa
 * bellek içi sınıra döner: koruma zayıflar ama hiçbir akış kilitlenmez.
 */

export type LimitRule = {
  /** Okunabilir ön ek + değer, ör. ['forgot:ip', ip]; değer özetlenir */
  key: [prefix: string, value?: string]
  limit: number
  windowSeconds: number
}

export type LimitResult = { ok: true } | { ok: false; prefix: string; retryAfterSeconds: number }

const HOUR = 3600
const DAY = 86400
export const WINDOW = { HOUR, DAY } as const

function ruleKey([prefix, value]: LimitRule['key']): string {
  if (value === undefined) return prefix
  const digest = createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
  return `${prefix}:${digest}`
}

let warnedFallback = false

export async function consumeLimits(rules: LimitRule[]): Promise<LimitResult> {
  if (!isRateLimitEnabled() || rules.length === 0) return { ok: true }

  const keyed = rules.map((r) => ({ rule: r, key: ruleKey(r.key) }))
  const { data, error } = await supabaseAdmin.rpc('consume_rate_limits', {
    p_rules: keyed.map(({ rule, key }) => ({ key, limit: rule.limit, window: rule.windowSeconds })),
  })

  if (!error && data && typeof data === 'object') {
    const res = data as { allowed?: boolean; key?: string; retry_after?: number }
    if (res.allowed) return { ok: true }
    const hit = keyed.find((k) => k.key === res.key)
    return { ok: false, prefix: hit?.rule.key[0] || 'unknown', retryAfterSeconds: res.retry_after || 60 }
  }

  if (!warnedFallback) {
    warnedFallback = true
    console.error('[rate-limit] consume_rate_limits çağrılamadı, bellek içi sınıra dönüldü (migration 22?):', error?.message)
  }
  for (const { rule, key } of keyed) {
    const r = checkRateLimit(`persist_${key}`, rule.limit, rule.windowSeconds)
    if (!r.success) return { ok: false, prefix: rule.key[0], retryAfterSeconds: r.resetSeconds }
  }
  return { ok: true }
}

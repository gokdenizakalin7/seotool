import { LEGAL_COMPANY } from '@/lib/legal'
import { consumeLimits, WINDOW, type LimitRule } from '@/lib/server/persistent-rate-limit'

/**
 * İşlemsel e-posta gönderimi (Resend HTTP API; SDK yok). Yalnızca sunucuda.
 *
 * RESEND_API_KEY yoksa e-posta gönderilmez, konsola yazılır (geliştirmede bağlantılar terminalden alınır).
 * Gönderim hatası çağıranı asla düşürmez: bildirim gitmese de onay/red, kayıt gibi işlem tamamlanır.
 *
 * Ortam değişkenleri: RESEND_API_KEY, EMAIL_FROM (varsayılan "QR Chef <bildirim@qr-chef.com.tr>"; alan adı
 * Resend'de doğrulanmış olmalı), ADMIN_NOTIFY_EMAIL (yeni başvuru bildirimi; varsayılan destek adresi),
 * EMAIL_DAILY_LIMIT (24 saatte en fazla e-posta; varsayılan 95, Resend ücretsiz planı günde 100).
 *
 * Gönderim tavanları (kalıcı, lib/server/persistent-rate-limit.ts), tetikleyene göre:
 *  - 'user'  (giriş yapmamış biri tetikler: şifre yenileme, doğrulama, başvuru alındı): alıcı başına saatte 5 /
 *            günde 10 ve günlük kotanın %70'i. Kötüye kullanım kotayı bitirse de onay/red e-postalarına yer kalır.
 *  - 'team'  (kayıtla tetiklenen ekip bildirimi): aynı %70'lik pay; alıcı sınırı yok (hepsi aynı adrese gider).
 *  - 'admin' (sistem yöneticisi işlemi: onay/red): yalnızca günlük toplam tavan.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'QR Chef <bildirim@qr-chef.com.tr>'

export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export type EmailResult = { ok: true; id?: string } | { ok: false; skipped?: boolean; rateLimited?: boolean; error?: string }

export type EmailTrigger = 'user' | 'team' | 'admin'

function dailyLimit(): number {
  const n = Number(process.env.EMAIL_DAILY_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 95
}

function sendLimits(trigger: EmailTrigger, to: string[]): LimitRule[] {
  const daily = dailyLimit()
  const rules: LimitRule[] = [{ key: ['email:all'], limit: daily, windowSeconds: WINDOW.DAY }]
  if (trigger === 'admin') return rules
  rules.push({ key: ['email:public'], limit: Math.max(1, Math.floor(daily * 0.7)), windowSeconds: WINDOW.DAY })
  if (trigger === 'user') {
    for (const addr of to) {
      rules.push({ key: ['email:to:hour', addr], limit: 5, windowSeconds: WINDOW.HOUR })
      rules.push({ key: ['email:to:day', addr], limit: 10, windowSeconds: WINDOW.DAY })
    }
  }
  return rules
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/** Yeni başvuru gibi ekip bildirimlerinin gideceği adres */
export function adminNotifyEmail(): string {
  return (process.env.ADMIN_NOTIFY_EMAIL || '').trim() || LEGAL_COMPANY.email
}

export async function sendEmail(message: EmailMessage, trigger: EmailTrigger): Promise<EmailResult> {
  const to = Array.isArray(message.to) ? message.to : [message.to]
  const limited = await consumeLimits(sendLimits(trigger, to))
  if (!limited.ok) {
    console.warn(`[email] tavan doldu (${limited.prefix}), gönderilmedi → ${message.subject}`)
    return { ok: false, rateLimited: true, error: limited.prefix }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY yok, gönderilmedi → ${message.to} · ${message.subject}`)
    if (process.env.NODE_ENV !== 'production') console.info(`[email] içerik:\n${message.text}`)
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: (process.env.EMAIL_FROM || '').trim() || DEFAULT_FROM,
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo || LEGAL_COMPANY.email,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[email] Resend hatası:', res.status, data?.message || data)
      return { ok: false, error: data?.message || `HTTP ${res.status}` }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[email] gönderilemedi:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

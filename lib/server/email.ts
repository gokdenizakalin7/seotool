import { LEGAL_COMPANY } from '@/lib/legal'

/**
 * İşlemsel e-posta gönderimi (Resend HTTP API; SDK yok). Yalnızca sunucuda.
 *
 * RESEND_API_KEY yoksa e-posta gönderilmez, konsola yazılır (geliştirmede bağlantılar terminalden alınır).
 * Gönderim hatası çağıranı asla düşürmez: bildirim gitmese de onay/red, kayıt gibi işlem tamamlanır.
 *
 * Ortam değişkenleri: RESEND_API_KEY, EMAIL_FROM (varsayılan "QR Chef <bildirim@qr-chef.com.tr>"; alan adı
 * Resend'de doğrulanmış olmalı), ADMIN_NOTIFY_EMAIL (yeni başvuru bildirimi; varsayılan destek adresi).
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

export type EmailResult = { ok: true; id?: string } | { ok: false; skipped?: boolean; error?: string }

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/** Yeni başvuru gibi ekip bildirimlerinin gideceği adres */
export function adminNotifyEmail(): string {
  return (process.env.ADMIN_NOTIFY_EMAIL || '').trim() || LEGAL_COMPANY.email
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
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
        to: Array.isArray(message.to) ? message.to : [message.to],
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

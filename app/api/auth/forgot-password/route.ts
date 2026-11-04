import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { consumeLimits } from '@/lib/server/persistent-rate-limit'
import { emailLinkOrigin, sendPasswordResetEmail } from '@/lib/server/account-emails'

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) })

/**
 * POST /api/auth/forgot-password { email }
 * Kayıtlı e-postaya şifre yenileme bağlantısı (/auth/sifre-yenile) gönderir. Hesap olsun olmasın aynı yanıt döner.
 * Sınırlar kalıcı (IP ve e-posta başına saatte 5); gönderimde ayrıca alıcı ve günlük tavan (lib/server/email.ts).
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 })
  const { email } = parsed.data

  const { limit, windowSeconds } = RATE_LIMITS.AUTH_EMAIL
  const limited = await consumeLimits([
    { key: ['forgot:ip', getClientIp(request)], limit, windowSeconds },
    { key: ['forgot:email', email], limit, windowSeconds },
  ])
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Çok fazla deneme yaptınız. Lütfen bir süre sonra tekrar deneyin.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    )
  }

  await sendPasswordResetEmail(email, emailLinkOrigin(request))
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { emailLinkOrigin, sendPasswordResetEmail } from '@/lib/server/account-emails'

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) })

/**
 * POST /api/auth/forgot-password { email }
 * Kayıtlı e-postaya şifre yenileme bağlantısı (/auth/sifre-yenile) gönderir. Hesap olsun olmasın aynı yanıt döner.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 })
  const { email } = parsed.data

  const { limit, windowSeconds } = RATE_LIMITS.AUTH_EMAIL
  const byIp = checkRateLimit(`forgot_ip_${getClientIp(request)}`, limit, windowSeconds)
  const byEmail = checkRateLimit(`forgot_email_${email}`, limit, windowSeconds)
  if (!byIp.success || !byEmail.success) {
    return NextResponse.json(
      { error: 'Çok fazla deneme yaptınız. Lütfen bir süre sonra tekrar deneyin.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(byIp.resetSeconds, byEmail.resetSeconds)) } }
    )
  }

  await sendPasswordResetEmail(email, emailLinkOrigin(request))
  return NextResponse.json({ ok: true })
}

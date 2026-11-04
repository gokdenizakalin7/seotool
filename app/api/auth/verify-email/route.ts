import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const schema = z.object({ tokenHash: z.string().min(10).max(200) })

/**
 * POST /api/auth/verify-email { tokenHash }
 * Kayıt doğrulama bağlantısı (/auth/dogrula). Doğrulamanın açtığı oturum kapatılır; kullanıcı /login'den girer
 * (onay bekleyen başvuru orada durdurulur). requiresApproval: sayfa "başvurunuz inceleniyor" mu desin.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`verify_ip_${getClientIp(request)}`, RATE_LIMITS.AUTH_LOGIN.limit, RATE_LIMITS.AUTH_LOGIN.windowSeconds)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Çok fazla deneme yaptınız. Lütfen bir süre sonra tekrar deneyin.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
    )
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Doğrulama bağlantısı eksik.' }, { status: 400 })

  const anon = createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({ type: 'signup', token_hash: parsed.data.tokenHash })
  if (error || !data.user) {
    return NextResponse.json(
      {
        error: 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Giriş yapmayı deneyin; e-postanız doğrulanmadıysa yeni bağlantı gönderilir.',
        code: 'TOKEN_INVALID',
      },
      { status: 400 }
    )
  }
  if (data.session) await supabaseAdmin.auth.admin.signOut(data.session.access_token).catch(() => undefined)

  return NextResponse.json({ ok: true, requiresApproval: data.user.user_metadata?.requires_approval === true })
}

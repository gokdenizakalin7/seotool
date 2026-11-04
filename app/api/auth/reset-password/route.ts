import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const schema = z.object({
  tokenHash: z.string().min(10).max(200),
  password: z.string().min(8).max(100),
})

/**
 * POST /api/auth/reset-password { tokenHash, password }
 * E-postadaki yenileme belirteci doğrulanır, şifre sunucuda değiştirilir ve doğrulamanın açtığı oturum kapatılır:
 * kullanıcı yeni şifresiyle /login'den girer (onay bekleyen başvuru denetimi orada).
 * Belirteç tek kullanımlıktır; şifre biçimi belirteç harcanmadan önce denetlenir.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`reset_ip_${getClientIp(request)}`, RATE_LIMITS.AUTH_LOGIN.limit, RATE_LIMITS.AUTH_LOGIN.windowSeconds)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Çok fazla deneme yaptınız. Lütfen bir süre sonra tekrar deneyin.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
    )
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Şifreniz en az 8 karakter olmalı.' }, { status: 400 })
  const { tokenHash, password } = parsed.data

  const anon = createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (error || !data.user) {
    return NextResponse.json(
      { error: 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir şifre yenileme bağlantısı isteyin.', code: 'TOKEN_INVALID' },
      { status: 400 }
    )
  }

  // Yönetici açtığı hesapta "ilk girişte şifre değiştir" zorunluluğu da kalkar: şifreyi kullanıcı kendisi belirledi
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password,
    user_metadata: { ...(data.user.user_metadata || {}), must_change_password: false },
  })
  if (data.session) await supabaseAdmin.auth.admin.signOut(data.session.access_token).catch(() => undefined)
  if (updateErr) {
    console.error('reset-password update:', updateErr)
    const weak = /password/i.test(updateErr.message) && /weak|short|characters/i.test(updateErr.message)
    return NextResponse.json(
      { error: weak ? 'Bu şifre çok zayıf. Daha uzun ya da farklı bir şifre deneyin.' : 'Şifre güncellenemedi. Lütfen tekrar deneyin.' },
      { status: weak ? 400 : 500 }
    )
  }

  return NextResponse.json({ ok: true, email: data.user.email || '' })
}

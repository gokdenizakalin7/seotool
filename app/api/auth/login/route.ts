import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rateLimit = checkRateLimit(ip, RATE_LIMITS.AUTH_LOGIN.limit, RATE_LIMITS.AUTH_LOGIN.windowSeconds)

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Çok fazla giriş denemesi yaptınız. Lütfen daha sonra tekrar deneyin.' },
        { status: 429, headers: { 'Retry-After': rateLimit.resetSeconds.toString() } }
      )
    }

    const { email, password } = await request.json()
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      // Admin panelinden girişi engellenen kullanıcı
      if (error.code === 'user_banned' || /banned/i.test(error.message)) {
        return NextResponse.json(
          { error: 'Hesabınızın girişi yönetici tarafından engellendi. Lütfen bizimle iletişime geçin.', code: 'USER_BANNED' },
          { status: 403 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

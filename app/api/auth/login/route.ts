import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSystemAdmin } from '@/lib/auth-middleware'
import { emailLinkOrigin, sendVerificationEmail } from '@/lib/server/account-emails'
import { consumeLimits } from '@/lib/server/persistent-rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Kullanıcının üye olduğu işletme onay bekliyor mu (/signup başvurusu, sistem yöneticisi henüz onaylamadı) */
async function isPendingApplicant(userId: string): Promise<boolean> {
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!member) return false
  const { data: org } = await supabaseAdmin.from('organizations').select('status').eq('id', member.organization_id).maybeSingle()
  return org?.status === 'pending'
}

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
      // E-postası doğrulanmamış kayıt (EMAIL_VERIFICATION_REQUIRED): şifre doğru, bağlantı yeniden gönderilir
      if (error.code === 'email_not_confirmed') {
        const { limit, windowSeconds } = RATE_LIMITS.AUTH_EMAIL
        if ((await consumeLimits([{ key: ['verify-resend:email', String(email)], limit, windowSeconds }])).ok) {
          const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: 'signup', email, password })
          if (link?.properties?.hashed_token) {
            const businessName = link.user?.user_metadata?.business_name || 'İşletmeniz'
            await sendVerificationEmail(email, link.properties.hashed_token, businessName, emailLinkOrigin(request))
          } else if (linkErr) {
            console.error('login verification resend:', linkErr)
          }
        }
        return NextResponse.json(
          {
            error: 'E-posta adresiniz henüz doğrulanmadı. Doğrulama bağlantısını e-postanıza yeniden gönderdik; gelen kutunuzu ve spam klasörünü kontrol edin.',
            code: 'EMAIL_NOT_CONFIRMED',
          },
          { status: 403 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Onay bekleyen başvuru giriş yapamaz: açılan oturum hemen kapatılır, belirteç istemciye verilmez.
    // (Doğrudan Supabase ile oturum açılsa bile panel uçları 403 ORG_PENDING döner; bkz. lib/auth-middleware.ts)
    if (data.user && !isSystemAdmin(data.user) && (await isPendingApplicant(data.user.id))) {
      if (data.session) await supabaseAdmin.auth.admin.signOut(data.session.access_token).catch(() => undefined)
      return NextResponse.json(
        { error: 'Hesabınız henüz onaylanmadı. Başvurunuz incelendikten sonra giriş yapabilirsiniz.', code: 'ORG_PENDING' },
        { status: 403 }
      )
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

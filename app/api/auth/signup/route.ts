import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { getSetting } from '@/lib/server/platform-settings'
import { LEGAL_VERSION } from '@/lib/legal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Telefon: rakamlar (+ ile başlayabilir); 0xxx / 5xx / 90xxx biçimleri +90'a çevrilir */
function normalizePhone(input: string): string {
  const hasPlus = input.trim().startsWith('+')
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith('0')) return `+90${digits.slice(1)}`
    if (digits.length === 10 && digits.startsWith('5')) return `+90${digits}`
    if (digits.length === 12 && digits.startsWith('90')) return `+${digits}`
  }
  return `+${digits}`
}

const schema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(100),
  ownerPhone: z
    .string()
    .trim()
    .regex(/^[+0-9 ()./-]{10,24}$/)
    .refine((v) => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(100),
  acceptTerms: z.literal(true),
  website: z.string().optional(), // honeypot
})

/** GET: kayıt formunun açılışta bilmesi gerekenler (kayıt açık mı, başvuru onay bekler mi) */
export async function GET() {
  const [enabled, requiresApproval] = await Promise.all([getSetting('signup_enabled'), getSetting('signup_requires_approval')])
  return NextResponse.json({ enabled, requiresApproval, termsVersion: LEGAL_VERSION })
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getSetting('signup_enabled'))) {
      return NextResponse.json(
        { error: 'Yeni kayıtlar şu an kapalı. Hesap açmak için bizimle iletişime geçin.', code: 'SIGNUP_DISABLED' },
        { status: 403 }
      )
    }

    const ip = getClientIp(request)
    const rl = checkRateLimit(`signup_${ip}`, RATE_LIMITS.AUTH_SIGNUP.limit, RATE_LIMITS.AUTH_SIGNUP.windowSeconds)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
      )
    }

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Lütfen tüm alanları doğru doldurun (geçerli telefon, şifre en az 8 karakter) ve koşulları onaylayın.' },
        { status: 400 }
      )
    }
    const { ownerName, businessName, ownerPhone, email, password, website } = parsed.data

    // Bot tuzağı: sessizce başarılı gibi davran
    if (website) return NextResponse.json({ ok: true }, { status: 200 })

    // Başvuru onayı: işletme sistem yöneticisi onaylayana kadar 'pending' açılır (handle_new_user, migration 16)
    const requiresApproval = await getSetting('signup_requires_approval')

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      // E-posta servisi bağlanana kadar doğrulama yok (EMAIL_VERIFICATION_REQUIRED=true ile açılacak)
      email_confirm: process.env.EMAIL_VERIFICATION_REQUIRED !== 'true',
      user_metadata: {
        business_name: businessName,
        owner_name: ownerName,
        owner_phone: normalizePhone(ownerPhone),
        requires_approval: requiresApproval,
        // Kabul edilen sözleşme sürümü ve zamanı (ispat kaydı)
        terms_version: LEGAL_VERSION,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_ip: ip,
      },
    })

    if (createErr || !created?.user) {
      const msg = (createErr?.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.' }, { status: 409 })
      }
      console.error('signup createUser error:', createErr)
      return NextResponse.json({ error: 'Hesap oluşturulamadı. Lütfen tekrar deneyin.' }, { status: 500 })
    }

    const userId = created.user.id

    // Tetikleyicinin organizasyon + üyelik oluşturduğunu doğrula
    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!member) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('signup: organization trigger did not create membership for', userId)
      return NextResponse.json({ error: 'Restoran kaydı oluşturulamadı. Lütfen tekrar deneyin.' }, { status: 500 })
    }

    // Doğrulama zorunluysa oturum açma
    if (process.env.EMAIL_VERIFICATION_REQUIRED === 'true') {
      return NextResponse.json({ ok: true, verifyEmail: true, requiresApproval })
    }

    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({ email, password })
    if (signInErr || !sess?.session) {
      return NextResponse.json({ ok: true, needsLogin: true, requiresApproval })
    }

    return NextResponse.json({
      ok: true,
      requiresApproval,
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
      },
    })
  } catch (err) {
    console.error('signup error:', err)
    return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 })
  }
}

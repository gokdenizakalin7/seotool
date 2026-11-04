import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { canonicalOrigin, sitePath } from '@/lib/site-url'
import { getOrgMembers } from '@/lib/server/admin/orgs'
import { adminNotifyEmail, sendEmail, type EmailResult } from '@/lib/server/email'
import {
  applicationApprovedEmail,
  applicationReceivedEmail,
  applicationRejectedEmail,
  newApplicationAdminEmail,
  passwordResetEmail,
  verifyEmailEmail,
} from '@/lib/server/email-templates'

/**
 * Hesap e-postaları: şifre yenileme, e-posta doğrulama, başvuru alındı/onay/red ve ekibe yeni başvuru bildirimi.
 *
 * Doğrulama ve yenileme bağlantıları Supabase'in kendi e-postasıyla değil, admin generateLink'in hashed_token'ı ile
 * bizim sayfalarımıza (/auth/…) kurulur: şablon Türkçe ve kodda, Supabase'de yönlendirme listesi gerekmez.
 */

/**
 * E-postadaki bağlantıların kök adresi. Üretimde sabit alan adı (Host başlığıyla oynanarak başka adrese bağlantı
 * yollatılamasın); geliştirmede isteğin geldiği adres (localhost).
 */
export function emailLinkOrigin(request: NextRequest): string {
  return process.env.NODE_ENV === 'production' ? canonicalOrigin() : request.nextUrl.origin
}

/**
 * Şifre yenileme bağlantısı gönderir. Kayıtlı olmayan e-postada sessizce döner (hesap varlığı dışarı sızmaz).
 */
export async function sendPasswordResetEmail(email: string, origin: string): Promise<EmailResult | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.hashed_token) {
    if (error && error.status !== 404 && !/not.?found/i.test(error.message)) console.error('[email] recovery link:', error)
    return null
  }
  const url = `${origin}/auth/sifre-yenile?token_hash=${encodeURIComponent(data.properties.hashed_token)}`
  return sendEmail({ to: email, ...passwordResetEmail(url) }, 'user')
}

/** Doğrulama bağlantısını gönderir (hashed_token generateLink'ten: signup ya da yeniden gönderim) */
export async function sendVerificationEmail(email: string, hashedToken: string, businessName: string, origin: string) {
  const url = `${origin}/auth/dogrula?token_hash=${encodeURIComponent(hashedToken)}`
  return sendEmail({ to: email, ...verifyEmailEmail(url, businessName) }, 'user')
}

/** Başvuru sahibine "başvurunuz alındı" (onay gereken kayıtta; e-posta doğrulaması açıksa doğrulama e-postası yeter) */
export async function sendApplicationReceivedEmail(email: string, businessName: string) {
  return sendEmail({ to: email, ...applicationReceivedEmail(businessName) }, 'user')
}

/** Ekibe yeni kayıt bildirimi */
export async function sendNewApplicationNotice(
  opts: { businessName: string; ownerName: string; email: string; phone: string; requiresApproval: boolean },
  origin: string
) {
  const adminUrl = `${origin}/admin/${opts.requiresApproval ? 'applications' : 'restaurants'}`
  return sendEmail({ to: adminNotifyEmail(), ...newApplicationAdminEmail({ ...opts, adminUrl }) }, 'team')
}

type OrgForEmail = { id: string; name: string | null; subdomain: string | null }

/**
 * Başvuru sonucu işletme sahibine: onay (pending/rejected → active) ya da red. Askı ve yeniden incelemeye almada
 * e-posta gitmez. Sahip bulunamazsa ya da gönderim başarısızsa sessizce döner; durum değişikliği zaten kaydedildi.
 */
export async function sendApplicationDecisionEmail(
  org: OrgForEmail,
  previousStatus: string | null,
  nextStatus: string,
  reason: string,
  origin: string
): Promise<EmailResult | null> {
  const approved = nextStatus === 'active' && (previousStatus === 'pending' || previousStatus === 'rejected')
  const rejected = nextStatus === 'rejected' && previousStatus !== 'rejected'
  if (!approved && !rejected) return null

  try {
    const owner = (await getOrgMembers(org.id)).find((m) => m.role === 'owner')
    if (!owner?.email) return null
    const businessName = org.name || 'İşletmeniz'

    if (approved) {
      return await sendEmail(
        {
          to: owner.email,
          ...applicationApprovedEmail({
            businessName,
            loginUrl: `${origin}/login`,
            siteUrl: org.subdomain ? `${origin}${sitePath(org.subdomain)}` : origin,
          }),
        },
        'admin'
      )
    }
    return await sendEmail({ to: owner.email, ...applicationRejectedEmail({ businessName, reason }) }, 'admin')
  } catch (err) {
    console.error('[email] başvuru sonucu e-postası:', err)
    return null
  }
}

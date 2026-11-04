import { LEGAL_COMPANY } from '@/lib/legal'
import { canonicalOrigin } from '@/lib/site-url'
import type { EmailMessage } from '@/lib/server/email'

/**
 * İşlemsel e-posta şablonları (Türkçe). Her şablon konu + HTML + düz metin döner; alıcı çağıranda eklenir.
 * HTML e-posta istemcileri için tablo düzeni ve satır içi stil; dışarıdan gelen her metin escapeHtml'den geçer.
 * Logo üretim alan adından yüklenir (public/email/logo.png); görseller kapalıysa yazı markası görünür.
 */

type Template = Omit<EmailMessage, 'to'>

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  success: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  warning: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  danger: { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  neutral: { bg: '#f4f4f5', fg: '#3f3f46', border: '#e4e4e7' },
}

const INK = '#0a0c10'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Marka işareti (public/email/logo.png, koyu zemin için beyaz/gri); e-posta istemcileri SVG göstermez */
function logoUrl(): string {
  return `${canonicalOrigin()}/email/logo.png`
}

type LayoutOpts = {
  /** Gelen kutusunda konunun yanında görünen önizleme metni */
  preheader: string
  badge?: { label: string; tone: Tone }
  title: string
  /** HTML paragraflar (dış metinler çağıranda escapeHtml'den geçmiş olmalı) */
  paragraphs: string[]
  /** Gri bilgi kutusu: etiket / değer satırları (değer HTML) */
  details?: [string, string][]
  /** Renkli vurgu kutusu (ör. red gerekçesi) */
  callout?: { label: string; text: string; tone: Tone }
  button?: { label: string; url: string }
  note?: string
}

/** Ortak çerçeve: koyu logolu başlık, durum rozeti, başlık, metin, bilgi kutusu, düğme ve alt bilgi */
function layout(opts: LayoutOpts): string {
  const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">${html}</p>`

  const badge = opts.badge
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="background:${TONES[opts.badge.tone].bg};border:1px solid ${TONES[opts.badge.tone].border};border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;letter-spacing:0.02em;color:${TONES[opts.badge.tone].fg};">${escapeHtml(opts.badge.label)}</td></tr></table>`
    : ''

  const details = opts.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#f4f4f5;border-radius:14px;">
${opts.details
  .map(
    ([label, value], i) =>
      `<tr><td style="padding:${i === 0 ? 19 : 13}px 12px ${i === opts.details!.length - 1 ? 16 : 10}px 16px;font-size:11px;line-height:1.5;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;width:76px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:${i === 0 ? 16 : 10}px 16px ${i === opts.details!.length - 1 ? 16 : 10}px 0;font-size:15px;line-height:1.5;color:${INK};font-weight:600;word-break:break-word;">${value}</td></tr>`
  )
  .join('\n')}
</table>`
    : ''

  const callout = opts.callout
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="background:${TONES[opts.callout.tone].bg};border-left:4px solid ${TONES[opts.callout.tone].fg};border-radius:12px;padding:14px 18px;">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${TONES[opts.callout.tone].fg};">${escapeHtml(opts.callout.label)}</p>
<p style="margin:0;font-size:15px;line-height:1.55;color:${INK};">${escapeHtml(opts.callout.text)}</p>
</td></tr></table>`
    : ''

  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;"><tr><td style="border-radius:14px;background:${INK};">
<a href="${escapeHtml(opts.button.url)}" style="display:inline-block;padding:15px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;">${escapeHtml(opts.button.label)} &rarr;</a>
</td></tr></table>`
    : ''

  const fallback = opts.button
    ? `<p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#a1a1aa;">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br><a href="${escapeHtml(opts.button.url)}" style="color:#71717a;word-break:break-all;">${escapeHtml(opts.button.url)}</a></p>`
    : ''
  const note = opts.note ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">${opts.note}</p>` : ''
  const footerBlock =
    fallback || note
      ? `<tr><td style="padding:0 28px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e4e4e7;padding-top:20px;">${fallback}${note}</td></tr></table></td></tr>`
      : ''

  const site = canonicalOrigin()
  const siteLabel = site.replace(/^https?:\/\//, '')

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}${'&#8203;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e4e4e7;">
<tr><td style="background:${INK};padding:20px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:12px;"><img src="${logoUrl()}" width="40" height="40" alt="" style="display:block;border:0;width:40px;height:40px;"></td>
<td style="vertical-align:middle;font-size:21px;font-weight:800;letter-spacing:-0.01em;color:#ffffff;font-family:${FONT};">QR <span style="color:#a1a1aa;">Chef</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 28px 8px;">
${badge}<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:${INK};">${escapeHtml(opts.title)}</h1>
${opts.paragraphs.map(p).join('\n')}
${details}${callout}${button}
</td></tr>
${footerBlock}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td align="center" style="padding:20px 24px 0;font-size:12px;line-height:1.7;color:#a1a1aa;">
<a href="${site}" style="color:#71717a;font-weight:700;text-decoration:none;">${siteLabel}</a> &nbsp;·&nbsp; <a href="mailto:${LEGAL_COMPANY.email}" style="color:#71717a;text-decoration:none;">${LEGAL_COMPANY.email}</a><br>
Bu e-postayı QR Chef hesabınızla ilgili bir işlem nedeniyle aldınız.
</td></tr></table>
</td></tr></table>
</body></html>`
}

function textBody(lines: (string | false | null | undefined)[]): string {
  return [...lines.filter((l): l is string => typeof l === 'string'), '', `QR Chef · ${LEGAL_COMPANY.email}`].join('\n')
}

export function passwordResetEmail(resetUrl: string): Template {
  const title = 'Şifrenizi yenileyin'
  return {
    subject: 'QR Chef şifre yenileme bağlantınız',
    html: layout({
      preheader: 'Yeni şifrenizi belirlemek için bağlantı. 1 saat geçerlidir.',
      badge: { label: 'Şifre yenileme', tone: 'neutral' },
      title,
      paragraphs: ['QR Chef hesabınız için şifre yenileme isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki düğmeye tıklayın.'],
      button: { label: 'Yeni şifre belirle', url: resetUrl },
      note: 'Bağlantı <b>1 saat</b> geçerlidir ve bir kez kullanılabilir. Bu isteği siz yapmadıysanız e-postayı yok sayın; şifreniz değişmez.',
    }),
    text: textBody([
      title,
      '',
      'QR Chef hesabınız için şifre yenileme isteği aldık. Yeni şifrenizi belirlemek için bağlantıyı açın:',
      resetUrl,
      '',
      'Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir. Bu isteği siz yapmadıysanız e-postayı yok sayın.',
    ]),
  }
}

export function verifyEmailEmail(verifyUrl: string, businessName: string): Template {
  const title = 'E-posta adresinizi doğrulayın'
  return {
    subject: 'QR Chef e-posta doğrulama',
    html: layout({
      preheader: `${businessName} kaydını tamamlamak için e-posta adresinizi doğrulayın.`,
      badge: { label: 'Son bir adım', tone: 'warning' },
      title,
      paragraphs: [
        `<b>${escapeHtml(businessName)}</b> için QR Chef hesabınız oluşturuldu. Kaydı tamamlamak için e-posta adresinizi doğrulayın.`,
      ],
      button: { label: 'E-postamı doğrula', url: verifyUrl },
      note: 'Bu kaydı siz yapmadıysanız e-postayı yok sayabilirsiniz.',
    }),
    text: textBody([
      title,
      '',
      `${businessName} için QR Chef hesabınız oluşturuldu. Kaydı tamamlamak için e-posta adresinizi doğrulayın:`,
      verifyUrl,
      '',
      'Bu kaydı siz yapmadıysanız e-postayı yok sayabilirsiniz.',
    ]),
  }
}

export function applicationReceivedEmail(businessName: string): Template {
  const title = 'Başvurunuz alındı'
  return {
    subject: `${businessName} QR Chef başvurunuz alındı`,
    html: layout({
      preheader: 'Başvurunuzu inceliyoruz; onaylandığında size e-posta göndereceğiz.',
      badge: { label: 'İnceleniyor', tone: 'warning' },
      title,
      paragraphs: [
        `<b>${escapeHtml(businessName)}</b> için QR Chef başvurunuz ekibimize ulaştı. Bilgilerinizi inceleyip en kısa sürede size döneceğiz.`,
        'Başvurunuz onaylandığında bu adrese e-posta göndereceğiz. Ardından kayıtta belirlediğiniz e-posta ve şifreyle giriş yapıp menünüzü hazırlayabilirsiniz.',
      ],
      note: 'Sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz. Bu başvuruyu siz yapmadıysanız bize haber verin.',
    }),
    text: textBody([
      title,
      '',
      `${businessName} için QR Chef başvurunuz ekibimize ulaştı. Bilgilerinizi inceleyip en kısa sürede size döneceğiz.`,
      'Başvurunuz onaylandığında bu adrese e-posta göndereceğiz; ardından kayıtta belirlediğiniz e-posta ve şifreyle giriş yapabilirsiniz.',
      '',
      'Sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz. Bu başvuruyu siz yapmadıysanız bize haber verin.',
    ]),
  }
}

export function applicationApprovedEmail(opts: { businessName: string; loginUrl: string; siteUrl: string }): Template {
  const title = 'Başvurunuz onaylandı 🎉'
  const siteLabel = opts.siteUrl.replace(/^https?:\/\//, '')
  return {
    subject: `${opts.businessName} QR Chef'te yayında`,
    html: layout({
      preheader: `${opts.businessName} işletme siteniz ve QR menünüz yayında.`,
      badge: { label: 'Onaylandı', tone: 'success' },
      title,
      paragraphs: [
        `<b>${escapeHtml(opts.businessName)}</b> için başvurunuzu onayladık. İşletme siteniz ve QR menünüz artık yayında.`,
      ],
      details: [
        ['Siteniz', `<a href="${escapeHtml(opts.siteUrl)}" style="color:${INK};text-decoration:underline;">${escapeHtml(siteLabel)}</a>`],
        ['Giriş', 'Kayıtta belirlediğiniz e-posta ve şifre'],
      ],
      button: { label: 'Panele giriş yap', url: opts.loginUrl },
      note: 'Panelden menünüzü düzenleyebilir, masa QR kodlarınızı yazdırabilirsiniz. Sorunuz olursa bu e-postayı yanıtlayın.',
    }),
    text: textBody([
      title,
      '',
      `${opts.businessName} için başvurunuzu onayladık. İşletme siteniz ve QR menünüz artık yayında.`,
      `Sitenizin adresi: ${opts.siteUrl}`,
      '',
      `Panele giriş: ${opts.loginUrl}`,
      '',
      'Sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz.',
    ]),
  }
}

export function applicationRejectedEmail(opts: { businessName: string; reason: string }): Template {
  const title = 'Başvurunuz hakkında'
  return {
    subject: `${opts.businessName} QR Chef başvurusu`,
    html: layout({
      preheader: `${opts.businessName} başvurunuzu şu an onaylayamadık.`,
      badge: { label: 'Onaylanmadı', tone: 'danger' },
      title,
      paragraphs: [`<b>${escapeHtml(opts.businessName)}</b> için yaptığınız başvuruyu şu an onaylayamadık.`],
      callout: opts.reason ? { label: 'Gerekçe', text: opts.reason, tone: 'danger' } : undefined,
      note: 'Bilgilerinizi güncelleyip yeniden değerlendirme istemek ya da soru sormak için bu e-postayı yanıtlayabilirsiniz.',
    }),
    text: textBody([
      title,
      '',
      `${opts.businessName} için yaptığınız başvuruyu şu an onaylayamadık.`,
      opts.reason && `Gerekçe: ${opts.reason}`,
      '',
      'Yeniden değerlendirme istemek ya da soru sormak için bu e-postayı yanıtlayabilirsiniz.',
    ]),
  }
}

export function newApplicationAdminEmail(opts: {
  businessName: string
  ownerName: string
  email: string
  phone: string
  requiresApproval: boolean
  adminUrl: string
}): Template {
  const title = opts.requiresApproval ? 'Yeni başvuru onay bekliyor' : 'Yeni işletme kaydı'
  const rows: [string, string][] = [
    ['İşletme', opts.businessName],
    ['Yetkili', opts.ownerName],
    ['E-posta', opts.email],
    ['Telefon', opts.phone],
  ]
  return {
    subject: `${title}: ${opts.businessName}`,
    html: layout({
      preheader: `${opts.businessName} · ${opts.ownerName} · ${opts.phone}`,
      badge: opts.requiresApproval ? { label: 'Onay bekliyor', tone: 'warning' } : { label: 'Yeni kayıt', tone: 'neutral' },
      title,
      paragraphs: [opts.requiresApproval ? 'Yeni bir işletme kaydoldu ve onayınızı bekliyor.' : 'Yeni bir işletme kaydoldu.'],
      details: [
        ['İşletme', escapeHtml(opts.businessName)],
        ['Yetkili', escapeHtml(opts.ownerName)],
        ['E-posta', `<a href="mailto:${escapeHtml(opts.email)}" style="color:${INK};">${escapeHtml(opts.email)}</a>`],
        ['Telefon', `<a href="tel:${escapeHtml(opts.phone)}" style="color:${INK};">${escapeHtml(opts.phone)}</a>`],
      ],
      button: { label: opts.requiresApproval ? 'Başvuruyu incele' : 'Admin paneli', url: opts.adminUrl },
    }),
    text: textBody([title, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', opts.adminUrl]),
  }
}

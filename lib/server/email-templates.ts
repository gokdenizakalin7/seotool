import { LEGAL_COMPANY } from '@/lib/legal'
import type { EmailMessage } from '@/lib/server/email'

/**
 * İşlemsel e-posta şablonları (Türkçe). Her şablon konu + HTML + düz metin döner; alıcı çağıranda eklenir.
 * HTML e-posta istemcileri için tablo düzeni ve satır içi stil; dışarıdan gelen her metin escapeHtml'den geçer.
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

/** Ortak çerçeve: başlık, paragraflar, isteğe bağlı düğme ve alt bilgi */
function layout(opts: { title: string; paragraphs: string[]; button?: { label: string; url: string }; note?: string }): string {
  const paragraphs = opts.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#27272a;">${p}</p>`)
    .join('')
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:12px;background:#09090b;">
<a href="${escapeHtml(opts.button.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(opts.button.label)}</a>
</td></tr></table>
<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a;">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br><a href="${escapeHtml(opts.button.url)}" style="color:#71717a;word-break:break-all;">${escapeHtml(opts.button.url)}</a></p>`
    : ''
  const note = opts.note ? `<p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">${opts.note}</p>` : ''

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px;">
<tr><td>
<p style="margin:0 0 24px;font-size:20px;font-weight:800;color:#09090b;">QR <span style="color:#a1a1aa;">Chef</span></p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:800;color:#09090b;">${escapeHtml(opts.title)}</h1>
${paragraphs}${button}${note}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">QR Chef · <a href="mailto:${LEGAL_COMPANY.email}" style="color:#a1a1aa;">${LEGAL_COMPANY.email}</a></p>
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
      title,
      paragraphs: ['QR Chef hesabınız için şifre yenileme isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki düğmeye tıklayın.'],
      button: { label: 'Yeni şifre belirle', url: resetUrl },
      note: 'Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir. Bu isteği siz yapmadıysanız e-postayı yok sayın; şifreniz değişmez.',
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
      title,
      paragraphs: [
        `<b>${escapeHtml(businessName)}</b> için QR Chef başvurunuz ekibimize ulaştı. Bilgilerinizi inceleyip en kısa sürede size döneceğiz.`,
        'Başvurunuz onaylandığında bu adrese e-posta göndereceğiz; ardından kayıtta belirlediğiniz e-posta ve şifreyle giriş yapıp menünüzü hazırlayabilirsiniz.',
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
  return {
    subject: `${opts.businessName} QR Chef'te yayında`,
    html: layout({
      title,
      paragraphs: [
        `<b>${escapeHtml(opts.businessName)}</b> için başvurunuzu onayladık. İşletme siteniz ve QR menünüz artık yayında.`,
        `Sitenizin adresi: <a href="${escapeHtml(opts.siteUrl)}" style="color:#09090b;font-weight:700;">${escapeHtml(opts.siteUrl)}</a>`,
        'Kayıtta belirlediğiniz e-posta ve şifreyle panele giriş yapıp menünüzü düzenleyebilir, masa QR kodlarınızı yazdırabilirsiniz.',
      ],
      button: { label: 'Panele giriş yap', url: opts.loginUrl },
      note: 'Sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz.',
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
      title,
      paragraphs: [
        `<b>${escapeHtml(opts.businessName)}</b> için yaptığınız başvuruyu şu an onaylayamadık.`,
        ...(opts.reason ? [`Gerekçe: ${escapeHtml(opts.reason)}`] : []),
        'Bilgilerinizi güncelleyip yeniden değerlendirme istemek ya da soru sormak için bu e-postayı yanıtlayabilirsiniz.',
      ],
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
      title,
      paragraphs: rows.map(([k, v]) => `<b>${k}:</b> ${escapeHtml(v)}`),
      button: { label: opts.requiresApproval ? 'Başvuruyu incele' : 'Admin paneli', url: opts.adminUrl },
    }),
    text: textBody([title, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', opts.adminUrl]),
  }
}

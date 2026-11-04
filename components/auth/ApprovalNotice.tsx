import { Clock, Mail, Phone } from 'lucide-react'
import { LEGAL_COMPANY } from '@/lib/legal'

/**
 * Onay bekleyen başvuru: kayıt sonrası ve onaysız giriş denemesinde gösterilir. Sistem yöneticisi başvuruyu
 * onaylayana kadar giriş kapalıdır (app/api/auth/login); iletişim bilgileri lib/legal.ts'ten.
 */
export function ApprovalNotice({ kind, businessName }: { kind: 'submitted' | 'login'; businessName?: string }) {
  const phoneHref = LEGAL_COMPANY.phone ? `tel:${LEGAL_COMPANY.phone.replace(/[^\d+]/g, '')}` : ''
  return (
    <div role="status" className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-5 text-left text-sm leading-relaxed text-amber-50">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
        <div className="space-y-2">
          <p className="font-bold text-white">{kind === 'submitted' ? 'Başvurunuz alındı' : 'Hesabınız henüz onaylanmadı'}</p>
          <p>
            {kind === 'submitted' ? (
              <>
                {businessName ? <b>{businessName}</b> : 'İşletmeniz'} için başvurunuz ekibimize ulaştı. İnceleyip kayıtta verdiğiniz
                telefon ya da e-posta üzerinden size döneceğiz; onaylandığında aynı e-posta ve şifreyle giriş yapabilirsiniz.
              </>
            ) : (
              <>Başvurunuz incelendikten ve onaylandıktan sonra giriş yapabilirsiniz. Süreç hakkında bilgi almak için bize ulaşın.</>
            )}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 border-t border-amber-200/20 pt-4">
        <li>
          <a href={`mailto:${LEGAL_COMPANY.email}`} className="inline-flex items-center gap-2 font-semibold text-white hover:underline">
            <Mail className="h-4 w-4 text-amber-200" aria-hidden="true" />
            {LEGAL_COMPANY.email}
          </a>
        </li>
        {phoneHref && (
          <li>
            <a href={phoneHref} className="inline-flex items-center gap-2 font-semibold text-white hover:underline">
              <Phone className="h-4 w-4 text-amber-200" aria-hidden="true" />
              {LEGAL_COMPANY.phone}
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}

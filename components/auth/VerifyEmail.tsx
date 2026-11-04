'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { AuthMessage, AuthShell, authButtonCls } from '@/components/auth/AuthShell'

/**
 * /auth/dogrula — kayıt doğrulama bağlantısı. Sayfa açılınca belirteç bir kez gönderilir (POST /api/auth/verify-email).
 * E-posta istemcilerinin bağlantı önizlemesi yalnızca GET yaptığı için belirteç önizlemede harcanmaz.
 */
export function VerifyEmail({ tokenHash }: { tokenHash: string | null }) {
  const [state, setState] = useState<{ status: 'loading' | 'done' | 'error'; requiresApproval?: boolean; error?: string }>(
    tokenHash ? { status: 'loading' } : { status: 'error', error: 'Doğrulama bağlantısı eksik. E-postadaki bağlantıyı yeniden açın.' }
  )
  const sent = useRef(false)

  useEffect(() => {
    if (!tokenHash || sent.current) return
    sent.current = true
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenHash }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) setState({ status: 'error', error: data.error || 'E-posta doğrulanamadı.' })
        else setState({ status: 'done', requiresApproval: !!data.requiresApproval })
      })
      .catch(() => setState({ status: 'error', error: 'Bağlantı hatası. Sayfayı yenileyip tekrar deneyin.' }))
  }, [tokenHash])

  if (state.status === 'loading') {
    return (
      <AuthShell title="E-postanız doğrulanıyor">
        <div className="flex justify-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-white" aria-label="Doğrulanıyor" />
        </div>
      </AuthShell>
    )
  }

  if (state.status === 'error') {
    return (
      <AuthShell title="E-posta doğrulanamadı">
        <AuthMessage kind="error">{state.error}</AuthMessage>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="E-postanız doğrulandı">
      <div className="space-y-5">
        {state.requiresApproval ? (
          <AuthMessage kind="info">
            Başvurunuz ekibimize ulaştı. İnceleyip onayladığımızda size e-posta göndereceğiz; ardından kayıtta belirlediğiniz
            e-posta ve şifreyle giriş yapabilirsiniz.
          </AuthMessage>
        ) : (
          <AuthMessage kind="success">Hesabınız hazır. Kayıtta belirlediğiniz e-posta ve şifreyle giriş yapabilirsiniz.</AuthMessage>
        )}
        <a href="/login" className={authButtonCls}>
          Giriş Sayfasına Git <ArrowRight className="ml-2 h-5 w-5 opacity-70" aria-hidden="true" />
        </a>
      </div>
    </AuthShell>
  )
}

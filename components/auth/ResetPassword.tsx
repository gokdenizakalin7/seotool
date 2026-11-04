'use client'

import React, { useState } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { AuthMessage, AuthShell, authButtonCls, authInputCls } from '@/components/auth/AuthShell'

/**
 * /auth/sifre-yenile — belirteç yoksa e-posta ile bağlantı isteme, e-postadaki bağlantıyla (token_hash) yeni şifre.
 * Uçlar: POST /api/auth/forgot-password, POST /api/auth/reset-password
 */
export function ResetPassword({ tokenHash }: { tokenHash: string | null }) {
  return tokenHash ? <NewPasswordForm tokenHash={tokenHash} /> : <RequestLinkForm />
}

function RequestLinkForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Bağlantı gönderilemedi. Lütfen tekrar deneyin.')
        setStatus('idle')
        return
      }
      setStatus('sent')
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <AuthShell title="E-postanızı kontrol edin">
        <AuthMessage kind="success">
          <b>{email}</b> adresine kayıtlı bir hesap varsa şifre yenileme bağlantısını gönderdik. Bağlantı 1 saat geçerlidir.
          Birkaç dakika içinde gelmezse spam klasörüne bakın.
        </AuthMessage>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Şifremi unuttum" subtitle="Kayıtlı e-posta adresinizi girin, yeni şifre belirlemeniz için bir bağlantı gönderelim.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="pl-1 text-xs font-bold uppercase tracking-wider text-white/70">E-Posta Adresi</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" aria-hidden="true" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ad@ornek.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputCls}
            />
          </div>
        </div>
        {error && <AuthMessage kind="error">{error}</AuthMessage>}
        <button type="submit" disabled={status === 'loading'} className={authButtonCls}>
          {status === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Bağlantı Gönder'}
        </button>
      </form>
    </AuthShell>
  )
}

function NewPasswordForm({ tokenHash }: { tokenHash: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'expired'>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Şifreniz en az 8 karakter olmalı.')
    if (password !== confirm) return setError('Şifreler birbiriyle aynı değil.')
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenHash, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'TOKEN_INVALID') return setStatus('expired')
        setError(data.error || 'Şifre güncellenemedi. Lütfen tekrar deneyin.')
        setStatus('idle')
        return
      }
      setStatus('done')
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <AuthShell title="Şifreniz yenilendi">
        <div className="space-y-5">
          <AuthMessage kind="success">Yeni şifrenizle giriş yapabilirsiniz.</AuthMessage>
          <a href="/login" className={authButtonCls}>
            Giriş Yap <ArrowRight className="ml-2 h-5 w-5 opacity-70" aria-hidden="true" />
          </a>
        </div>
      </AuthShell>
    )
  }

  if (status === 'expired') {
    return (
      <AuthShell title="Bağlantı geçersiz">
        <div className="space-y-5">
          <AuthMessage kind="error">
            Bu bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir şifre yenileme bağlantısı isteyin.
          </AuthMessage>
          <a href="/auth/sifre-yenile" className={authButtonCls}>Yeni Bağlantı İste</a>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Yeni şifre belirleyin" subtitle="En az 8 karakterlik yeni şifrenizi iki kez yazın.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {[
          { id: 'password', label: 'Yeni Şifre', value: password, set: setPassword },
          { id: 'confirm', label: 'Yeni Şifre (Tekrar)', value: confirm, set: setConfirm },
        ].map((f) => (
          <div key={f.id} className="space-y-2">
            <label htmlFor={f.id} className="pl-1 text-xs font-bold uppercase tracking-wider text-white/70">{f.label}</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" aria-hidden="true" />
              <input
                id={f.id}
                type={show ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className={`${authInputCls} pr-12`}
              />
              {f.id === 'password' && (
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  title={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/40 transition-colors hover:text-white"
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              )}
            </div>
          </div>
        ))}
        {error && <AuthMessage kind="error">{error}</AuthMessage>}
        <button type="submit" disabled={status === 'loading'} className={authButtonCls}>
          {status === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Şifremi Kaydet'}
        </button>
      </form>
    </AuthShell>
  )
}

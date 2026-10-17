'use client'

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowRight, Lock, Mail, User, Store, Phone, Eye, EyeOff, Clock } from 'lucide-react'
import { QrChefMark } from '@/components/brand/qr-chef-logo'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { clearApiCache } from '@/lib/api-client'
import { TermsOfServiceModal } from '@/components/modals/TermsOfServiceModal'
import { PrivacyPolicyModal } from '@/components/modals/PrivacyPolicyModal'

const inputCls =
  'w-full bg-black/20 border text-white placeholder-white/30 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all shadow-inner'
const labelCls = 'text-xs font-bold text-white/70 uppercase tracking-wider pl-1'

type FieldKey = 'ownerName' | 'businessName' | 'ownerPhone' | 'email' | 'password' | 'accepted'
type Errors = Partial<Record<FieldKey, string>>

const phoneDigits = (v: string) => v.replace(/\D/g, '').length

/** Alan doğrulaması: tarayıcı balonu yerine her alanın altında Türkçe mesaj */
function validate(f: { ownerName: string; businessName: string; ownerPhone: string; email: string; password: string; accepted: boolean }): Errors {
  const e: Errors = {}
  if (f.ownerName.trim().length < 2) e.ownerName = 'Adınızı ve soyadınızı yazın.'
  if (f.businessName.trim().length < 2) e.businessName = 'İşletme adı en az 2 karakter olmalı.'
  if (phoneDigits(f.ownerPhone) < 10 || phoneDigits(f.ownerPhone) > 15 || !/^[+0-9 ()./-]+$/.test(f.ownerPhone.trim()))
    e.ownerPhone = 'Geçerli bir telefon numarası yazın (örn. 0532 000 00 00).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Geçerli bir e-posta adresi yazın.'
  if (f.password.length < 8) e.password = 'Şifreniz en az 8 karakter olmalı.'
  if (!f.accepted) e.accepted = 'Devam etmek için Kullanım Koşulları’nı kabul etmeli, aydınlatma metnini okumalısınız.'
  return e
}

export function Signup() {
  const [ownerName, setOwnerName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTermsOpen, setIsTermsOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  // Kayıt açık mı, başvuru onay bekler mi (sunucu ayarı)
  const [signupState, setSignupState] = useState<{ enabled: boolean; requiresApproval: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/signup')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setSignupState({ enabled: !!d.enabled, requiresApproval: !!d.requiresApproval })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const clearField = (key: FieldKey) =>
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')

    const nextErrors = validate({ ownerName, businessName, ownerPhone, email, password, accepted })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const first = (['ownerName', 'businessName', 'ownerPhone', 'email', 'password'] as FieldKey[]).find((k) => nextErrors[k])
      if (first) document.getElementById(first)?.focus()
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          businessName: businessName.trim(),
          ownerPhone: ownerPhone.trim(),
          email: email.trim().toLowerCase(),
          password,
          acceptTerms: true,
          website,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Kayıt tamamlanamadı.')
        return
      }
      if (data.verifyEmail) {
        setInfo('Hesabınız oluşturuldu. Lütfen e-postanıza gelen doğrulama bağlantısına tıklayın.')
        return
      }
      if (data.needsLogin || !data.session) {
        window.location.href = '/login'
        return
      }

      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      clearApiCache()
      window.location.href = '/onboarding'
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setIsLoading(false)
    }
  }

  const fieldBorder = (key: FieldKey) => (errors[key] ? 'border-red-400/70' : 'border-white/10')
  const FieldError = ({ id }: { id: FieldKey }) =>
    errors[id] ? (
      <p id={`${id}-error`} role="alert" className="pl-1 text-xs font-medium text-red-200">
        {errors[id]}
      </p>
    ) : null

  const signupClosed = signupState?.enabled === false

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black font-sans py-10">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop")',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70 backdrop-blur-[2px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[460px] px-6"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center relative w-20 h-20 rounded-[24px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-5">
            <QrChefMark size={56} secondary="rgba(255,255,255,0.6)" className="text-white" />
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Ücretsiz Hesap Oluştur</h1>
          <p className="text-white/60 font-medium">Dakikalar içinde dijital menünüzü hazırlayın</p>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-7 rounded-[32px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          {signupState?.requiresApproval && !signupClosed && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3.5 py-3 text-xs leading-relaxed text-amber-50">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <span>
                Kayıt bir <b>başvurudur</b>: hesabınız hemen açılır ve menünüzü hazırlayabilirsiniz, ancak işletme siteniz
                başvurunuz incelenip onaylandıktan sonra yayına girer.
              </span>
            </div>
          )}

          {signupClosed ? (
            <div className="rounded-2xl border border-white/15 bg-black/20 p-5 text-center text-sm text-white/80">
              Yeni kayıtlar şu an kapalı. Hesap açmak için bizimle iletişime geçin.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <label className={labelCls} htmlFor="ownerName">Adınız Soyadınız</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="ownerName"
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Ayşe Yılmaz"
                    value={ownerName}
                    aria-invalid={!!errors.ownerName}
                    aria-describedby={errors.ownerName ? 'ownerName-error' : undefined}
                    onChange={(e) => {
                      setOwnerName(e.target.value)
                      clearField('ownerName')
                    }}
                    className={`${inputCls} ${fieldBorder('ownerName')}`}
                  />
                </div>
                <FieldError id="ownerName" />
              </div>

              <div className="space-y-2">
                <label className={labelCls} htmlFor="businessName">İşletme Adı</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="businessName"
                    maxLength={100}
                    autoComplete="organization"
                    placeholder="Örn: Köşe Kafe"
                    value={businessName}
                    aria-invalid={!!errors.businessName}
                    aria-describedby={errors.businessName ? 'businessName-error' : undefined}
                    onChange={(e) => {
                      setBusinessName(e.target.value)
                      clearField('businessName')
                    }}
                    className={`${inputCls} ${fieldBorder('businessName')}`}
                  />
                </div>
                <FieldError id="businessName" />
                <p className="pl-1 text-[11px] text-white/45">Site adresiniz bu addan türetilir; kurulum sırasında değiştirebilirsiniz.</p>
              </div>

              <div className="space-y-2">
                <label className={labelCls} htmlFor="ownerPhone">Telefon</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="ownerPhone"
                    type="tel"
                    inputMode="tel"
                    maxLength={24}
                    autoComplete="tel"
                    placeholder="0532 000 00 00"
                    value={ownerPhone}
                    aria-invalid={!!errors.ownerPhone}
                    aria-describedby={errors.ownerPhone ? 'ownerPhone-error' : undefined}
                    onChange={(e) => {
                      setOwnerPhone(e.target.value)
                      clearField('ownerPhone')
                    }}
                    className={`${inputCls} ${fieldBorder('ownerPhone')}`}
                  />
                </div>
                <FieldError id="ownerPhone" />
                <p className="pl-1 text-[11px] text-white/45">Başvurunuzla ilgili size ulaşmak için; müşterilere gösterilmez.</p>
              </div>

              <div className="space-y-2">
                <label className={labelCls} htmlFor="email">E-Posta Adresi</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ad@ornek.com"
                    value={email}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      clearField('email')
                    }}
                    className={`${inputCls} ${fieldBorder('email')}`}
                  />
                </div>
                <FieldError id="email" />
              </div>

              <div className="space-y-2">
                <label className={labelCls} htmlFor="password">Şifre (en az 8 karakter)</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    maxLength={100}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearField('password')
                    }}
                    className={`${inputCls} ${fieldBorder('password')} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <FieldError id="password" />
              </div>

              {/* Bot tuzağı: insanlara görünmez */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
                name="website"
              />

              <div className="space-y-2">
                <label className="flex items-start gap-3 text-xs text-white/70 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accepted}
                    aria-invalid={!!errors.accepted}
                    onChange={(e) => {
                      setAccepted(e.target.checked)
                      clearField('accepted')
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 accent-white"
                  />
                  <span>
                    <button type="button" onClick={() => setIsTermsOpen(true)} className="underline text-white">Kullanım Koşulları</button>
                    ’nı kabul ediyorum;{' '}
                    <button type="button" onClick={() => setIsPrivacyOpen(true)} className="underline text-white">Gizlilik Politikası ve KVKK Aydınlatma Metni</button>
                    ’ni okudum.
                  </span>
                </label>
                <FieldError id="accepted" />
              </div>

              <AnimatePresence>
                {(error || info) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className={`p-4 rounded-2xl text-sm font-medium text-center backdrop-blur-md border ${error ? 'bg-red-500/20 border-red-500/30 text-red-100' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100'}`}>
                      {error || info}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="group w-full flex justify-center items-center py-4 px-4 text-base font-extrabold rounded-2xl text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-white/30 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.98] disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-black" />
                ) : (
                  <>
                    {signupState?.requiresApproval ? 'Başvuruyu Gönder ve Başla' : 'Hesabı Oluştur ve Başla'}
                    <ArrowRight className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-white/60">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="font-bold text-white underline">Giriş yapın</Link>
        </p>
      </motion.div>

      <TermsOfServiceModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </div>
  )
}

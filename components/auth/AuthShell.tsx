import React from 'react'
import { QrChefMark, QrChefWordmark } from '@/components/brand/qr-chef-logo'

/**
 * Panel dışındaki hesap sayfalarının (şifre yenileme, e-posta doğrulama) çerçevesi: giriş ekranıyla aynı arka plan,
 * logo ve cam kart. Bu sayfalar SPA dışında (app/auth/…), bağlantılar düz <a>.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black font-sans">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop")',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-6 py-10">
        <div className="mb-8 text-center">
          <a
            href="/"
            aria-label="QR Chef ana sayfa"
            className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl"
          >
            <QrChefMark size={56} secondary="rgba(255,255,255,0.6)" className="text-white" />
          </a>
          <p className="text-2xl font-extrabold tracking-tight text-white">
            <QrChefWordmark chefClassName="text-white/60" />
          </p>
        </div>

        <div className="rounded-[32px] border border-white/20 bg-white/10 p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-2xl">
          <h1 className="text-xl font-extrabold text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/60">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-6 text-center text-sm text-white/60">
          <a href="/login" className="font-bold text-white underline">Giriş sayfasına dön</a>
        </p>
      </div>
    </div>
  )
}

export const authInputCls =
  'w-full rounded-2xl border border-white/10 bg-black/20 py-4 pl-12 pr-4 text-white placeholder-white/30 shadow-inner transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-white/50'

export const authButtonCls =
  'flex w-full items-center justify-center rounded-2xl bg-white px-4 py-4 text-base font-extrabold text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-white/30 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100'

export function AuthMessage({ kind, children }: { kind: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const cls =
    kind === 'error'
      ? 'border-red-500/30 bg-red-500/20 text-red-100'
      : kind === 'success'
        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-50'
        : 'border-amber-300/30 bg-amber-400/10 text-amber-50'
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-sm font-medium leading-relaxed backdrop-blur-md ${cls}`}>
      {children}
    </div>
  )
}

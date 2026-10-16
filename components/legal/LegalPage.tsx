'use client'

import { Link } from 'react-router-dom'
import { ArrowLeft, ChefHat, QrCode } from 'lucide-react'
import { LegalMeta, PrivacyPolicyText, TermsOfServiceText } from './LegalTexts'

/** /kosullar ve /gizlilik: hukuki metinlerin herkese açık, yazdırılabilir sayfaları */
export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const title = kind === 'terms' ? 'Kullanım Koşulları' : 'Gizlilik Politikası ve KVKK Aydınlatma Metni'
  const other = kind === 'terms' ? { to: '/gizlilik', label: 'Gizlilik Politikası' } : { to: '/kosullar', label: 'Kullanım Koşulları' }
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-2 font-extrabold text-gray-900">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
              <QrCode className="h-4 w-4" />
              <ChefHat className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-white p-0.5" />
            </span>
            QR Chef
          </Link>
          <Link to={other.to} className="text-sm text-gray-600 underline-offset-2 hover:underline">
            {other.label}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/" className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="mr-1 h-4 w-4" /> Ana sayfa
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
        <div className="mt-2">
          <LegalMeta />
        </div>
        <article className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {kind === 'terms' ? <TermsOfServiceText /> : <PrivacyPolicyText />}
        </article>
      </main>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOutClient } from '@/lib/session'
import { clearApiCache } from '@/lib/api-client'

/**
 * Onay bekleyen başvurunun gördüğü tek ekran. Panel (menü, şablonlar, katalog, editör) sistem yöneticisi onaylayana
 * kadar açılmaz: rakip işletmeler kayıt olup paneli gezerek kopyalıyordu. Sunucu da aynı kuralı uygular
 * (403 ORG_PENDING, lib/auth-middleware.ts); bu ekran yalnızca /api/auth/me okur.
 */
export function PendingApproval({ businessName, email }: { businessName?: string | null; email?: string | null }) {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  const logout = async () => {
    setLeaving(true)
    await signOutClient()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Clock className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
            Başvuru inceleniyor
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">Başvurunuz alındı</h1>
          <p className="text-sm leading-relaxed text-gray-600">
            {businessName ? <><strong>{businessName}</strong> için başvurunuz</> : 'Başvurunuz'} ekibimize ulaştı. En kısa sürede
            inceleyip kayıt sırasında verdiğiniz telefon ya da e-posta üzerinden sizi bilgilendireceğiz.
          </p>
          <p className="text-sm leading-relaxed text-gray-600">
            Onaylandığında giriş yaptığınızda kurulum sihirbazı açılır; menünüzü dakikalar içinde hazırlar, QR kodlarınızı
            indirirsiniz.
          </p>
        </div>
        {email && <p className="text-xs text-gray-400">Giriş yapılan hesap: {email}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              clearApiCache()
              window.location.reload()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Durumu yenile
          </Button>
          <Button className="flex-1" onClick={logout} disabled={leaving}>
            <LogOut className="mr-2 h-4 w-4" /> Çıkış yap
          </Button>
        </div>
      </div>
    </div>
  )
}

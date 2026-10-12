'use client'

import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { getImpersonatedOrgId } from '@/lib/impersonation'

/**
 * Admin'in belirlediği şifreyle açılan hesaplar ilk girişte kendi şifresini belirler
 * (user_metadata.must_change_password). Kapatılamaz.
 */
export function MustChangePasswordGate() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guarded = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/onboarding')

  useEffect(() => {
    if (!guarded || getImpersonatedOrgId()) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session?.user?.user_metadata?.must_change_password === true) setOpen(true)
    })
    return () => {
      alive = false
    }
  }, [guarded, location.pathname])

  const submit = async () => {
    setError(null)
    if (pw.length < 8 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(pw) || !/\d/.test(pw)) {
      setError('Şifre en az 8 karakter olmalı, harf ve rakam içermeli.')
      return
    }
    if (pw !== pw2) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } })
    setBusy(false)
    if (err) {
      setError(/same|different/i.test(err.message) ? 'Yeni şifre, yöneticinin verdiği şifreden farklı olmalı.' : err.message)
      return
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="max-w-sm [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Kendi şifrenizi belirleyin
          </DialogTitle>
          <DialogDescription>Hesabınız yönetici tarafından açıldı. Devam etmeden önce yalnızca sizin bildiğiniz yeni bir şifre belirleyin.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Yeni şifre</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Yeni şifre (tekrar)</Label>
            <Input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        {/* Sarmalayıcı şart: [&>button]:hidden yalnızca kapatma (X) düğmesini gizlemeli */}
        <div>
          <Button onClick={submit} disabled={busy || !pw || !pw2} className="w-full">
            {busy ? 'Kaydediliyor…' : 'Şifremi kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

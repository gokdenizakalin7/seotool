'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Ban, KeyRound, Trash2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog, CopyButton, Field, PasswordField, Spinner, Switch } from '../shared/ui'
import { adminApi, errorMessage, fmtDateTime, isBanned } from '../lib/admin-api'

export interface EditableUser {
  id: string
  email: string
  ownerName: string
  mustChangePassword: boolean
  bannedUntil: string | null
  lastSignInAt?: string | null
  isSuperAdmin?: boolean
}

/**
 * Kullanıcı düzenleme: e-posta, ad, yeni şifre (admin belirler), ilk girişte değiştirme zorunluluğu,
 * giriş engeli ve hesabı silme.
 */
export function UserEditDialog({
  user,
  onOpenChange,
  onChanged,
}: {
  user: EditableUser | null
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [password, setPassword] = useState('')
  const [mustChange, setMustChange] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [savedPassword, setSavedPassword] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setOwnerName(user.ownerName)
      setPassword('')
      setMustChange(user.mustChangePassword)
      setSavedPassword(null)
      setBanReason('')
    }
  }, [user])

  if (!user) return null
  const banned = isBanned(user.bannedUntil)

  const patch = async (body: Record<string, unknown>, success: string) => {
    setBusy(true)
    try {
      await adminApi(`/api/admin/users/${user.id}`, { method: 'PATCH', body })
      toast.success(success)
      onChanged()
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const body: Record<string, unknown> = {}
    if (email.trim().toLowerCase() !== user.email) body.email = email.trim()
    if (ownerName.trim() !== user.ownerName) body.ownerName = ownerName.trim()
    if (password) body.password = password
    if (mustChange !== user.mustChangePassword || password) body.mustChangePassword = mustChange
    if (!Object.keys(body).length) return onOpenChange(false)
    const ok = await patch(body, 'Kullanıcı güncellendi.')
    if (ok && password) setSavedPassword(password)
    else if (ok) onOpenChange(false)
  }

  const credentials = savedPassword
    ? `QR Chef paneline giriş\nAdres: ${window.location.origin}/login\nE-posta: ${email.trim().toLowerCase()}\nŞifre: ${savedPassword}`
    : ''

  return (
    <>
      <Dialog open={!!user && !banOpen && !deleteOpen} onOpenChange={(v) => !busy && onOpenChange(v)}>
        <DialogContent className="max-w-lg">
          {savedPassword ? (
            <>
              <DialogHeader>
                <DialogTitle>Yeni şifre belirlendi</DialogTitle>
                <DialogDescription>Bilgileri kullanıcıya iletin. Şifre bu pencere kapanınca tekrar gösterilmez.</DialogDescription>
              </DialogHeader>
              <pre className="whitespace-pre-wrap rounded-2xl border border-border/60 bg-muted/40 p-4 font-mono text-sm">{credentials}</pre>
              <div className="flex justify-end gap-2">
                <CopyButton text={credentials} label="Bilgileri kopyala" />
                <Button onClick={() => onOpenChange(false)}>Kapat</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Kullanıcıyı düzenle</DialogTitle>
                <DialogDescription>
                  Son giriş: {fmtDateTime(user.lastSignInAt)}
                  {banned && <span className="ml-2 font-semibold text-red-600">· Giriş engelli</span>}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Field label="E-posta (giriş adı)">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={user.isSuperAdmin} />
                </Field>
                <Field label="Ad soyad">
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                </Field>
                <Field label="Yeni şifre belirle" hint="Boş bırakırsanız şifre değişmez. Kullanıcıya siz iletirsiniz.">
                  <PasswordField value={password} onChange={setPassword} placeholder="Değiştirmek için yazın veya üretin" />
                </Field>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 text-sm">
                  <span>
                    <span className="font-semibold">İlk girişte şifre değiştirilsin</span>
                    <span className="block text-xs text-muted-foreground">Kullanıcı giriş yapınca yeni şifre belirlemeden devam edemez</span>
                  </span>
                  <Switch checked={mustChange} onChange={setMustChange} />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
                {!user.isSuperAdmin ? (
                  <div className="flex gap-1.5">
                    {banned ? (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => patch({ banned: false }, 'Giriş engeli kaldırıldı.')}>
                        <UserCheck className="mr-1 h-3.5 w-3.5" /> Engeli kaldır
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="text-red-600" disabled={busy} onClick={() => setBanOpen(true)}>
                        <Ban className="mr-1 h-3.5 w-3.5" /> Girişi engelle
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-500/10" disabled={busy} onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Sil
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Süper admin hesabı</span>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                    Vazgeç
                  </Button>
                  <Button onClick={save} disabled={busy || (!!password && password.length < 8)}>
                    {busy ? <Spinner className="mr-1.5" /> : password ? <KeyRound className="mr-1.5 h-4 w-4" /> : null}
                    Kaydet
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        title={`${user.email} engellensin mi?`}
        description="Kullanıcı panele giriş yapamaz. Restoranı ve müşteri menüsü etkilenmez (restoranı kapatmak için askıya alın)."
        confirmLabel="Girişi engelle"
        destructive
        onConfirm={async () => {
          if (await patch({ banned: true, banReason }, 'Kullanıcının girişi engellendi.')) setBanOpen(false)
        }}
      >
        <Field label="Sebep (iç not)">
          <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={2} />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Kullanıcı hesabı silinsin mi?"
        description="Hesap ve restoran üyelikleri kalıcı olarak silinir. Restoranın tek sahibiyse önce başka bir sahip atayın ya da restoranı silin."
        confirmLabel="Kalıcı olarak sil"
        destructive
        typeToConfirm={user.email}
        onConfirm={async () => {
          try {
            await adminApi(`/api/admin/users/${user.id}`, { method: 'DELETE' })
            toast.success('Kullanıcı silindi.')
            setDeleteOpen(false)
            onOpenChange(false)
            onChanged()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </>
  )
}

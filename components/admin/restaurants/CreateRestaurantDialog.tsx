'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AdminBusinessType, AdminTemplate } from '@/lib/admin-types'
import { CopyButton, Field, NativeSelect, PasswordField, Spinner, Switch } from '../shared/ui'
import { adminApi, errorMessage, generatePassword, slugify, subdomainInput } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'

interface Created {
  organization: { id: string; name: string; subdomain: string }
  email: string
  password: string
}

const empty = {
  businessName: '',
  ownerName: '',
  email: '',
  password: '',
  phone: '',
  city: '',
  subdomain: '',
  businessType: '',
  templateSlug: '',
  mustChangePassword: true,
  skipOnboarding: false,
}

/**
 * Yeni restoran + sahip hesabı. Şifreyi admin belirler ve kullanıcıya kendisi iletir.
 */
export function CreateRestaurantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (orgId: string) => void
}) {
  const [form, setForm] = useState(empty)
  const [subdomainTouched, setSubdomainTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  const types = useAdminQuery<{ businessTypes: AdminBusinessType[] }>(open ? '/api/admin/business-types' : null)
  const templates = useAdminQuery<{ templates: AdminTemplate[] }>(open ? '/api/admin/templates' : null)

  useEffect(() => {
    if (open) {
      setForm({ ...empty, password: generatePassword() })
      setSubdomainTouched(false)
      setError(null)
      setCreated(null)
    }
  }, [open])

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const typeTemplates = useMemo(
    () => (templates.data?.templates || []).filter((t) => t.isActive && (!form.businessType || t.businessType === form.businessType)),
    [templates.data, form.businessType]
  )

  const onTypeChange = (slug: string) => {
    const bt = types.data?.businessTypes.find((t) => t.slug === slug)
    setForm((f) => ({ ...f, businessType: slug, templateSlug: bt?.defaultTemplateSlug || '' }))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await adminApi<{ organization: Created['organization']; templateApplied: boolean }>('/api/admin/organizations', {
        method: 'POST',
        body: { ...form, subdomain: form.subdomain || undefined },
      })
      setCreated({ organization: res.organization, email: form.email.trim().toLowerCase(), password: form.password })
      toast.success(`"${res.organization.name}" oluşturuldu${res.templateApplied ? ', şablon menü eklendi' : ''}.`)
      onCreated(res.organization.id)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const credentialsText = created
    ? `QR Chef paneline giriş\nAdres: ${window.location.origin}/login\nE-posta: ${created.email}\nŞifre: ${created.password}${
        form.mustChangePassword ? '\nİlk girişte şifrenizi değiştirmeniz istenecek.' : ''
      }`
    : ''

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Restoran oluşturuldu</DialogTitle>
              <DialogDescription>
                Giriş bilgilerini restoran sahibine iletin. Şifre bu pencere kapandıktan sonra tekrar gösterilmez.
              </DialogDescription>
            </DialogHeader>
            <pre className="whitespace-pre-wrap rounded-2xl border border-border/60 bg-muted/40 p-4 font-mono text-sm">{credentialsText}</pre>
            <div className="flex flex-wrap justify-end gap-2">
              <CopyButton text={credentialsText} label="Bilgileri kopyala" />
              <Button onClick={() => onOpenChange(false)}>Kapat</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Yeni Restoran ve Sahip Hesabı</DialogTitle>
              <DialogDescription>
                Şifreyi siz belirlersiniz; e-posta gönderilmez. Oluşturduktan sonra giriş bilgilerini kopyalayıp iletebilirsiniz.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="İşletme adı *">
                <Input
                  value={form.businessName}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({ ...f, businessName: v, subdomain: subdomainTouched ? f.subdomain : slugify(v).slice(0, 40).replace(/-+$/, '') }))
                  }}
                  autoFocus
                />
              </Field>
              <Field label="Yetkili adı soyadı *">
                <Input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
              </Field>
              <Field label="E-posta (giriş adı) *">
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Şifre *" hint="En az 8 karakter, harf ve rakam içermeli">
                <PasswordField value={form.password} onChange={(v) => set('password', v)} />
              </Field>
              <Field label="Telefon">
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Şehir">
                <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="Site adresi (slug)" hint={form.subdomain ? `/${form.subdomain}` : 'Boş bırakılırsa işletme adından üretilir'}>
                <Input
                  value={form.subdomain}
                  onChange={(e) => {
                    setSubdomainTouched(true)
                    set('subdomain', subdomainInput(e.target.value))
                  }}
                  className="font-mono"
                />
              </Field>
              <Field label="İşletme türü">
                <NativeSelect value={form.businessType} onChange={(e) => onTypeChange(e.target.value)}>
                  <option value="">Seçilmedi</option>
                  {(types.data?.businessTypes || [])
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field label="Başlangıç menüsü (şablon)" hint="Seçilirse katalogdan hazır menü kopyalanır" className="sm:col-span-2">
                <NativeSelect value={form.templateSlug} onChange={(e) => set('templateSlug', e.target.value)}>
                  <option value="">Boş başlasın</option>
                  {typeTemplates.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.icon} {t.name} ({t.itemCount} ürün)
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">İlk girişte şifre değiştirilsin</span>
                  <span className="block text-xs text-muted-foreground">Önerilir: belirlediğiniz şifre yalnızca ilk giriş için kullanılır</span>
                </span>
                <Switch checked={form.mustChangePassword} onChange={(v) => set('mustChangePassword', v)} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">Kurulum sihirbazını atla</span>
                  <span className="block text-xs text-muted-foreground">Bilgileri siz dolduracaksanız açın</span>
                </span>
                <Switch checked={form.skipOnboarding} onChange={(v) => set('skipOnboarding', v)} />
              </label>
            </div>

            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Vazgeç
              </Button>
              <Button
                onClick={submit}
                disabled={busy || form.businessName.trim().length < 2 || form.ownerName.trim().length < 2 || !form.email || form.password.length < 8}
              >
                {busy && <Spinner className="mr-1.5" />}
                Oluştur
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

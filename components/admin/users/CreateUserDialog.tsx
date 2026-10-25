'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MEMBER_ROLE_LABELS, type AdminBusinessType, type AdminOrgRow, type AdminTemplate, type MemberRole } from '@/lib/admin-types'
import { CopyButton, Field, NativeSelect, PasswordField, Spinner, Switch, Tabs, useDebounced } from '../shared/ui'
import { adminApi, errorMessage, generatePassword, qs, slugify, subdomainInput } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'

type OrgMode = 'existing' | 'new'
type AccountRole = 'system_admin' | MemberRole

const ACCOUNT_ROLES: { id: AccountRole; label: string; hint: string }[] = [
  {
    id: 'owner',
    label: 'Restoran sahibi',
    hint: 'Restoranın tüm ayarlarını ve üyelerini yönetir',
  },
  {
    id: 'admin',
    label: MEMBER_ROLE_LABELS.admin,
    hint: 'Restoranın menülerini ve ayarlarını yönetir',
  },
  {
    id: 'staff',
    label: MEMBER_ROLE_LABELS.staff,
    hint: 'Restoranın menülerinde günlük işleri yapar',
  },
  {
    id: 'system_admin',
    label: 'Sistem yöneticisi',
    hint: 'Restorana bağlı değildir; bu admin paneline tam erişir',
  },
]

const emptyOrg = {
  businessName: '',
  subdomain: '',
  phone: '',
  city: '',
  businessType: '',
  templateSlug: '',
  skipOnboarding: false,
}

/**
 * Yeni kullanıcı: admin şifreyi belirler ve kullanıcıya kendisi iletir.
 * Sistem yöneticisi restorana bağlanmaz. Restoran kullanıcısı mevcut bir restorana rolüyle eklenir;
 * sahip rolünde girilen bilgilerle yeni restoran da açılabilir.
 */
export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [email, setEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [password, setPassword] = useState('')
  const [mustChange, setMustChange] = useState(true)
  const [orgMode, setOrgMode] = useState<OrgMode>('existing')
  const [orgSearch, setOrgSearch] = useState('')
  const [orgId, setOrgId] = useState('')
  const [role, setRole] = useState<AccountRole>('owner')
  const [org, setOrg] = useState(emptyOrg)
  const [subdomainTouched, setSubdomainTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<string | null>(null)

  const isSystemAdmin = role === 'system_admin'
  // Yeni restoranın bir sahibi olmalı: yeni restoran yalnızca sahip rolüyle açılır
  const effectiveOrgMode: OrgMode = role === 'owner' ? orgMode : 'existing'

  const orgQ = useDebounced(orgSearch)
  const orgs = useAdminQuery<{ organizations: AdminOrgRow[] }>(
    open && !isSystemAdmin && effectiveOrgMode === 'existing' ? `/api/admin/organizations${qs({ q: orgQ, size: 50 })}` : null
  )
  const orgOptions = orgs.data?.organizations || []
  const types = useAdminQuery<{ businessTypes: AdminBusinessType[] }>(
    open && effectiveOrgMode === 'new' && !isSystemAdmin ? '/api/admin/business-types' : null
  )
  const templates = useAdminQuery<{ templates: AdminTemplate[] }>(
    open && effectiveOrgMode === 'new' && !isSystemAdmin ? '/api/admin/templates' : null
  )
  const typeTemplates = useMemo(
    () => (templates.data?.templates || []).filter((t) => t.isActive && (!org.businessType || t.businessType === org.businessType)),
    [templates.data, org.businessType]
  )

  useEffect(() => {
    if (open) {
      setEmail('')
      setOwnerName('')
      setPassword(generatePassword())
      setMustChange(true)
      setOrgMode('existing')
      setOrgSearch('')
      setOrgId('')
      setRole('owner')
      setOrg(emptyOrg)
      setSubdomainTouched(false)
      setError(null)
      setCredentials(null)
    }
  }, [open])

  // Arama sonucu değişince seçili restoran listede yoksa ilkini seç
  useEffect(() => {
    if (isSystemAdmin || effectiveOrgMode !== 'existing') return
    if (!orgOptions.some((o) => o.id === orgId)) setOrgId(orgOptions[0]?.id || '')
  }, [isSystemAdmin, effectiveOrgMode, orgOptions, orgId])

  const setOrgField = <K extends keyof typeof emptyOrg>(k: K, v: (typeof emptyOrg)[K]) => setOrg((f) => ({ ...f, [k]: v }))

  const onTypeChange = (slug: string) => {
    const bt = types.data?.businessTypes.find((t) => t.slug === slug)
    setOrg((f) => ({
      ...f,
      businessType: slug,
      templateSlug: bt?.defaultTemplateSlug || '',
    }))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const normalized = email.trim().toLowerCase()
      if (isSystemAdmin || effectiveOrgMode === 'existing') {
        await adminApi('/api/admin/users', {
          method: 'POST',
          body: {
            email: normalized,
            password,
            ownerName: ownerName.trim(),
            mustChangePassword: mustChange,
            role,
            ...(isSystemAdmin ? {} : { organizationId: orgId }),
          },
        })
        toast.success(isSystemAdmin ? 'Sistem yöneticisi oluşturuldu.' : 'Kullanıcı oluşturuldu ve restorana eklendi.')
      } else {
        // Yeni restoran: kullanıcı + restoran + sahip üyeliği tek istekte açılır
        const res = await adminApi<{
          organization: { name: string }
          templateApplied: boolean
        }>('/api/admin/organizations', {
          method: 'POST',
          body: {
            ...org,
            subdomain: org.subdomain || undefined,
            email: normalized,
            password,
            ownerName: ownerName.trim(),
            mustChangePassword: mustChange,
          },
        })
        toast.success(`Kullanıcı ve "${res.organization.name}" restoranı oluşturuldu${res.templateApplied ? ', şablon menü eklendi' : ''}.`)
      }
      onCreated()
      setCredentials(
        `QR Chef paneline giriş\nAdres: ${window.location.origin}/login\nE-posta: ${normalized}\nŞifre: ${password}${
          mustChange ? '\nİlk girişte şifrenizi değiştirmeniz istenecek.' : ''
        }`
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    !!email.trim() &&
    password.length >= 8 &&
    (isSystemAdmin || (effectiveOrgMode === 'existing' ? !!orgId : org.businessName.trim().length >= 2 && ownerName.trim().length >= 2))

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>Kullanıcı oluşturuldu</DialogTitle>
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
              <DialogTitle>Yeni kullanıcı</DialogTitle>
              <DialogDescription>Hesap onaylı açılır, e-posta gönderilmez. Şifreyi kullanıcıya siz iletirsiniz.</DialogDescription>
            </DialogHeader>

            <Field label="Rol *" hint={ACCOUNT_ROLES.find((r) => r.id === role)?.hint}>
              <NativeSelect value={role} onChange={(e) => setRole(e.target.value as AccountRole)}>
                {ACCOUNT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="E-posta (giriş adı) *">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
              </Field>
              <Field label={!isSystemAdmin && effectiveOrgMode === 'new' ? 'Ad soyad *' : 'Ad soyad'}>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </Field>
              <Field label="Şifre *" hint="En az 8 karakter, harf ve rakam içermeli">
                <PasswordField value={password} onChange={setPassword} />
              </Field>
              <label className="flex items-center justify-between gap-3 self-end rounded-2xl border border-border/60 p-3 text-sm">
                <span className="font-semibold">İlk girişte şifre değiştirilsin</span>
                <Switch checked={mustChange} onChange={setMustChange} />
              </label>
            </div>

            {!isSystemAdmin && (
              <div className="space-y-3 rounded-2xl border border-border/60 p-3">
                {role === 'owner' ? (
                  <Tabs<OrgMode>
                    value={orgMode}
                    onChange={setOrgMode}
                    tabs={[
                      { id: 'existing', label: 'Mevcut restoran' },
                      { id: 'new', label: 'Yeni restoran' },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Yeni restoran yalnızca Restoran sahibi rolüyle açılabilir.</p>
                )}
                {effectiveOrgMode === 'existing' ? (
                  <div className="space-y-3">
                    <Field label="Restoran *">
                      <Input placeholder="Ad veya subdomain ile ara…" value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} />
                    </Field>
                    <NativeSelect
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      disabled={!orgOptions.length}
                    >
                      {!orgOptions.length && (
                        <option value="">
                          {orgs.loading
                            ? 'Yükleniyor…'
                            : role === 'owner'
                              ? 'Restoran bulunamadı — "Yeni restoran" sekmesini kullanın'
                              : 'Restoran bulunamadı'}
                        </option>
                      )}
                      {orgOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.subdomain})
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="İşletme adı *">
                      <Input
                        value={org.businessName}
                        onChange={(e) => {
                          const v = e.target.value
                          setOrg((f) => ({
                            ...f,
                            businessName: v,
                            subdomain: subdomainTouched ? f.subdomain : slugify(v).slice(0, 40).replace(/-+$/, ''),
                          }))
                        }}
                      />
                    </Field>
                    <Field
                      label="Menü adresi (subdomain)"
                      hint={org.subdomain ? `/${org.subdomain}` : 'Boş bırakılırsa işletme adından üretilir'}
                    >
                      <Input
                        value={org.subdomain}
                        onChange={(e) => {
                          setSubdomainTouched(true)
                          setOrgField('subdomain', subdomainInput(e.target.value))
                        }}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Telefon">
                      <Input value={org.phone} onChange={(e) => setOrgField('phone', e.target.value)} />
                    </Field>
                    <Field label="Şehir">
                      <Input value={org.city} onChange={(e) => setOrgField('city', e.target.value)} />
                    </Field>
                    <Field label="İşletme türü">
                      <NativeSelect value={org.businessType} onChange={(e) => onTypeChange(e.target.value)}>
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
                    <Field label="Başlangıç menüsü (şablon)">
                      <NativeSelect value={org.templateSlug} onChange={(e) => setOrgField('templateSlug', e.target.value)}>
                        <option value="">Boş başlasın</option>
                        {typeTemplates.map((t) => (
                          <option key={t.slug} value={t.slug}>
                            {t.icon} {t.name} ({t.itemCount} ürün)
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>
                        <span className="font-semibold">Kurulum sihirbazını atla</span>
                        <span className="block text-xs text-muted-foreground">Bilgileri siz dolduracaksanız açın</span>
                      </span>
                      <Switch checked={org.skipOnboarding} onChange={(v) => setOrgField('skipOnboarding', v)} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Vazgeç
              </Button>
              <Button onClick={submit} disabled={busy || !canSubmit}>
                {busy ? <Spinner className="mr-1.5" /> : <Plus className="mr-1.5 h-4 w-4" />}
                Oluştur
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

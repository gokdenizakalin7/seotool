'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  ImagePlus,
  LogIn,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  QrCode,
  Trash2,
  UserPlus,
  Utensils,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authFetch } from '@/lib/api-client'
import { compressImageFile, IMAGE_PRESETS } from '@/lib/image-compression'
import { MEMBER_ROLE_LABELS, type AdminBusinessType, type AdminMember, type AdminOrgDetail, type MemberRole, type OrgStatus } from '@/lib/admin-types'
import { normalizeOrgStatus } from '@/lib/org-status'
import {
  Badge,
  ConfirmDialog,
  ErrorBanner,
  Field,
  LoadingBlock,
  NativeSelect,
  OrgStatusBadge,
  PageHeader,
  Panel,
  PanelTitle,
  PasswordField,
  RejectDialog,
  Spinner,
  SuspendDialog,
  Switch,
  Tabs,
} from '../shared/ui'
import { adminApi, errorMessage, fmtDate, fmtDateTime, fmtRelative, generatePassword, isBanned, subdomainInput } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { startImpersonation } from '../lib/impersonate'
import { AuditList } from '../audit/AuditList'
import { UserEditDialog, type EditableUser } from '../users/UserEditDialog'
import { sitePath } from '@/lib/site-url'

type TabId = 'profile' | 'status' | 'members' | 'menus' | 'tables' | 'history'

export function RestaurantDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('profile')
  const detail = useAdminQuery<AdminOrgDetail>(`/api/admin/organizations/${id}`)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteUsers, setDeleteUsers] = useState(true)

  if (detail.loading && !detail.data) return <LoadingBlock />
  if (detail.error && !detail.data) return <ErrorBanner message={detail.error} onRetry={detail.reload} />
  if (!detail.data) return null

  const d = detail.data
  const org = d.org
  const status = normalizeOrgStatus(org.status)
  const isApplication = status === 'pending' || status === 'rejected'

  const setStatus = async (next: OrgStatus, reason = '') => {
    try {
      await adminApi(`/api/admin/organizations/${id}/status`, { method: 'PATCH', body: { status: next, reason } })
      toast.success(
        next === 'suspended'
          ? 'Restoran askıya alındı.'
          : next === 'rejected'
            ? 'Başvuru reddedildi.'
            : next === 'pending'
              ? 'Başvuru yeniden incelemeye alındı.'
              : isApplication
                ? 'Başvuru onaylandı; site yayında.'
                : 'Restoran aktifleştirildi.'
      )
      setSuspendOpen(false)
      setRejectOpen(false)
      detail.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <Link to="/admin/restaurants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Restoranlar
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {org.logo_url && <img src={org.logo_url} alt="" className="h-10 w-10 rounded-xl border border-border/60 bg-white object-contain" />}
            {org.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href={sitePath(org.subdomain)} target="_blank" rel="noreferrer" className="inline-flex items-center font-mono hover:underline">
              /{org.subdomain} <ExternalLink className="ml-1 h-3 w-3" />
            </a>
            <span>Kayıt: {fmtDate(org.created_at)}</span>
            {!org.onboarding_completed_at && <Badge tone="blue">Kurulum sihirbazında</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => startImpersonation(id, navigate).catch((e) => toast.error(errorMessage(e)))}>
              <LogIn className="mr-1.5 h-4 w-4" /> Panele Gir
            </Button>
            {status === 'active' && (
              <Button variant="outline" className="text-red-600" onClick={() => setSuspendOpen(true)}>
                <PauseCircle className="mr-1.5 h-4 w-4" /> Askıya al
              </Button>
            )}
            {status === 'suspended' && (
              <Button variant="outline" className="text-green-600" onClick={() => setStatus('active')}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Aktifleştir
              </Button>
            )}
            {isApplication && (
              <Button variant="outline" className="text-green-600" onClick={() => setStatus('active')}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Başvuruyu onayla
              </Button>
            )}
            {status === 'pending' && (
              <Button variant="outline" className="text-red-600" onClick={() => setRejectOpen(true)}>
                <XCircle className="mr-1.5 h-4 w-4" /> Reddet
              </Button>
            )}
            <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-500/10" title="Restoranı sil" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {status === 'pending' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold">
            <Clock className="mr-1.5 inline h-4 w-4" />
            Kayıt başvurusu onay bekliyor
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            Başvuru: {fmtDateTime(org.created_at)} · Site yayında değil; sahibi paneli kullanabilir. Tüm başvuru bilgileri için{' '}
            <Link to="/admin/applications" className="underline">
              Başvurular
            </Link>{' '}
            sayfasına bakın.
          </p>
        </div>
      )}
      {status === 'rejected' && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <p className="font-semibold">
            <XCircle className="mr-1.5 inline h-4 w-4" />
            Başvuru reddedildi — {org.status_reason || 'sebep girilmemiş'}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {fmtDateTime(org.status_changed_at)}
            {d.statusChangedByEmail && ` · ${d.statusChangedByEmail}`} · Site yok, panel salt-okunur. &quot;Başvuruyu onayla&quot; ile
            aktifleştirebilirsiniz.
          </p>
        </div>
      )}
      {status === 'suspended' && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <p className="font-semibold">
            <PauseCircle className="mr-1.5 inline h-4 w-4" />
            Askıda — {org.status_reason || 'sebep girilmemiş'}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {fmtDateTime(org.status_changed_at)}
            {d.statusChangedByEmail && ` · ${d.statusChangedByEmail}`} · Müşteri menüsü kapalı, restoran paneli salt-okunur.
          </p>
        </div>
      )}

      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Profil' },
          { id: 'status', label: 'Durum & Not' },
          { id: 'members', label: `Kullanıcılar (${d.members.length})` },
          { id: 'menus', label: `Menüler (${d.menus.length})` },
          { id: 'tables', label: `QR & Masalar (${d.tables.length})` },
          { id: 'history', label: 'İşlem Geçmişi' },
        ]}
      />

      {tab === 'profile' && <ProfileTab detail={d} onSaved={detail.reload} />}
      {tab === 'status' && <StatusTab detail={d} status={status} onSuspend={() => setSuspendOpen(true)} onActivate={() => setStatus('active')} onSaved={detail.reload} />}
      {tab === 'members' && <MembersTab orgId={id} members={d.members} onChanged={detail.reload} />}
      {tab === 'menus' && <MenusTab orgId={id} detail={d} onChanged={detail.reload} />}
      {tab === 'tables' && <TablesTab detail={d} />}
      {tab === 'history' && (
        <Panel>
          <AuditList entries={d.audit} showTarget={false} />
        </Panel>
      )}

      <SuspendDialog open={suspendOpen} onOpenChange={setSuspendOpen} orgName={org.name} onSubmit={(r) => setStatus('suspended', r)} />
      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} orgName={org.name} onSubmit={(r) => setStatus('rejected', r)} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`"${org.name}" kalıcı olarak silinsin mi?`}
        description="Menüler, kategoriler, ürünler, QR masalar ve yüklenen görseller silinir. Bu işlem geri alınamaz. Geçici olarak kapatmak için askıya alın."
        confirmLabel="Restoranı sil"
        destructive
        typeToConfirm={org.subdomain}
        onConfirm={async () => {
          try {
            const res = await adminApi<{ removedFiles: number; deletedUsers: number }>(`/api/admin/organizations/${id}`, {
              method: 'DELETE',
              body: { confirmSubdomain: org.subdomain, deleteUsers },
            })
            toast.success(`Restoran silindi (${res.removedFiles} dosya, ${res.deletedUsers} kullanıcı).`)
            navigate('/admin/restaurants')
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      >
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 text-sm">
          <span>
            <span className="font-semibold">Kullanıcı hesaplarını da sil</span>
            <span className="block text-xs text-muted-foreground">Yalnızca başka restorana üye olmayan kullanıcılar silinir</span>
          </span>
          <Switch checked={deleteUsers} onChange={setDeleteUsers} />
        </label>
      </ConfirmDialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

const PROFILE_FIELDS = {
  name: 'name',
  ownerName: 'owner_name',
  subdomain: 'subdomain',
  businessType: 'business_type',
  phone: 'business_phone',
  address: 'address',
  city: 'city',
  state: 'state',
  zipcode: 'zipcode',
  currency: 'currency',
  workingHours: 'working_hours',
  instagramHandle: 'instagram_handle',
  whatsappNumber: 'whatsapp_number',
  googleMapsUrl: 'google_maps_url',
  googleReviewUrl: 'google_review_url',
  contactEmail: 'contact_email',
  websiteUrl: 'website_url',
  facebookUrl: 'facebook_url',
  tiktokHandle: 'tiktok_handle',
  xHandle: 'x_handle',
  youtubeUrl: 'youtube_url',
  aboutText: 'about_text',
  wifiName: 'wifi_name',
  wifiPassword: 'wifi_password',
  primaryColor: 'primary_color',
} as const

type ProfileForm = Record<keyof typeof PROFILE_FIELDS, string> & { onboardingCompleted: boolean }

function toForm(org: Record<string, any>): ProfileForm {
  const f = {} as ProfileForm
  for (const [k, col] of Object.entries(PROFILE_FIELDS)) (f as any)[k] = org[col] ?? ''
  f.primaryColor = f.primaryColor || '#e11d48'
  f.currency = f.currency || '₺'
  f.onboardingCompleted = !!org.onboarding_completed_at
  return f
}

function ProfileTab({ detail, onSaved }: { detail: AdminOrgDetail; onSaved: () => void }) {
  const org = detail.org
  const [form, setForm] = useState<ProfileForm>(() => toForm(org))
  const [busy, setBusy] = useState(false)
  const types = useAdminQuery<{ businessTypes: AdminBusinessType[] }>('/api/admin/business-types')

  useEffect(() => setForm(toForm(org)), [org])

  const set = (k: keyof ProfileForm, v: any) => setForm((f) => ({ ...f, [k]: v }))
  const initial = toForm(org)
  const changed = (Object.keys(form) as (keyof ProfileForm)[]).filter((k) => form[k] !== initial[k])

  const save = async () => {
    const body: Record<string, unknown> = {}
    for (const k of changed) body[k] = form[k]
    if (body.subdomain) body.subdomain = String(body.subdomain).replace(/-+$/, '')
    setBusy(true)
    try {
      await adminApi(`/api/admin/organizations/${org.id}`, { method: 'PATCH', body })
      toast.success('Restoran bilgileri kaydedildi.')
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const input = (k: keyof typeof PROFILE_FIELDS, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input value={form[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
    </Field>
  )

  return (
    <div className="space-y-6">
      <BrandingPanel org={org} onChanged={onSaved} />

      <Panel>
        <PanelTitle>İşletme</PanelTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {input('name', 'İşletme adı')}
          {input('ownerName', 'Yetkili adı')}
          <Field label="Site adresi (slug)" hint="Değişirse eski adres ve QR kodlar yeni adrese yönlendirilir">
            <Input value={form.subdomain} onChange={(e) => set('subdomain', subdomainInput(e.target.value))} className="font-mono" />
          </Field>
          <Field label="İşletme türü">
            <NativeSelect value={form.businessType} onChange={(e) => set('businessType', e.target.value)}>
              <option value="">Seçilmedi</option>
              {(types.data?.businessTypes || []).map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.icon} {t.label}
                  {!t.isActive ? ' (pasif)' : ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {input('currency', 'Para birimi', { maxLength: 10 })}
          {input('workingHours', 'Çalışma saatleri')}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>İletişim ve adres</PanelTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {input('phone', 'Telefon')}
          {input('whatsappNumber', 'WhatsApp', {}, '05xx… biçiminde girilebilir')}
          {input('instagramHandle', 'Instagram', {}, '@kullanici veya profil linki')}
          {input('address', 'Adres')}
          {input('city', 'Şehir')}
          {input('state', 'İlçe')}
          {input('zipcode', 'Posta kodu')}
          {input('googleMapsUrl', 'Google Haritalar linki')}
          {input('googleReviewUrl', 'Google yorum linki')}
          {input('contactEmail', 'İletişim e-postası')}
          {input('websiteUrl', 'Web sitesi')}
          {input('facebookUrl', 'Facebook')}
          {input('tiktokHandle', 'TikTok')}
          {input('xHandle', 'X (Twitter)')}
          {input('youtubeUrl', 'YouTube')}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Site: Hakkımızda</PanelTitle>
        <Field label="Hakkımızda metni" hint="Boş bırakılırsa sitede işletme türü ve menüden otomatik metin gösterilir">
          <Textarea rows={5} maxLength={2000} value={form.aboutText} onChange={(e) => set('aboutText', e.target.value)} />
        </Field>
      </Panel>

      <Panel>
        <PanelTitle>Wi-Fi, görünüm ve kurulum</PanelTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {input('wifiName', 'Wi-Fi adı')}
          {input('wifiPassword', 'Wi-Fi şifresi')}
          <Field label="Ana renk" group>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent"
              />
              <Input value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} className="font-mono" />
            </div>
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 text-sm sm:col-span-2 lg:col-span-3">
            <span>
              <span className="font-semibold">Kurulum tamamlandı</span>
              <span className="block text-xs text-muted-foreground">Kapatırsanız restoran sahibi bir sonraki girişte kurulum sihirbazını görür</span>
            </span>
            <Switch checked={form.onboardingCompleted} onChange={(v) => set('onboardingCompleted', v)} />
          </label>
        </div>
      </Panel>

      <div className="sticky bottom-4 flex justify-end">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 p-2 pl-4 shadow-xl backdrop-blur-xl">
          <span className="text-xs text-muted-foreground">{changed.length ? `${changed.length} alan değişti` : 'Değişiklik yok'}</span>
          <Button variant="outline" disabled={!changed.length || busy} onClick={() => setForm(initial)}>
            Geri al
          </Button>
          <Button disabled={!changed.length || busy} onClick={save}>
            {busy && <Spinner className="mr-1.5" />}
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}

function BrandingPanel({ org, onChanged }: { org: Record<string, any>; onChanged: () => void }) {
  const [busy, setBusy] = useState<'logo' | 'cover' | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const upload = async (kind: 'logo' | 'cover', file: File) => {
    setBusy(kind)
    try {
      const { dataUrl } = await compressImageFile(file, kind === 'logo' ? IMAGE_PRESETS.LOGO : IMAGE_PRESETS.MENU_COVER)
      const res = await authFetch('/api/organizations/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, dataUrl, organizationId: org.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Görsel yüklenemedi.')
      toast.success(kind === 'logo' ? 'Logo güncellendi.' : 'Kapak güncellendi.')
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (kind: 'logo' | 'cover') => {
    setBusy(kind)
    try {
      const res = await authFetch(`/api/organizations/assets?kind=${kind}&organizationId=${org.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Kaldırılamadı.')
      toast.success('Görsel kaldırıldı.')
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const slot = (kind: 'logo' | 'cover', url: string | null, ref: React.RefObject<HTMLInputElement>) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{kind === 'logo' ? 'Logo' : 'Kapak görseli'}</p>
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30 ${
          kind === 'logo' ? 'h-28 w-28' : 'h-28 w-full'
        }`}
      >
        {url ? (
          <img src={url} alt="" className={`h-full w-full ${kind === 'logo' ? 'bg-white object-contain' : 'object-cover'}`} />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
        {busy === kind && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Spinner />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => ref.current?.click()}>
          {url ? 'Değiştir' : 'Yükle'}
        </Button>
        {url && (
          <Button size="sm" variant="ghost" className="text-red-600" disabled={!!busy} onClick={() => remove(kind)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) upload(kind, f)
        }}
      />
    </div>
  )

  return (
    <Panel>
      <PanelTitle>Marka görselleri</PanelTitle>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr]">
        {slot('logo', org.logo_url, logoRef)}
        {slot('cover', org.cover_url, coverRef)}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Durum & not                                                         */
/* ------------------------------------------------------------------ */

function StatusTab({
  detail,
  status,
  onSuspend,
  onActivate,
  onSaved,
}: {
  detail: AdminOrgDetail
  status: OrgStatus
  onSuspend: () => void
  onActivate: () => void
  onSaved: () => void
}) {
  const [note, setNote] = useState(detail.adminNote)
  const [busy, setBusy] = useState(false)
  useEffect(() => setNote(detail.adminNote), [detail.adminNote])
  const STATUS_ACTIONS = ['organization.suspend', 'organization.activate', 'organization.approve', 'organization.reject', 'organization.pending']
  const history = detail.audit.filter((a) => STATUS_ACTIONS.includes(a.action))

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <PanelTitle>Hesap durumu</PanelTitle>
        <OrgStatusBadge status={status} reason={detail.org.status_reason} changedAt={detail.org.status_changed_at} />
        <p className="mt-3 text-sm text-muted-foreground">
          {status === 'active'
            ? 'Restoran aktif: müşteri menüsü yayında, restoran sahibi paneli kullanabilir.'
            : status === 'pending'
              ? 'Kayıt başvurusu onay bekliyor: site yayında değil; sahibi kurulumu tamamlayıp menüsünü hazırlayabilir.'
              : status === 'rejected'
                ? 'Başvuru reddedildi: site yayınlanmıyor; sahibi sebebi görür ancak değişiklik yapamaz.'
                : 'Restoran askıda: müşteri menüsü "hizmet dışı" mesajı gösterir; sahibi sebebi görür ancak değişiklik yapamaz.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'active' && (
            <Button variant="outline" className="text-red-600" onClick={onSuspend}>
              <PauseCircle className="mr-1.5 h-4 w-4" /> Askıya al
            </Button>
          )}
          {status !== 'active' && (
            <Button variant="outline" className="text-green-600" onClick={onActivate}>
              {status === 'suspended' ? <PlayCircle className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              {status === 'suspended' ? 'Aktifleştir' : 'Başvuruyu onayla'}
            </Button>
          )}
        </div>
        <h3 className="mb-1 mt-6 text-sm font-semibold">Durum geçmişi</h3>
        <AuditList entries={history} showTarget={false} />
      </Panel>

      <Panel>
        <PanelTitle>Admin notu</PanelTitle>
        <p className="mb-2 text-xs text-muted-foreground">Yalnızca sistem yöneticileri görür (sözleşme, ödeme, iletişim notları…).</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={8} maxLength={4000} />
        <div className="mt-3 flex justify-end">
          <Button
            disabled={busy || note === detail.adminNote}
            onClick={async () => {
              setBusy(true)
              try {
                await adminApi(`/api/admin/organizations/${detail.org.id}`, { method: 'PATCH', body: { adminNote: note } })
                toast.success('Not kaydedildi.')
                onSaved()
              } catch (e) {
                toast.error(errorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Spinner className="mr-1.5" />}
            Notu kaydet
          </Button>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Kullanıcılar                                                        */
/* ------------------------------------------------------------------ */

function MembersTab({ orgId, members, onChanged }: { orgId: string; members: AdminMember[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<EditableUser | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<AdminMember | null>(null)

  const changeRole = async (m: AdminMember, role: MemberRole) => {
    try {
      await adminApi(`/api/admin/organizations/${orgId}/members`, { method: 'PATCH', body: { userId: m.userId, role } })
      toast.success('Rol güncellendi.')
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Panel className="p-0 sm:p-0">
      <div className="flex items-center justify-between p-5 pb-3">
        <h2 className="text-base font-bold">Restoran kullanıcıları</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Kullanıcı ekle
        </Button>
      </div>
      {members.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-amber-700 dark:text-amber-300">
          Bu restorana bağlı kullanıcı yok; kimse panele giriş yapamaz. Bir kullanıcı ekleyin.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="hidden md:table-cell">Son giriş</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <p className="font-medium">{m.ownerName || '—'}</p>
                    <p className="font-mono text-xs text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell>
                    <NativeSelect value={m.role} onChange={(e) => changeRole(m, e.target.value as MemberRole)} className="h-8 w-32 text-xs">
                      {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((r) => (
                        <option key={r} value={r}>
                          {MEMBER_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {isBanned(m.bannedUntil) ? <Badge tone="red">Giriş engelli</Badge> : <Badge tone="green">Giriş açık</Badge>}
                      {m.mustChangePassword && <Badge tone="amber">Şifre değiştirmeli</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{fmtRelative(m.lastSignInAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEdit({
                            id: m.userId,
                            email: m.email,
                            ownerName: m.ownerName,
                            mustChangePassword: m.mustChangePassword,
                            bannedUntil: m.bannedUntil,
                            lastSignInAt: m.lastSignInAt,
                          })
                        }
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle / Şifre
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-500/10" title="Restorandan çıkar" onClick={() => setRemoveTarget(m)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UserEditDialog user={edit} onOpenChange={(v) => !v && setEdit(null)} onChanged={onChanged} />
      <AddMemberDialog orgId={orgId} open={addOpen} onOpenChange={setAddOpen} onAdded={onChanged} />
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title={`${removeTarget?.email} restorandan çıkarılsın mı?`}
        description="Kullanıcı hesabı silinmez, yalnızca bu restorana erişimi kalkar."
        confirmLabel="Çıkar"
        destructive
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await adminApi(`/api/admin/organizations/${orgId}/members`, { method: 'DELETE', body: { userId: removeTarget.userId } })
            toast.success('Kullanıcı restorandan çıkarıldı.')
            setRemoveTarget(null)
            onChanged()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </Panel>
  )
}

function AddMemberDialog({
  orgId,
  open,
  onOpenChange,
  onAdded,
}: {
  orgId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded: () => void
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [email, setEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<MemberRole>('staff')
  const [mustChange, setMustChange] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setMode('new')
      setEmail('')
      setOwnerName('')
      setPassword(generatePassword())
      setRole('staff')
      setMustChange(true)
      setError(null)
    }
  }, [open])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await adminApi(`/api/admin/organizations/${orgId}/members`, {
        method: 'POST',
        body: mode === 'new' ? { mode, email, password, ownerName, role, mustChangePassword: mustChange } : { mode, email, role },
      })
      toast.success(mode === 'new' ? 'Kullanıcı oluşturuldu ve eklendi. Şifreyi iletmeyi unutmayın.' : 'Kullanıcı eklendi.')
      onAdded()
      onOpenChange(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restorana kullanıcı ekle</DialogTitle>
          <DialogDescription>Bir kullanıcı yalnızca bir restorana üye olabilir.</DialogDescription>
        </DialogHeader>
        <Tabs<'new' | 'existing'>
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'new', label: 'Yeni kullanıcı' },
            { id: 'existing', label: 'Mevcut kullanıcı' },
          ]}
        />
        <div className="space-y-3">
          <Field label="E-posta">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
          {mode === 'new' && (
            <>
              <Field label="Ad soyad">
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </Field>
              <Field label="Şifre">
                <PasswordField value={password} onChange={setPassword} />
              </Field>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">İlk girişte şifre değiştirilsin</span>
                <Switch checked={mustChange} onChange={setMustChange} />
              </label>
            </>
          )}
          <Field label="Rol">
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((r) => (
                <option key={r} value={r}>
                  {MEMBER_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={busy || !email || (mode === 'new' && password.length < 8)}>
            {busy ? <Spinner className="mr-1.5" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Ekle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Menüler ve masalar                                                  */
/* ------------------------------------------------------------------ */

function MenusTab({ orgId, detail, onChanged }: { orgId: string; detail: AdminOrgDetail; onChanged: () => void }) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)

  const toggle = async (menuId: string, isListed: boolean) => {
    setBusyId(menuId)
    try {
      await adminApi(`/api/admin/organizations/${orgId}/menus`, { method: 'PATCH', body: { menuId, isListed } })
      toast.success(isListed ? 'Menü yayına alındı.' : 'Menü yayından kaldırıldı.')
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel className="p-0 sm:p-0">
      <div className="flex items-center justify-between p-5 pb-3">
        <h2 className="text-base font-bold">Menüler</h2>
        <Button size="sm" variant="outline" onClick={() => startImpersonation(orgId, navigate).catch((e) => toast.error(errorMessage(e)))}>
          <Utensils className="mr-1.5 h-4 w-4" /> Menü editöründe aç
        </Button>
      </div>
      {detail.menus.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted-foreground">Henüz menü yok.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Menü</TableHead>
              <TableHead className="text-right">Kategori</TableHead>
              <TableHead className="text-right">Ürün</TableHead>
              <TableHead>Güncelleme</TableHead>
              <TableHead className="text-right">Yayında</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.menus.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-right tabular-nums">{m.categoryCount}</TableCell>
                <TableCell className="text-right tabular-nums">{m.itemCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(m.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    {busyId === m.id && <Spinner />}
                    <Switch checked={m.isListed} disabled={busyId === m.id} onChange={(v) => toggle(m.id, v)} label="Yayında" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  )
}

function TablesTab({ detail }: { detail: AdminOrgDetail }) {
  const total = detail.tables.reduce((n, t) => n + t.views, 0)
  return (
    <Panel>
      <PanelTitle>
        QR masalar <span className="ml-2 text-sm font-normal text-muted-foreground">Toplam {total.toLocaleString('tr-TR')} okutma</span>
      </PanelTitle>
      {detail.tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz QR masa oluşturulmamış.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {detail.tables.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4 text-muted-foreground" /> {t.name}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{t.views.toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

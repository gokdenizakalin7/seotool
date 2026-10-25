'use client'

import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Inbox,
  Instagram,
  LogIn,
  RotateCcw,
  Search,
  Store,
  User,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminApplication, OrgStatus } from '@/lib/admin-types'
import { useBusinessTypes } from '@/lib/use-business-types'
import { sitePath } from '@/lib/site-url'
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  OrgStatusBadge,
  PageHeader,
  Panel,
  RejectDialog,
  Tabs,
  useDebounced,
} from '../shared/ui'
import { adminApi, errorMessage, fmtDateTime, fmtRelative, qs } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { startImpersonation } from '../lib/impersonate'

type StatusFilter = 'pending' | 'rejected'

interface ListResponse {
  applications: AdminApplication[]
  counts: { pending: number; rejected: number }
}

const ONBOARDING_STEP_LABELS: Record<string, string> = {
  basics: 'İşletme bilgileri',
  brand: 'Logo ve görünüm',
  contact: 'İletişim ve konum',
  wifi: 'Wi-Fi',
  social: 'Sosyal medya',
  menu: 'Menü seçimi',
  done: 'Tamamlandı',
}

/**
 * Başvurular: /signup'tan kaydolan ve onay bekleyen (ya da reddedilen) işletmeler.
 * Kayıt formu ve kurulum sihirbazında toplanan her bilgi burada listelenir; Onayla → site yayına girer.
 */
export function ApplicationsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as StatusFilter) || 'pending'
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebounced(search)
  const [approveTarget, setApproveTarget] = useState<AdminApplication | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminApplication | null>(null)
  const { get: getBusinessType } = useBusinessTypes()

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if ((params.get('q') || '') !== q) update({ q: q || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const list = useAdminQuery<ListResponse>(`/api/admin/applications${qs({ status, q })}`)
  const counts = list.data?.counts

  const setStatus = async (app: AdminApplication, next: OrgStatus, reason = '') => {
    try {
      await adminApi(`/api/admin/organizations/${app.id}/status`, { method: 'PATCH', body: { status: next, reason } })
      toast.success(
        next === 'active'
          ? `"${app.name}" onaylandı; sitesi yayında.`
          : next === 'rejected'
            ? `"${app.name}" başvurusu reddedildi.`
            : `"${app.name}" yeniden incelemeye alındı.`
      )
      setApproveTarget(null)
      setRejectTarget(null)
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Başvurular"
        description="Kayıt formundan gelen işletme başvuruları. Onaylanana kadar site yayınlanmaz; başvuru sahibi bu sırada paneli kullanıp menüsünü hazırlayabilir."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<StatusFilter>
          value={status}
          onChange={(v) => update({ status: v === 'pending' ? null : v })}
          tabs={[
            { id: 'pending', label: `Onay bekleyen${counts ? ` (${counts.pending})` : ''}` },
            { id: 'rejected', label: `Reddedilen${counts ? ` (${counts.rejected})` : ''}` },
          ]}
        />
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="İşletme, yetkili, e-posta, telefon, şehir…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}

      {list.loading && !list.data ? (
        <LoadingBlock />
      ) : !list.data?.applications.length ? (
        <Panel className="p-0 sm:p-0">
          <EmptyState
            icon={Inbox}
            title={status === 'pending' ? 'Onay bekleyen başvuru yok' : 'Reddedilen başvuru yok'}
            hint={q ? 'Aramayı değiştirmeyi deneyin.' : status === 'pending' ? 'Yeni kayıtlar burada görünür.' : undefined}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {list.data.applications.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              typeLabel={getBusinessType(a.businessType)?.label}
              typeIcon={getBusinessType(a.businessType)?.icon}
              onApprove={() => setApproveTarget(a)}
              onReject={() => setRejectTarget(a)}
              onReopen={() => setStatus(a, 'pending')}
              onImpersonate={() => startImpersonation(a.id, navigate).catch((e) => toast.error(errorMessage(e)))}
            />
          ))}
        </div>
      )}

      {approveTarget && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setApproveTarget(null)}
          title={`"${approveTarget.name}" onaylansın mı?`}
          description={
            <>
              İşletme sitesi <span className="font-mono">{sitePath(approveTarget.subdomain)}</span> adresinde hemen yayına girer; QR
              kodlar bu adrese açılır. Başvuru sahibi panelde durumu görür.
              {!approveTarget.onboardingCompleted && ' Kurulum sihirbazı henüz tamamlanmamış; sahibi kaldığı yerden devam edebilir.'}
            </>
          }
          confirmLabel="Onayla ve yayınla"
          onConfirm={() => setStatus(approveTarget, 'active')}
        />
      )}
      {rejectTarget && (
        <RejectDialog
          open
          onOpenChange={(v) => !v && setRejectTarget(null)}
          orgName={rejectTarget.name}
          onSubmit={(reason) => setStatus(rejectTarget, 'rejected', reason)}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Onay ve red işlemleri İşlem Geçmişi&apos;ne yazılır. Onay bekleyen başvurular{' '}
        <Link to="/admin/restaurants?status=pending" className="underline-offset-2 hover:underline">
          Restoranlar
        </Link>{' '}
        listesinde de görünür.
      </p>
    </>
  )
}

function ApplicationCard({
  app: a,
  typeLabel,
  typeIcon,
  onApprove,
  onReject,
  onReopen,
  onImpersonate,
}: {
  app: AdminApplication
  typeLabel?: string
  typeIcon?: string
  onApprove: () => void
  onReject: () => void
  onReopen: () => void
  onImpersonate: () => void
}) {
  const stepLabel = a.onboardingCompleted
    ? 'Tamamlandı'
    : a.onboardingStep
      ? `${ONBOARDING_STEP_LABELS[a.onboardingStep] || a.onboardingStep} adımında`
      : 'Başlanmadı'

  return (
    <Panel>
      {/* Üst satır: kimlik + durum + eylemler */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {a.logoUrl ? (
            <img src={a.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-border/60 bg-white object-contain" />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 text-sm font-bold"
              style={{ background: a.primaryColor ? `${a.primaryColor}22` : undefined }}
            >
              {a.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold text-foreground">{a.name}</h3>
              <OrgStatusBadge status={a.status} reason={a.statusReason} changedAt={a.statusChangedAt} showReason={false} />
              {typeLabel && (
                <Badge tone="blue">
                  {typeIcon} {typeLabel}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <a
                href={sitePath(a.subdomain)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center font-mono hover:text-foreground hover:underline"
                title="Onaylanana kadar bu adres 'henüz yayında değil' gösterir"
              >
                {sitePath(a.subdomain)} <ExternalLink className="ml-1 h-3 w-3" />
              </a>
              <span>
                Başvuru: {fmtDateTime(a.createdAt)} ({fmtRelative(a.createdAt)})
              </span>
              <span>Kurulum: {stepLabel}</span>
              <span>
                {a.menuCount} menü · {a.itemCount} ürün
              </span>
            </div>
            {a.status === 'rejected' && (
              <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">
                Red sebebi: {a.statusReason || 'girilmemiş'} · {fmtDateTime(a.statusChangedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="outline" size="sm" onClick={onImpersonate} title="Bu işletmenin paneline gir">
            <LogIn className="mr-1.5 h-4 w-4" /> Panele Gir
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin/restaurants/${a.id}`}>
              <FileText className="mr-1.5 h-4 w-4" /> Detay
            </Link>
          </Button>
          {a.status === 'pending' ? (
            <>
              <Button size="sm" variant="outline" className="text-red-600" onClick={onReject}>
                <XCircle className="mr-1.5 h-4 w-4" /> Reddet
              </Button>
              <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={onApprove}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Onayla
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onReopen} title="Yeniden onay bekleyenlere al">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Yeniden incele
              </Button>
              <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={onApprove}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Onayla
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Toplanan bilgiler */}
      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border/60 pt-5 md:grid-cols-2 xl:grid-cols-4">
        <InfoGroup icon={User} title="Başvuru sahibi">
          <Row label="Ad soyad" value={a.ownerName} />
          <Row label="E-posta" value={a.owner?.email} href={a.owner?.email ? `mailto:${a.owner.email}` : undefined} mono />
          <Row label="Telefon" value={a.ownerPhone} href={a.ownerPhone ? `tel:${a.ownerPhone}` : undefined} mono />
          <Row label="Kayıt" value={a.owner?.createdAt ? fmtDateTime(a.owner.createdAt) : undefined} />
          <Row label="Son giriş" value={fmtRelative(a.owner?.lastSignInAt)} />
          <Row
            label="Sözleşme"
            value={a.owner?.termsAcceptedAt ? `v${a.owner.termsVersion || '?'} · ${fmtDateTime(a.owner.termsAcceptedAt)}` : undefined}
          />
        </InfoGroup>

        <InfoGroup icon={Store} title="İşletme">
          <Row label="Tür" value={typeLabel ? `${typeIcon ?? ''} ${typeLabel}`.trim() : a.businessType || undefined} />
          <Row label="İşletme telefonu" value={a.businessPhone} href={a.businessPhone ? `tel:${a.businessPhone}` : undefined} mono />
          <Row label="Şehir" value={a.city} />
          <Row label="Adres" value={a.address} />
          <Row label="Çalışma saatleri" value={a.workingHours} />
          <Row label="Harita" value={a.googleMapsUrl} href={a.googleMapsUrl} link />
          <Row label="Google yorum" value={a.googleReviewUrl} href={a.googleReviewUrl} link />
        </InfoGroup>

        <InfoGroup icon={Instagram} title="Sosyal medya ve iletişim">
          <Row label="Instagram" value={a.instagramHandle ? `@${a.instagramHandle}` : undefined} href={a.instagramHandle ? `https://instagram.com/${a.instagramHandle}` : undefined} link />
          <Row label="WhatsApp" value={a.whatsappNumber ? `+${a.whatsappNumber.replace(/^\+/, '')}` : undefined} href={a.whatsappNumber ? `https://wa.me/${a.whatsappNumber.replace(/\D/g, '')}` : undefined} link mono />
          <Row label="Facebook" value={a.facebookUrl} href={a.facebookUrl} link />
          <Row label="TikTok" value={a.tiktokHandle ? `@${a.tiktokHandle}` : undefined} />
          <Row label="X" value={a.xHandle ? `@${a.xHandle}` : undefined} />
          <Row label="YouTube" value={a.youtubeUrl} href={a.youtubeUrl} link />
          <Row label="İletişim e-postası" value={a.contactEmail} href={a.contactEmail ? `mailto:${a.contactEmail}` : undefined} mono />
          <Row label="Web sitesi" value={a.websiteUrl} href={a.websiteUrl} link />
        </InfoGroup>

        <InfoGroup icon={Globe} title="Site ve menü">
          <Row label="Site adresi" value={sitePath(a.subdomain)} mono />
          <Row label="Wi-Fi ağı" value={a.wifiName} />
          <Row
            label="Ana renk"
            value={
              a.primaryColor ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-border/60" style={{ background: a.primaryColor }} />
                  <span className="font-mono">{a.primaryColor}</span>
                </span>
              ) : undefined
            }
          />
          <Row label="Logo" value={a.logoUrl ? 'Yüklendi' : undefined} href={a.logoUrl || undefined} link />
          <Row label="Kapak" value={a.coverUrl ? 'Yüklendi' : undefined} href={a.coverUrl || undefined} link />
          <Row label="Menü / ürün" value={`${a.menuCount} / ${a.itemCount}`} />
          <Row label="Hakkımızda" value={a.aboutText ? `${a.aboutText.slice(0, 140)}${a.aboutText.length > 140 ? '…' : ''}` : undefined} />
        </InfoGroup>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Boş alanlar başvuru sahibi tarafından henüz doldurulmadı; kurulum sihirbazı tamamlandıkça bu kart güncellenir.
      </p>
    </Panel>
  )
}

function InfoGroup({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h4>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function Row({
  label,
  value,
  href,
  link,
  mono,
}: {
  label: string
  value?: React.ReactNode
  href?: string
  link?: boolean
  mono?: boolean
}) {
  const empty = value === undefined || value === null || value === '' || value === '—' || value === 'Hiç'
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 break-words ${empty ? 'text-muted-foreground/60' : 'text-foreground'} ${mono ? 'font-mono' : ''}`}>
        {empty ? (
          '—'
        ) : href ? (
          <a href={href} target={link ? '_blank' : undefined} rel={link ? 'noreferrer' : undefined} className="hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

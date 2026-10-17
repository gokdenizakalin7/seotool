'use client'

import React, { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Eye, EyeOff, Loader2, PauseCircle, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { SUSPEND_REASON_PRESETS, type OrgStatus } from '@/lib/admin-types'
import { fmtDateTime, generatePassword } from '../lib/admin-api'

/* ------------------------------------------------------------------ */
/* Yerleşim parçaları                                                  */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PanelTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-foreground">{children}</h2>
      {actions}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

export function LoadingBlock({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Spinner /> {label}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint }: { icon?: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {Icon && <Icon className="mb-3 h-10 w-10 text-muted-foreground/60" />}
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {message}
      </span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Tekrar dene
        </Button>
      )}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ElementType
  tone?: 'default' | 'warn' | 'good'
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-primary/10 text-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
      {hint && (
        <p
          className={cn(
            'mt-1 text-xs',
            tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'good' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          )}
        >
          {hint}
        </p>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Form parçaları                                                      */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  children,
  className,
  group,
}: {
  label: string
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
  /** Birden çok kontrol içeren alan (çip/ikon listesi, renk seçici): <label> yerine role="group" */
  group?: boolean
}) {
  const body = (
    <>
      <span className="block text-xs font-semibold leading-none text-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs text-red-600">{error}</span> : hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </>
  )
  // Tek kontrollü alanlarda <label>: etiket kontrole bağlanır (ekran okuyucu, etikete tıklama).
  // Gruplarda <label> boşluğa tıklamayı ilk düğmeye aktarırdı.
  return group ? (
    <div role="group" aria-label={label} className={cn('space-y-1.5', className)}>
      {body}
    </div>
  ) : (
    <label className={cn('block space-y-1.5', className)}>{body}</label>
  )
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-xl border border-input bg-background/40 px-3 text-sm shadow-sm backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
NativeSelect.displayName = 'NativeSelect'

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border/60 transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

export function PasswordField({
  value,
  onChange,
  placeholder = 'En az 8 karakter, harf ve rakam',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-1.5">
      <div className="relative flex-1">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="pr-9 font-mono"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        title="Güçlü şifre üret"
        onClick={() => {
          onChange(generatePassword())
          setShow(true)
        }}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        title="Kopyala"
        disabled={!value}
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
      {copied ? 'Kopyalandı' : label || 'Kopyala'}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* Durum rozetleri                                                     */
/* ------------------------------------------------------------------ */

export function Badge({
  tone = 'neutral',
  children,
  title,
  className,
}: {
  tone?: 'neutral' | 'green' | 'red' | 'amber' | 'blue'
  children: React.ReactNode
  title?: string
  className?: string
}) {
  const tones = {
    neutral: 'border-border/70 bg-muted/60 text-muted-foreground',
    green: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  }
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}
    >
      {children}
    </span>
  )
}

/** Restoran hesap durumu; askıda / reddedildiyse sebep ve tarih rozetin altında ve ipucunda görünür */
export function OrgStatusBadge({
  status,
  reason,
  changedAt,
  showReason = true,
}: {
  status: OrgStatus
  reason?: string
  changedAt?: string | null
  showReason?: boolean
}) {
  if (status === 'active') {
    return (
      <Badge tone="green">
        <CheckCircle2 className="h-3 w-3" /> Aktif
      </Badge>
    )
  }
  if (status === 'pending') {
    return (
      <Badge tone="amber" title={`Başvuru ${changedAt ? fmtDateTime(changedAt) : ''} tarihinden beri onay bekliyor`}>
        <Clock className="h-3 w-3" /> Onay bekliyor
      </Badge>
    )
  }
  const rejected = status === 'rejected'
  const tip = `${rejected ? 'Başvuru reddedildi' : 'Askıya alındı'}${changedAt ? ` (${fmtDateTime(changedAt)})` : ''}: ${reason || 'sebep girilmemiş'}`
  return (
    <div className="space-y-1">
      <Badge tone="red" title={tip}>
        {rejected ? <XCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />} {rejected ? 'Reddedildi' : 'Askıda'}
      </Badge>
      {showReason && (
        <p className="max-w-[220px] truncate text-[11px] text-red-700/80 dark:text-red-300/80" title={tip}>
          {reason || 'Sebep girilmemiş'}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Diyaloglar                                                          */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  destructive,
  typeToConfirm,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** Verilirse kullanıcı bu metni aynen yazmadan onaylayamaz */
  typeToConfirm?: string
  onConfirm: () => Promise<void> | void
  children?: React.ReactNode
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = !typeToConfirm || typed.trim() === typeToConfirm
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          onOpenChange(v)
          if (!v) setTyped('')
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
        </DialogHeader>
        {children}
        {typeToConfirm && (
          <Field label={`Onaylamak için "${typeToConfirm}" yazın`}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus className="font-mono" />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                setTyped('')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Spinner className="mr-1.5" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Askıya alma sebebi: hazır sebepler + serbest metin */
export function SuspendDialog({
  open,
  onOpenChange,
  orgName,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgName: string
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>&quot;{orgName}&quot; askıya alınsın mı?</DialogTitle>
          <DialogDescription>
            Müşteri menüsü &quot;hizmet dışı&quot; mesajı gösterir. Restoran sahibi giriş yapabilir ve sebebi görür, ancak
            değişiklik yapamaz.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {SUSPEND_REASON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                reason === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <Field label="Sebep (restoran sahibi bu metni görür)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onSubmit(reason.trim())
                setReason('')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Spinner className="mr-1.5" />}
            Askıya al
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const REJECT_REASON_PRESETS = [
  'İşletme bilgileri doğrulanamadı',
  'Eksik veya hatalı başvuru bilgileri',
  'Hizmet kapsamı dışında bir işletme',
  'Yinelenen başvuru',
]

/** Başvuru reddi: hazır sebepler + serbest metin (işletme sahibi panelde görür) */
export function RejectDialog({
  open,
  onOpenChange,
  orgName,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgName: string
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>&quot;{orgName}&quot; başvurusu reddedilsin mi?</DialogTitle>
          <DialogDescription>
            İşletme sitesi yayınlanmaz, panel salt-okunur olur ve başvuru sahibi sebebi görür. Daha sonra &quot;Onayla&quot; ile
            aktifleştirebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {REJECT_REASON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                reason === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <Field label="Sebep (başvuru sahibi bu metni görür)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onSubmit(reason.trim())
                setReason('')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Spinner className="mr-1.5" />}
            Reddet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Sayfalama                                                           */
/* ------------------------------------------------------------------ */

export function Pager({
  page,
  size,
  total,
  onPage,
}: {
  page: number
  size: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return <p className="pt-3 text-xs text-muted-foreground">{total} kayıt</p>
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
      <span>
        {total} kayıt • Sayfa {page}/{pages}
      </span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Önceki
        </Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Sonraki
        </Button>
      </div>
    </div>
  )
}

/** Sekme çubuğu */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: React.ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/60 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
            value === t.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Gecikmeli arama değeri */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

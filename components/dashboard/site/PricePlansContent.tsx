'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgePercent, CalendarClock, CircleHelp, Hand, Loader2, Pencil, Plus, RefreshCw, Trash2, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog, Field, NativeSelect, Switch } from '@/components/admin/shared/ui'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { formatPrice, parsePrice, type Rounding } from '@/lib/price'
import {
  applyPlanToPrice,
  describePlan,
  findScheduleOverlaps,
  ISO_DAY_LABELS,
  type PriceModeState,
  type PricePlan,
  type ScheduleWindow,
} from '@/lib/price-plan'
import { cn } from '@/lib/utils'
import { UnsavedChangesDialog, useBeforeUnload, useUnsavedChanges } from '@/components/dashboard/unsaved-changes'
import { MigrationNotice, SiteApiError, SitePageShell, isoToLocalInput, localInputToIso, siteApi, useOrgMenus } from './shared'

interface PlansResponse {
  plans: PricePlan[]
  mode: PriceModeState
  currency: string
  effective: { planId: string | null; source: 'manual' | 'schedule' | 'none'; until: string | null }
  next: { planId: string; startsAt: string } | null
}

type Draft = Omit<PricePlan, 'id' | 'displayOrder'> & { id?: string; direction: 'up' | 'down'; amount: string }

const emptyDraft = (): Draft => ({
  name: '',
  bannerText: '',
  adjustmentType: 'percent',
  adjustmentValue: 10,
  direction: 'up',
  amount: '10',
  rounding: '1',
  excludedCategoryIds: [],
  schedule: [],
  scheduleEnabled: false,
  overrides: {},
})

const draftFromPlan = (p: PricePlan): Draft => ({
  ...p,
  bannerText: p.bannerText || '',
  direction: p.adjustmentValue < 0 ? 'down' : 'up',
  amount: String(Math.abs(p.adjustmentValue)).replace('.', ','),
})

const formatWindow = (w: ScheduleWindow) =>
  `${[...w.days].sort().map((d) => ISO_DAY_LABELS[d - 1]).join(', ')} ${w.start}–${w.end}`

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/** Bu gece 04:00 (şu an 04:00'dan önceyse bugün 04:00) */
function tonightAt4(): string {
  const d = new Date()
  const target = new Date(d)
  target.setHours(4, 0, 0, 0)
  if (target <= d) target.setDate(target.getDate() + 1)
  return target.toISOString()
}

export function PricePlansContent() {
  const { restaurant, isSuspended } = useRestaurant()
  const subdomain = restaurant?.subdomain || ''
  const [state, setState] = useState<PlansResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PricePlan | null>(null)
  const org = useOrgMenus(subdomain)

  const load = useCallback(async () => {
    if (!subdomain) return
    setLoading(true)
    setError(null)
    try {
      setState(await siteApi<PlansResponse>(`/api/site/price-plans?subdomain=${encodeURIComponent(subdomain)}`))
    } catch (e: any) {
      if (e instanceof SiteApiError && e.code === 'MIGRATION_REQUIRED') setMigrationMissing(true)
      else setError(e?.message || 'Fiyat planları yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    load()
  }, [load])

  const plans = state?.plans || []
  const currency = state?.currency || restaurant?.currency || '₺'
  const planName = (id: string | null | undefined) => plans.find((p) => p.id === id)?.name
  const overlaps = useMemo(() => findScheduleOverlaps(plans), [plans])

  // Plan kartından tek tıkla: planı elle (süresiz) uygula ya da otomatik moda dön
  const [applying, setApplying] = useState<string | null>(null)
  const applyPlanNow = async (plan: PricePlan | null) => {
    setApplying(plan?.id || 'auto')
    try {
      await siteApi<{ mode: PriceModeState }>('/api/site/price-mode', {
        method: 'POST',
        json: plan ? { subdomain, mode: 'manual', planId: plan.id, until: null } : { subdomain, mode: 'auto', planId: null, until: null },
      })
      toast.success(plan ? `"${plan.name}" fiyatları şu an geçerli. Siz değiştirene kadar devrede kalır.` : 'Fiyatlar takvime göre otomatik moda döndü.')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Fiyat modu değiştirilemedi.')
    } finally {
      setApplying(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await siteApi(`/api/site/price-plans/${deleteTarget.id}?subdomain=${encodeURIComponent(subdomain)}`, { method: 'DELETE' })
      toast.success('Fiyat planı silindi.')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <SitePageShell
      title="Fiyat Planları"
      description="Etkinlik günleri, happy hour gibi dönemler için menüden türetilen fiyat listeleri. QR kodunuz değişmez; fiyatlar otomatik geçer."
      subdomain={subdomain}
      page=""
      actions={
        !migrationMissing && (
          <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended || loading}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Plan
          </Button>
        )
      }
    >
      {migrationMissing ? (
        <MigrationNotice />
      ) : error ? (
        <div className="glass-card border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tekrar dene
          </Button>
        </div>
      ) : loading && !state ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      ) : state ? (
        <>
          <CurrentStatus state={state} planName={planName} />
          <ModeCard
            subdomain={subdomain}
            state={state}
            disabled={isSuspended}
            onSaved={(mode) => {
              setState((s) => (s ? { ...s, mode } : s))
              load()
            }}
          />

          {overlaps.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Takvimi çakışan planlar var:{' '}
                {overlaps.map(([a, b]) => `${a.name} ↔ ${b.name}`).join(', ')}. Çakışmada en son başlayan pencere geçerli olur.
              </span>
            </div>
          )}

          {plans.length === 0 ? (
            <div className="glass-card border-dashed p-10 text-center">
              <BadgePercent className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-1 text-lg font-semibold text-foreground">Henüz fiyat planı yok</h3>
              <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
                Örneğin &quot;Etkinlik Fiyatları&quot;: tüm menüye %15 artış, her cuma 20:00–02:00 arasında otomatik. Ya da
                &quot;Happy Hour&quot;: içeceklerde 20 ₺ indirim.
              </p>
              <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended}>
                <Plus className="mr-2 h-4 w-4" /> İlk Planı Oluştur
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {plans.map((plan) => {
                const overrideCount = Object.keys(plan.overrides || {}).length
                const isEffective = state.effective.planId === plan.id
                const isManualActive = state.mode.mode === 'manual' && state.mode.activePlanId === plan.id
                return (
                  <Card key={plan.id} className={cn(isEffective && 'ring-2 ring-primary')}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <CardDescription>{describePlan(plan, currency)}</CardDescription>
                        </div>
                        {isEffective && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">Şu an geçerli</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="space-y-1 text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <CalendarClock className="h-4 w-4" />
                          {plan.scheduleEnabled && plan.schedule.length
                            ? plan.schedule.map(formatWindow).join(' · ')
                            : 'Takvim yok (yalnızca elle)'}
                        </p>
                        {(overrideCount > 0 || plan.excludedCategoryIds.length > 0) && (
                          <p>
                            {overrideCount > 0 && `${overrideCount} ürüne özel fiyat`}
                            {overrideCount > 0 && plan.excludedCategoryIds.length > 0 && ' · '}
                            {plan.excludedCategoryIds.length > 0 && `${plan.excludedCategoryIds.length} kategori hariç`}
                          </p>
                        )}
                        {plan.bannerText && <p className="italic">“{plan.bannerText}”</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isManualActive ? (
                          <Button size="sm" variant="outline" onClick={() => applyPlanNow(null)} disabled={isSuspended || !!applying}>
                            {applying === 'auto' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                            Normal fiyatlara dön
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => applyPlanNow(plan)} disabled={isSuspended || !!applying}>
                            {applying === plan.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
                            Şimdi uygula
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setEditing(draftFromPlan(plan))} disabled={isSuspended}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Düzenle
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(plan)} disabled={isSuspended}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Sil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      ) : null}

      {editing && (
        <PlanEditor
          draft={editing}
          subdomain={subdomain}
          currency={currency}
          org={org}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Fiyat planı silinsin mi?"
        description={`"${deleteTarget?.name}" planı ve ürüne özel fiyatları silinecek. Elle seçiliyse fiyatlar otomatik moda döner.`}
        confirmLabel="Sil"
        destructive
        onConfirm={handleDelete}
      />
    </SitePageShell>
  )
}

function CurrentStatus({ state, planName }: { state: PlansResponse; planName: (id: string | null | undefined) => string | undefined }) {
  const name = planName(state.effective.planId) || 'Normal fiyatlar'
  const source =
    state.effective.source === 'manual'
      ? `Elle seçildi${state.effective.until ? ` · ${fmtDateTime(state.effective.until)} tarihine kadar` : ''}`
      : state.effective.source === 'schedule'
        ? 'Takvime göre otomatik'
        : 'Açık bir takvim penceresi yok'
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Zap className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Müşteriler şu an görüyor</p>
          <p className="text-lg font-extrabold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{source}</p>
        </div>
      </div>
      {state.next && state.mode.mode === 'auto' && (
        <p className="text-xs text-muted-foreground sm:text-right">
          Sıradaki: <strong className="text-foreground">{planName(state.next.planId)}</strong>
          <br />
          {fmtDateTime(state.next.startsAt)}
        </p>
      )}
    </div>
  )
}

function ModeCard({
  subdomain,
  state,
  disabled,
  onSaved,
}: {
  subdomain: string
  state: PlansResponse
  disabled?: boolean
  onSaved: (mode: PriceModeState) => void
}) {
  const [mode, setMode] = useState<'auto' | 'manual'>(state.mode.mode)
  const [planId, setPlanId] = useState<string>(state.mode.activePlanId || '')
  const [duration, setDuration] = useState<'forever' | 'tonight' | 'custom'>(state.mode.manualUntil ? 'custom' : 'forever')
  const [customUntil, setCustomUntil] = useState(isoToLocalInput(state.mode.manualUntil))
  const [saving, setSaving] = useState(false)

  // "Uygula"ya basılmamış seçim varken sayfadan ayrılma uyarısı
  const savedDuration: 'forever' | 'tonight' | 'custom' = state.mode.manualUntil ? 'custom' : 'forever'
  const dirty =
    mode !== state.mode.mode ||
    (mode === 'manual' &&
      (planId !== (state.mode.activePlanId || '') ||
        duration !== savedDuration ||
        (duration === 'custom' && customUntil !== isoToLocalInput(state.mode.manualUntil))))
  const guard = useUnsavedChanges(dirty && !disabled)

  useEffect(() => {
    setMode(state.mode.mode)
    setPlanId(state.mode.activePlanId || '')
    setDuration(state.mode.manualUntil ? 'custom' : 'forever')
    setCustomUntil(isoToLocalInput(state.mode.manualUntil))
  }, [state.mode])

  const save = async (): Promise<boolean> => {
    const until = mode === 'manual' ? (duration === 'tonight' ? tonightAt4() : duration === 'custom' ? localInputToIso(customUntil) : null) : null
    if (mode === 'manual' && duration === 'custom' && !until) {
      toast.error('Bitiş tarihini seçin.')
      return false
    }
    setSaving(true)
    try {
      const data = await siteApi<{ mode: PriceModeState }>('/api/site/price-mode', {
        method: 'POST',
        json: { subdomain, mode, planId: mode === 'manual' ? planId || null : null, until },
      })
      toast.success(mode === 'auto' ? 'Fiyatlar takvime göre otomatik değişecek.' : 'Fiyat planı uygulandı.')
      onSaved(data.mode)
      return true
    } catch (e: any) {
      toast.error(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Fiyat modu</CardTitle>
        <CardDescription>Otomatikte takvimdeki plan devreye girer; elle seçtiğiniz plan (ya da normal fiyatlar) takvimin önüne geçer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            { id: 'auto', icon: CalendarClock, title: 'Otomatik (takvime göre)', hint: 'Açık pencere yoksa normal fiyatlar' },
            { id: 'manual', icon: Hand, title: 'Elle seç', hint: 'Seçtiğiniz fiyatlar hemen geçerli olur' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                mode === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
              )}
            >
              <opt.icon className="mt-0.5 h-5 w-5 text-primary" />
              <span>
                <span className="block text-sm font-bold text-foreground">{opt.title}</span>
                <span className="block text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === 'manual' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Geçerli fiyatlar">
              <NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Normal fiyatlar (menüdeki)</option>
                {state.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ne zamana kadar?">
              <NativeSelect value={duration} onChange={(e) => setDuration(e.target.value as typeof duration)}>
                <option value="forever">Ben değiştirene kadar</option>
                <option value="tonight">Bu gece 04:00&apos;a kadar</option>
                <option value="custom">Belirli bir tarihe kadar</option>
              </NativeSelect>
            </Field>
            {duration === 'custom' && (
              <Field label="Bitiş">
                <Input type="datetime-local" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        <Button onClick={save} disabled={disabled || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Uygula
        </Button>

        <UnsavedChangesDialog
          open={guard.open}
          saving={saving}
          onStay={guard.stay}
          onDiscard={() => {
            setMode(state.mode.mode)
            setPlanId(state.mode.activePlanId || '')
            setDuration(savedDuration)
            setCustomUntil(isoToLocalInput(state.mode.manualUntil))
            guard.leave()
          }}
          onSave={async () => {
            if (await save()) guard.leave()
          }}
          discardLabel="Uygulamadan çık"
          saveLabel="Uygula ve çık"
        />
      </CardContent>
    </Card>
  )
}

function PlanEditor({
  draft: initial,
  subdomain,
  currency,
  org,
  onClose,
  onSaved,
}: {
  draft: Draft
  subdomain: string
  currency: string
  org: ReturnType<typeof useOrgMenus>
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const [overrideText, setOverrideText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initial.overrides || {})
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v).replace('.', ',')])
    )
  )
  const [filter, setFilter] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [closePrompt, setClosePrompt] = useState(false)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial])
  useBeforeUnload(dirty)
  // Kaydedilmemiş değişiklik varken kapatma (X, Esc, dışarı tıklama, Vazgeç) önce sorar
  const requestClose = () => (dirty ? setClosePrompt(true) : onClose())

  const amount = parsePrice(draft.amount)?.amount ?? NaN
  const signedValue = Number.isFinite(amount) ? (draft.direction === 'down' ? -amount : amount) : 0
  const previewPlan: PricePlan = { ...draft, id: draft.id || 'draft', displayOrder: 0, adjustmentValue: signedValue }

  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; parent: string | null }>()
    for (const row of org.customerItems) {
      if (!seen.has(row.categoryId)) seen.set(row.categoryId, { id: row.categoryId, name: row.categoryName, parent: row.parentCategoryId })
    }
    return [...seen.values()]
  }, [org.customerItems])

  const rows = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr')
    return org.customerItems.filter((r) => !q || r.item.name.toLocaleLowerCase('tr').includes(q) || r.categoryName.toLocaleLowerCase('tr').includes(q))
  }, [org.customerItems, filter])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const setOverride = (itemId: string, value: number | null | undefined) =>
    setDraft((d) => {
      const overrides = { ...d.overrides }
      if (value === undefined) delete overrides[itemId]
      else overrides[itemId] = value
      return { ...d, overrides }
    })

  const toggleExcluded = (id: string) =>
    update({
      excludedCategoryIds: draft.excludedCategoryIds.includes(id)
        ? draft.excludedCategoryIds.filter((c) => c !== id)
        : [...draft.excludedCategoryIds, id],
    })

  const updateWindow = (index: number, patch: Partial<ScheduleWindow>) =>
    update({ schedule: draft.schedule.map((w, i) => (i === index ? { ...w, ...patch } : w)) })

  const save = async () => {
    if (!draft.name.trim()) return toast.error('Plan adı gerekli.')
    if (!Number.isFinite(amount) || amount < 0) return toast.error('Geçerli bir değişim miktarı girin.')
    if (draft.scheduleEnabled && !draft.schedule.length) return toast.error('Takvim için en az bir pencere ekleyin.')
    for (const w of draft.schedule) {
      if (!w.days.length) return toast.error('Her takvim penceresinde en az bir gün seçin.')
      if (w.start === w.end) return toast.error('Takvim penceresinin başlangıç ve bitiş saati aynı olamaz.')
    }
    const overrides = Object.entries(draft.overrides).map(([itemId, price]) => ({ itemId, price }))
    const payload = {
      subdomain,
      name: draft.name,
      bannerText: draft.bannerText || null,
      adjustmentType: draft.adjustmentType,
      adjustmentValue: signedValue,
      rounding: draft.rounding,
      excludedCategoryIds: draft.excludedCategoryIds,
      schedule: draft.schedule,
      scheduleEnabled: draft.scheduleEnabled,
      overrides,
    }
    setSaving(true)
    try {
      await siteApi(draft.id ? `/api/site/price-plans/${draft.id}` : '/api/site/price-plans', {
        method: draft.id ? 'PATCH' : 'POST',
        json: payload,
      })
      toast.success('Fiyat planı kaydedildi.')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle>{draft.id ? 'Fiyat planını düzenle' : 'Yeni fiyat planı'}</DialogTitle>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-expanded={showHelp}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <CircleHelp className="h-3.5 w-3.5" /> {showHelp ? 'Yardımı gizle' : 'Nasıl kullanılır?'}
            </button>
          </div>
          <DialogDescription>Mevcut menü fiyatlarından türetilir; menüde fiyat değiştirdiğinizde plan da otomatik güncellenir.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {showHelp && <PlanEditorHelp currency={currency} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Plan adı">
              <Input value={draft.name} maxLength={60} placeholder="Etkinlik Fiyatları" onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Müşteriye duyuru (isteğe bağlı)" hint="Plan geçerliyken menünün üstünde görünür.">
              <Input
                value={draft.bannerText || ''}
                maxLength={140}
                placeholder="Bu akşam canlı müzik: etkinlik fiyatları geçerlidir"
                onChange={(e) => update({ bannerText: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Yön">
              <NativeSelect value={draft.direction} onChange={(e) => update({ direction: e.target.value as 'up' | 'down' })}>
                <option value="up">Artış (bindirim)</option>
                <option value="down">İndirim</option>
              </NativeSelect>
            </Field>
            <Field label="Tür">
              <NativeSelect value={draft.adjustmentType} onChange={(e) => update({ adjustmentType: e.target.value as 'percent' | 'fixed' })}>
                <option value="percent">Yüzde (%)</option>
                <option value="fixed">Sabit tutar ({currency})</option>
              </NativeSelect>
            </Field>
            <Field label={draft.adjustmentType === 'percent' ? 'Oran (%)' : `Tutar (${currency})`}>
              <Input inputMode="decimal" value={draft.amount} onChange={(e) => update({ amount: e.target.value })} />
            </Field>
            <Field label="Yuvarlama">
              <NativeSelect value={draft.rounding} onChange={(e) => update({ rounding: e.target.value as Rounding })}>
                <option value="none">Yok (kuruşlu)</option>
                <option value="1">Tam sayı</option>
                <option value="5">5&apos;in katı</option>
                <option value="10">10&apos;un katı</option>
              </NativeSelect>
            </Field>
          </div>

          {categories.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Hariç tutulan kategoriler</p>
              <p className="text-xs text-muted-foreground">Seçilen kategorilerin fiyatları bu planda değişmez.</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = draft.excludedCategoryIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleExcluded(c.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                        on ? 'border-destructive bg-destructive/10 text-destructive line-through' : 'border-border hover:bg-accent'
                      )}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Haftalık takvim</p>
                <p className="text-xs text-muted-foreground">
                  Fiyat modu &quot;Otomatik&quot;teyken bu saatlerde plan kendiliğinden geçerli olur (İstanbul saati). Bitiş başlangıçtan
                  önceyse ertesi güne taşar.
                </p>
              </div>
              <Switch checked={draft.scheduleEnabled} onChange={(v) => update({ scheduleEnabled: v })} label="Takvim" />
            </div>
            {draft.scheduleEnabled && (
              <div className="space-y-2">
                {draft.schedule.map((w, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
                    <div className="flex gap-1">
                      {ISO_DAY_LABELS.map((label, idx) => {
                        const day = idx + 1
                        const on = w.days.includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => updateWindow(i, { days: on ? w.days.filter((d) => d !== day) : [...w.days, day] })}
                            className={cn(
                              'h-8 w-10 rounded-md text-xs font-bold',
                              on ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground border border-border'
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <Input type="time" className="w-28" value={w.start} onChange={(e) => updateWindow(i, { start: e.target.value })} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" className="w-28" value={w.end} onChange={(e) => updateWindow(i, { end: e.target.value })} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => update({ schedule: draft.schedule.filter((_, idx) => idx !== i) })}
                      aria-label="Pencereyi sil"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => update({ schedule: [...draft.schedule, { days: [5], start: '20:00', end: '02:00' }] })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Pencere ekle
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Fiyat önizlemesi ve ürüne özel fiyat</p>
                <p className="text-xs text-muted-foreground">
                  Müşterinin gördüğü menü. &quot;Özel fiyat&quot; yazarsanız kural yerine o fiyat kullanılır; &quot;Uygulama&quot; ile ürün bu
                  plandan etkilenmez.
                </p>
              </div>
              <Input className="w-56" placeholder="Ürün ara…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            {org.loading ? (
              <div className="h-32 animate-pulse rounded-xl bg-muted" />
            ) : org.customerItems.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Menünüzde henüz ürün yok.</p>
            ) : (
              <div className="max-h-[360px] overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Ürün</th>
                      <th className="px-3 py-2 text-right">Mevcut</th>
                      <th className="px-3 py-2 text-right">Yeni</th>
                      <th className="px-3 py-2 text-left">Özel fiyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ item, categoryId, categoryName, parentCategoryId }) => {
                      const result = applyPlanToPrice(item.price, { itemId: item.id, categoryId, parentCategoryId }, previewPlan, currency)
                      const isSkipped = Object.prototype.hasOwnProperty.call(draft.overrides, item.id) && draft.overrides[item.id] == null
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{categoryName}</p>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{item.price}</td>
                          <td className={cn('px-3 py-2 text-right font-semibold', result.changed && 'text-primary')}>
                            {result.unparsable ? <span className="text-xs text-amber-600">okunamadı, değişmez</span> : result.price}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-8 w-24"
                                inputMode="decimal"
                                disabled={isSkipped}
                                placeholder="—"
                                value={overrideText[item.id] || ''}
                                onChange={(e) => {
                                  const text = e.target.value
                                  setOverrideText((t) => ({ ...t, [item.id]: text }))
                                  const parsed = parsePrice(text)
                                  setOverride(item.id, text.trim() && parsed ? parsed.amount : undefined)
                                }}
                              />
                              <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={isSkipped}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setOverrideText((t) => ({ ...t, [item.id]: '' }))
                                      setOverride(item.id, null)
                                    } else setOverride(item.id, undefined)
                                  }}
                                />
                                Uygulama
                              </label>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {Number.isFinite(amount) && (
              <p className="text-xs text-muted-foreground">
                Örnek: 100 {currency} →{' '}
                {formatPrice(
                  parsePrice(applyPlanToPrice('100', { itemId: '__ornek__' }, previewPlan, currency).price)?.amount ?? 100,
                  currency
                )}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={requestClose} disabled={saving}>
              Vazgeç
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kaydet
            </Button>
          </div>
        </div>

        <UnsavedChangesDialog
          open={closePrompt}
          saving={saving}
          onStay={() => setClosePrompt(false)}
          onDiscard={() => {
            setClosePrompt(false)
            onClose()
          }}
          onSave={async () => {
            setClosePrompt(false)
            await save()
          }}
          discardLabel="Kaydetmeden kapat"
          saveLabel="Kaydet ve kapat"
        />
      </DialogContent>
    </Dialog>
  )
}

/** "Nasıl kullanılır?" paneli: plan editöründeki her seçeneğin ne işe yaradığı */
function PlanEditorHelp({ currency }: { currency: string }) {
  const items: { title: string; text: string }[] = [
    {
      title: 'Fiyat planı nedir?',
      text: 'Menünüzdeki fiyatlardan türetilen ikinci bir fiyat listesidir (etkinlik gecesi, happy hour, hafta sonu…). QR kodunuz değişmez; plan devredeyken müşteri yeni fiyatları görür, indirimlerde eski fiyat üstü çizili kalır. Menüde bir ürünün fiyatını değiştirirseniz plan da kendiliğinden güncellenir.',
    },
    {
      title: 'Plan adı ve müşteriye duyuru',
      text: 'Ad yalnızca panelde görünür. Duyuru yazarsanız plan geçerliyken menünün üstünde bir şerit olarak gösterilir (ör. "Bu akşam canlı müzik: etkinlik fiyatları geçerlidir").',
    },
    {
      title: 'Yön, tür ve miktar',
      text: `Yön: "Artış" fiyatları yükseltir, "İndirim" düşürür. Tür: "Yüzde" seçilirse her ürün kendi fiyatının o yüzdesi kadar değişir; "Sabit tutar" seçilirse her ürüne aynı tutar (${currency}) eklenir ya da çıkarılır.`,
    },
    {
      title: 'Yuvarlama',
      text: 'Hesaplanan fiyat tam sayıya, 5\'in ya da 10\'un katına yuvarlanır (ör. 93,50 → 95). "Yok" seçilirse kuruşlu sonuç olduğu gibi kalır.',
    },
    {
      title: 'Hariç tutulan kategoriler',
      text: 'İşaretlediğiniz kategorilerin ürünleri bu plandan etkilenmez; fiyatı sabit kalması gereken ürünler (su, sigara vb.) için kullanışlıdır.',
    },
    {
      title: 'Haftalık takvim',
      text: 'Açarsanız, Fiyat modu "Otomatik"teyken plan seçtiğiniz gün ve saatlerde kendiliğinden devreye girer; pencere bitince normal fiyatlara dönülür. Bitiş başlangıçtan önceyse pencere ertesi güne taşar (20:00–02:00). Takvim kapalıysa planı Fiyat modu kartından "Elle seç" ile uygularsınız.',
    },
    {
      title: 'Fiyat önizlemesi ve ürüne özel fiyat',
      text: `Tablo her ürünün mevcut ve yeni fiyatını gösterir. "Özel fiyat" kutusuna yazdığınız tutar o ürün için kuralın yerine geçer; "Uygulama" işaretli ürün bu planda hiç değişmez. Alttaki örnek satırı kuralın 100 ${currency} için sonucunu gösterir.`,
    },
  ]
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-bold text-foreground">
        <CircleHelp className="h-4 w-4" /> Nasıl kullanılır?
      </p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.title}>
            <dt className="font-semibold text-foreground">{it.title}</dt>
            <dd className="text-xs leading-relaxed text-muted-foreground">{it.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

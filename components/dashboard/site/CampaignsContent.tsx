'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock, Gift, Loader2, Minus, Package, Pencil, Plus, RefreshCw, Search, Tag, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog, Field, NativeSelect, Switch } from '@/components/admin/shared/ui'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { catalogThumbUrl } from '@/lib/image-url'
import { formatPrice, parsePrice } from '@/lib/price'
import {
  campaignNormalTotal,
  campaignSavingsPercent,
  campaignStatus,
  describeCampaignSchedule,
  isCampaignInSchedule,
  isCampaignInWindow,
  isCampaignLive,
  suggestCampaignName,
  type Campaign,
  type CampaignKind,
} from '@/lib/campaigns'
import { fromIstanbulInput, istanbulDateKey, toIstanbulInput } from '@/lib/events'
import { ISO_DAY_LABELS, type ScheduleWindow } from '@/lib/price-plan'
import { cn } from '@/lib/utils'
import { MigrationNotice, SiteApiError, SitePageShell, siteApi, useOrgMenus, type FlatMenuItem } from './shared'
import { addDays, dateOptions, dayFromIso, timeOptions } from './date-options'
import { UnsavedChangesDialog, useBeforeUnload } from '@/components/dashboard/unsaved-changes'

interface DraftComponent {
  itemId: string
  name: string
  /** Menüdeki normal fiyat */
  price: string
  imageUrl: string
  quantity: number
  /** İndirimli ürünler: bu ürünün kampanya fiyatı */
  dealPrice: string
}

interface Draft {
  id?: string
  kind: CampaignKind
  name: string
  nameTouched: boolean
  description: string
  /** Paket fiyatı */
  price: string
  isActive: boolean
  /** Haftalık takvim (İstanbul saati); her gün + 00:00–00:00 = takvim yok */
  days: number[]
  startTime: string
  endTime: string
  /** Tarih aralığı (İstanbul takvim günü, bitiş dahil); boş = hemen / süresiz */
  fromDate: string
  untilDate: string
  imageUrl: string | null
  displayOrder?: number
  items: DraftComponent[]
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]
const DAY_PRESETS = [
  { label: 'Her gün', days: ALL_DAYS },
  { label: 'Hafta içi', days: [1, 2, 3, 4, 5] },
  { label: 'Hafta sonu', days: [6, 7] },
]
const MAX_ITEMS: Record<CampaignKind, number> = { bundle: 10, per_item: 30 }

const KIND_OPTIONS: { kind: CampaignKind; title: string; description: string; icon: typeof Package }[] = [
  { kind: 'bundle', title: 'Paket', description: 'Seçilen ürünler birlikte tek fiyata. Ör. Bira + Patates 170 ₺', icon: Package },
  { kind: 'per_item', title: 'İndirimli ürünler', description: 'Her ürün ayrı ayrı kendi indirimli fiyatına. Ör. Tuborg ve Efes 165 ₺', icon: Tag },
]

const toPriceInput = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))
const sameDays = (a: number[], b: number[]) => [...a].sort().join() === [...b].sort().join()

/** Tarih aralığı İstanbul takvim günleriyle; bitiş günü dahil (ertesi gün 00:00'a kadar) */
const validFromIso = (date: string) => (date ? fromIstanbulInput(date, '00:00') : null)
const validUntilIso = (date: string) => (date ? fromIstanbulInput(addDays(date, 1), '00:00') : null)
const dateOfValidFrom = (iso: string | null) => (iso ? toIstanbulInput(iso).date : '')
const dateOfValidUntil = (iso: string | null) => (iso ? istanbulDateKey(new Date(Date.parse(iso) - 1)) : '')

function scheduleFromDraft(d: Pick<Draft, 'days' | 'startTime' | 'endTime'>): ScheduleWindow[] {
  if (d.days.length === 7 && d.startTime === '00:00' && d.endTime === '00:00') return []
  return [{ days: [...d.days].sort(), start: d.startTime, end: d.endTime }]
}

const emptyDraft = (): Draft => ({
  kind: 'bundle',
  name: '',
  nameTouched: false,
  description: '',
  price: '',
  isActive: true,
  days: ALL_DAYS,
  startTime: '00:00',
  endTime: '00:00',
  fromDate: '',
  untilDate: '',
  imageUrl: null,
  items: [],
})

function draftFromCampaign(c: Campaign): Draft {
  const win = c.schedule[0]
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    nameTouched: true,
    description: c.description,
    price: c.kind === 'bundle' ? toPriceInput(c.price) : '',
    isActive: c.isActive,
    days: win?.days.length ? [...win.days].sort() : ALL_DAYS,
    startTime: win?.start ?? '00:00',
    endTime: win?.end ?? '00:00',
    fromDate: dateOfValidFrom(c.validFrom),
    untilDate: dateOfValidUntil(c.validUntil),
    imageUrl: c.imageUrl,
    displayOrder: c.displayOrder,
    items: c.items
      .filter((comp) => comp.itemId && comp.item)
      .map((comp) => ({
        itemId: comp.itemId!,
        name: comp.item!.name,
        price: comp.item!.price,
        imageUrl: comp.item!.image_url || '',
        quantity: comp.quantity,
        dealPrice: toPriceInput(comp.price),
      })),
  }
}

/** Kaydedilmiş kampanyadan API gövdesi (hızlı aç/kapat için) */
function payloadFromCampaign(subdomain: string, c: Campaign, patch: Partial<{ isActive: boolean }> = {}) {
  return {
    subdomain,
    kind: c.kind,
    name: c.name,
    description: c.description,
    price: c.kind === 'bundle' ? c.price : null,
    imageUrl: c.imageUrl,
    isActive: patch.isActive ?? c.isActive,
    displayOrder: c.displayOrder,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    schedule: c.schedule,
    items: c.items
      .filter((comp) => comp.itemId)
      .map((comp) => ({ itemId: comp.itemId!, quantity: comp.quantity, price: comp.price ?? null })),
  }
}

const STATUS_TEXT: Record<CampaignKind, Record<'missing_item' | 'unavailable_item' | 'empty', string>> = {
  bundle: {
    missing_item: 'Bir ürünü menüden silinmiş — müşteriye gösterilmiyor',
    unavailable_item: 'Bir ürünü tükendi olarak işaretli — müşteriye gösterilmiyor',
    empty: 'Ürün yok — müşteriye gösterilmiyor',
  },
  per_item: {
    missing_item: 'Bir ürünü menüden silinmiş — o ürün gösterilmiyor',
    unavailable_item: 'Bir ürünü tükendi olarak işaretli — o ürün gösterilmiyor',
    empty: 'Ürün yok — müşteriye gösterilmiyor',
  },
}

const SHORT_DAY_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Kartta tarih aralığı: "20 Eki 2026 – 30 Kas 2026", "Bitiş: 30 Kas 2026"; sınırsızsa null */
function describeDateRange(c: Pick<Campaign, 'validFrom' | 'validUntil'>): string | null {
  const from = dateOfValidFrom(c.validFrom)
  const until = dateOfValidUntil(c.validUntil)
  const fmt = (iso: string) => SHORT_DAY_FMT.format(dayFromIso(iso))
  if (from && until) return `${fmt(from)} – ${fmt(until)}`
  if (until) return `Bitiş: ${fmt(until)}`
  if (from) return `Başlangıç: ${fmt(from)}`
  return null
}

export function CampaignsContent() {
  const { restaurant, isSuspended } = useRestaurant()
  const subdomain = restaurant?.subdomain || ''
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [currency, setCurrency] = useState(restaurant?.currency || '₺')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const org = useOrgMenus(subdomain)

  const load = useCallback(async () => {
    if (!subdomain) return
    setLoading(true)
    setError(null)
    try {
      const data = await siteApi<{ campaigns: Campaign[]; currency: string }>(`/api/site/campaigns?subdomain=${encodeURIComponent(subdomain)}`)
      setCampaigns(data.campaigns || [])
      setCurrency(data.currency || '₺')
    } catch (e: any) {
      if (e instanceof SiteApiError && e.code === 'MIGRATION_REQUIRED') setMigrationMissing(true)
      else setError(e?.message || 'Kampanyalar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (c: Campaign, isActive: boolean) => {
    if (campaignStatus(c) === 'missing_item') {
      toast.error('Silinmiş ürünü kampanyadan çıkarmak için önce düzenleyin.')
      return
    }
    setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, isActive } : x)))
    try {
      await siteApi(`/api/site/campaigns/${c.id}`, { method: 'PATCH', json: payloadFromCampaign(subdomain, c, { isActive }) })
    } catch (e: any) {
      toast.error(e.message)
      load()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await siteApi(`/api/site/campaigns/${deleteTarget.id}?subdomain=${encodeURIComponent(subdomain)}`, { method: 'DELETE' })
      toast.success('Kampanya silindi.')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <SitePageShell
      tourPage="campaigns"
      tourReady={!loading}
      title="Kampanyalar"
      description="Menünüzdeki ürünlerden paketler (ör. Bira + Patates) ya da belli gün ve saatlerde indirimli ürünler (ör. 19:00'a kadar Efes 165 ₺) oluşturun. Menüde en üstte “Kampanyalı Ürünler” olarak görünür."
      subdomain={subdomain}
      page=""
      actions={
        !migrationMissing && (
          <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended || loading}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Kampanya
          </Button>
        )
      }
    >
      {migrationMissing ? (
        <MigrationNotice file="18_campaign_kinds_and_schedule.sql" />
      ) : error ? (
        <div className="glass-card border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tekrar dene
          </Button>
        </div>
      ) : loading && campaigns.length === 0 ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      ) : campaigns.length === 0 ? (
        <div className="glass-card border-dashed p-10 text-center">
          <Gift className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-lg font-semibold text-foreground">Henüz kampanya yok</h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            Ürünleri birleştirip tek fiyata paket yapın ya da seçtiğiniz ürünleri belli gün ve saatlerde indirime sokun.
          </p>
          <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended}>
            <Plus className="mr-2 h-4 w-4" /> İlk Kampanyayı Oluştur
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const status = campaignStatus(c)
            const perItem = c.kind === 'per_item'
            const normal = campaignNormalTotal(c.items, (comp) => comp.item?.price)
            const savings = campaignSavingsPercent(c.price, normal)
            const image = c.imageUrl || c.items.map((comp) => comp.item?.image_url).find(Boolean)
            const expired = !isCampaignInWindow(c)
            const live = isCampaignLive(c)
            const offHours = c.isActive && !expired && !isCampaignInSchedule(c)
            const when = [describeCampaignSchedule(c.schedule), describeDateRange(c)].filter(Boolean).join(' · ')
            const dealPrices = [...new Set(c.items.map((comp) => comp.price).filter((p): p is number => p != null))]
            // İndirimli ürünler: normal fiyatından düşük olmayan ürün müşteriye kampanyalı gösterilmez
            const notCheaper = perItem && c.items.some((comp) => {
              const base = parsePrice(comp.item?.price || '')?.amount
              return comp.price != null && base != null && comp.price >= base
            })
            return (
              <div key={c.id} className={cn('glass-card flex gap-4 p-4', !c.isActive && 'opacity-70')}>
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {image ? (
                    <img src={catalogThumbUrl(image)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Gift className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-bold text-foreground">{c.name}</h3>
                    <Switch checked={c.isActive} onChange={(v) => toggleActive(c, v)} disabled={isSuspended} label="Aktif" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{perItem ? 'İndirimli ürünler' : 'Paket'}</span>
                    {live ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600">Şu an menüde</span>
                    ) : offHours ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Şu an saat dışında</span>
                    ) : null}
                  </div>
                  {perItem ? (
                    <>
                      <ul className="space-y-0.5 text-xs">
                        {c.items.slice(0, 3).map((comp, i) => (
                          <li key={comp.itemId || i} className="flex items-baseline gap-1.5">
                            <span className="min-w-0 truncate text-muted-foreground">{comp.item?.name || comp.name}</span>
                            {comp.price != null && <span className="shrink-0 font-bold text-foreground">{formatPrice(comp.price, currency)}</span>}
                            {comp.item?.price && <span className="shrink-0 text-muted-foreground">(normal {comp.item.price})</span>}
                          </li>
                        ))}
                      </ul>
                      {c.items.length > 3 && <p className="text-xs text-muted-foreground">+{c.items.length - 3} ürün daha</p>}
                      {dealPrices.length === 1 && c.items.length > 1 && (
                        <p className="text-sm font-extrabold text-foreground">Her biri {formatPrice(dealPrices[0], currency)}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.items.map((comp) => `${comp.quantity}× ${comp.item?.name || comp.name}`).join(' + ')}
                      </p>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-lg font-extrabold text-foreground">{formatPrice(c.price, currency)}</span>
                        {normal != null && normal > c.price && (
                          <span className="text-xs text-muted-foreground line-through">{formatPrice(normal, currency)}</span>
                        )}
                        {savings != null && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">%{savings} avantaj</span>
                        )}
                      </div>
                    </>
                  )}
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" /> {when || 'Her zaman geçerli'}
                  </p>
                  {status !== 'ok' && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> {STATUS_TEXT[c.kind][status]}
                    </p>
                  )}
                  {notCheaper && (
                    <p className="text-xs font-semibold text-amber-600">Bazı ürünlerde kampanya fiyatı normal fiyattan düşük değil — o ürünler gösterilmiyor</p>
                  )}
                  {expired && <p className="text-xs font-semibold text-amber-600">Geçerlilik tarihleri dışında — müşteriye gösterilmiyor</p>}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(draftFromCampaign(c))} disabled={isSuspended}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Düzenle
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(c)} disabled={isSuspended}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Sil
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <CampaignEditor
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
        title="Kampanya silinsin mi?"
        description={`"${deleteTarget?.name}" menüden kaldırılacak. Ürünleriniz etkilenmez.`}
        confirmLabel="Sil"
        destructive
        onConfirm={handleDelete}
      />
    </SitePageShell>
  )
}

function CampaignEditor({
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
  const [query, setQuery] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const multipleMenus = org.menus.length > 1
  const perItem = draft.kind === 'per_item'
  const [closePrompt, setClosePrompt] = useState(false)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial])
  useBeforeUnload(dirty)
  // Kaydedilmemiş değişiklik varken kapatma (X, Esc, dışarı tıklama, Vazgeç) önce sorar
  const requestClose = () => (dirty ? setClosePrompt(true) : onClose())

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch }
      // Ad elle değiştirilmediyse ürünlerden önerilir: "Bira + Patates" / "Tuborg, Efes"
      if ((patch.items || patch.kind) && !next.nameTouched) next.name = suggestCampaignName(next.items, next.kind)
      return next
    })

  const grouped = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    const groups = new Map<string, { label: string; rows: FlatMenuItem[] }>()
    for (const row of org.allItems) {
      if (q && !row.item.name.toLocaleLowerCase('tr').includes(q) && !row.categoryName.toLocaleLowerCase('tr').includes(q)) continue
      const key = `${row.menuId}:${row.categoryId}`
      const label = multipleMenus ? `${row.menuName} · ${row.categoryName}` : row.categoryName
      if (!groups.has(key)) groups.set(key, { label, rows: [] })
      groups.get(key)!.rows.push(row)
    }
    return [...groups.values()]
  }, [org.allItems, query, multipleMenus])

  const toComponent = (row: FlatMenuItem, dealPrice: string): DraftComponent => ({
    itemId: row.item.id,
    name: row.item.name,
    price: row.item.price,
    imageUrl: row.item.image_url || '',
    quantity: 1,
    dealPrice,
  })

  const addItem = (row: FlatMenuItem) => {
    if (row.item.id.startsWith('item-')) {
      toast.error('Bu ürün henüz kaydedilmemiş. Önce menü editöründe kaydedin.')
      return
    }
    const existing = draft.items.find((c) => c.itemId === row.item.id)
    if (existing) {
      // Pakette aynı ürün adet artırır; indirimli ürünlerde ikinci tık ürünü çıkarır
      if (perItem) update({ items: draft.items.filter((c) => c.itemId !== row.item.id) })
      else update({ items: draft.items.map((c) => (c.itemId === row.item.id ? { ...c, quantity: Math.min(20, c.quantity + 1) } : c)) })
      return
    }
    if (draft.items.length >= MAX_ITEMS[draft.kind]) return toast.error(`Bir kampanyada en fazla ${MAX_ITEMS[draft.kind]} ürün olabilir.`)
    // Yeni ürün son girilen kampanya fiyatıyla başlar (ör. tüm biralar 165 ₺)
    update({ items: [...draft.items, toComponent(row, draft.items[draft.items.length - 1]?.dealPrice || '')] })
  }

  /** İndirimli ürünler: kategorideki kaydedilmiş tüm ürünleri ekler */
  const addGroup = (rows: FlatMenuItem[]) => {
    const fresh = rows.filter((r) => !r.item.id.startsWith('item-') && !draft.items.some((c) => c.itemId === r.item.id))
    const room = MAX_ITEMS.per_item - draft.items.length
    if (!fresh.length) return
    if (fresh.length > room) toast.error(`Bir kampanyada en fazla ${MAX_ITEMS.per_item} ürün olabilir; ilk ${room} ürün eklendi.`)
    const dealPrice = draft.items[draft.items.length - 1]?.dealPrice || ''
    update({ items: [...draft.items, ...fresh.slice(0, room).map((r) => toComponent(r, dealPrice))] })
  }

  const setQuantity = (itemId: string, quantity: number) =>
    update({
      items: quantity <= 0 ? draft.items.filter((c) => c.itemId !== itemId) : draft.items.map((c) => (c.itemId === itemId ? { ...c, quantity: Math.min(20, quantity) } : c)),
    })

  const setDealPrice = (itemId: string, dealPrice: string) =>
    setDraft((d) => ({ ...d, items: d.items.map((c) => (c.itemId === itemId ? { ...c, dealPrice } : c)) }))

  const applyBulkPrice = () => {
    if (!parsePrice(bulkPrice)) return toast.error('Geçerli bir fiyat girin.')
    setDraft((d) => ({ ...d, items: d.items.map((c) => ({ ...c, dealPrice: bulkPrice })) }))
  }

  const normal = campaignNormalTotal(
    draft.items.map((c) => ({ itemId: c.itemId, name: c.name, quantity: c.quantity })),
    (comp) => draft.items.find((c) => c.itemId === comp.itemId)?.price
  )
  const price = parsePrice(draft.price)?.amount
  const savings = price != null ? campaignSavingsPercent(price, normal) : null
  const imageChoices = draft.items.map((c) => c.imageUrl).filter((url) => url && !url.startsWith('data:'))

  const allDay = draft.startTime === '00:00' && draft.endTime === '00:00'
  const crossesMidnight = draft.endTime !== '00:00' && draft.endTime < draft.startTime
  const scheduleHint = allDay
    ? 'Gün boyunca geçerli'
    : crossesMidnight
      ? `Ertesi gün ${draft.endTime}'de biter`
      : 'İstanbul saatine göre'

  const save = async () => {
    if (!draft.items.length) return toast.error('En az bir ürün seçin.')
    if (draft.items.length > MAX_ITEMS[draft.kind]) return toast.error(`Bir pakette en fazla ${MAX_ITEMS[draft.kind]} ürün olabilir.`)
    if (draft.name.trim().length < 2) return toast.error('Kampanya adı en az 2 karakter olmalı.')
    if (!perItem && price == null) return toast.error('Geçerli bir kampanya fiyatı girin.')
    const dealPrices = draft.items.map((c) => parsePrice(c.dealPrice)?.amount)
    if (perItem && dealPrices.some((p) => p == null)) return toast.error('Her ürün için kampanya fiyatı girin.')
    if (!draft.days.length) return toast.error('En az bir gün seçin.')
    if (draft.startTime === draft.endTime && !allDay) return toast.error('Başlangıç ve bitiş saati aynı olamaz.')
    if (draft.fromDate && draft.untilDate && draft.untilDate < draft.fromDate) return toast.error('Bitiş tarihi başlangıçtan önce olamaz.')
    setSaving(true)
    try {
      await siteApi(draft.id ? `/api/site/campaigns/${draft.id}` : '/api/site/campaigns', {
        method: draft.id ? 'PATCH' : 'POST',
        json: {
          subdomain,
          kind: draft.kind,
          name: draft.name,
          description: draft.description,
          price: perItem ? null : price,
          imageUrl: draft.imageUrl && !draft.imageUrl.startsWith('data:') ? draft.imageUrl : null,
          isActive: draft.isActive,
          displayOrder: draft.displayOrder,
          validFrom: validFromIso(draft.fromDate),
          validUntil: validUntilIso(draft.untilDate),
          schedule: scheduleFromDraft(draft),
          items: draft.items.map((c, i) => ({
            itemId: c.itemId,
            quantity: perItem ? 1 : c.quantity,
            price: perItem ? dealPrices[i] : null,
          })),
        },
      })
      toast.success('Kampanya kaydedildi.')
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
          <DialogTitle>{draft.id ? 'Kampanyayı düzenle' : 'Yeni kampanya'}</DialogTitle>
          <DialogDescription>Yalnızca menünüzdeki ürünler listelenir. Ürün fiyatı değişirse “normal” fiyat da güncellenir.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Kampanya türü" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {KIND_OPTIONS.map((o) => {
            const on = draft.kind === o.kind
            return (
              <button
                key={o.kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ kind: o.kind })}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <o.icon className="h-4 w-4 text-primary" /> {o.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.description}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Ürün seçici */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Menünüzde ürün arayın…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border p-2">
              {org.loading ? (
                <div className="h-32 animate-pulse rounded-lg bg-muted" />
              ) : org.error ? (
                <p className="p-4 text-center text-sm text-destructive">{org.error}</p>
              ) : grouped.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {org.allItems.length ? 'Aramanıza uygun ürün yok.' : 'Menünüzde henüz ürün yok. Önce menü editöründen ürün ekleyin.'}
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center justify-between gap-2 px-1 pb-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                      {perItem && group.rows.length > 1 && (
                        <button type="button" onClick={() => addGroup(group.rows)} className="text-[11px] font-semibold text-primary hover:underline">
                          Tümünü ekle
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {group.rows.map((row) => {
                        const selected = draft.items.some((c) => c.itemId === row.item.id)
                        return (
                          <button
                            key={row.item.id}
                            type="button"
                            onClick={() => addItem(row)}
                            aria-pressed={perItem ? selected : undefined}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                              selected && 'bg-primary/10'
                            )}
                          >
                            {row.item.image_url ? (
                              <img src={catalogThumbUrl(row.item.image_url)} alt="" className="h-8 w-8 rounded-md object-cover" />
                            ) : (
                              <span className="h-8 w-8 rounded-md bg-muted" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{row.item.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{row.item.price}</span>
                            {perItem && selected ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <Plus className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kampanya */}
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-sm font-semibold">{perItem ? 'İndirimli ürünler ve kampanya fiyatları' : 'Kampanya içeriği'}</p>
              {draft.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Soldan ürün seçin.</p>
              ) : perItem ? (
                <>
                  {draft.items.map((c) => {
                    const base = parsePrice(c.price)?.amount ?? null
                    const deal = parsePrice(c.dealPrice)?.amount
                    const pct = deal != null ? campaignSavingsPercent(deal, base) : null
                    return (
                      <div key={c.itemId} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{c.price}</span>
                        <div className="relative w-24 shrink-0">
                          <Input
                            inputMode="decimal"
                            aria-label={`${c.name} kampanya fiyatı`}
                            className={cn('h-8 pr-6 text-right', deal != null && base != null && deal >= base && 'border-amber-500')}
                            value={c.dealPrice}
                            placeholder="165"
                            onChange={(e) => setDealPrice(c.itemId, e.target.value)}
                          />
                          <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-muted-foreground">{currency}</span>
                        </div>
                        <span className="w-10 shrink-0 text-right text-[11px] font-bold text-primary">{pct != null ? `-%${pct}` : ''}</span>
                        <button type="button" onClick={() => setQuantity(c.itemId, 0)} aria-label="Çıkar" className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                  {draft.items.length > 1 && (
                    <div className="flex items-center gap-2 border-t pt-2">
                      <span className="flex-1 text-xs text-muted-foreground">Hepsine aynı fiyat</span>
                      <Input
                        inputMode="decimal"
                        aria-label="Hepsine aynı fiyat"
                        className="h-8 w-24 text-right"
                        value={bulkPrice}
                        placeholder="165"
                        onChange={(e) => setBulkPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            applyBulkPrice()
                          }
                        }}
                      />
                      <Button type="button" size="sm" variant="outline" onClick={applyBulkPrice}>
                        Uygula
                      </Button>
                    </div>
                  )}
                  {draft.items.some((c) => {
                    const base = parsePrice(c.price)?.amount
                    const deal = parsePrice(c.dealPrice)?.amount
                    return base != null && deal != null && deal >= base
                  }) && <p className="text-xs font-semibold text-amber-600">Normal fiyatından düşük olmayan ürünler kampanyalı gösterilmez.</p>}
                </>
              ) : (
                draft.items.map((c) => (
                  <div key={c.itemId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.price}</span>
                    <div className="flex items-center rounded-lg border">
                      <button type="button" className="p-1.5" onClick={() => setQuantity(c.itemId, c.quantity - 1)} aria-label="Azalt">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold">{c.quantity}</span>
                      <button type="button" className="p-1.5" onClick={() => setQuantity(c.itemId, c.quantity + 1)} aria-label="Artır">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button type="button" onClick={() => setQuantity(c.itemId, 0)} aria-label="Çıkar" className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <Field label="Kampanya adı">
              <Input
                value={draft.name}
                maxLength={80}
                placeholder={perItem ? 'Happy Hour' : 'Bira + Patates'}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, nameTouched: true }))}
              />
            </Field>
            <Field label="Açıklama (isteğe bağlı)">
              <Textarea value={draft.description} maxLength={300} rows={2} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </Field>
            {!perItem && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Kampanya fiyatı (${currency})`}>
                  <Input inputMode="decimal" value={draft.price} placeholder="150" onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
                </Field>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Ayrı ayrı toplam</p>
                  <p className="font-bold">{normal != null ? formatPrice(normal, currency) : '—'}</p>
                  {savings != null && <p className="text-xs font-bold text-primary">Müşteri %{savings} avantaj görür</p>}
                  {price != null && normal != null && price >= normal && (
                    <p className="text-xs font-semibold text-amber-600">Kampanya fiyatı ayrı ayrı toplamdan düşük değil</p>
                  )}
                </div>
              </div>
            )}

            {/* Ne zaman geçerli */}
            <div className="space-y-3 rounded-xl border p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Clock className="h-4 w-4 text-muted-foreground" /> Ne zaman geçerli?
              </p>
              <Field label="Günler" group>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, days: p.days }))}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold',
                        sameDays(draft.days, p.days) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {ISO_DAY_LABELS.map((label, idx) => {
                    const day = idx + 1
                    const on = draft.days.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraft((d) => ({ ...d, days: on ? d.days.filter((x) => x !== day) : [...d.days, day].sort() }))}
                        className={cn(
                          'h-8 rounded-md text-xs font-bold',
                          on ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Başlangıç saati">
                  <NativeSelect value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}>
                    {timeOptions(draft.startTime).map((t) => (
                      <option key={t} value={t}>
                        {t === '00:00' ? '00:00 (gün başı)' : t}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Bitiş saati" hint={scheduleHint}>
                  <NativeSelect value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}>
                    {/* 00:00 listenin sonunda: gece yarısı (gün sonu) */}
                    {[...timeOptions(draft.endTime).filter((t) => t !== '00:00'), '00:00'].map((t) => (
                      <option key={t} value={t}>
                        {t === '00:00' ? '24:00 (gün sonu)' : t}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Başlangıç tarihi">
                  <NativeSelect
                    value={draft.fromDate}
                    onChange={(e) => {
                      const fromDate = e.target.value
                      // Bitiş yeni başlangıçtan önce kalırsa temizlenir
                      setDraft((d) => ({ ...d, fromDate, untilDate: d.untilDate && fromDate && d.untilDate < fromDate ? '' : d.untilDate }))
                    }}
                  >
                    <option value="">Hemen</option>
                    {dateOptions(draft.fromDate, 365).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Bitiş tarihi" hint={draft.untilDate ? 'Bu gün dahil' : undefined}>
                  <NativeSelect value={draft.untilDate} onChange={(e) => setDraft((d) => ({ ...d, untilDate: e.target.value }))}>
                    <option value="">Süresiz</option>
                    {dateOptions(draft.untilDate, 365, draft.fromDate || undefined).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {describeCampaignSchedule(scheduleFromDraft(draft)) || 'Her gün, gün boyunca'}
                {draft.fromDate || draft.untilDate ? ` · ${describeDateRange({ validFrom: validFromIso(draft.fromDate), validUntil: validUntilIso(draft.untilDate) })}` : ''}
              </p>
            </div>

            {imageChoices.length > 1 && (
              <Field label="Kampanya görseli" group>
                <div className="flex flex-wrap gap-2">
                  {imageChoices.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, imageUrl: d.imageUrl === url ? null : url }))}
                      className={cn(
                        'h-14 w-14 overflow-hidden rounded-lg border-2',
                        (draft.imageUrl || imageChoices[0]) === url ? 'border-primary' : 'border-transparent'
                      )}
                    >
                      <img src={catalogThumbUrl(url)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-semibold">Menüde göster</p>
                <p className="text-xs text-muted-foreground">Kapalıyken kampanya saklanır ama müşteriye görünmez.</p>
              </div>
              <Switch checked={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} label="Menüde göster" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={requestClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kaydet
          </Button>
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

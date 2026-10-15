'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Gift, Loader2, Minus, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog, Field, Switch } from '@/components/admin/shared/ui'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { catalogThumbUrl } from '@/lib/image-url'
import { formatPrice, parsePrice } from '@/lib/price'
import {
  campaignNormalTotal,
  campaignSavingsPercent,
  campaignStatus,
  isCampaignInWindow,
  suggestCampaignName,
  type Campaign,
} from '@/lib/campaigns'
import { cn } from '@/lib/utils'
import {
  MigrationNotice,
  SiteApiError,
  SitePageShell,
  isoToLocalInput,
  localInputToIso,
  siteApi,
  useOrgMenus,
  type FlatMenuItem,
} from './shared'

interface DraftComponent {
  itemId: string
  name: string
  price: string
  imageUrl: string
  quantity: number
}

interface Draft {
  id?: string
  name: string
  nameTouched: boolean
  description: string
  price: string
  isActive: boolean
  validFrom: string
  validUntil: string
  imageUrl: string | null
  displayOrder?: number
  items: DraftComponent[]
}

const emptyDraft = (): Draft => ({
  name: '',
  nameTouched: false,
  description: '',
  price: '',
  isActive: true,
  validFrom: '',
  validUntil: '',
  imageUrl: null,
  items: [],
})

function draftFromCampaign(c: Campaign): Draft {
  return {
    id: c.id,
    name: c.name,
    nameTouched: true,
    description: c.description,
    price: String(c.price).replace('.', ','),
    isActive: c.isActive,
    validFrom: isoToLocalInput(c.validFrom),
    validUntil: isoToLocalInput(c.validUntil),
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
      })),
  }
}

/** Kaydedilmiş kampanyadan API gövdesi (hızlı aç/kapat için) */
function payloadFromCampaign(subdomain: string, c: Campaign, patch: Partial<{ isActive: boolean }> = {}) {
  return {
    subdomain,
    name: c.name,
    description: c.description,
    price: c.price,
    imageUrl: c.imageUrl,
    isActive: patch.isActive ?? c.isActive,
    displayOrder: c.displayOrder,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    items: c.items.filter((comp) => comp.itemId).map((comp) => ({ itemId: comp.itemId!, quantity: comp.quantity })),
  }
}

const STATUS_TEXT = {
  missing_item: 'Bir ürünü menüden silinmiş — müşteriye gösterilmiyor',
  unavailable_item: 'Bir ürünü tükendi olarak işaretli — müşteriye gösterilmiyor',
  empty: 'Ürün yok — müşteriye gösterilmiyor',
} as const

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
      title="Kampanyalar"
      description="Menünüzdeki ürünlerden paketler oluşturun (ör. Bira + Patates). Menüde en üstte “Kampanyalı Ürünler” olarak görünür."
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
        <MigrationNotice />
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
            Menünüzdeki ürünleri birleştirip tek fiyat belirleyin. Müşteriler ayrı ayrı alınca ne kadar kazandıklarını görür.
          </p>
          <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended}>
            <Plus className="mr-2 h-4 w-4" /> İlk Kampanyayı Oluştur
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const status = campaignStatus(c)
            const normal = campaignNormalTotal(c.items, (comp) => comp.item?.price)
            const savings = campaignSavingsPercent(c.price, normal)
            const image = c.imageUrl || c.items.map((comp) => comp.item?.image_url).find(Boolean)
            const expired = !isCampaignInWindow(c)
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
                  {status !== 'ok' && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> {STATUS_TEXT[status]}
                    </p>
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
  const [saving, setSaving] = useState(false)
  const multipleMenus = org.menus.length > 1

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch }
      // Ad elle değiştirilmediyse ürünlerden önerilir: "Bira + Patates"
      if (patch.items && !next.nameTouched) next.name = suggestCampaignName(next.items)
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

  const addItem = (row: FlatMenuItem) => {
    if (row.item.id.startsWith('item-')) {
      toast.error('Bu ürün henüz kaydedilmemiş. Önce menü editöründe kaydedin.')
      return
    }
    const existing = draft.items.find((c) => c.itemId === row.item.id)
    if (existing) {
      update({ items: draft.items.map((c) => (c.itemId === row.item.id ? { ...c, quantity: Math.min(20, c.quantity + 1) } : c)) })
      return
    }
    if (draft.items.length >= 10) return toast.error('Bir kampanyada en fazla 10 ürün olabilir.')
    update({
      items: [
        ...draft.items,
        { itemId: row.item.id, name: row.item.name, price: row.item.price, imageUrl: row.item.image_url || '', quantity: 1 },
      ],
    })
  }

  const setQuantity = (itemId: string, quantity: number) =>
    update({
      items: quantity <= 0 ? draft.items.filter((c) => c.itemId !== itemId) : draft.items.map((c) => (c.itemId === itemId ? { ...c, quantity: Math.min(20, quantity) } : c)),
    })

  const normal = campaignNormalTotal(
    draft.items.map((c) => ({ itemId: c.itemId, name: c.name, quantity: c.quantity })),
    (comp) => draft.items.find((c) => c.itemId === comp.itemId)?.price
  )
  const price = parsePrice(draft.price)?.amount
  const savings = price != null ? campaignSavingsPercent(price, normal) : null
  const imageChoices = draft.items.map((c) => c.imageUrl).filter((url) => url && !url.startsWith('data:'))

  const save = async () => {
    if (!draft.items.length) return toast.error('En az bir ürün seçin.')
    if (draft.name.trim().length < 2) return toast.error('Kampanya adı en az 2 karakter olmalı.')
    if (price == null) return toast.error('Geçerli bir kampanya fiyatı girin.')
    setSaving(true)
    try {
      await siteApi(draft.id ? `/api/site/campaigns/${draft.id}` : '/api/site/campaigns', {
        method: draft.id ? 'PATCH' : 'POST',
        json: {
          subdomain,
          name: draft.name,
          description: draft.description,
          price,
          imageUrl: draft.imageUrl && !draft.imageUrl.startsWith('data:') ? draft.imageUrl : null,
          isActive: draft.isActive,
          displayOrder: draft.displayOrder,
          validFrom: localInputToIso(draft.validFrom),
          validUntil: localInputToIso(draft.validUntil),
          items: draft.items.map((c) => ({ itemId: c.itemId, quantity: c.quantity })),
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
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? 'Kampanyayı düzenle' : 'Yeni kampanya'}</DialogTitle>
          <DialogDescription>Yalnızca menünüzdeki ürünler listelenir. Ürün fiyatı değişirse “normal toplam” da güncellenir.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
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
                    <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                    <div className="space-y-1">
                      {group.rows.map((row) => {
                        const selected = draft.items.some((c) => c.itemId === row.item.id)
                        return (
                          <button
                            key={row.item.id}
                            type="button"
                            onClick={() => addItem(row)}
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
                            <Plus className="h-4 w-4 shrink-0 text-primary" />
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
              <p className="text-sm font-semibold">Kampanya içeriği</p>
              {draft.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Soldan ürün seçin.</p>
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
              <Input value={draft.name} maxLength={80} placeholder="Bira + Patates" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, nameTouched: true }))} />
            </Field>
            <Field label="Açıklama (isteğe bağlı)">
              <Textarea value={draft.description} maxLength={300} rows={2} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </Field>
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Başlangıç (isteğe bağlı)">
                <Input type="datetime-local" value={draft.validFrom} onChange={(e) => setDraft((d) => ({ ...d, validFrom: e.target.value }))} />
              </Field>
              <Field label="Bitiş (isteğe bağlı)">
                <Input type="datetime-local" value={draft.validUntil} onChange={(e) => setDraft((d) => ({ ...d, validUntil: e.target.value }))} />
              </Field>
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

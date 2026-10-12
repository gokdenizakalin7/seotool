'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ImageOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { catalogThumbUrl } from '@/lib/image-url'
import { foldTurkish } from '@/lib/catalog-match'
import type { AdminCatalogCategory, AdminCatalogItem, AdminTemplate, AdminTemplateDetail } from '@/lib/admin-types'
import { cn } from '@/lib/utils'
import { ErrorBanner, LoadingBlock, Spinner } from '../shared/ui'
import { adminApi, errorMessage } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { ancestorIds, buildTree, flattenTree, type CategoryNode } from '../catalog/tree'
import { CategoryIcon } from '../catalog/category-icons'

/**
 * Şablon içeriği: katalog ağacından kategori ve ürün seçimi + fiyat geçersiz kılma.
 * Ürün seçilince kategorisi ve üst kategorileri otomatik seçilir (apply_catalog_template ağacı böyle kurar).
 */
export function TemplateEditorDialog({
  template,
  onClose,
  onSaved,
}: {
  template: AdminTemplate
  onClose: () => void
  onSaved: () => void
}) {
  const detail = useAdminQuery<{ template: AdminTemplateDetail }>(`/api/admin/templates/${template.id}`)
  const cats = useAdminQuery<{ categories: AdminCatalogCategory[] }>('/api/admin/catalog/categories')
  const items = useAdminQuery<{ items: AdminCatalogItem[] }>('/api/admin/catalog/items?size=2000&usage=0')

  const [selCats, setSelCats] = useState<Set<string>>(new Set())
  const [selItems, setSelItems] = useState<Map<string, { displayOrder: number; priceOverride: string }>>(new Map())
  const [focusCat, setFocusCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const t = detail.data?.template
    if (!t) return
    setSelCats(new Set(t.categories.map((c) => c.categoryId)))
    setSelItems(new Map(t.items.map((i) => [i.itemId, { displayOrder: i.displayOrder, priceOverride: i.priceOverride || '' }])))
    setDirty(false)
  }, [detail.data])

  const categories = cats.data?.categories || []
  const tree = useMemo(() => buildTree(categories), [categories])
  const flat = useMemo(() => flattenTree(tree), [tree])
  const allItems = items.data?.items || []
  const itemsByCat = useMemo(() => {
    const m = new Map<string, AdminCatalogItem[]>()
    for (const i of allItems) {
      const list = m.get(i.categoryId) || []
      list.push(i)
      m.set(i.categoryId, list)
    }
    return m
  }, [allItems])

  const selectedCountUnder = (n: CategoryNode): number =>
    (itemsByCat.get(n.id) || []).filter((i) => selItems.has(i.id)).length + n.children.reduce((s, c) => s + selectedCountUnder(c), 0)

  const descendants = (id: string): string[] => {
    const node = flat.find((n) => n.id === id)
    if (!node) return [id]
    const out: string[] = []
    const walk = (n: CategoryNode) => {
      out.push(n.id)
      n.children.forEach(walk)
    }
    walk(node)
    return out
  }

  const toggleCat = (id: string, on: boolean) => {
    setDirty(true)
    setSelCats((prev) => {
      const next = new Set(prev)
      if (on) ancestorIds(categories, id).forEach((a) => next.add(a))
      else descendants(id).forEach((d) => next.delete(d))
      return next
    })
    if (!on) {
      const removed = new Set(descendants(id))
      setSelItems((prev) => new Map([...prev].filter(([itemId]) => !removed.has(allItems.find((i) => i.id === itemId)?.categoryId || ''))))
    }
  }

  const toggleItem = (item: AdminCatalogItem, on: boolean) => {
    setDirty(true)
    setSelItems((prev) => {
      const next = new Map(prev)
      if (on) next.set(item.id, { displayOrder: 9999, priceOverride: '' })
      else next.delete(item.id)
      return next
    })
    if (on) setSelCats((prev) => new Set([...prev, ...ancestorIds(categories, item.categoryId)]))
  }

  const setPrice = (itemId: string, priceOverride: string) => {
    setDirty(true)
    setSelItems((prev) => {
      const cur = prev.get(itemId)
      if (!cur) return prev
      return new Map(prev).set(itemId, { ...cur, priceOverride })
    })
  }

  const q = foldTurkish(search.trim())
  const visibleItems = q
    ? allItems.filter((i) => foldTurkish(i.name).includes(q) || foldTurkish(i.nameEn).includes(q)).slice(0, 200)
    : focusCat
      ? descendants(focusCat).flatMap((id) => itemsByCat.get(id) || [])
      : []

  const save = async () => {
    setBusy(true)
    try {
      const catOrder = flat.filter((n) => selCats.has(n.id)).map((n, idx) => ({ categoryId: n.id, displayOrder: idx + 1 }))
      // Ürün sırası: kategori içinde mevcut sıra korunur, yeni eklenenler katalog sırasıyla sona
      const catalogIndex = new Map(allItems.map((i, idx) => [i.id, idx]))
      const itemCat = new Map(allItems.map((i) => [i.id, i.categoryId]))
      const grouped = new Map<string, string[]>()
      for (const id of selItems.keys()) {
        const c = itemCat.get(id) || ''
        grouped.set(c, [...(grouped.get(c) || []), id])
      }
      const itemOrder: { itemId: string; displayOrder: number; priceOverride: string | null }[] = []
      for (const ids of grouped.values()) {
        ids.sort(
          (a, b) => (selItems.get(a)!.displayOrder - selItems.get(b)!.displayOrder) || ((catalogIndex.get(a) ?? 0) - (catalogIndex.get(b) ?? 0))
        )
        ids.forEach((id, idx) => itemOrder.push({ itemId: id, displayOrder: idx + 1, priceOverride: selItems.get(id)!.priceOverride.trim() || null }))
      }
      await adminApi(`/api/admin/templates/${template.id}/categories`, { method: 'PUT', body: { categories: catOrder } })
      await adminApi(`/api/admin/templates/${template.id}/items`, { method: 'PUT', body: { items: itemOrder } })
      toast.success(`Şablon kaydedildi: ${catOrder.length} kategori, ${itemOrder.length} ürün.`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const loading = (detail.loading && !detail.data) || (cats.loading && !cats.data) || (items.loading && !items.data)
  const error = detail.error || cats.error || items.error

  const renderTree = (nodes: CategoryNode[]) =>
    nodes.map((n) => {
      const count = selectedCountUnder(n)
      return (
        <div key={n.id}>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg py-1 pr-2 text-sm hover:bg-accent/60',
              focusCat === n.id && !q && 'bg-accent',
              !n.isActive && 'opacity-50'
            )}
            style={{ paddingLeft: 6 + n.depth * 16 }}
          >
            <Checkbox checked={selCats.has(n.id)} onCheckedChange={(v) => toggleCat(n.id, v === true)} />
            <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setFocusCat(n.id)}>
              <CategoryIcon name={n.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{n.name}</span>
            </button>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {count ? <b className="text-foreground">{count}</b> : 0}/{n.totalItems}
            </span>
          </div>
          {n.children.length > 0 && renderTree(n.children)}
        </div>
      )
    })

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {template.icon} {template.name} — içerik
          </DialogTitle>
          <DialogDescription>
            {selCats.size} kategori · {selItems.size} ürün seçili. Fiyat boş bırakılırsa katalogdaki önerilen fiyat kullanılır.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ErrorBanner message={error} />
        ) : loading ? (
          <LoadingBlock />
        ) : (
          <div className="grid h-[60vh] gap-4 md:grid-cols-[minmax(240px,340px)_1fr]">
            <div className="overflow-y-auto rounded-2xl border border-border/60 p-1.5">{renderTree(tree)}</div>
            <div className="flex min-h-0 flex-col rounded-2xl border border-border/60">
              <div className="relative border-b border-border/60 p-2">
                <Search className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tüm katalogda ara…" className="pl-9" />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {!visibleItems.length ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {q ? 'Sonuç yok.' : 'Soldan bir kategori seçin ya da arayın.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {visibleItems.map((i) => {
                      const sel = selItems.get(i.id)
                      return (
                        <li key={i.id} className={cn('flex items-center gap-3 py-1.5', !i.isActive && 'opacity-50')}>
                          <Checkbox checked={!!sel} onCheckedChange={(v) => toggleItem(i, v === true)} />
                          {i.imageUrl ? (
                            <img src={catalogThumbUrl(i.imageUrl)} alt="" loading="lazy" className="h-9 w-9 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <ImageOff className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{i.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {flat.find((c) => c.id === i.categoryId)?.path}
                              {!i.isActive && ' · pasif (şablonda görünmez)'}
                            </p>
                          </div>
                          <Input
                            value={sel?.priceOverride ?? ''}
                            disabled={!sel}
                            onChange={(e) => setPrice(i.id, e.target.value)}
                            placeholder={i.priceSuggested || 'Fiyat'}
                            className="h-8 w-28 text-xs"
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={busy || loading || !!error || !dirty}>
            {busy && <Spinner className="mr-1.5" />}
            Şablonu kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

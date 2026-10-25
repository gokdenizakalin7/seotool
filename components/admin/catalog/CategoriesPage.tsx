'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, FolderTree, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AdminCatalogCategory } from '@/lib/admin-types'
import { cn } from '@/lib/utils'
import { Badge, ConfirmDialog, EmptyState, ErrorBanner, Field, LoadingBlock, NativeSelect, PageHeader, Panel, Spinner, Switch } from '../shared/ui'
import { adminApi, errorMessage, slugify } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { buildTree, flattenTree, type CategoryNode } from './tree'
import { CategoryIcon, IconPicker } from './category-icons'

interface EditState {
  mode: 'create' | 'edit'
  id?: string
  parentId: string | null
  slug: string
  name: string
  nameEn: string
  icon: string
  isActive: boolean
}

export function CategoriesPage() {
  const q = useAdminQuery<{ categories: AdminCatalogCategory[] }>('/api/admin/catalog/categories')
  const categories = q.data?.categories
  const tree = useMemo(() => buildTree(categories || []), [categories])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<EditState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // İlk yüklemede kökleri aç
  useEffect(() => {
    if (tree.length && expanded.size === 0) setExpanded(new Set(tree.map((n) => n.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length])

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  /** Kardeşler arasında yukarı/aşağı taşır ve tüm kardeşlerin sırasını yeniden yazar */
  const move = async (node: CategoryNode, siblings: CategoryNode[], dir: -1 | 1) => {
    const i = siblings.findIndex((s) => s.id === node.id)
    const j = i + dir
    if (j < 0 || j >= siblings.length) return
    const order = [...siblings]
    ;[order[i], order[j]] = [order[j], order[i]]
    setBusyId(node.id)
    try {
      await adminApi('/api/admin/catalog/categories/reorder', {
        method: 'PUT',
        body: { orders: order.map((s, idx) => ({ id: s.id, displayOrder: (idx + 1) * 10 })) },
      })
      q.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const setActive = async (node: CategoryNode, isActive: boolean) => {
    setBusyId(node.id)
    try {
      await adminApi(`/api/admin/catalog/categories/${node.id}`, { method: 'PATCH', body: { isActive } })
      toast.success(isActive ? 'Kategori aktifleştirildi.' : 'Kategori pasifleştirildi; şablonlarda ve aramada görünmez.')
      q.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const renderNodes = (nodes: CategoryNode[]) =>
    nodes.map((n, idx) => {
      const open = expanded.has(n.id)
      return (
        <div key={n.id}>
          <div
            className={cn('group rounded-xl px-2 py-1.5 hover:bg-accent/50 sm:flex sm:items-center sm:gap-2', !n.isActive && 'opacity-55')}
            style={{ paddingLeft: 8 + n.depth * 22 }}
          >
            {/* Dar ekranda ad bloğu üstte, işlem düğmeleri alt satırda; sm ve üstünde tek satır */}
            <div className="flex min-w-0 items-center gap-2 sm:flex-1">
              <button
                type="button"
                onClick={() => toggle(n.id)}
                className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground', !n.children.length && 'invisible')}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <CategoryIcon name={n.icon} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{n.name}</span>
                <span className="block truncate text-xs text-muted-foreground sm:ml-2 sm:inline">
                  {n.nameEn && <span>{n.nameEn}</span>}
                  <span className={cn('font-mono text-[11px] text-muted-foreground/70', n.nameEn && 'ml-2')}>{n.slug}</span>
                </span>
              </div>
              {!n.isActive && <Badge tone="neutral">Pasif</Badge>}
              <Link
                to={`/admin/catalog/items?categoryId=${n.id}`}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Ürünleri göster"
              >
                <Package className="h-3.5 w-3.5" /> {n.totalItems}
              </Link>
            </div>
            <div className="mt-1 flex items-center gap-0.5 pl-8 sm:mt-0 sm:pl-0 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100">
              {busyId === n.id && <Spinner className="mx-1" />}
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0 || !!busyId} onClick={() => move(n, nodes, -1)} title="Yukarı">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === nodes.length - 1 || !!busyId} onClick={() => move(n, nodes, 1)} title="Aşağı">
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Alt kategori ekle"
                onClick={() =>
                  setEdit({ mode: 'create', parentId: n.id, slug: '', name: '', nameEn: '', icon: n.icon, isActive: true })
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Düzenle"
                onClick={() =>
                  setEdit({ mode: 'edit', id: n.id, parentId: n.parentId, slug: n.slug, name: n.name, nameEn: n.nameEn, icon: n.icon, isActive: n.isActive })
                }
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Switch checked={n.isActive} disabled={!!busyId} onChange={(v) => setActive(n, v)} label="Aktif" />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" title="Sil" onClick={() => setDeleteTarget(n)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {open && n.children.length > 0 && renderNodes(n.children)}
        </div>
      )
    })

  return (
    <>
      <PageHeader
        title="Kategori Ağacı"
        description="Tüm restoranların ortak katalog kategorileri. Şablonlar ve katalogdan seçim bu ağaca göre çalışır."
        actions={
          <>
            <Button variant="outline" onClick={() => setExpanded(new Set(flattenTree(tree).map((n) => n.id)))}>
              Tümünü aç
            </Button>
            <Button variant="outline" onClick={() => setExpanded(new Set())}>
              Kapat
            </Button>
            <Button onClick={() => setEdit({ mode: 'create', parentId: null, slug: '', name: '', nameEn: '', icon: '', isActive: true })}>
              <Plus className="mr-1.5 h-4 w-4" /> Ana kategori
            </Button>
          </>
        }
      />

      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}

      <Panel className="p-2 sm:p-3">
        {q.loading && !q.data ? <LoadingBlock /> : tree.length ? renderNodes(tree) : <EmptyState icon={FolderTree} title="Kategori yok" />}
      </Panel>

      <p className="text-xs text-muted-foreground">
        Restoranlar şablon uyguladığında 4 seviyeli ağaç 2 seviyeye indirilir: ikinci seviye ana başlık, en alt seviye alt başlık olur.
        Restoranlara daha önce kopyalanmış menüler bu değişikliklerden etkilenmez.
      </p>

      {edit && <CategoryDialog state={edit} categories={categories || []} onClose={() => setEdit(null)} onSaved={q.reload} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`"${deleteTarget?.name}" silinsin mi?`}
        description="Yalnızca boş kategoriler (alt kategori, ürün ve şablon bağlantısı olmayan) silinebilir. Dolu kategorileri pasifleştirin."
        confirmLabel="Sil"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await adminApi(`/api/admin/catalog/categories/${deleteTarget.id}`, { method: 'DELETE' })
            toast.success('Kategori silindi.')
            setDeleteTarget(null)
            q.reload()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </>
  )
}

function CategoryDialog({
  state,
  categories,
  onClose,
  onSaved,
}: {
  state: EditState
  categories: AdminCatalogCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const [s, setS] = useState(state)
  const [slugTouched, setSlugTouched] = useState(state.mode === 'edit')
  const [busy, setBusy] = useState(false)
  const options = useMemo(() => flattenTree(buildTree(categories)), [categories])

  // Kendisi ve altları üst kategori olarak seçilemez
  const blocked = useMemo(() => {
    if (!s.id) return new Set<string>()
    const out = new Set<string>([s.id])
    let grew = true
    while (grew) {
      grew = false
      for (const c of categories) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) (out.add(c.id), (grew = true))
    }
    return out
  }, [categories, s.id])

  const save = async () => {
    setBusy(true)
    try {
      if (s.mode === 'create') {
        await adminApi('/api/admin/catalog/categories', {
          method: 'POST',
          body: { slug: s.slug, name: s.name, nameEn: s.nameEn, icon: s.icon, parentId: s.parentId, isActive: s.isActive },
        })
        toast.success('Kategori eklendi.')
      } else {
        await adminApi(`/api/admin/catalog/categories/${s.id}`, {
          method: 'PATCH',
          body: { name: s.name, nameEn: s.nameEn, icon: s.icon, parentId: s.parentId, isActive: s.isActive },
        })
        toast.success('Kategori güncellendi.')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{s.mode === 'create' ? 'Yeni kategori' : 'Kategoriyi düzenle'}</DialogTitle>
          <DialogDescription>Ad değişikliği yeni şablon uygulamalarında görünür; mevcut restoran menüleri değişmez.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Ad (Türkçe)">
            <Input
              value={s.name}
              onChange={(e) => {
                const name = e.target.value
                setS((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) }))
              }}
              autoFocus
            />
          </Field>
          <Field label="Ad (İngilizce)">
            <Input value={s.nameEn} onChange={(e) => setS({ ...s, nameEn: e.target.value })} />
          </Field>
          <Field label="Slug" hint={s.mode === 'edit' ? 'Slug değiştirilemez (import ve görseller buna bağlı)' : undefined}>
            <Input
              value={s.slug}
              disabled={s.mode === 'edit'}
              onChange={(e) => {
                setSlugTouched(true)
                setS({ ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
              }}
              className="font-mono"
            />
          </Field>
          <Field label="Üst kategori">
            <NativeSelect value={s.parentId || ''} onChange={(e) => setS({ ...s, parentId: e.target.value || null })}>
              <option value="">— Ana kategori —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={blocked.has(o.id)}>
                  {'  '.repeat(o.depth)}
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="İkon" group>
          <IconPicker value={s.icon} onChange={(icon) => setS({ ...s, icon })} />
        </Field>
        <label className="flex items-center justify-between text-sm">
          <span className="font-semibold">Aktif</span>
          <Switch checked={s.isActive} onChange={(v) => setS({ ...s, isActive: v })} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={busy || !s.name.trim() || !s.slug}>
            {busy && <Spinner className="mr-1.5" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

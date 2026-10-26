'use client'

import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImageOff, LayoutGrid, List, Package, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { catalogThumbUrl } from '@/lib/image-url'
import type { AdminCatalogCategory, AdminCatalogItem } from '@/lib/admin-types'
import { cn } from '@/lib/utils'
import { Badge, EmptyState, ErrorBanner, LoadingBlock, NativeSelect, PageHeader, Pager, Panel, useDebounced } from '../shared/ui'
import { qs } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { buildTree, flattenTree } from './tree'
import { ItemEditDialog } from './ItemEditDialog'

interface ListResponse {
  items: AdminCatalogItem[]
  total: number
  size: number
}

export function ItemsPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebounced(search)
  const categoryId = params.get('categoryId') || ''
  const image = params.get('image') || ''
  const active = params.get('active') || 'all'
  const page = Number(params.get('page')) || 1
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [editing, setEditing] = useState<AdminCatalogItem | null | 'new'>(null)

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  const cats = useAdminQuery<{ categories: AdminCatalogCategory[] }>('/api/admin/catalog/categories')
  const categories = cats.data?.categories || []
  const options = useMemo(() => flattenTree(buildTree(categories)), [categories])
  const catPath = useMemo(() => new Map(options.map((o) => [o.id, o.path])), [options])

  const list = useAdminQuery<ListResponse>(
    `/api/admin/catalog/items${qs({ q, categoryId, image, active: active === 'all' ? null : active, page, size: 60 })}`
  )

  const onSaved = (saved: AdminCatalogItem) => {
    list.setData((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === saved.id ? { ...i, ...saved, usageCount: i.usageCount, orgCount: i.orgCount } : i)) } : prev
    )
    if (editing === 'new') list.reload()
  }

  return (
    <>
      <PageHeader
        title="Katalog Ürünleri & Görseller"
        description="Restoranların şablonlardan ve katalogdan seçtiği ortak ürünler. Görseller restoranlar için varsayılandır."
        actions={
          <Button onClick={() => setEditing('new')} disabled={!categories.length}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni ürün
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_260px_170px_150px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ürün adı veya slug…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              update({ q: e.target.value || null })
            }}
          />
        </div>
        <NativeSelect value={categoryId} onChange={(e) => update({ categoryId: e.target.value || null })}>
          <option value="">Tüm kategoriler</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {'  '.repeat(o.depth)}
              {o.name} ({o.totalItems})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={image} onChange={(e) => update({ image: e.target.value || null })}>
          <option value="">Tüm görseller</option>
          <option value="missing">Görseli olmayanlar</option>
          <option value="has">Görseli olanlar</option>
        </NativeSelect>
        <NativeSelect value={active} onChange={(e) => update({ active: e.target.value === 'all' ? null : e.target.value })}>
          <option value="all">Aktif + pasif</option>
          <option value="active">Yalnız aktif</option>
          <option value="inactive">Yalnız pasif</option>
        </NativeSelect>
        <div className="flex gap-1">
          <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setView('grid')} title="Izgara">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={view === 'table' ? 'default' : 'outline'} size="icon" onClick={() => setView('table')} title="Tablo">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}

      {list.loading && !list.data ? (
        <LoadingBlock />
      ) : !list.data?.items.length ? (
        <Panel>
          <EmptyState icon={Package} title="Ürün bulunamadı" hint="Filtreleri değiştirmeyi deneyin." />
        </Panel>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {list.data.items.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setEditing(i)}
              className={cn(
                'group overflow-hidden rounded-2xl border border-border/60 bg-card/70 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg',
                !i.isActive && 'opacity-55'
              )}
            >
              <div className="relative aspect-square bg-muted/40">
                {i.imageUrl ? (
                  <img src={catalogThumbUrl(i.imageUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
                {!!i.usageCount && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {i.usageCount} kullanım
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold">{i.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{catPath.get(i.categoryId) || '—'}</p>
                {!i.isActive && (
                  <div className="mt-1">
                    <Badge tone="neutral">Pasif</Badge>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Panel className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14" />
                  <TableHead>Ürün</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Kullanım</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => setEditing(i)}>
                    <TableCell>
                      {i.imageUrl ? (
                        <img src={catalogThumbUrl(i.imageUrl)} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{i.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{i.slug}</p>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">{catPath.get(i.categoryId) || '—'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {i.usageCount ?? 0}
                      <span className="text-xs text-muted-foreground"> / {i.orgCount ?? 0} rest.</span>
                    </TableCell>
                    <TableCell>{i.isActive ? <Badge tone="green">Aktif</Badge> : <Badge tone="neutral">Pasif</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {list.data && <Pager page={page} size={list.data.size} total={list.data.total} onPage={(p) => update({ page: String(p) })} />}

      {editing && (
        <ItemEditDialog
          item={editing === 'new' ? null : editing}
          defaultCategoryId={categoryId}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  )
}

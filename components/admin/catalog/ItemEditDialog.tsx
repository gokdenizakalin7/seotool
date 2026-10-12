'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImageOff, ImagePlus, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { compressImageFile } from '@/lib/image-compression'
import {
  CATALOG_TAGS,
  EU_ALLERGENS,
  type AdminCatalogCategory,
  type AdminCatalogItem,
  type ImagePropagationResult,
} from '@/lib/admin-types'
import { cn } from '@/lib/utils'
import { ConfirmDialog, Field, NativeSelect, Spinner, Switch } from '../shared/ui'
import { adminApi, errorMessage, fmtDateTime, slugify } from '../lib/admin-api'
import { buildTree, flattenTree } from './tree'

type Draft = Omit<AdminCatalogItem, 'id' | 'imageUrl' | 'displayOrder' | 'adminEditedAt' | 'updatedAt' | 'usageCount' | 'orgCount'>

function toDraft(item: AdminCatalogItem | null, categoryId: string): Draft {
  return {
    slug: item?.slug || '',
    categoryId: item?.categoryId || categoryId,
    name: item?.name || '',
    nameEn: item?.nameEn || '',
    description: item?.description || '',
    descriptionEn: item?.descriptionEn || '',
    priceSuggested: item?.priceSuggested || '',
    allergens: item?.allergens || [],
    calories: item?.calories ?? null,
    tags: item?.tags || [],
    isActive: item?.isActive ?? true,
  }
}

function propagationText(p: ImagePropagationResult | null | undefined) {
  if (!p || !p.linked) return 'Bu ürün henüz hiçbir restoran menüsünde kullanılmıyor.'
  const parts = [`${p.linked} restoran ürününe bağlı`]
  if (p.updated) parts.push(`${p.updated} tanesi yeni görselle güncellendi`)
  if (p.cleared) parts.push(`${p.cleared} tanesinden varsayılan görsel kaldırıldı`)
  if (p.kept_custom) parts.push(`${p.kept_custom} tanesi kendi fotoğrafını kullandığı için korundu`)
  return parts.join(', ') + '.'
}

/**
 * Katalog ürünü düzenleme + varsayılan görsel (yükle / AI üret / kaldır).
 * item null ise yeni ürün oluşturulur.
 */
export function ItemEditDialog({
  item,
  defaultCategoryId,
  categories,
  onClose,
  onSaved,
}: {
  item: AdminCatalogItem | null
  defaultCategoryId: string
  categories: AdminCatalogCategory[]
  onClose: () => void
  onSaved: (item: AdminCatalogItem) => void
}) {
  const [current, setCurrent] = useState<AdminCatalogItem | null>(item)
  const [d, setD] = useState<Draft>(() => toDraft(item, defaultCategoryId))
  const [slugTouched, setSlugTouched] = useState(!!item)
  const [busy, setBusy] = useState(false)
  const [imgBusy, setImgBusy] = useState<'upload' | 'generate' | 'remove' | null>(null)
  const [prompt, setPrompt] = useState('')
  const [lastPropagation, setLastPropagation] = useState<ImagePropagationResult | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const options = useMemo(() => flattenTree(buildTree(categories)), [categories])

  useEffect(() => {
    setCurrent(item)
    setD(toDraft(item, defaultCategoryId))
    setLastPropagation(null)
  }, [item, defaultCategoryId])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))
  const toggleIn = (k: 'allergens' | 'tags', v: string) =>
    setD((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }))

  const save = async () => {
    setBusy(true)
    try {
      const body = { ...d, calories: d.calories === null || Number.isNaN(d.calories) ? null : d.calories }
      const res = current
        ? await adminApi<{ item: AdminCatalogItem }>(`/api/admin/catalog/items/${current.id}`, {
            method: 'PATCH',
            body: (({ slug: _slug, ...rest }) => rest)(body),
          })
        : await adminApi<{ item: AdminCatalogItem }>('/api/admin/catalog/items', { method: 'POST', body })
      toast.success(current ? 'Ürün güncellendi.' : 'Ürün eklendi. Şimdi görsel ekleyebilirsiniz.')
      setCurrent(res.item)
      onSaved(res.item)
      if (current) onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const imageAction = async (mode: 'upload' | 'generate' | 'remove', file?: File) => {
    if (!current) return
    setImgBusy(mode)
    try {
      let res: { item: AdminCatalogItem; propagation: ImagePropagationResult | null }
      if (mode === 'remove') {
        res = await adminApi(`/api/admin/catalog/items/${current.id}/image`, { method: 'DELETE' })
      } else if (mode === 'upload' && file) {
        const { dataUrl } = await compressImageFile(file, { maxDimension: 1200, quality: 0.9, format: 'image/webp' })
        res = await adminApi(`/api/admin/catalog/items/${current.id}/image`, { method: 'POST', body: { mode: 'upload', dataUrl } })
      } else {
        res = await adminApi(`/api/admin/catalog/items/${current.id}/image`, {
          method: 'POST',
          body: { mode: 'generate', prompt: prompt.trim() || undefined },
        })
      }
      setCurrent((c) => (c ? { ...res.item, usageCount: c.usageCount, orgCount: c.orgCount } : res.item))
      setLastPropagation(res.propagation)
      onSaved(res.item)
      toast.success(mode === 'remove' ? 'Görsel kaldırıldı.' : 'Görsel kaydedildi.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setImgBusy(null)
    }
  }

  const imageUrl = current?.imageUrl || ''

  return (
    <>
      <Dialog open={!deleteOpen} onOpenChange={(v) => !v && !busy && !imgBusy && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{current ? current.name : 'Yeni katalog ürünü'}</DialogTitle>
            <DialogDescription>
              {current
                ? `${current.usageCount ?? 0} restoran ürününde kullanılıyor (${current.orgCount ?? 0} restoran) · Son düzenleme: ${fmtDateTime(current.adminEditedAt || current.updatedAt)}`
                : 'Katalog tüm restoranlar için ortaktır. Restoranlara kopyalanmış ürünler bu düzenlemelerden etkilenmez.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            {/* Görsel */}
            <div className="space-y-2">
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                    <ImageOff className="h-7 w-7" /> Görsel yok
                  </div>
                )}
                {imgBusy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/75 text-xs">
                    <Spinner className="h-5 w-5" />
                    {imgBusy === 'generate' ? 'AI görsel üretiyor…' : 'Kaydediliyor…'}
                  </div>
                )}
              </div>
              {current ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="outline" disabled={!!imgBusy} onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Yükle
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!imgBusy} onClick={() => imageAction('generate')}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> AI üret
                    </Button>
                  </div>
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="AI için İngilizce tarif (isteğe bağlı)"
                    className="h-8 text-xs"
                  />
                  {imageUrl && (
                    <Button size="sm" variant="ghost" className="w-full text-red-600" disabled={!!imgBusy} onClick={() => imageAction('remove')}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Görseli kaldır
                    </Button>
                  )}
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Bu görsel varsayılandır: bağlı restoran ürünlerinde yalnızca görseli boş olan ya da hâlâ katalog görselini kullananlar
                    güncellenir. Restoranın kendi yüklediği fotoğraf korunur.
                  </p>
                  {lastPropagation && (
                    <p className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2 text-[11px] text-blue-800 dark:text-blue-200">
                      {propagationText(lastPropagation)}
                    </p>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) imageAction('upload', f)
                    }}
                  />
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ImagePlus className="h-3.5 w-3.5" /> Görsel, ürün kaydedildikten sonra eklenir.
                </p>
              )}
            </div>

            {/* Bilgiler */}
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ad (Türkçe)">
                  <Input
                    value={d.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setD((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) }))
                    }}
                  />
                </Field>
                <Field label="Ad (İngilizce)" hint="AI görsel üretimi bu adı kullanır">
                  <Input value={d.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
                </Field>
                <Field label="Slug" hint={current ? 'Değiştirilemez' : undefined}>
                  <Input
                    value={d.slug}
                    disabled={!!current}
                    onChange={(e) => {
                      setSlugTouched(true)
                      set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                    }}
                    className="font-mono"
                  />
                </Field>
                <Field label="Kategori">
                  <NativeSelect value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                    <option value="" disabled>
                      Seçin
                    </option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {'  '.repeat(o.depth)}
                        {o.name}
                        {!o.isActive ? ' (pasif)' : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Önerilen fiyat">
                  <Input value={d.priceSuggested} onChange={(e) => set('priceSuggested', e.target.value)} placeholder="ör. 120 ₺" />
                </Field>
                <Field label="Kalori (kcal)">
                  <Input
                    type="number"
                    min={0}
                    value={d.calories ?? ''}
                    onChange={(e) => set('calories', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </Field>
              </div>
              <Field label="Açıklama (Türkçe)">
                <Textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={2} />
              </Field>
              <Field label="Açıklama (İngilizce)">
                <Textarea value={d.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} rows={2} />
              </Field>
              <Field label="Alerjenler">
                <div className="flex flex-wrap gap-1.5">
                  {EU_ALLERGENS.map((a) => (
                    <Chip key={a} active={d.allergens.includes(a)} onClick={() => toggleIn('allergens', a)}>
                      {a}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Etiketler">
                <div className="flex flex-wrap gap-1.5">
                  {CATALOG_TAGS.map((t) => (
                    <Chip key={t.id} active={d.tags.includes(t.id)} onClick={() => toggleIn('tags', t.id)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <label className="flex items-center justify-between rounded-2xl border border-border/60 p-3 text-sm">
                <span>
                  <span className="font-semibold">Aktif</span>
                  <span className="block text-xs text-muted-foreground">Pasif ürünler katalog aramasında ve yeni şablon uygulamalarında görünmez</span>
                </span>
                <Switch checked={d.isActive} onChange={(v) => set('isActive', v)} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
            {current ? (
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-500/10" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Sil
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy || !!imgBusy}>
                Kapat
              </Button>
              <Button onClick={save} disabled={busy || !d.name.trim() || !d.slug || !d.categoryId}>
                {busy && <Spinner className="mr-1.5" />}
                {current ? 'Kaydet' : 'Oluştur'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`"${current?.name}" silinsin mi?`}
        description="Yalnızca hiçbir restoranda ve şablonda kullanılmayan ürünler silinebilir. Kullanılan ürünleri pasifleştirin."
        confirmLabel="Sil"
        destructive
        onConfirm={async () => {
          if (!current) return
          try {
            await adminApi(`/api/admin/catalog/items/${current.id}`, { method: 'DELETE' })
            toast.success('Ürün silindi.')
            setDeleteOpen(false)
            onSaved({ ...current, isActive: false })
            onClose()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}

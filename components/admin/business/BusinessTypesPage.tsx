'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LayoutTemplate, Pencil, Plus, Star, Store, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AdminBusinessType, AdminTemplate } from '@/lib/admin-types'
import { cn } from '@/lib/utils'
import { Badge, ConfirmDialog, EmptyState, ErrorBanner, Field, LoadingBlock, NativeSelect, PageHeader, Panel, PanelTitle, Spinner, Switch } from '../shared/ui'
import { adminApi, errorMessage, slugify } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { TemplateEditorDialog } from './TemplateEditorDialog'

const UNASSIGNED = '__none__'

export function BusinessTypesPage() {
  const types = useAdminQuery<{ businessTypes: AdminBusinessType[] }>('/api/admin/business-types')
  const templates = useAdminQuery<{ templates: AdminTemplate[] }>('/api/admin/templates')
  const [selected, setSelected] = useState<string | null>(null)
  const [typeEdit, setTypeEdit] = useState<AdminBusinessType | 'new' | null>(null)
  const [tplEdit, setTplEdit] = useState<AdminTemplate | 'new' | null>(null)
  const [contentEdit, setContentEdit] = useState<AdminTemplate | null>(null)
  const [deleteType, setDeleteType] = useState<AdminBusinessType | null>(null)
  const [deleteTpl, setDeleteTpl] = useState<AdminTemplate | null>(null)

  const list = types.data?.businessTypes || []
  const allTemplates = templates.data?.templates || []

  useEffect(() => {
    if (!selected && list.length) setSelected(list[0].slug)
  }, [list, selected])

  const current = list.find((t) => t.slug === selected) || null
  const shownTemplates = useMemo(
    () =>
      allTemplates.filter((t) =>
        selected === UNASSIGNED ? !t.businessType || !list.some((b) => b.slug === t.businessType) : t.businessType === selected
      ),
    [allTemplates, selected, list]
  )
  const unassignedCount = allTemplates.filter((t) => !t.businessType || !list.some((b) => b.slug === t.businessType)).length

  const reloadAll = () => {
    types.reload()
    templates.reload()
  }

  const setDefault = async (tpl: AdminTemplate) => {
    if (!current) return
    try {
      await adminApi(`/api/admin/business-types/${current.slug}`, { method: 'PATCH', body: { defaultTemplateSlug: tpl.slug } })
      toast.success(`"${tpl.name}" varsayılan şablon yapıldı.`)
      types.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="İşletme Türleri & Şablonlar"
        description="Kayıt ve kurulum sihirbazında görünen işletme türleri ve her türün hazır menü şablonları"
        actions={
          <>
            <Button variant="outline" onClick={() => setTplEdit('new')}>
              <LayoutTemplate className="mr-1.5 h-4 w-4" /> Yeni şablon
            </Button>
            <Button onClick={() => setTypeEdit('new')}>
              <Plus className="mr-1.5 h-4 w-4" /> Yeni işletme türü
            </Button>
          </>
        }
      />

      {(types.error || templates.error) && <ErrorBanner message={types.error || templates.error || ''} onRetry={reloadAll} />}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel className="p-2 sm:p-2">
          {types.loading && !types.data ? (
            <LoadingBlock />
          ) : (
            <ul className="space-y-1">
              {list.map((t) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.slug)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      selected === t.slug ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                      !t.isActive && 'opacity-55'
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: `${t.color}22` }}>
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t.label}</span>
                      <span className={cn('block text-[11px]', selected === t.slug ? 'opacity-80' : 'text-muted-foreground')}>
                        {allTemplates.filter((x) => x.businessType === t.slug).length} şablon · {t.orgCount} restoran
                      </span>
                    </span>
                    {!t.isActive && <Badge tone="neutral">Pasif</Badge>}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setSelected(UNASSIGNED)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    selected === UNASSIGNED ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <LayoutTemplate className="h-4 w-4" /> Türü atanmamış şablonlar ({unassignedCount})
                </button>
              </li>
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          {current && selected !== UNASSIGNED && (
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: `${current.color}22` }}>
                    {current.icon}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">{current.label}</h2>
                    <p className="text-sm text-muted-foreground">{current.hint}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{current.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setTypeEdit(current)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteType(current)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {current.coverImage && <img src={current.coverImage} alt="" className="mt-4 h-28 w-full rounded-2xl object-cover" />}
            </Panel>
          )}

          <Panel>
            <PanelTitle
              actions={
                <Button size="sm" variant="outline" onClick={() => setTplEdit('new')}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Şablon
                </Button>
              }
            >
              Şablonlar
            </PanelTitle>
            {templates.loading && !templates.data ? (
              <LoadingBlock />
            ) : !shownTemplates.length ? (
              <EmptyState icon={Store} title="Bu türde şablon yok" hint="Yeni şablon oluşturup katalogdan kategori ve ürün seçin." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shownTemplates.map((t) => {
                  const isDefault = current?.defaultTemplateSlug === t.slug
                  return (
                    <div key={t.id} className={cn('rounded-2xl border border-border/60 p-4', !t.isActive && 'opacity-60')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {t.icon} {t.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{t.tagline}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{t.slug}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isDefault && (
                            <Badge tone="blue">
                              <Star className="h-3 w-3" /> Varsayılan
                            </Badge>
                          )}
                          {!t.isActive && <Badge tone="neutral">Pasif</Badge>}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t.categoryCount} kategori · {t.itemCount} ürün
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button size="sm" onClick={() => setContentEdit(t)}>
                          İçerik
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setTplEdit(t)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Bilgiler
                        </Button>
                        {current && selected !== UNASSIGNED && !isDefault && (
                          <Button size="sm" variant="outline" onClick={() => setDefault(t)}>
                            <Star className="mr-1 h-3.5 w-3.5" /> Varsayılan yap
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteTpl(t)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {typeEdit && (
        <BusinessTypeDialog
          value={typeEdit === 'new' ? null : typeEdit}
          templates={allTemplates}
          onClose={() => setTypeEdit(null)}
          onSaved={(slug) => {
            types.reload()
            setSelected(slug)
          }}
        />
      )}
      {tplEdit && (
        <TemplateInfoDialog
          value={tplEdit === 'new' ? null : tplEdit}
          businessTypes={list}
          defaultBusinessType={selected && selected !== UNASSIGNED ? selected : ''}
          onClose={() => setTplEdit(null)}
          onSaved={(tpl, created) => {
            templates.reload()
            if (created) setContentEdit(tpl)
          }}
        />
      )}
      {contentEdit && <TemplateEditorDialog template={contentEdit} onClose={() => setContentEdit(null)} onSaved={templates.reload} />}

      <ConfirmDialog
        open={!!deleteType}
        onOpenChange={(v) => !v && setDeleteType(null)}
        title={`"${deleteType?.label}" silinsin mi?`}
        description="Bu türü kullanan restoran varsa silinemez; pasifleştirin. Türün şablonları silinmez, türü atanmamış olarak kalır."
        confirmLabel="Sil"
        destructive
        onConfirm={async () => {
          if (!deleteType) return
          try {
            await adminApi(`/api/admin/business-types/${deleteType.slug}`, { method: 'DELETE' })
            toast.success('İşletme türü silindi.')
            setDeleteType(null)
            setSelected(null)
            types.reload()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
      <ConfirmDialog
        open={!!deleteTpl}
        onOpenChange={(v) => !v && setDeleteTpl(null)}
        title={`"${deleteTpl?.name}" şablonu silinsin mi?`}
        description="Restoranlara daha önce kopyalanmış menüler etkilenmez. Yeni restoranlar bu şablonu seçemez."
        confirmLabel="Sil"
        destructive
        typeToConfirm={deleteTpl?.slug}
        onConfirm={async () => {
          if (!deleteTpl) return
          try {
            await adminApi(`/api/admin/templates/${deleteTpl.id}`, { method: 'DELETE' })
            toast.success('Şablon silindi.')
            setDeleteTpl(null)
            reloadAll()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </>
  )
}

function BusinessTypeDialog({
  value,
  templates,
  onClose,
  onSaved,
}: {
  value: AdminBusinessType | null
  templates: AdminTemplate[]
  onClose: () => void
  onSaved: (slug: string) => void
}) {
  const [f, setF] = useState({
    slug: value?.slug || '',
    label: value?.label || '',
    icon: value?.icon || '',
    hint: value?.hint || '',
    color: value?.color || '#e11d48',
    coverImage: value?.coverImage || '',
    defaultTemplateSlug: value?.defaultTemplateSlug || '',
    isActive: value?.isActive ?? true,
  })
  const [busy, setBusy] = useState(false)
  const own = templates.filter((t) => !value || t.businessType === value.slug)

  const save = async () => {
    setBusy(true)
    try {
      const body = { ...f, defaultTemplateSlug: f.defaultTemplateSlug || null }
      if (value) {
        const { slug: _slug, ...rest } = body
        await adminApi(`/api/admin/business-types/${value.slug}`, { method: 'PATCH', body: rest })
      } else {
        await adminApi('/api/admin/business-types', { method: 'POST', body })
      }
      toast.success('İşletme türü kaydedildi.')
      onSaved(f.slug)
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
          <DialogTitle>{value ? 'İşletme türünü düzenle' : 'Yeni işletme türü'}</DialogTitle>
          <DialogDescription>Kayıt ve kurulum sihirbazında restoran sahiplerine gösterilir.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <Field label="Emoji">
            <Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} className="text-center text-lg" maxLength={8} />
          </Field>
          <Field label="Ad">
            <Input
              value={f.label}
              onChange={(e) => setF({ ...f, label: e.target.value, slug: value ? f.slug : slugify(e.target.value).slice(0, 40) })}
              autoFocus
            />
          </Field>
        </div>
        <Field label="Kısa ad (slug)" hint={value ? 'Değiştirilemez (restoran kayıtları buna bağlı)' : 'Küçük harf, rakam ve tire'}>
          <Input value={f.slug} disabled={!!value} onChange={(e) => setF({ ...f, slug: slugify(e.target.value).slice(0, 40) })} className="font-mono" />
        </Field>
        <Field label="Açıklama">
          <Input value={f.hint} onChange={(e) => setF({ ...f, hint: e.target.value })} placeholder="ör. Kahvaltı, kahve, tatlı" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Renk" group>
            <div className="flex gap-2">
              <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-12 rounded-lg border border-input" />
              <Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="font-mono" />
            </div>
          </Field>
          <Field label="Varsayılan şablon">
            <NativeSelect value={f.defaultTemplateSlug} onChange={(e) => setF({ ...f, defaultTemplateSlug: e.target.value })}>
              <option value="">Yok</option>
              {own.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Kapak görseli URL">
          <Input value={f.coverImage} onChange={(e) => setF({ ...f, coverImage: e.target.value })} placeholder="https://…" />
        </Field>
        <label className="flex items-center justify-between text-sm">
          <span className="font-semibold">Aktif (listelerde görünsün)</span>
          <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={busy || f.label.trim().length < 2 || f.slug.length < 2}>
            {busy && <Spinner className="mr-1.5" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TemplateInfoDialog({
  value,
  businessTypes,
  defaultBusinessType,
  onClose,
  onSaved,
}: {
  value: AdminTemplate | null
  businessTypes: AdminBusinessType[]
  defaultBusinessType: string
  onClose: () => void
  onSaved: (tpl: AdminTemplate, created: boolean) => void
}) {
  const [f, setF] = useState({
    slug: value?.slug || '',
    businessType: value?.businessType || defaultBusinessType,
    name: value?.name || '',
    tagline: value?.tagline || '',
    venueType: value?.venueType || '',
    icon: value?.icon || '',
    color: value?.color || '#e11d48',
    coverImage: value?.coverImage || '',
    description: value?.description || '',
    isActive: value?.isActive ?? true,
  })
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const body = { ...f, businessType: f.businessType || null }
      let tpl: AdminTemplate
      if (value) {
        const { slug: _slug, ...rest } = body
        tpl = (await adminApi<{ template: AdminTemplate }>(`/api/admin/templates/${value.id}`, { method: 'PATCH', body: rest })).template
      } else {
        tpl = (await adminApi<{ template: AdminTemplate }>('/api/admin/templates', { method: 'POST', body })).template
      }
      toast.success(value ? 'Şablon güncellendi.' : 'Şablon oluşturuldu. Şimdi içeriğini seçin.')
      onSaved(tpl, !value)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{value ? 'Şablon bilgileri' : 'Yeni şablon'}</DialogTitle>
          <DialogDescription>Menü adı uygulandığında &quot;{f.venueType || f.name || 'Şablon'} Menüsü&quot; olur.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <Field label="Emoji">
            <Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} className="text-center text-lg" maxLength={8} />
          </Field>
          <Field label="Ad">
            <Input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value, slug: value ? f.slug : slugify(e.target.value) })}
              autoFocus
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Slug" hint={value ? 'Değiştirilemez' : undefined}>
            <Input value={f.slug} disabled={!!value} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} className="font-mono" />
          </Field>
          <Field label="İşletme türü">
            <NativeSelect value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })}>
              <option value="">Atanmamış</option>
              {businessTypes.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.icon} {b.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Mekan türü (menü adında)">
            <Input value={f.venueType} onChange={(e) => setF({ ...f, venueType: e.target.value })} placeholder="ör. Kafe" />
          </Field>
          <Field label="Renk" group>
            <div className="flex gap-2">
              <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-12 rounded-lg border border-input" />
              <Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="font-mono" />
            </div>
          </Field>
        </div>
        <Field label="Kısa tanım (menü açıklaması olur)">
          <Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
        </Field>
        <Field label="Açıklama">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} />
        </Field>
        <Field label="Kapak görseli URL (menü görseli olur)">
          <Input value={f.coverImage} onChange={(e) => setF({ ...f, coverImage: e.target.value })} placeholder="https://…" />
        </Field>
        <label className="flex items-center justify-between text-sm">
          <span className="font-semibold">Aktif (restoranlar seçebilsin)</span>
          <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={busy || f.name.trim().length < 2 || !f.slug}>
            {busy && <Spinner className="mr-1.5" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

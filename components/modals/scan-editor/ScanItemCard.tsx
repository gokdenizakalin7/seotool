'use client'

import React, { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, Check, Flame, GripVertical, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input as BaseInput, type InputProps } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { compressImageFile, IMAGE_PRESETS } from '@/lib/image-compression'
import { catalogThumbUrl, isCatalogImage } from '@/lib/image-url'
import { generateItemImage } from '@/lib/image-generation-client'
import type { CatalogMatch } from '@/lib/catalog-match'
import { ChipAllergenInput } from './ChipAllergenInput'
import { CatalogPickerPopover } from './CatalogPickerPopover'
import type { EditorAction } from './useScanEditorState'
import type { EditorItem, ItemIssue } from './types'

/** Yüzlerce alanda kaydırmayı ağırlaştırdığı için backdrop-blur kapatılır */
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <BaseInput ref={ref} className={cn('backdrop-blur-none', className)} {...props} />
))
Input.displayName = 'Input'

function ImageUpload({
  value,
  onChange,
  badge,
  onGenerate,
  generating,
}: {
  value?: string
  onChange: (v: string) => void
  badge?: string
  onGenerate?: () => void
  generating?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    setLoading(true)
    try {
      const c = await compressImageFile(file, IMAGE_PRESETS.PRODUCT)
      onChange(c.dataUrl)
    } catch (err) {
      console.error('Görsel yüklenemedi:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative h-24 w-24">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {value ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              title="Görseli değiştir"
              className="h-full w-full overflow-hidden rounded-xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={catalogThumbUrl(value)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
            {badge && (
              <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                {badge}
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange('')}
              title="Görseli kaldır"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={generating}
            className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-60"
          >
            {loading || generating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-medium">Görsel yükle</span>
              </>
            )}
          </button>
        )}
      </div>
      {!value && onGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          title="Yapay zeka ile ürün görseli üret (günlük ücretsiz kota)"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 hover:bg-violet-500/10 disabled:opacity-60"
        >
          <Sparkles className="h-3 w-3" /> AI görsel
        </button>
      )}
    </div>
  )
}

interface Props {
  item: EditorItem
  catId: string
  /** Kategori adı: AI görsel prompt'u için ipucu */
  catName?: string
  /** İşletme subdomain'i; yoksa "AI görsel" butonu gösterilmez */
  subdomain?: string
  selected: boolean
  issues?: ItemIssue[]
  onToggleSelect: (id: string) => void
  dispatch: (action: EditorAction, key?: string | null) => void
}

export const ScanItemCard = React.memo(function ScanItemCard({
  item,
  catId,
  catName,
  subdomain,
  selected,
  issues,
  onToggleSelect,
  dispatch,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', catId },
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  const update = (patch: Partial<EditorItem>, field: string) =>
    dispatch({ type: 'UPDATE_ITEM', itemId: item.id, patch }, `${item.id}:${field}`)

  const noName = issues?.includes('noName')
  const noPrice = issues?.includes('noPrice')
  const dup = issues?.includes('duplicate')

  /* ── Katalog eşleşmesi ── */
  const match = item.match
  const linked = !!item.catalog_item_id
  const linkedName = linked && match?.top && match.top.item_id === item.catalog_item_id ? match.top.name : null
  const suggestion = !linked && match?.level === 'suggest' && match.top ? match.top : null
  const usingCatalogImage = isCatalogImage(item.image_url)

  /** Sahibin yüklediği fotoğraf (data:) asla ezilmez; katalog görseli yalnızca boşsa/katalogsa gelir */
  const applyMatch = (m: CatalogMatch) =>
    update(
      {
        catalog_item_id: m.item_id,
        image_url: item.image_url && item.image_url.startsWith('data:') ? item.image_url : m.image_url || item.image_url || '',
        match: { level: 'confirmed', top: m, candidates: match?.candidates || [] },
      },
      'catalog'
    )

  const clearMatch = () =>
    update(
      {
        catalog_item_id: null,
        image_url: usingCatalogImage ? '' : item.image_url,
        match: match ? { ...match, level: 'none', top: undefined } : undefined,
      },
      'catalog'
    )

  const ignoreSuggestion = () => update({ match: match ? { ...match, level: 'none', top: undefined } : undefined }, 'catalog')

  const handleGenerate = async () => {
    if (!subdomain || !item.name.trim()) return
    setGenerating(true)
    try {
      const r = await generateItemImage({ subdomain, name: item.name.trim(), description: item.description, category: catName })
      update({ image_url: r.url }, 'image')
      toast.success('AI görsel eklendi', { description: `Bugün kalan: ${Math.min(r.orgRemaining, r.globalRemaining)}` })
    } catch (e: any) {
      toast.error(e?.message || 'Görsel üretilemedi')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-item={item.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative flex flex-col gap-3 bg-card p-3 sm:flex-row sm:items-start sm:p-4',
        selected && 'bg-primary/5',
        isDragging && 'z-20 rounded-xl shadow-2xl ring-1 ring-primary/40'
      )}
    >
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:pt-1">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          title="Sürükleyerek sırala veya başka kategoriye taşı"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
          aria-label="Ürünü seç"
          className="h-4 w-4 cursor-pointer accent-violet-600"
        />
      </div>

      <ImageUpload
        value={item.image_url}
        onChange={(v) => update({ image_url: v }, 'image')}
        badge={usingCatalogImage ? 'Katalog' : undefined}
        onGenerate={subdomain && item.name.trim() ? handleGenerate : undefined}
        generating={generating}
      />

      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={item.name}
          onChange={(e) => update({ name: e.target.value }, 'name')}
          placeholder="Ürün adı"
          className={cn('h-9 font-semibold', (noName || dup) && 'border-destructive/70')}
        />
        <Textarea
          value={item.description || ''}
          onChange={(e) => update({ description: e.target.value }, 'desc')}
          placeholder="Açıklama (opsiyonel)"
          rows={2}
          className="min-h-[56px] resize-none rounded-xl text-sm backdrop-blur-none"
        />
        {(noName || dup) && (
          <p className="text-[11px] font-medium text-destructive">
            {noName ? 'Ürün adı boş.' : 'Bu kategoride aynı isimde başka bir ürün var.'}
          </p>
        )}

        {/* Katalog durumu: bağlı / öneri / seç */}
        <div className="relative flex flex-wrap items-center gap-1.5 text-[11px]">
          {linked ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <BookOpen className="h-3 w-3" /> Katalog: {linkedName || 'bağlı ürün'}
              </span>
              <button type="button" onClick={() => setPickerOpen(true)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Değiştir
              </button>
              <button type="button" onClick={clearMatch} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Kaldır
              </button>
            </>
          ) : suggestion ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" /> Önerilen: {suggestion.name}
                <span className="font-normal opacity-70">%{Math.round(suggestion.score * 100)}</span>
              </span>
              <button
                type="button"
                onClick={() => applyMatch(suggestion)}
                className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary hover:bg-primary/20"
              >
                <Check className="h-3 w-3" /> Kabul
              </button>
              <button type="button" onClick={() => setPickerOpen(true)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Değiştir
              </button>
              <button type="button" onClick={ignoreSuggestion} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Yok say
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:border-primary hover:text-primary"
            >
              <BookOpen className="h-3 w-3" /> Katalogdan seç
            </button>
          )}
          <CatalogPickerPopover
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(m) => {
              applyMatch(m)
              setPickerOpen(false)
            }}
            initialQuery={pickerOpen && !match?.candidates?.length ? item.name : ''}
            suggestions={match?.candidates}
          />
        </div>
      </div>

      <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-64">
        <div>
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Fiyat</span>
          <Input
            value={item.price}
            onChange={(e) => update({ price: e.target.value }, 'price')}
            placeholder="Örn: 50 ₺"
            className={cn('h-9 font-bold', noPrice && 'border-destructive/70')}
          />
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Kalori (kcal)</span>
          <div className="relative">
            <Flame className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-orange-500" />
            <Input
              type="number"
              min={0}
              value={item.calories ?? ''}
              onChange={(e) =>
                update({ calories: e.target.value === '' ? undefined : Number(e.target.value) }, 'cal')
              }
              placeholder="kcal"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="col-span-2">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Alerjenler</span>
          <ChipAllergenInput
            allergens={item.allergens || []}
            onChange={(allergens) => dispatch({ type: 'UPDATE_ITEM', itemId: item.id, patch: { allergens } })}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'DELETE_ITEMS', itemIds: [item.id] })}
        title="Ürünü sil"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:static sm:self-start"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
})

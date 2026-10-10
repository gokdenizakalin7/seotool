'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Plus,
  Redo2,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input as BaseInput, type InputProps } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ScanItemCard } from './scan-editor/ScanItemCard'
import {
  BulkActionBar,
  PhotoViewer,
  ScanSummaryPanel,
  type ScanPhoto,
  type SummaryStats,
} from './scan-editor/panels'
import { useCalorieEstimate } from './scan-editor/useCalorieEstimate'
import { useImageGenerate } from './scan-editor/useImageGenerate'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { authFetch } from '@/lib/api-client'
import { normalizeDishName } from '@/lib/catalog-match'
import {
  uid,
  useScanEditorState,
  type EditorAction,
} from './scan-editor/useScanEditorState'
import type {
  EditorCategory,
  EditorItem,
  EditorState,
  ItemIssue,
  ParsedCategory,
} from './scan-editor/types'

export type { ParsedCategory, ParsedItem } from './scan-editor/types'
export type { ScanPhoto } from './scan-editor/panels'

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <BaseInput ref={ref} className={cn('backdrop-blur-none', className)} {...props} />
))
Input.displayName = 'Input'

const DRAFT_KEY = 'scan_editor_draft_v1'

type FilterKey = 'noPrice' | 'noCalories' | 'noImage' | 'noAllergens' | 'suggested' | 'noCatalog'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'noPrice', label: 'Fiyatı eksik' },
  { key: 'noCalories', label: 'Kalorisi eksik' },
  { key: 'noImage', label: 'Görselsiz' },
  { key: 'noAllergens', label: 'Alerjensiz' },
  { key: 'suggested', label: 'Öneri var' },
  { key: 'noCatalog', label: 'Katalogda yok' },
]

const isSuggested = (item: EditorItem) => !item.catalog_item_id && item.match?.level === 'suggest' && !!item.match.top

function matchesFilter(item: EditorItem, key: FilterKey) {
  switch (key) {
    case 'noPrice':
      return !item.price.trim()
    case 'noCalories':
      return !item.calories
    case 'noImage':
      return !item.image_url
    case 'noAllergens':
      return !item.allergens || item.allergens.length === 0
    case 'suggested':
      return isSuggested(item)
    case 'noCatalog':
      return !item.catalog_item_id && !isSuggested(item)
  }
}

/** Fiyat metnindeki ilk sayıya yüzde uygular, para birimi/biçimi korunur */
function applyPercent(price: string, pct: number): string | null {
  const m = price.match(/\d+(?:[.,]\d+)?/)
  if (!m) return null
  const raw = m[0]
  const n = parseFloat(raw.replace(',', '.'))
  const v = Math.max(0, Math.round(n * (1 + pct / 100) * 100) / 100)
  let s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')
  if (raw.includes(',')) s = s.replace('.', ',')
  return price.replace(raw, s)
}

const collisionDetection: CollisionDetection = (args) => {
  const type = args.active.data.current?.type
  const containers = args.droppableContainers.filter((c) => {
    const t = c.data.current?.type
    return type === 'cat' ? t === 'cat' : t === 'item' || t === 'cat-drop'
  })
  const a = { ...args, droppableContainers: containers }
  const hits = pointerWithin(a)
  return hits.length ? hits : closestCenter(a)
}

interface ScanResultsEditorProps {
  initialMenuName: string
  initialCategories: ParsedCategory[]
  photos: ScanPhoto[]
  onBack: () => void
  onCancel: () => void
  onCreate: (menuName: string, categories: ParsedCategory[]) => void
  isCreating?: boolean
}

/* ───────────── Kategori bölümü ───────────── */

interface CategorySectionProps {
  cat: EditorCategory
  index: number
  items: EditorItem[]
  collapsed: boolean
  selection: Set<string>
  issues: Map<string, ItemIssue[]>
  dispatch: (action: EditorAction, key?: string | null) => void
  onToggleCollapse: (catId: string) => void
  onToggleSelect: (itemId: string) => void
  onToggleSelectCat: (catId: string, select: boolean) => void
  /** İşletme subdomain'i (AI görsel üretimi için); yoksa buton gizlenir */
  subdomain?: string
}

const CategorySection = React.memo(function CategorySection({
  cat,
  index,
  items,
  collapsed,
  selection,
  issues,
  dispatch,
  onToggleCollapse,
  onToggleSelect,
  onToggleSelectCat,
  subdomain,
}: CategorySectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat:${cat.id}`,
    data: { type: 'cat', catId: cat.id },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${cat.id}`,
    data: { type: 'cat-drop', catId: cat.id },
  })

  const issueCount = cat.items.reduce((n, i) => n + (issues.has(i.id) ? 1 : 0), 0)
  const allSelected = items.length > 0 && items.every((i) => selection.has(i.id))
  const itemIds = useMemo(() => items.map((i) => i.id), [items])

  return (
    <section
      ref={setNodeRef}
      data-cat={cat.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'scroll-mt-2 rounded-2xl border border-border bg-card shadow-sm',
        isDragging && 'z-30 opacity-80 shadow-2xl ring-1 ring-primary/40'
      )}
    >
      <div
        className={cn(
          'sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-muted px-3 py-2.5',
          collapsed ? 'rounded-2xl border-b-0' : 'rounded-t-2xl'
        )}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-background active:cursor-grabbing"
          title="Kategoriyi sürükleyerek sırala"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggleCollapse(cat.id)}
          className="rounded p-1 text-muted-foreground hover:bg-background"
          title={collapsed ? 'Genişlet' : 'Daralt'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onToggleSelectCat(cat.id, e.target.checked)}
          aria-label="Kategorideki tüm ürünleri seç"
          className="h-4 w-4 cursor-pointer accent-violet-600"
        />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </span>
        <Input
          value={cat.name}
          onChange={(e) =>
            dispatch({ type: 'SET_CAT_NAME', catId: cat.id, name: e.target.value }, `cat:${cat.id}`)
          }
          className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-base font-bold shadow-none focus-visible:ring-1"
          placeholder="Kategori adı"
        />
        {issueCount > 0 && (
          <span className="hidden items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive sm:inline-flex">
            <AlertTriangle className="h-3 w-3" /> {issueCount}
          </span>
        )}
        <span className="whitespace-nowrap text-xs text-muted-foreground">{cat.items.length} ürün</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => dispatch({ type: 'DELETE_CAT', catId: cat.id })}
          title="Kategoriyi sil"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {!collapsed && (
        <div ref={setDropRef} className={cn('rounded-b-2xl transition-colors', isOver && 'bg-primary/5')}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <ScanItemCard
                  key={item.id}
                  item={item}
                  catId={cat.id}
                  catName={cat.name}
                  subdomain={subdomain}
                  selected={selection.has(item.id)}
                  issues={issues.get(item.id)}
                  onToggleSelect={onToggleSelect}
                  dispatch={dispatch}
                />
              ))}
            </div>
          </SortableContext>
          {items.length === 0 && (
            <p className="px-4 py-4 text-sm italic text-muted-foreground">
              {cat.items.length === 0 ? 'Bu kategoride ürün yok' : 'Filtreye uyan ürün yok'}
            </p>
          )}
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-primary"
              onClick={() => dispatch({ type: 'ADD_ITEM', catId: cat.id, itemId: uid('i') })}
            >
              <Plus className="h-4 w-4" /> Ürün ekle
            </Button>
          </div>
        </div>
      )}
    </section>
  )
})

/* ───────────── Ana editör ───────────── */

export function ScanResultsEditor({
  initialMenuName,
  initialCategories,
  photos,
  onBack,
  onCancel,
  onCreate,
  isCreating,
}: ScanResultsEditorProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo, isDirty, issues } = useScanEditorState(
    initialMenuName,
    initialCategories
  )
  const calorie = useCalorieEstimate()
  const { restaurant } = useRestaurant()
  const subdomain = restaurant?.subdomain || ''
  const imageGen = useImageGenerate(subdomain)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [draftOffer, setDraftOffer] = useState<EditorState | null>(null)
  const issueCursor = useRef(0)

  /* Silme işlemlerinde "Geri al" bildirimi */
  const dispatchUI = useCallback(
    (action: EditorAction, key: string | null = null) => {
      dispatch(action, key)
      if (action.type === 'DELETE_ITEMS' || action.type === 'DELETE_CAT') {
        toast('Silindi', { action: { label: 'Geri al', onClick: undo }, duration: 5000 })
      }
    },
    [dispatch, undo]
  )

  /* Klavye kısayolları (alan dışındayken) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  /* Taslak: açılışta kontrol */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as EditorState
      if (draft?.categories?.some((c) => c.items.length > 0)) setDraftOffer(draft)
    } catch {
      /* yoksay */
    }
  }, [])

  /* Taslak: değişiklikte kaydet (görseller kota nedeniyle hariç) */
  useEffect(() => {
    if (!isDirty) return
    const t = setTimeout(() => {
      try {
        const slim: EditorState = {
          menuName: state.menuName,
          categories: state.categories.map((c) => ({
            ...c,
            items: c.items.map((i) => ({
              ...i,
              image_url: i.image_url?.startsWith('data:') ? '' : i.image_url,
            })),
          })),
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(slim))
      } catch {
        /* kota dolu */
      }
    }, 800)
    return () => clearTimeout(t)
  }, [state, isDirty])

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* yoksay */
    }
  }

  /* Türetilmiş değerler */
  const q = search.trim().toLocaleLowerCase('tr-TR')
  const isFiltering = q.length > 0 || filters.size > 0

  const visible = useMemo(() => {
    return state.categories.map((cat) => {
      if (!isFiltering) return { cat, items: cat.items }
      const items = cat.items.filter((it) => {
        if (q && !`${it.name} ${it.description || ''}`.toLocaleLowerCase('tr-TR').includes(q)) return false
        for (const f of filters) if (!matchesFilter(it, f)) return false
        return true
      })
      return { cat, items }
    })
  }, [state.categories, q, filters, isFiltering])

  const stats: SummaryStats = useMemo(() => {
    let items = 0,
      noName = 0,
      noPrice = 0,
      duplicate = 0,
      noCalories = 0,
      noImage = 0,
      complete = 0,
      catalogMatched = 0,
      catalogSuggested = 0,
      catalogNone = 0
    for (const c of state.categories)
      for (const it of c.items) {
        items++
        const is = issues.get(it.id)
        if (is?.includes('noName')) noName++
        if (is?.includes('noPrice')) noPrice++
        if (is?.includes('duplicate')) duplicate++
        if (!it.calories) noCalories++
        if (!it.image_url) noImage++
        if (it.name.trim() && it.price.trim()) complete++
        if (it.catalog_item_id) catalogMatched++
        else if (isSuggested(it)) catalogSuggested++
        else if (it.name.trim()) catalogNone++
      }
    return {
      categories: state.categories.length,
      items,
      noName,
      noPrice,
      duplicate,
      noCalories,
      noImage,
      complete,
      catalogMatched,
      catalogSuggested,
      catalogNone,
    }
  }, [state.categories, issues])

  /* Katalog önerileri: toplu kabul (tek undo adımı) */
  const suggestionTargets = useMemo(
    () => state.categories.flatMap((c) => c.items.filter(isSuggested)),
    [state.categories]
  )
  const acceptAllSuggestions = () => {
    if (suggestionTargets.length === 0) return
    const patches: Record<string, Partial<EditorItem>> = {}
    for (const it of suggestionTargets) {
      const top = it.match!.top!
      patches[it.id] = {
        catalog_item_id: top.item_id,
        image_url: it.image_url && it.image_url.startsWith('data:') ? it.image_url : top.image_url || it.image_url || '',
        match: { level: 'confirmed', top, candidates: it.match?.candidates || [] },
      }
    }
    dispatch({ type: 'UPDATE_ITEMS', patches })
    toast.success(`${suggestionTargets.length} öneri kabul edildi`, { action: { label: 'Geri al', onClick: undo }, duration: 5000 })
  }

  /* Görselsiz ürünler için AI üretimi (kota dolunca durur) */
  const imageTargets = useMemo(
    () =>
      state.categories.flatMap((c) =>
        c.items
          .filter((it) => !it.image_url && it.name.trim())
          .map((it) => ({ id: it.id, name: it.name.trim(), description: it.description, category: c.name }))
      ),
    [state.categories]
  )
  const generateMissingImages = async () => {
    if (imageTargets.length === 0 || !subdomain) return
    if (!window.confirm(`${imageTargets.length} görselsiz ürün için yapay zeka görseli üretilsin mi? Günlük ücretsiz kota dolunca durur.`)) return
    const r = await imageGen.run(imageTargets, (id, url) => dispatch({ type: 'UPDATE_ITEM', itemId: id, patch: { image_url: url } }, `${id}:image`))
    if (r.ok > 0) toast.success(`${r.ok} ürüne AI görsel eklendi`)
    if (r.stoppedReason) toast.warning(r.stoppedReason)
    else if (r.failed > 0) toast.error(`${r.failed} ürün için görsel üretilemedi`)
  }

  const issueIds = useMemo(() => {
    const ids: string[] = []
    for (const c of state.categories) for (const it of c.items) if (issues.has(it.id)) ids.push(it.id)
    return ids
  }, [state.categories, issues])

  const existingIds = useMemo(() => {
    const s = new Set<string>()
    state.categories.forEach((c) => c.items.forEach((i) => s.add(i.id)))
    return s
  }, [state.categories])
  const selectedIds = useMemo(() => [...selection].filter((id) => existingIds.has(id)), [selection, existingIds])

  /* Gezinme */
  const scrollToEl = (selector: string, block: ScrollLogicalPosition) => {
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(selector)
      el?.scrollIntoView({ behavior: 'smooth', block })
      return el
    }, 60)
  }

  const scrollToCategory = (catId: string) => {
    setCollapsed((prev) => {
      if (!prev.has(catId)) return prev
      const n = new Set(prev)
      n.delete(catId)
      return n
    })
    scrollToEl(`[data-cat="${catId}"]`, 'start')
  }

  const goToNextIssue = () => {
    if (issueIds.length === 0) return
    const id = issueIds[issueCursor.current % issueIds.length]
    issueCursor.current++
    const cat = state.categories.find((c) => c.items.some((i) => i.id === id))
    if (cat) {
      setCollapsed((prev) => {
        if (!prev.has(cat.id)) return prev
        const n = new Set(prev)
        n.delete(cat.id)
        return n
      })
    }
    setSearch('')
    setFilters(new Set())
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-item="${id}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-destructive', 'rounded-xl')
      setTimeout(() => el.classList.remove('ring-2', 'ring-destructive', 'rounded-xl'), 1600)
    }, 120)
  }

  const scrollRaf = useRef(0)
  const onScroll = () => {
    cancelAnimationFrame(scrollRaf.current)
    scrollRaf.current = requestAnimationFrame(() => {
      const root = scrollRef.current
      if (!root) return
      const top = root.getBoundingClientRect().top + 80
      let current: string | null = null
      root.querySelectorAll<HTMLElement>('[data-cat]').forEach((el) => {
        if (el.getBoundingClientRect().top <= top) current = el.dataset.cat || null
      })
      setActiveCat((p) => (p === current ? p : current))
    })
  }

  /* Seçim */
  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const toggleSelectCat = useCallback(
    (catId: string, select: boolean) => {
      const entry = visible.find((v) => v.cat.id === catId)
      if (!entry) return
      setSelection((prev) => {
        const n = new Set(prev)
        entry.items.forEach((i) => (select ? n.add(i.id) : n.delete(i.id)))
        return n
      })
    },
    [visible]
  )

  const toggleCollapse = useCallback((catId: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev)
      if (n.has(catId)) n.delete(catId)
      else n.add(catId)
      return n
    })
  }, [])

  /* Toplu işlemler */
  const bulkPrice = (pct: number) => {
    const patches: Record<string, { price: string }> = {}
    state.categories.forEach((c) =>
      c.items.forEach((i) => {
        if (!selectedIds.includes(i.id)) return
        const next = applyPercent(i.price, pct)
        if (next !== null) patches[i.id] = { price: next }
      })
    )
    const n = Object.keys(patches).length
    if (n === 0) {
      toast.error('Seçili ürünlerde sayısal fiyat bulunamadı')
      return
    }
    dispatch({ type: 'UPDATE_ITEMS', patches })
    toast.success(`${n} ürünün fiyatı %${pct > 0 ? '+' : ''}${pct} güncellendi`)
  }

  const bulkAllergen = (allergen: string) => {
    const patches: Record<string, { allergens: string[] }> = {}
    state.categories.forEach((c) =>
      c.items.forEach((i) => {
        if (!selectedIds.includes(i.id)) return
        const cur = i.allergens || []
        if (cur.some((a) => a.toLocaleLowerCase('tr-TR') === allergen.toLocaleLowerCase('tr-TR'))) return
        patches[i.id] = { allergens: [...cur, allergen] }
      })
    )
    if (Object.keys(patches).length) dispatch({ type: 'UPDATE_ITEMS', patches })
  }

  /* AI kalori doldurma */
  const calorieTargets = useMemo(() => {
    const t: { id: string; name: string; category: string }[] = []
    state.categories.forEach((c) =>
      c.items.forEach((i) => {
        if (!i.calories && i.name.trim().length >= 2) t.push({ id: i.id, name: i.name, category: c.name })
      })
    )
    return t
  }, [state.categories])

  const fillCalories = async () => {
    const { ok, failed } = await calorie.run(calorieTargets, (id, calories) =>
      dispatch({ type: 'UPDATE_ITEM', itemId: id, patch: { calories } }, 'ai-cal')
    )
    if (ok) toast.success(`${ok} ürünün kalorisi dolduruldu`)
    if (failed) toast.error(`${failed} ürün için kalori hesaplanamadı (günlük kota veya hata)`)
  }

  /* Sürükle-bırak */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const at = active.data.current?.type
    const od = over.data.current
    if (at === 'cat') {
      const catId = active.data.current?.catId as string
      const overCatId = od?.catId as string | undefined
      if (overCatId && overCatId !== catId) dispatch({ type: 'REORDER_CAT', catId, overCatId })
    } else if (at === 'item') {
      if (!od?.catId || active.id === over.id) return
      dispatch({
        type: 'MOVE_ITEM',
        itemId: String(active.id),
        toCatId: od.catId as string,
        overItemId: od.type === 'item' ? String(over.id) : null,
      })
    }
  }

  /* Çıkışlar */
  const handleCancel = () => {
    if (isDirty && !window.confirm('Yaptığınız değişiklikler silinecek. Vazgeçmek istiyor musunuz?')) return
    clearDraft()
    onCancel()
  }

  const canCreate = state.categories.some((c) => c.items.some((i) => i.name.trim()))

  const handleCreate = () => {
    const problems = stats.noName + stats.noPrice + stats.duplicate
    if (problems > 0) {
      const msg =
        `${problems} sorun bulundu` +
        (stats.noName ? ` (adı boş ${stats.noName} ürün menüye eklenmeyecek)` : '') +
        '. Yine de menüyü oluşturmak istiyor musunuz?'
      if (!window.confirm(msg)) return
    }
    // Onaylanan katalog eşleşmeleri: menüdeki farklı yazımı takma ad olarak öğret (tek toplu istek)
    const seenAlias = new Set<string>()
    const pairs: { alias: string; item_id: string }[] = []
    for (const c of state.categories)
      for (const i of c.items) {
        if (!i.catalog_item_id || i.match?.level !== 'confirmed' || !i.name.trim()) continue
        const k = `${normalizeDishName(i.name)}|${i.catalog_item_id}`
        if (seenAlias.has(k)) continue
        seenAlias.add(k)
        pairs.push({ alias: i.name.trim(), item_id: i.catalog_item_id })
      }
    if (pairs.length > 0) {
      void authFetch('/api/catalog/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: pairs.slice(0, 200) }),
      }).catch(() => undefined)
    }

    const cats: ParsedCategory[] = state.categories.map((c) => ({
      name: c.name.trim() || 'Genel',
      // `match` yalnızca editör bilgisidir; `catalog_item_id` menüyle birlikte kaydedilir
      items: c.items.filter((i) => i.name.trim()).map(({ id: _id, match: _match, ...rest }) => rest),
    }))
    clearDraft()
    onCreate(state.menuName, cats)
  }

  if (typeof document === 'undefined') return null

  const renderedCats = visible.filter((v) => !isFiltering || v.items.length > 0)
  const catIds = renderedCats.map((v) => `cat:${v.cat.id}`)

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* ÜST BAR */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Geri Dön</span>
        </Button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight">Tarama Sonuçları</h2>
            <p className="truncate text-xs text-muted-foreground">
              {stats.categories} kategori · {stats.items} ürün — kontrol edip düzenleyin
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo} title="Geri al (Cmd+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={!canRedo} onClick={redo} title="İleri al (Cmd+Shift+Z)">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Vazgeç
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white hover:from-violet-700 hover:to-indigo-700"
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Menüyü Oluştur
          </Button>
        </div>
      </header>

      {/* ARAÇ ÇUBUĞU */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-4 py-2 sm:px-6">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün ara…"
            className="h-9 pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Aramayı temizle"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = filters.has(f.key)
            return (
              <button
                key={f.key}
                type="button"
                onClick={() =>
                  setFilters((prev) => {
                    const n = new Set(prev)
                    if (n.has(f.key)) n.delete(f.key)
                    else n.add(f.key)
                    return n
                  })
                }
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {calorie.running ? (
            <Button variant="outline" size="sm" onClick={calorie.cancel} className="gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kalori hesaplanıyor {calorie.done}/{calorie.total} · İptal
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={calorieTargets.length === 0}
              onClick={fillCalories}
              className="gap-1.5"
              title="Kalorisi boş ürünler için yapay zeka tahmini yapar"
            >
              <Sparkles className="h-4 w-4 text-violet-500" />
              Eksik kalorileri AI ile doldur ({calorieTargets.length})
            </Button>
          )}
          {suggestionTargets.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={acceptAllSuggestions}
              className="gap-1.5"
              title="Katalog önerilerini tek seferde kabul eder (görsel + bağlantı)"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Önerileri kabul et ({suggestionTargets.length})
            </Button>
          )}
          {subdomain &&
            (imageGen.running ? (
              <Button variant="outline" size="sm" onClick={imageGen.cancel} className="gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Görsel üretiliyor {imageGen.done}/{imageGen.total} · İptal
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={imageTargets.length === 0}
                onClick={generateMissingImages}
                className="gap-1.5"
                title="Görselsiz ürünler için yapay zeka görseli üretir (günlük ücretsiz kota)"
              >
                <Sparkles className="h-4 w-4 text-violet-500" />
                Görselsizler için AI görsel ({imageTargets.length})
              </Button>
            ))}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const catId = uid('c')
              dispatch({ type: 'ADD_CAT', catId, itemId: uid('i') })
              scrollToEl(`[data-cat="${catId}"]`, 'start')
            }}
          >
            <Plus className="h-4 w-4" /> Kategori ekle
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* KATEGORİ GEZGİNİ */}
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card/40 p-4 lg:block">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Kategoriler</p>
          <nav className="space-y-1">
            {state.categories.map((cat, idx) => {
              const missing = cat.items.reduce((n, i) => n + (issues.has(i.id) ? 1 : 0), 0)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted',
                    activeCat === cat.id && 'bg-primary/10 font-semibold text-primary'
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{cat.name || 'Adsız'}</span>
                  {missing > 0 && (
                    <span className="rounded bg-destructive/10 px-1 text-[10px] font-bold text-destructive">
                      {missing}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{cat.items.length}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ANA İÇERİK */}
        <main ref={scrollRef} onScroll={onScroll} className="min-w-0 flex-1 overflow-y-auto">
          <div className="w-full space-y-4 px-4 py-5 pb-28 sm:px-6">
            {draftOffer && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <p className="min-w-0 flex-1 text-sm text-amber-600 dark:text-amber-400">
                  Kaydedilmemiş bir taslak bulundu. Kaldığınız yerden devam etmek ister misiniz?
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    dispatch({ type: 'RESET', state: draftOffer })
                    setDraftOffer(null)
                  }}
                >
                  Taslağı yükle
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearDraft()
                    setDraftOffer(null)
                  }}
                >
                  Yoksay
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px] flex-1 space-y-1.5">
                <label htmlFor="scan-menu-name" className="text-xs font-semibold text-muted-foreground">
                  Menü Adı
                </label>
                <Input
                  id="scan-menu-name"
                  value={state.menuName}
                  onChange={(e) => dispatch({ type: 'SET_MENU_NAME', name: e.target.value }, 'menu-name')}
                  placeholder="Taranan Menü"
                  className="h-11 text-base font-semibold"
                />
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                Sürükleyerek ürünleri sıralayın veya başka kategoriye taşıyın.
              </p>
            </div>

            <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={handleDragEnd}>
              <SortableContext items={catIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {renderedCats.map(({ cat, items }) => (
                    <CategorySection
                      key={cat.id}
                      cat={cat}
                      index={state.categories.indexOf(cat)}
                      items={items}
                      collapsed={collapsed.has(cat.id)}
                      selection={selection}
                      issues={issues}
                      dispatch={dispatchUI}
                      onToggleCollapse={toggleCollapse}
                      onToggleSelect={toggleSelect}
                      onToggleSelectCat={toggleSelectCat}
                      subdomain={subdomain}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {renderedCats.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {isFiltering ? 'Aramaya veya filtreye uyan ürün bulunamadı.' : 'Henüz kategori yok.'}
              </p>
            )}
          </div>
        </main>

        {/* ÖZET PANELİ */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card/40 p-4 xl:block">
          <ScanSummaryPanel
            stats={stats}
            photos={photos}
            onOpenPhoto={setViewerIndex}
            onNextIssue={goToNextIssue}
            issueCount={issueIds.length}
          />
        </aside>

        {selectedIds.length > 0 && (
          <BulkActionBar
            count={selectedIds.length}
            categories={state.categories}
            onClear={() => setSelection(new Set())}
            onSelectVisible={() =>
              setSelection(new Set(renderedCats.flatMap((v) => v.items.map((i) => i.id))))
            }
            onDelete={() => {
              dispatchUI({ type: 'DELETE_ITEMS', itemIds: selectedIds })
              setSelection(new Set())
            }}
            onMove={(toCatId) => dispatch({ type: 'MOVE_ITEMS', itemIds: selectedIds, toCatId })}
            onPricePercent={bulkPrice}
            onAddAllergen={bulkAllergen}
          />
        )}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>,
    document.body
  )
}

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { authFetch } from '@/lib/api-client'
import type { CatalogMatch } from '@/lib/catalog-match'
import { catalogThumbUrl } from '@/lib/image-url'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (match: CatalogMatch) => void
  initialQuery?: string
  /** Sunucunun önerdiği adaylar; listenin başında "Öneriler" olarak gösterilir */
  suggestions?: CatalogMatch[]
  /** true: akış içinde blok; false: üst öğeye göre mutlak konumlu açılır panel */
  inline?: boolean
  className?: string
}

/** "Katalogdan seç": 250 ms gecikmeli arama, en fazla 8 sonuç. Yalnızca açıkken render edilir. */
export function CatalogPickerPopover(props: Props) {
  if (!props.open) return null
  return <CatalogPickerPanel {...props} />
}

function CatalogPickerPanel({ onClose, onSelect, initialQuery = '', suggestions = [], inline = false, className }: Props) {
  const [q, setQ] = useState(initialQuery)
  const [results, setResults] = useState<CatalogMatch[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const res = await authFetch(`/api/catalog/match?q=${encodeURIComponent(term)}&limit=8`, { signal: ctrl.signal })
        const data = await res.json().catch(() => ({}))
        if (!ctrl.signal.aborted) setResults(Array.isArray(data?.results) ? data.results : [])
      } catch (e: any) {
        if (e?.name !== 'AbortError' && !ctrl.signal.aborted) setResults([])
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!inline && rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      abortRef.current?.abort()
    }
  }, [onClose, inline])

  const seen = new Set<string>()
  const suggestionRows = suggestions.filter((s) => (seen.has(s.item_id) ? false : (seen.add(s.item_id), true)))
  const resultRows = results.filter((r) => !seen.has(r.item_id))

  const Row = ({ m, hint }: { m: CatalogMatch; hint?: string }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(m)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
    >
      {m.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={catalogThumbUrl(m.image_url)} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-md border border-border object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[9px] text-muted-foreground">
          yok
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{m.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {m.category}
          {hint ? ` · ${hint}` : ''}
        </span>
      </span>
    </button>
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        'z-30 w-full rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg',
        inline ? 'mt-2' : 'absolute left-0 top-full mt-1 w-80 max-w-[90vw]',
        className
      )}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Katalogda ara… (ör. lahmacun)"
          className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <button type="button" onClick={onClose} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-1.5 max-h-72 overflow-y-auto">
        {suggestionRows.length > 0 && (
          <>
            <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Öneriler</p>
            {suggestionRows.map((m) => (
              <Row key={m.item_id} m={m} hint={`%${Math.round(m.score * 100)}`} />
            ))}
          </>
        )}
        {resultRows.length > 0 && (
          <>
            {suggestionRows.length > 0 && (
              <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Arama</p>
            )}
            {resultRows.map((m) => (
              <Row key={m.item_id} m={m} />
            ))}
          </>
        )}
        {q.trim().length >= 2 && !loading && resultRows.length === 0 && suggestionRows.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">Katalogda bulunamadı.</p>
        )}
        {q.trim().length < 2 && suggestionRows.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">En az 2 karakter yazın.</p>
        )}
      </div>
    </div>
  )
}

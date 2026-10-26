'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Sparkles, X } from 'lucide-react'
import { authFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pendingSuggestions, uniqueIngredients } from '@/lib/ingredients'

interface Props {
  subdomain?: string | null
  /** Öneriler ürün adı, açıklaması ve kategorisinden üretilir */
  name: string
  description?: string
  category?: string | null
  value: string[]
  onChange: (ingredients: string[]) => void
}

/**
 * Ürün bileşenleri: seçili bileşenler çıkarılabilir çipler; listede olmayan bileşen elle yazılıp Enter ya da "Ekle" ile
 * eklenir (virgülle birden fazla). AI önerileri (ana + isteğe bağlı malzemeler) yalnız "AI ile öner" düğmesiyle istenir:
 * ürünü başka bir şey için açan kullanıcı Gemini kotası harcamasın.
 */
export function IngredientEditor({ subdomain, name, description, category, value, onChange }: Props) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const trimmedName = name.trim()
  const productKey = `${trimmedName}|${category || ''}`
  const keyRef = useRef(productKey)
  keyRef.current = productKey

  // Ad ya da kategori değişince eldeki öneriler başka bir ürüne ait olur: temizlenir (istek atılmaz)
  useEffect(() => {
    setSuggestions([])
    setUnavailable(false)
    setFetchedFor(null)
  }, [productKey])

  const canSuggest = !!subdomain && trimmedName.length >= 2
  const fetched = fetchedFor === productKey
  const pending = useMemo(() => pendingSuggestions(suggestions, value), [suggestions, value])

  const requestSuggestions = async () => {
    if (!canSuggest || loading) return
    const key = productKey
    setLoading(true)
    setUnavailable(false)
    try {
      const res = await authFetch('/api/items/ingredient-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, name: trimmedName, description: description || '', category: category || '', current: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (keyRef.current !== key) return // istek sürerken ürün adı değişti
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : [])
      setUnavailable(!res.ok || !!data?.unavailable)
      setFetchedFor(key)
    } catch {
      if (keyRef.current === key) setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }

  const addText = () => {
    const next = uniqueIngredients([...value, ...text.split(',')])
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="i-ingredient" className="text-xs">Bileşenler</Label>
        <span className="text-[10px] text-muted-foreground">Menüde açıklamanın altında listelenir</span>
      </div>

      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-1.5">
        {value.length === 0 && <span className="px-1 text-[11px] text-muted-foreground">Henüz bileşen yok; yazıp ekleyin ya da AI'dan öneri isteyin.</span>}
        {value.map((ing) => (
          <span
            key={ing}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
          >
            {ing}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== ing))}
              className="rounded hover:text-destructive"
              aria-label={`${ing} bileşenini kaldır`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-1.5">
        <Input
          id="i-ingredient"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault() // formu göndermesin
              addText()
            }
          }}
          placeholder="Listede olmayan bileşeni yazın (ör. Pul biber)"
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addText} disabled={!text.trim()} className="h-8 shrink-0 text-xs">
          <Plus className="mr-1 h-3.5 w-3.5" /> Ekle
        </Button>
      </div>

      <div className="space-y-1 pt-0.5">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Bu üründe olabilecek bileşenler
          </p>
          {!fetched && (
            <Button
              type="button"
              size="sm"
              onClick={requestSuggestions}
              disabled={!canSuggest || loading}
              title={canSuggest ? undefined : 'Önce ürün adını yazın'}
              className="ai-glow h-6 shrink-0 gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 text-[11px] font-semibold text-white hover:from-violet-600 hover:to-fuchsia-600"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {loading ? 'Getiriliyor…' : 'AI ile öner'}
            </Button>
          )}
        </div>
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pending.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(uniqueIngredients([...value, s]))}
                className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-emerald-950/30"
              >
                <Plus className="h-3 w-3" /> {s}
              </button>
            ))}
          </div>
        )}
        {unavailable && !loading && <p className="text-[10px] text-muted-foreground">Öneriler şu an alınamadı; bileşenleri elle ekleyebilirsiniz.</p>}
        {fetched && !unavailable && pending.length === 0 && <p className="text-[10px] text-muted-foreground">Önerilen bileşenlerin hepsi listede.</p>}
      </div>
    </div>
  )
}

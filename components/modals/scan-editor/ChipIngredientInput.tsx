'use client'

import React, { useState } from 'react'
import { Utensils, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  ingredients: string[]
  onChange: (ingredients: string[]) => void
}

export function ChipIngredientInput({ ingredients, onChange }: Props) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  const has = (v: string) => ingredients.some((x) => x.toLocaleLowerCase('tr-TR') === v.toLocaleLowerCase('tr-TR'))

  const add = (raw: string) => {
    const v = raw.trim()
    if (!v || has(v)) {
      setText('')
      return
    }
    onChange([...ingredients, v])
    setText('')
  }

  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1 rounded-xl border border-input bg-background/40 px-2 py-1',
        focused && 'ring-1 ring-ring'
      )}
    >
      {ingredients.length === 0 && !focused && !text && (
        <Utensils className="h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
      )}
      {ingredients.map((ing) => (
        <span
          key={ing}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
        >
          {ing}
          <button
            type="button"
            onClick={() => onChange(ingredients.filter((x) => x !== ing))}
            className="rounded hover:text-destructive"
            aria-label={`${ing} bileşenini kaldır`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) {
            v.split(',').forEach((p, i, arr) => i < arr.length - 1 && add(p))
            setText(v.split(',').pop() || '')
          } else setText(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          } else if (e.key === 'Backspace' && !text && ingredients.length) {
            onChange(ingredients.slice(0, -1))
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          if (text.trim()) add(text)
        }}
        placeholder={ingredients.length ? '' : 'Bileşen ekle'}
        className="min-w-[60px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

'use client'

import { useCallback, useMemo, useReducer, useRef } from 'react'
import { foldTurkish } from '@/lib/catalog-match'
import type {
  EditorCategory,
  EditorItem,
  EditorState,
  ItemIssue,
  ParsedCategory,
  ParsedItem,
} from './types'

let uidCounter = 0
export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`

export function toEditorCategories(cats: ParsedCategory[]): EditorCategory[] {
  return cats.map((c) => ({
    id: uid('c'),
    name: c.name,
    items: c.items.map((i) => ({ ...i, id: uid('i') })),
  }))
}

export type EditorAction =
  | { type: 'SET_MENU_NAME'; name: string }
  | { type: 'SET_CAT_NAME'; catId: string; name: string }
  | { type: 'UPDATE_ITEM'; itemId: string; patch: Partial<ParsedItem> }
  | { type: 'UPDATE_ITEMS'; patches: Record<string, Partial<ParsedItem>> }
  | { type: 'DELETE_ITEMS'; itemIds: string[] }
  | { type: 'DELETE_CAT'; catId: string }
  | { type: 'ADD_ITEM'; catId: string; itemId: string }
  | { type: 'ADD_CAT'; catId: string; itemId: string }
  | { type: 'MOVE_ITEM'; itemId: string; toCatId: string; overItemId: string | null }
  | { type: 'MOVE_ITEMS'; itemIds: string[]; toCatId: string }
  | { type: 'REORDER_CAT'; catId: string; overCatId: string }
  | { type: 'RESET'; state: EditorState }

function mapItems(
  state: EditorState,
  fn: (item: EditorItem) => EditorItem | null
): EditorState {
  return {
    ...state,
    categories: state.categories.map((c) => {
      let changed = false
      const items: EditorItem[] = []
      for (const it of c.items) {
        const next = fn(it)
        if (next !== it) changed = true
        if (next) items.push(next)
      }
      return changed ? { ...c, items } : c
    }),
  }
}

function reduce(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_MENU_NAME':
      return { ...state, menuName: action.name }
    case 'SET_CAT_NAME':
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.catId ? { ...c, name: action.name } : c
        ),
      }
    case 'UPDATE_ITEM':
      return mapItems(state, (it) => (it.id === action.itemId ? { ...it, ...action.patch } : it))
    case 'UPDATE_ITEMS':
      return mapItems(state, (it) =>
        action.patches[it.id] ? { ...it, ...action.patches[it.id] } : it
      )
    case 'DELETE_ITEMS': {
      const set = new Set(action.itemIds)
      return mapItems(state, (it) => (set.has(it.id) ? null : it))
    }
    case 'DELETE_CAT':
      return { ...state, categories: state.categories.filter((c) => c.id !== action.catId) }
    case 'ADD_ITEM':
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.catId
            ? { ...c, items: [...c.items, { id: action.itemId, name: '', price: '', allergens: [] }] }
            : c
        ),
      }
    case 'ADD_CAT':
      return {
        ...state,
        categories: [
          ...state.categories,
          {
            id: action.catId,
            name: 'Yeni Kategori',
            items: [{ id: action.itemId, name: '', price: '', allergens: [] }],
          },
        ],
      }
    case 'MOVE_ITEM': {
      let moving: EditorItem | undefined
      for (const c of state.categories) {
        const f = c.items.find((i) => i.id === action.itemId)
        if (f) moving = f
      }
      if (!moving) return state
      const without = state.categories.map((c) => ({
        ...c,
        items: c.items.filter((i) => i.id !== action.itemId),
      }))
      // Aynı kategori içinde taşırken dnd-kit arrayMove semantiği: hedef, orijinal dizideki over indeksi
      const origCat = state.categories.find((c) => c.items.some((i) => i.id === action.itemId))
      const categories = without.map((c) => {
        if (c.id !== action.toCatId) return c
        let idx = c.items.length
        if (action.overItemId) {
          if (origCat && origCat.id === c.id) {
            const orig = origCat.items.findIndex((i) => i.id === action.overItemId)
            if (orig >= 0) idx = Math.min(orig, c.items.length)
          } else {
            const o = c.items.findIndex((i) => i.id === action.overItemId)
            if (o >= 0) idx = o
          }
        }
        const items = [...c.items]
        items.splice(idx, 0, moving!)
        return { ...c, items }
      })
      return { ...state, categories }
    }
    case 'MOVE_ITEMS': {
      const set = new Set(action.itemIds)
      const moved: EditorItem[] = []
      state.categories.forEach((c) => c.items.forEach((i) => set.has(i.id) && moved.push(i)))
      return {
        ...state,
        categories: state.categories.map((c) => {
          const kept = c.items.filter((i) => !set.has(i.id))
          return c.id === action.toCatId ? { ...c, items: [...kept, ...moved] } : { ...c, items: kept }
        }),
      }
    }
    case 'REORDER_CAT': {
      const from = state.categories.findIndex((c) => c.id === action.catId)
      const to = state.categories.findIndex((c) => c.id === action.overCatId)
      if (from < 0 || to < 0 || from === to) return state
      const categories = [...state.categories]
      const [m] = categories.splice(from, 1)
      categories.splice(to, 0, m)
      return { ...state, categories }
    }
    case 'RESET':
      return action.state
  }
}

interface History {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
  lastKey: string | null
  lastAt: number
}

type HistoryAction =
  | { type: 'DO'; action: EditorAction; key: string | null; now: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }

const MAX_HISTORY = 100
const COALESCE_MS = 1000

function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case 'DO': {
      const next = reduce(h.present, a.action)
      if (next === h.present) return h
      if (a.action.type === 'RESET') {
        return { past: [], present: next, future: [], lastKey: null, lastAt: 0 }
      }
      const coalesce = a.key !== null && a.key === h.lastKey && a.now - h.lastAt < COALESCE_MS
      return {
        past: coalesce ? h.past : [...h.past, h.present].slice(-MAX_HISTORY),
        present: next,
        future: [],
        lastKey: a.key,
        lastAt: a.now,
      }
    }
    case 'UNDO': {
      if (h.past.length === 0) return h
      const prev = h.past[h.past.length - 1]
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [h.present, ...h.future],
        lastKey: null,
        lastAt: 0,
      }
    }
    case 'REDO': {
      if (h.future.length === 0) return h
      const [next, ...rest] = h.future
      return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 }
    }
  }
}

// Türkçe katlama: "Iced Latte" → "iced latte" (toLocaleLowerCase('tr-TR') noktasız ı üretirdi)
const norm = (s: string) => foldTurkish(s).trim().replace(/\s+/g, ' ')

export function computeIssues(categories: EditorCategory[]): Map<string, ItemIssue[]> {
  const map = new Map<string, ItemIssue[]>()
  for (const c of categories) {
    const seen = new Map<string, string[]>()
    for (const it of c.items) {
      const issues: ItemIssue[] = []
      if (!it.name.trim()) issues.push('noName')
      else {
        const k = norm(it.name)
        seen.set(k, [...(seen.get(k) || []), it.id])
      }
      if (!it.price.trim()) issues.push('noPrice')
      if (issues.length) map.set(it.id, issues)
    }
    for (const ids of seen.values()) {
      if (ids.length > 1) {
        ids.forEach((id) => map.set(id, [...(map.get(id) || []), 'duplicate']))
      }
    }
  }
  return map
}

export function useScanEditorState(initialName: string, initialCategories: ParsedCategory[]) {
  const [history, dispatchHistory] = useReducer(historyReducer, undefined, (): History => ({
    past: [],
    present: { menuName: initialName, categories: toEditorCategories(initialCategories) },
    future: [],
    lastKey: null,
    lastAt: 0,
  }))

  /** key: aynı alan üzerindeki ardışık yazımlar tek geri alma adımında birleşir */
  const dispatch = useCallback((action: EditorAction, key: string | null = null) => {
    dispatchHistory({ type: 'DO', action, key, now: Date.now() })
  }, [])
  const undo = useCallback(() => dispatchHistory({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatchHistory({ type: 'REDO' }), [])

  const state = history.present
  const issues = useMemo(() => computeIssues(state.categories), [state.categories])

  const stateRef = useRef(state)
  stateRef.current = state

  return {
    state,
    dispatch,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    isDirty: history.past.length > 0,
    issues,
    getState: () => stateRef.current,
  }
}

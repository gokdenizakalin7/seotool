'use client'

import { useEffect, useState } from 'react'

export interface ImageCredit {
  slug: string
  name: string
  source: string
  source_url: string
  creator?: string | null
  license: string
  license_url?: string | null
}

let cached: ImageCredit[] | null = null
let pending: Promise<ImageCredit[]> | null = null

/** public/catalog/credits.json — stok fotoğraf atıfları (yoksa veya SPA HTML dönerse boş liste) */
export function loadImageCredits(): Promise<ImageCredit[]> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending
  pending = fetch('/catalog/credits.json', { cache: 'no-cache' })
    .then(async (r) => {
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return []
      const data = await r.json()
      return Array.isArray(data) ? (data as ImageCredit[]) : []
    })
    .catch(() => [] as ImageCredit[])
    .then((list) => {
      cached = list
      return list
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export function useImageCredits(): ImageCredit[] {
  const [credits, setCredits] = useState<ImageCredit[]>(cached || [])
  useEffect(() => {
    let alive = true
    loadImageCredits().then((list) => {
      if (alive) setCredits(list)
    })
    return () => {
      alive = false
    }
  }, [])
  return credits
}

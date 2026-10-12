'use client'

import { useCallback, useEffect, useState } from 'react'
import { BUSINESS_TYPES, type BusinessType } from '@/lib/business-types'

/**
 * İşletme türleri admin panelinden yönetilir (business_types). Liste sayfa başına bir kez çekilir;
 * yüklenene kadar ve hata durumunda koddaki yedek liste kullanılır.
 */
let cache: BusinessType[] | null = null
let inflight: Promise<BusinessType[]> | null = null

function load(): Promise<BusinessType[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/business-types')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cache = Array.isArray(d.businessTypes) && d.businessTypes.length ? d.businessTypes : BUSINESS_TYPES
        return cache!
      })
      .catch(() => BUSINESS_TYPES)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useBusinessTypes() {
  const [types, setTypes] = useState<BusinessType[]>(cache || BUSINESS_TYPES)

  useEffect(() => {
    let alive = true
    load().then((t) => alive && setTypes(t))
    return () => {
      alive = false
    }
  }, [])

  /** Pasifleştirilmiş (listede olmayan) türler için yedek listeye bakılır */
  const get = useCallback(
    (id?: string | null) => (id ? types.find((t) => t.id === id) || BUSINESS_TYPES.find((t) => t.id === id) : undefined),
    [types]
  )

  return { types, get }
}

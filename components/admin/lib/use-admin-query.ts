'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, errorMessage } from './admin-api'

/** Basit GET kancası: yükleniyor / hata / yeniden yükle */
export function useAdminQuery<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!url)
  const seq = useRef(0)

  const reload = useCallback(async () => {
    if (!url) return
    const id = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi<T>(url)
      if (id === seq.current) setData(res)
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e))
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, setData, error, loading, reload }
}

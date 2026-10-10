'use client'

import { useCallback, useRef, useState } from 'react'
import { generateItemImage, ImageGenError } from '@/lib/image-generation-client'

export interface ImageGenTarget {
  id: string
  name: string
  description?: string
  category: string
}

const CONCURRENCY = 2

/** Görselsiz ürünler için /api/items/generate-image uç noktasını sınırlı paralellikle çağırır; kota dolunca durur. */
export function useImageGenerate(subdomain: string) {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const cancelRef = useRef(false)

  const run = useCallback(
    async (targets: ImageGenTarget[], onResult: (id: string, url: string) => void) => {
      if (targets.length === 0 || !subdomain) return { ok: 0, failed: 0, stoppedReason: null as string | null }
      cancelRef.current = false
      setRunning(true)
      setDone(0)
      setTotal(targets.length)

      let cursor = 0
      let ok = 0
      let failed = 0
      let stoppedReason: string | null = null

      const worker = async () => {
        while (!cancelRef.current && !stoppedReason) {
          const t = targets[cursor++]
          if (!t) return
          try {
            const r = await generateItemImage({ subdomain, name: t.name, description: t.description, category: t.category })
            onResult(t.id, r.url)
            ok++
            if (r.orgRemaining <= 0 || r.globalRemaining <= 0) stoppedReason = 'Günlük kota doldu'
          } catch (e: any) {
            failed++
            if (e instanceof ImageGenError && (e.code === 'QUOTA_EXCEEDED' || e.code === 'PROVIDER_QUOTA' || e.code === 'NOT_CONFIGURED')) {
              stoppedReason = e.message
            }
          } finally {
            setDone((d) => d + 1)
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))
      setRunning(false)
      return { ok, failed, stoppedReason }
    },
    [subdomain]
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  return { run, cancel, running, done, total }
}

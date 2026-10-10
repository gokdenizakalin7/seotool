'use client'

import { authFetch } from '@/lib/api-client'

export interface ImageGenQuota {
  configured: boolean
  orgRemaining: number
  globalRemaining: number
  resetsAt: string
}

export interface GenerateItemImageInput {
  subdomain: string
  name: string
  description?: string | null
  category?: string | null
}

export class ImageGenError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message)
    this.name = 'ImageGenError'
  }
}

/** Kalan günlük AI görsel kotası (işletme ve global) */
export async function fetchImageQuota(subdomain: string): Promise<ImageGenQuota | null> {
  try {
    const res = await authFetch(`/api/items/generate-image?subdomain=${encodeURIComponent(subdomain)}`)
    if (!res.ok) return null
    const data = await res.json()
    return {
      configured: !!data.configured,
      orgRemaining: Number(data.orgRemaining) || 0,
      globalRemaining: Number(data.globalRemaining) || 0,
      resetsAt: String(data.resetsAt || ''),
    }
  } catch {
    return null
  }
}

/** Tek ürün için AI görseli üretir; başarıda Storage URL'si döner, hatada ImageGenError fırlatır. */
export async function generateItemImage(input: GenerateItemImageInput): Promise<{ url: string; orgRemaining: number; globalRemaining: number }> {
  const res = await authFetch('/api/items/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.url) {
    throw new ImageGenError(data?.error || `Görsel üretilemedi (HTTP ${res.status})`, data?.code, res.status)
  }
  return { url: String(data.url), orgRemaining: Number(data.orgRemaining) || 0, globalRemaining: Number(data.globalRemaining) || 0 }
}

'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api-client'
import { extractPrimaryBrandColorFromDataUrl } from '@/lib/extract-brand-color'
import type { Restaurant } from '@/lib/types'
import { clearImpersonation, getImpersonatedOrgId } from '@/lib/impersonation'

export type ProfilePatch = Record<string, unknown>

interface RestaurantContextValue {
  restaurant: Restaurant | null
  email: string
  role: string
  isLoading: boolean
  onboardingCompleted: boolean
  /** Süper admin başka bir restoranın panelinde */
  impersonating: boolean
  /** Restoran askıda: panel salt-okunur */
  isSuspended: boolean
  refresh: () => Promise<void>
  /** Sunucuya kaydeder ve yerel durumu günceller. Hata varsa fırlatır. */
  save: (patch: ProfilePatch) => Promise<Restaurant>
  uploadAsset: (kind: 'logo' | 'cover', dataUrl: string) => Promise<string>
  removeAsset: (kind: 'logo' | 'cover') => Promise<void>
}

const Ctx = createContext<RestaurantContextValue | null>(null)

function persistLegacy(r: Restaurant | null) {
  try {
    if (r) localStorage.setItem('currentRestaurant', JSON.stringify(r))
  } catch {
    // depolama dolu / kapalı
  }
}

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('restaurant')
  const [onboardingCompleted, setOnboardingCompleted] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/me')
      if (!res.ok) return
      const data = await res.json()
      setEmail(data.email || '')
      setRole(data.role || 'restaurant')

      // Süper admin "Panele Gir": seçili restoranın profili sunucudan okunur (kendi restoranı yerine)
      const impersonatedId = data.role === 'superadmin' ? getImpersonatedOrgId() : null
      if (impersonatedId) {
        const imp = await authFetch(`/api/admin/organizations/${impersonatedId}/impersonate`)
        if (imp.ok) {
          const { restaurant: r } = await imp.json()
          setRestaurant(r)
          setImpersonating(true)
          setOnboardingCompleted(true)
          persistLegacy(r)
          return
        }
        clearImpersonation()
      }

      setImpersonating(false)
      setOnboardingCompleted(data.organization ? !!data.organization.onboardingCompleted : true)
      if (data.restaurant) {
        setRestaurant(data.restaurant)
        persistLegacy(data.restaurant)
      }
    } catch (err) {
      console.error('Profil yüklenemedi', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!restaurant) throw new Error('Restoran yüklenmedi.')
      const res = await authFetch('/api/organizations/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: restaurant.id, ...patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi.')
      const next: Restaurant = { ...data.restaurant, businessInfo: { ...data.restaurant.businessInfo, email } }
      setRestaurant(next)
      setOnboardingCompleted(!!data.organization?.onboarding_completed_at)
      persistLegacy(next)
      return next
    },
    [restaurant, email]
  )

  const uploadAsset = useCallback(
    async (kind: 'logo' | 'cover', dataUrl: string) => {
      const res = await authFetch('/api/organizations/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, dataUrl, organizationId: restaurant?.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Görsel yüklenemedi.')
      setRestaurant((prev) => {
        if (!prev) return prev
        const branding = {
          ...prev.branding,
          ...(kind === 'logo' ? { logoUrl: data.url } : { coverUrl: data.url, bannerUrl: data.url }),
        }
        const next = { ...prev, branding }
        persistLegacy(next)
        return next
      })
      // Marka rengi yalnızca hiç seçilmemişse (varsayılan) logodan alınır; kullanıcının seçtiği renk ezilmez
      const currentColor = (restaurant?.branding?.primaryColor || '').toLowerCase()
      if (kind === 'logo' && restaurant && (!currentColor || currentColor === '#e11d48')) {
        const primaryColor = await extractPrimaryBrandColorFromDataUrl(dataUrl)
        try {
          await save({ primaryColor })
        } catch (err) {
          console.warn('Logo rengi kaydedilemedi', err)
        }
      }
      return data.url as string
    },
    [restaurant, save]
  )

  const removeAsset = useCallback(async (kind: 'logo' | 'cover') => {
    const orgParam = restaurant?.id ? `&organizationId=${encodeURIComponent(restaurant.id)}` : ''
    const res = await authFetch(`/api/organizations/assets?kind=${kind}${orgParam}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Görsel kaldırılamadı.')
    setRestaurant((prev) => {
      if (!prev) return prev
      const branding = {
        ...prev.branding,
        ...(kind === 'logo' ? { logoUrl: '' } : { coverUrl: '', bannerUrl: '' }),
      }
      const next = { ...prev, branding }
      persistLegacy(next)
      return next
    })
  }, [restaurant?.id])

  const value = useMemo(
    () => ({
      restaurant,
      email,
      role,
      isLoading,
      onboardingCompleted,
      impersonating,
      // Süper admin askıdaki restoranda da düzenleyebilir
      isSuspended: restaurant?.status === 'suspended' && !impersonating,
      refresh,
      save,
      uploadAsset,
      removeAsset,
    }),
    [restaurant, email, role, isLoading, onboardingCompleted, impersonating, refresh, save, uploadAsset, removeAsset]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRestaurant() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRestaurant, RestaurantProvider içinde kullanılmalı')
  return v
}

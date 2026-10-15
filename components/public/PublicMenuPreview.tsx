'use client'

import { useEffect, useState } from 'react'
import { PublicMenuView } from '@/components/public/PublicMenuView'
import type { Menu } from '@/lib/types'
import { useBusinessTypes } from '@/lib/use-business-types'

/**
 * Panel içi canlı önizleme (/menu/[subdomain]?preview=1): menü, restoran ve renk yayınlanmadan
 * editörden postMessage ile gelir (bkz. lib/use-public-menu-preview.ts).
 */
export function PublicMenuPreview({ hasImageCredits }: { hasImageCredits: boolean }) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const { get: getBusinessType } = useBusinessTypes()

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'qr-preview-data') return
      setMenu(e.data.menu || null)
      setPrimaryColor(e.data.primaryColor || null)
      if (e.data.restaurant) setRestaurant(e.data.restaurant)
    }
    window.addEventListener('message', onMessage)
    window.parent?.postMessage({ type: 'qr-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <PublicMenuView
      isPreview
      restaurant={restaurant}
      menu={menu || undefined}
      primaryColor={primaryColor}
      fallbackCover={getBusinessType(restaurant.business_type)?.coverImage || ''}
      hasImageCredits={hasImageCredits}
    />
  )
}

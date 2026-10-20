'use client'

import React from 'react'
import { SiteLangProvider, useSiteLang } from './i18n'
import { SiteHeader } from './SiteHeader'
import { SiteNav } from './SiteNav'
import { SiteFooter } from './SiteFooter'
import type { SiteRestaurant } from './types'

interface SiteShellProps {
  restaurant: SiteRestaurant
  /** Site adresi; yoksa (panel önizlemesi) sekme çubuğu gösterilmez */
  slug?: string
  fallbackCover?: string
  hasEvents?: boolean
  hasImageCredits?: boolean
  children: React.ReactNode
}

/** İşletme sitesinin ortak iskeleti: kapak, sekmeler, içerik, altbilgi. Dil seçimi sayfalar arasında korunur. */
export function SiteShell(props: SiteShellProps) {
  return (
    <SiteLangProvider>
      <ShellFrame {...props} />
    </SiteLangProvider>
  )
}

function ShellFrame({ restaurant, slug, fallbackCover, hasEvents = false, hasImageCredits = false, children }: SiteShellProps) {
  const { lang } = useSiteLang()
  const showNav = Boolean(slug)
  // overflow-x-clip: taşan bir öğe sayfayı yana kaydırılabilir yapmasın (hidden değil; yapışkan kategori şeridi bozulmaz).
  // touch-manipulation: hızlı çift dokunuş sayfayı büyütmesin, iki parmakla yakınlaştırma açık kalır.
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-white to-[#F5F5F7] dark:from-[#1c1c1e] dark:to-[#000000] flex flex-col font-sans selection:bg-primary/20 relative overflow-x-clip touch-manipulation"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="relative z-10 flex-1">
        <SiteHeader restaurant={restaurant} fallbackCover={fallbackCover} />
        {showNav && <SiteNav slug={slug!} hasEvents={hasEvents} />}
        {children}
      </div>
      <SiteFooter restaurant={restaurant} hasImageCredits={hasImageCredits} withBottomNav={showNav} />
    </div>
  )
}

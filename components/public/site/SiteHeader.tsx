'use client'

import React from 'react'
import { Globe, Moon, Sun } from 'lucide-react'
import { SITE_LANGS, useSiteLang, type SiteLang } from './i18n'
import type { SiteRestaurant } from './types'

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop'

// Koyu tema <html class="dark"> ile: ilk değeri sayfadaki satır içi betik (sistem tercihi) boyamadan önce verir,
// buton ikonu dark: sınıflarıyla değiştiği için ayrıca state tutulmaz.
// Yumuşak tema geçişi: butondan genişleyen dairesel açılma (View Transitions API)
function toggleTheme(e: React.MouseEvent<HTMLButtonElement>) {
  const root = document.documentElement
  const next = !root.classList.contains('dark')
  const apply = () => {
    root.classList.toggle('dark', next)
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const start = (document as any).startViewTransition?.bind(document)
  if (reduce || !start) {
    root.classList.add('theme-fade')
    apply()
    setTimeout(() => root.classList.remove('theme-fade'), 600)
    return
  }
  const rect = e.currentTarget.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const t = start(apply)
  t.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
      )
    })
    .catch(() => {})
}

/** Dergi tarzı kapak: işletme adı (ve kapak varsa logo), tema ve dil seçici */
export function SiteHeader({ restaurant, fallbackCover }: { restaurant: SiteRestaurant; fallbackCover?: string }) {
  const { lang, setLang } = useSiteLang()

  const hasCustomCover = Boolean(restaurant.cover_url?.trim())
  const logo = restaurant.logo_url?.trim() || ''
  const coverUsesLogo = !hasCustomCover && Boolean(logo)
  const heroCoverSrc = hasCustomCover ? restaurant.cover_url! : coverUsesLogo ? logo : fallbackCover || FALLBACK_COVER

  return (
    <header className="relative h-40 sm:h-52 w-full bg-[#e9e9ee] dark:bg-[#1c1c1e] overflow-hidden rounded-b-[28px] shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
      {/* Giriş animasyonları CSS ile: sunucudan gelen HTML, JS yüklenmeden görünür ve canlanır */}
      <div className="h-full w-full animate-in zoom-in-105 slide-in-from-bottom-2.5 duration-[1200ms] ease-out">
        <img
          src={heroCoverSrc}
          alt={restaurant.name}
          className={`w-full h-full ${coverUsesLogo ? 'object-contain opacity-60 dark:opacity-35 blur-[1px]' : 'object-cover opacity-90 dark:opacity-45'}`}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-white/5 dark:from-black/85 dark:via-black/35 dark:to-black/10 flex flex-col justify-end p-4 sm:p-6">
        <div className="max-w-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 delay-200 duration-[600ms] ease-out fill-mode-both">
          {hasCustomCover && logo && (
            <img
              src={logo}
              alt=""
              className="h-11 w-11 sm:h-14 sm:w-14 shrink-0 rounded-2xl object-contain bg-white/90 dark:bg-white/10 p-1 shadow-sm"
            />
          )}
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white leading-tight">
            {restaurant.name}
          </h1>
        </div>
      </div>

      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 z-50">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 bg-white/70 dark:bg-black/20 backdrop-blur-xl rounded-full border border-black/10 dark:border-white/10 text-gray-700 dark:text-white/80 hover:text-black dark:hover:text-white transition-colors"
          aria-label="Toggle Dark Mode"
        >
          <span className="relative flex h-4 w-4">
            <Moon className="absolute inset-0 h-4 w-4 transition-all duration-300 ease-out dark:rotate-90 dark:scale-50 dark:opacity-0" />
            <Sun className="absolute inset-0 h-4 w-4 -rotate-90 scale-50 opacity-0 transition-all duration-300 ease-out dark:rotate-0 dark:scale-100 dark:opacity-100" />
          </span>
        </button>

        <div className="flex items-center bg-white/70 dark:bg-black/20 backdrop-blur-xl px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10">
          <Globe className="h-4 w-4 text-gray-700 dark:text-white/80 mr-1.5" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as SiteLang)}
            aria-label="Language"
            className="text-xs bg-transparent font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer appearance-none uppercase"
          >
            {SITE_LANGS.map((l) => (
              <option key={l} value={l} className="text-black">
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}

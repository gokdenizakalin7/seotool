'use client'

import Link from 'next/link'
import { Clock, MapPin, Store, UtensilsCrossed } from 'lucide-react'
import { sitePath } from '@/lib/site-url'
import { useSiteLang } from './i18n'
import type { SiteRestaurant } from './types'

/** Hakkımızda sekmesi: işletmenin yazdığı (ya da otomatik oluşturulan) metin ve kısa bilgiler */
export function AboutView({
  restaurant,
  slug,
  text,
  typeLabel,
  categories,
  primaryColor,
}: {
  restaurant: SiteRestaurant
  slug: string
  text: string
  typeLabel: string
  categories: string[]
  primaryColor: string
}) {
  const { t } = useSiteLang()
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const image = restaurant.cover_url || restaurant.logo_url

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-6 mb-24">
      <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-zinc-100">{t.navAbout}</h2>

      <article className="overflow-hidden rounded-[28px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        {image && (
          <img
            src={image}
            alt={restaurant.name}
            className={`w-full aspect-[16/7] ${restaurant.cover_url ? 'object-cover' : 'object-contain bg-gray-50 dark:bg-black/20 p-6'}`}
          />
        )}
        <div className="space-y-4 p-5 sm:p-7">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed text-gray-700 dark:text-zinc-300">
              {p}
            </p>
          ))}

          <div className="flex flex-wrap gap-2 pt-2">
            {typeLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-zinc-200">
                <Store className="h-3.5 w-3.5" /> {typeLabel}
              </span>
            )}
            {restaurant.city && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-zinc-200">
                <MapPin className="h-3.5 w-3.5" /> {restaurant.city}
              </span>
            )}
            {restaurant.working_hours && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-zinc-200">
                <Clock className="h-3.5 w-3.5" /> {restaurant.working_hours}
              </span>
            )}
          </div>
        </div>
      </article>

      {categories.length > 0 && (
        <Link
          href={sitePath(slug)}
          className="flex items-center gap-3 rounded-[24px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 p-4 shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: primaryColor }}>
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900 dark:text-zinc-100">{t.navMenu}</span>
            <span className="block truncate text-xs text-gray-500 dark:text-zinc-400">{categories.join(' · ')}</span>
          </span>
          <span className="text-gray-400">→</span>
        </Link>
      )}
    </main>
  )
}

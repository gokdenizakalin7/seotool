'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { CalendarDays, Info, Phone, UtensilsCrossed } from 'lucide-react'
import { sitePath, type SitePage } from '@/lib/site-url'
import { useSiteLang } from './i18n'

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

function isTextField(el: EventTarget | null) {
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}

/**
 * Yazı alanı odaktayken (ekran klavyesi açık) true. iOS'ta klavye açıkken sabit alt çubuk klavyenin
 * üstünde değil sayfanın ortasında asılı kalıyor; bu sürede gizlenir.
 */
function useTextFieldFocused() {
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => setFocused(isTextField(e.target))
    // relatedTarget: odağı alan öğe (yoksa null; ör. boşluğa dokunup klavye kapatıldı)
    const onFocusOut = (e: FocusEvent) => setFocused(isTextField(e.relatedTarget))
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    setFocused(isTextField(document.activeElement))
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  return focused
}

/**
 * Site sekmeleri: masaüstünde kapağın altında, mobilde altta sabit çubuk (menüdeki yapışkan kategori
 * şeridiyle çakışmasın). Etkin sekme layout'un bir altındaki segmentten okunur.
 */
export function SiteNav({ slug, hasEvents }: { slug: string; hasEvents: boolean }) {
  const segment = useSelectedLayoutSegment()
  const { t } = useSiteLang()
  const keyboardOpen = useTextFieldFocused()

  const items: { page: SitePage; label: string; icon: typeof Info }[] = [
    { page: '', label: t.navMenu, icon: UtensilsCrossed },
    ...(hasEvents ? [{ page: 'etkinlikler' as const, label: t.navEvents, icon: CalendarDays }] : []),
    { page: 'hakkimizda', label: t.navAbout, icon: Info },
    { page: 'iletisim', label: t.navContact, icon: Phone },
  ]
  const isActive = (page: SitePage) => (page === '' ? !segment || segment === '__PAGE__' : segment === page)

  return (
    <>
      <nav aria-label={t.navMenu} className="hidden sm:flex justify-center px-4 pt-5">
        <div className="inline-flex gap-1 rounded-full bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl p-1 border border-gray-200/70 dark:border-white/10 shadow-sm">
          {items.map(({ page, label, icon: Icon }) => (
            <Link
              key={page || 'menu'}
              href={sitePath(slug, page)}
              aria-current={isActive(page) ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive(page)
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <nav
        aria-label={t.navMenu}
        className={`${keyboardOpen ? 'hidden' : ''} sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ page, label, icon: Icon }) => (
            <Link
              key={page || 'menu'}
              href={sitePath(slug, page)}
              aria-current={isActive(page) ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
                isActive(page) ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-zinc-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive(page) ? 'stroke-[2.4]' : ''}`} />
              <span className="truncate max-w-full px-1">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}

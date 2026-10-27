'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Search,
  Utensils,
  Wifi,
  Copy,
  Check,
  AlertCircle,
  Flame,
  Star,
  Sparkles,
  CalendarDays,
  Gift,
  BadgePercent,
} from 'lucide-react'
import { flushSync } from 'react-dom'
import type { Menu, MenuCategory, MenuItem, ProductTag } from '@/lib/types'
import { catalogThumbUrl } from '@/lib/image-url'
import { CAMPAIGN_CATEGORY_ID } from '@/lib/campaigns'
import { displayPrice, parsePrice } from '@/lib/price'
import { formatEventTime } from '@/lib/events'
import { useSiteLang } from '@/components/public/site/i18n'
import { brandColor, type SiteNotice, type SiteRestaurant } from '@/components/public/site/types'

const getAllergenIcon = (allergen: string) => {
  const lower = allergen.toLowerCase()
  if (lower.includes('gluten') || lower.includes('buğday')) return '🌾'
  if (lower.includes('süt') || lower.includes('laktoz')) return '🥛'
  if (lower.includes('fıstık') || lower.includes('ceviz') || lower.includes('fındık')) return '🥜'
  if (lower.includes('yumurta')) return '🥚'
  if (lower.includes('balık') || lower.includes('deniz')) return '🐟'
  if (lower.includes('soya')) return '🫘'
  return '⚠️'
}

/** Fiyat planı / kampanya indirimi: "%17" */
/** Yapışkan kategori şeridinin altı (px): bölüm başlığı bu çizgiye gelince sekmesi aktif olur */
const SCROLL_SPY_OFFSET = 104

function savingsPercent(item: MenuItem): number | null {
  if (!item.original_price) return null
  const was = parsePrice(item.original_price)?.amount
  const now = parsePrice(item.price)?.amount
  if (!was || now == null || now >= was) return null
  const pct = Math.round(((was - now) / was) * 100)
  return pct > 0 ? pct : null
}

interface PublicMenuViewProps {
  /** Herkese açık restoran alanları (bkz. lib/server/public-menu.ts) */
  restaurant: SiteRestaurant | null
  /** Müşterinin gördüğü menü (yayındaki ilk menü; fiyat planı uygulanmış, kampanyalar ilk kategori) */
  menu?: Menu
  /** Önizlemede editördeki kaydedilmemiş tema rengi */
  primaryColor?: string | null
  /** Panel içi canlı önizleme: kategori kartları atlanır, görüntülenme sayılmaz */
  isPreview?: boolean
  /** Masa QR'ından gelindiyse masa adı / kimliği (masa okunma sayacı) */
  tableName?: string | null
  tableId?: string | null
  /** Menünün üstündeki duyurular (fiyat planı mesajı, bugünkü etkinlik) */
  notices?: SiteNotice[]
}

/** Menü sekmesi: sosyal kartlar, Wi-Fi, arama, kategoriler, ürünler ve ürün detayı. Kapak/sekme/altbilgi SiteShell'dedir. */
export function PublicMenuView({
  restaurant,
  menu: activeMenu,
  primaryColor: primaryColorOverride,
  isPreview = false,
  tableName,
  tableId,
  notices = [],
}: PublicMenuViewProps) {
  const { lang, t } = useSiteLang()
  const categoryLabel = (cat: Pick<MenuCategory, 'id' | 'name'>) => (cat.id === CAMPAIGN_CATEGORY_ID ? t.campaigns : cat.name)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [activeCategory, setActiveCategory] = useState<string>('')
  // İlk açılışta büyük kategori kartları; bir kategori seçilince liste görünümüne geçilir.
  // Editör önizlemesinde (preview=1) ürünler doğrudan görünsün diye atlanır.
  const [showLanding, setShowLanding] = useState(!isPreview)
  
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (activeCategory && tabsContainerRef.current) {
      const container = tabsContainerRef.current
      const activeTab = container.querySelector(`[data-category="${activeCategory}"]`) as HTMLElement
      if (activeTab) {
        const scrollLeft = activeTab.offsetLeft - container.clientWidth / 2 + activeTab.clientWidth / 2
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }
  }, [activeCategory])

  const categoryRefs = useRef<{ [key: string]: HTMLElement | null }>({})
  const isManualScrollRef = useRef(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [wifiCopied, setWifiCopied] = useState(false)

  // Görüntülenme sayımı menü göründükten sonra ayrı istekle; masa QR'ından gelindiyse masa sayacı da artar
  const restaurantId: string | undefined = restaurant?.id
  const isCountable = !isPreview && Boolean(restaurantId && !restaurant?.suspended && activeMenu)
  useEffect(() => {
    if (!isCountable) return
    const body = JSON.stringify({ orgId: restaurantId, table: tableName, tid: tableId })
    const sent = navigator.sendBeacon?.('/api/public/menu-view', new Blob([body], { type: 'application/json' }))
    if (!sent) {
      fetch('/api/public/menu-view', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    }
  }, [isCountable, restaurantId, tableName, tableId])

  const primaryColor = brandColor(restaurant, primaryColorOverride)

  // SADECE AKTİF OLAN KATEGORİLER
  const activeCategories = (activeMenu?.categories || []).filter(c => c.is_active)
  const allActiveItems = activeCategories.flatMap(c => c.items)

  const filteredCategories = activeCategories.map(cat => {
    const items = cat.items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesTag = selectedTag === 'all' || 
        (selectedTag === 'chef' && item.is_featured) ||
        (item.tags && item.tags.includes(selectedTag as ProductTag))

      return matchesSearch && matchesTag
    })
    return { ...cat, items }
  }).filter(cat => cat.items.length > 0)

  const landingVisible = showLanding && !searchTerm.trim() && filteredCategories.length > 1

  const openCategory = (categoryId: string) => {
    // Bölümler önce render edilsin ki scrollToCategory hedefi bulabilsin
    flushSync(() => setShowLanding(false))
    scrollToCategory(categoryId)
  }

  // Kaydırma takibi: sekme çubuğunun altına gelmiş son bölüm aktiftir. IntersectionObserver eşiği uzun
  // bölümlerde (mobilde tek sütun) hiç aşılmadığı için konum doğrudan ölçülür.
  const categoryIdsKey = filteredCategories.map((c) => c.id).join('|')
  useEffect(() => {
    if (landingVisible || !categoryIdsKey) return
    const ids = categoryIdsKey.split('|')
    let frame = 0
    const update = () => {
      frame = 0
      if (isManualScrollRef.current) return
      let current = ids[0]
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) {
        current = ids[ids.length - 1]
      } else {
        for (const id of ids) {
          const el = categoryRefs.current[id]
          if (!el) continue
          if (el.getBoundingClientRect().top > SCROLL_SPY_OFFSET) break
          current = id
        }
      }
      setActiveCategory((prev) => (prev === current ? prev : current))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [categoryIdsKey, landingVisible])

  // Sekmeye dokunulunca yumuşak kaydırma bitene kadar takip susar; mobilde uzun mesafeler 800 ms'yi aşabildiği için
  // sabit süre yerine kaydırmanın durması beklenir
  const releaseManualScrollRef = useRef<(() => void) | null>(null)
  useEffect(() => () => releaseManualScrollRef.current?.(), [])

  const scrollToCategory = (categoryId: string) => {
    releaseManualScrollRef.current?.()
    setActiveCategory(categoryId)
    const element = categoryRefs.current[categoryId]
    if (!element) return
    isManualScrollRef.current = true
    let idle = 0
    const release = () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(idle)
      window.clearTimeout(cap)
      isManualScrollRef.current = false
      releaseManualScrollRef.current = null
    }
    const onScroll = () => {
      window.clearTimeout(idle)
      idle = window.setTimeout(release, 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    idle = window.setTimeout(release, 400)
    const cap = window.setTimeout(release, 2500)
    releaseManualScrollRef.current = release
    const y = element.getBoundingClientRect().top + window.scrollY - SCROLL_SPY_OFFSET + 8
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const copyWifi = () => {
    if (restaurant?.wifi_password) {
      navigator.clipboard.writeText(restaurant.wifi_password)
      setWifiCopied(true)
      setTimeout(() => setWifiCopied(false), 2000)
    }
  }

  if (!restaurant) return null

  const igHandle = (restaurant.instagram_handle || '').replace(/^@+/, '')
  const showSocialCards = Boolean(igHandle || restaurant.google_review_url)

  return (
    <>
      {notices.length > 0 && (
        <div className="mx-4 mt-5 space-y-2 sm:mx-auto sm:max-w-2xl">
          {notices.map((notice) => {
            const Icon = notice.kind === 'event' ? CalendarDays : BadgePercent
            const text =
              notice.kind === 'event' && notice.startsAt
                ? `${notice.isNow ? t.liveNow : t.today} ${formatEventTime(notice.startsAt, lang)} · ${notice.text}`
                : notice.text
            const className =
              'flex items-center gap-2.5 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#242427] px-3 py-2.5 shadow-sm'
            const content = (
              <>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: primaryColor }}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-gray-800 dark:text-zinc-100">{text}</span>
                {notice.href && <span className="shrink-0 text-[11px] font-bold text-gray-400 dark:text-zinc-500">{t.seeEvents} →</span>}
              </>
            )
            return notice.href ? (
              <Link key={notice.id} href={notice.href} className={className}>
                {content}
              </Link>
            ) : (
              <div key={notice.id} className={className}>
                {content}
              </div>
            )
          })}
        </div>
      )}

        {showSocialCards && (
          <div
            className="bg-white dark:bg-[#242427] border border-gray-200 dark:border-[#333336] shadow-sm dark:shadow-none"
            style={{
              margin: '20px 16px 0',
              borderRadius: 18,
              display: 'grid',
              gridTemplateColumns: igHandle && restaurant.google_review_url ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
              overflow: 'hidden',
              containerType: 'inline-size',
            }}
          >
            {igHandle && (
              <a
                href={`https://instagram.com/${igHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className={restaurant.google_review_url ? 'border-r border-gray-200 dark:border-[#333336]' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 'clamp(6px, 2.6cqw, 10px)',
                  padding: '12px clamp(8px, 3.2cqw, 14px)',
                  minWidth: 0,
                }}
              >
                <div style={{ width: 'clamp(26px, 9cqw, 34px)', height: 'clamp(26px, 9cqw, 34px)', flexShrink: 0, borderRadius: '50%', background: 'rgba(240,90,140,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg style={{ width: '52%', height: '52%' }} viewBox="0 0 24 24" fill="none" stroke="#F27BA6" strokeWidth="1.9">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.3" cy="6.7" r="0.6" fill="#F27BA6" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span className="text-gray-500 dark:text-[#a1a1a6]" style={{ fontSize: 'clamp(10px, 3cqw, 11px)', whiteSpace: 'nowrap' }}>{t.instagramShort}</span>
                  <span className="text-gray-900 dark:text-white" style={{ fontSize: 'clamp(11px, 3.7cqw, 14px)', fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>@{igHandle}</span>
                </div>
              </a>
            )}
            {restaurant.google_review_url && (
              <a
                href={restaurant.google_review_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 'clamp(6px, 2.6cqw, 10px)',
                  padding: '12px clamp(8px, 3.2cqw, 14px)',
                  minWidth: 0,
                }}
              >
                <div style={{ width: 'clamp(26px, 9cqw, 34px)', height: 'clamp(26px, 9cqw, 34px)', flexShrink: 0, borderRadius: '50%', background: 'rgba(251,188,4,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg style={{ width: '52%', height: '52%' }} viewBox="0 0 24 24" fill="none" stroke="#F5C04A" strokeWidth="1.9" strokeLinejoin="round">
                    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span className="text-gray-500 dark:text-[#a1a1a6]" style={{ fontSize: 'clamp(10px, 3cqw, 11px)', whiteSpace: 'nowrap' }}>Google</span>
                  <span className="text-gray-900 dark:text-white" style={{ fontSize: 'clamp(11px, 3.7cqw, 14px)', fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{t.googleReviewShort}</span>
                </div>
              </a>
            )}
          </div>
        )}

        <main className="container mx-auto px-4 py-4 sm:py-5 max-w-5xl space-y-4 sm:space-y-5 mb-24">

          {restaurant.working_hours && (
            <p className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-zinc-400 text-center whitespace-pre-line -mt-1">
              <span className="font-bold text-gray-600 dark:text-zinc-300">{t.hours}:</span> {restaurant.working_hours}
            </p>
          )}

          {restaurant.wifi_name && (
            <div className="mx-auto w-full max-w-sm rounded-xl bg-white dark:bg-[#2c2c2e] px-2.5 py-2 shadow-sm border border-gray-100 dark:border-white/5 flex items-center gap-2">
              <div className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor }}>
                <Wifi className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[11px] font-bold text-gray-900 dark:text-zinc-100">{restaurant.wifi_name}</p>
                {restaurant.wifi_password && <p className="truncate text-[10px] font-mono text-gray-500 dark:text-zinc-400">{restaurant.wifi_password}</p>}
              </div>
              {restaurant.wifi_password && (
                <button onClick={copyWifi} className="shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: primaryColor }}>
                  {wifiCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {wifiCopied ? t.copied : t.copyWifi}
                </button>
              )}
            </div>
          )}

          <div className="relative w-full max-w-md mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
            {/* Mobilde 16px: iOS Safari daha küçük yazılı alana odaklanınca sayfayı büyütür, sayfa yana kayar */}
            <input
              placeholder={t.searchPlaceholder}
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="w-full pl-10 pr-4 h-10 text-base sm:text-sm bg-white dark:bg-[#2c2c2e]/60 backdrop-blur-xl rounded-full shadow-[0_4px_16px_rgb(0,0,0,0.05)] border border-gray-100/80 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-400 dark:text-zinc-200 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!landingVisible && filteredCategories.length > 0 && (
            <div className="sticky top-0 z-40 w-[calc(100%+2rem)] -mx-4 px-4 py-2 bg-[#F5F5F7]/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl sm:w-full sm:mx-0 sm:px-0 border-b border-gray-200/50 dark:border-white/5">
              <div 
                ref={tabsContainerRef}
                className="flex gap-1.5 overflow-x-auto hide-scrollbar scroll-smooth"
              >
                {filteredCategories.map(cat => (
                  <button
                    key={cat.id}
                    data-category={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`
                      px-3.5 py-1.5 rounded-full font-semibold text-xs whitespace-nowrap transition-all border
                      ${activeCategory === cat.id 
                        ? 'bg-gray-900 text-white border-transparent dark:bg-white dark:text-gray-900' 
                        : 'bg-white/80 dark:bg-[#2c2c2e] text-gray-600 dark:text-zinc-300 border-gray-100/80 dark:border-white/5 hover:bg-white dark:hover:bg-[#3a3a3c]'}
                    `}
                  >
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {landingVisible && (
            /* Karşılama: büyük kategori kartları */
            <div className="pt-2 pb-12">
              <h2 className="mb-3 text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">{t.categoriesTitle}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {filteredCategories.map((category, index) => {
                  const cover =
                    category.items.find((i) => i.is_featured && i.image_url)?.image_url ||
                    category.items.find((i) => i.image_url)?.image_url
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => openCategory(category.id)}
                      className="group relative aspect-[4/5] overflow-hidden rounded-[28px] text-left shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-none focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 animate-in fade-in slide-in-from-bottom-3 duration-[350ms] ease-out fill-mode-both"
                      style={{
                        animationDelay: `${Math.min(index, 10) * 40}ms`,
                        ...(cover ? {} : { background: `linear-gradient(145deg, ${primaryColor}, ${primaryColor}99)` }),
                      }}
                    >
                      {cover ? (
                        <img
                          src={catalogThumbUrl(cover)}
                          alt=""
                          loading={index < 6 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        />
                      ) : category.id === CAMPAIGN_CATEGORY_ID ? (
                        <Gift className="absolute right-4 top-4 h-10 w-10 text-white/40" />
                      ) : (
                        <Utensils className="absolute right-4 top-4 h-10 w-10 text-white/40" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                        <p className="text-base sm:text-lg font-bold leading-tight text-white capitalize line-clamp-2 drop-shadow-sm">{categoryLabel(category)}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/75">
                          {category.items.length} {t.itemsCount}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dergi Bento Izgarası. Karşılama kartları görünürken de sunucu HTML'inde (gizli): arama motorları ürün adı,
              fiyat ve açıklamayı kategoriye tıklamadan okur; gizli bölümdeki lazy görseller açılana kadar inmez */}
          <div className="space-y-10 pt-2 pb-12" hidden={landingVisible}>
            {!activeMenu || filteredCategories.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-[#2c2c2e] rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-gray-400 dark:text-zinc-500 text-base font-medium">
                <Utensils className="h-10 w-10 mx-auto mb-3 opacity-20" />
                {!activeMenu ? t.menuSoon : t.noItemsFound}
              </div>
            ) : (
              filteredCategories.map(category => (
                <section 
                  key={category.id} 
                  id={category.id}
                  ref={(el) => { categoryRefs.current[category.id] = el; }}
                  className="space-y-3 scroll-mt-28"
                >
                  <div className="mb-2 flex items-end justify-between border-b border-gray-200/60 dark:border-white/10 pb-2">
                    <div>
                      <h2 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-zinc-100 tracking-tight capitalize flex items-center gap-1.5">
                        {category.id === CAMPAIGN_CATEGORY_ID && <Gift className="h-5 w-5" style={{ color: primaryColor }} />}
                        {categoryLabel(category)}
                      </h2>
                      {category.description && (
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5 font-medium max-w-lg line-clamp-2">{category.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {[...category.items].sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)).map(item => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item)
                          setIsItemModalOpen(true)
                        }}
                        className={`
                          relative p-2 sm:p-3 flex gap-3 sm:gap-4 group cursor-pointer transition-all duration-300 hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 border
                          rounded-[24px] overflow-hidden
                          ${item.is_featured 
                            ? 'bg-gradient-to-br from-amber-100/80 via-orange-50/50 to-yellow-100/80 border-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.15)]' 
                            : 'bg-white dark:bg-[#2c2c2e] border-transparent dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-gray-200 dark:border-[#48484a]'}
                          ${!item.is_available ? 'opacity-50 grayscale' : ''}
                        `}
                      >
                        {/* Görsel Alanı. Liste gizliyken (karşılama kartları) base64 görsel çizilmez: veri zaten sayfa
                            yükünde, HTML'e ikinci kez gömülünce sayfa MB'larca büyüyordu (bkz. npm run images:localize) */}
                        {item.image_url && !(landingVisible && item.image_url.startsWith('data:')) ? (
                          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-[18px] overflow-hidden bg-gray-50 dark:bg-[#3a3a3c]/60 relative shadow-inner">
                            <img
                              src={catalogThumbUrl(item.image_url)}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                            />
                            {item.is_featured && (
                              <div className="absolute top-2 left-2 bg-white dark:bg-[#2c2c2e]/90 backdrop-blur-md text-amber-500 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                                <Star className="h-2.5 w-2.5 fill-amber-500" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-[18px] overflow-hidden bg-gray-50 dark:bg-[#3a3a3c]/60 flex items-center justify-center text-gray-300 relative shadow-inner border border-gray-100 dark:border-[#3a3a3c]/50">
                            <Utensils className="h-6 w-6" />
                          </div>
                        )}

                        {/* İçerik Alanı */}
                        <div className="flex-1 flex flex-col justify-between py-1 pr-2 min-w-0">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-extrabold text-[15px] sm:text-[17px] text-gray-900 dark:text-zinc-100 leading-tight mb-1 truncate">{item.name}</h3>
                              {!item.is_available && (
                                <span className="shrink-0 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
                                  {t.soldOut}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] sm:text-[12px] text-gray-500 dark:text-zinc-500 line-clamp-2 leading-relaxed font-medium">{item.description}</p>
                            {item.ingredients && item.ingredients.length > 0 && (
                              <p className="mt-0.5 text-[11px] sm:text-[12px] text-gray-500 dark:text-zinc-500 line-clamp-2 leading-relaxed font-medium">
                                <span className="font-bold text-gray-700 dark:text-zinc-300">{t.ingredients}:</span> {item.ingredients.join(', ')}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-gray-900/5">
                            <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="font-black text-lg sm:text-xl text-gray-900 dark:text-white">{displayPrice(item.price, restaurant?.currency)}</span>
                              {item.original_price && (
                                <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 line-through">{displayPrice(item.original_price, restaurant?.currency)}</span>
                              )}
                              {savingsPercent(item) && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[10px] font-black text-white"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  %{savingsPercent(item)} {t.savings}
                                </span>
                              )}
                            </div>

                            {/* Kalori ve Alerjenler */}
                            <div className="flex flex-wrap items-center gap-1.5 justify-end">
                              {item.allergens && item.allergens.length > 0 && (
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full border border-gray-200 dark:border-zinc-700">
                                  <AlertCircle className="h-3 w-3 text-gray-500 dark:text-zinc-400" />
                                  <span className="text-[9px] sm:text-[10px] font-bold text-gray-600 dark:text-zinc-300">
                                    {item.allergens.join(', ')}
                                  </span>
                                </div>
                              )}
                              
                              {item.calories && (
                                <div className="flex items-center gap-1 bg-white dark:bg-[#2c2c2e]/80 backdrop-blur-sm px-2 py-1 rounded-full border border-gray-200 dark:border-[#48484a]/50 shadow-sm">
                                  <Flame className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                                  <span className="text-[10px] sm:text-[11px] font-extrabold text-gray-600 dark:text-zinc-400">
                                    {(item.calorie_source === 'auto' || item.calorie_source === 'detailed') ? '~' : ''}{item.calories} <span className="font-medium text-gray-400 dark:text-zinc-500">kcal</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Şefin Tavsiyesi Vurgusu - Sağ Üst */}
                        {item.is_featured && (
                          <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none overflow-hidden rounded-tr-[24px]">
                            <div className="absolute top-[-10px] right-[-10px] w-12 h-12 bg-amber-400/20 rounded-full blur-xl"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

        </main>

      {/* Ürün Detay Modalı */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        {/* Modal sabit yükseklikli flex sütun: görsel sabit, detay alanı kendi içinde kayar. dvh: mobil tarayıcı çubukları hesaba katılır */}
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 flex flex-col overflow-hidden max-h-[90dvh] bg-white dark:bg-[#2c2c2e] rounded-[40px] border-none shadow-[0_40px_80px_rgba(0,0,0,0.2)]">
          {selectedItem && (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
              {/* Close Button on top of image */}
              <button 
                onClick={() => setIsItemModalOpen(false)}
                className="absolute top-4 right-4 z-50 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
              >
                <span className="sr-only">{t.close}</span>
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              </button>

              {/* Dev Görsel Alanı */}
              {selectedItem.image_url ? (
                <div className="relative h-[min(300px,35dvh)] sm:h-[min(350px,40dvh)] w-full shrink-0">
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/0 to-black/20 pointer-events-none" />
                  
                  {selectedItem.is_featured && (
                    <span className="absolute bottom-6 left-6 bg-amber-500/90 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg flex items-center">
                      <Star className="h-3.5 w-3.5 mr-1.5 fill-white" /> {t.chefChoice}
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-24 shrink-0 bg-gradient-to-b from-gray-100 to-white" />
              )}

              {/* Detay Alanı */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 pt-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight leading-tight pr-4">{selectedItem.name}</h3>
                  {selectedItem.price && (
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">{displayPrice(selectedItem.price, restaurant?.currency)}</span>
                      {selectedItem.original_price && (
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500 line-through">{displayPrice(selectedItem.original_price, restaurant?.currency)}</span>
                      )}
                    </div>
                  )}
                </div>

                {selectedItem.bundle && selectedItem.bundle.length > 0 ? (
                  <div className="mb-6 rounded-2xl border border-gray-100 dark:border-[#3a3a3c] bg-gray-50 dark:bg-[#3a3a3c]/60 p-4">
                    <h4 className="mb-2 flex items-center text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">
                      <Gift className="mr-1.5 h-3.5 w-3.5" /> {t.bundleContents}
                    </h4>
                    <ul className="space-y-1">
                      {selectedItem.bundle.map((b, i) => (
                        <li key={i} className="text-[15px] font-semibold text-gray-800 dark:text-zinc-200">
                          {b.quantity}× {b.name}
                        </li>
                      ))}
                    </ul>
                    {selectedItem.description && !selectedItem.description.includes('×') && (
                      <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400 font-medium leading-relaxed">{selectedItem.description}</p>
                    )}
                  </div>
                ) : (
                  selectedItem.description && (
                    <p className="text-[15px] text-gray-600 dark:text-zinc-400 font-medium leading-relaxed mb-6">
                      {selectedItem.description}
                    </p>
                  )
                )}

                {/* Bileşenler: açıklamanın hemen ardından, içindekiler listesi gibi */}
                {selectedItem.ingredients && selectedItem.ingredients.length > 0 && (
                  <div className="mb-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30">
                    <h4 className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-3">
                      {t.ingredients}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.ingredients.map((ing) => (
                        <span key={ing} className="bg-white dark:bg-[#2c2c2e] text-gray-800 dark:text-zinc-200 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-emerald-200 dark:border-emerald-800/40">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {/* Kalori */}
                  {selectedItem.calories && (
                    <div className="bg-gray-50 dark:bg-[#3a3a3c]/60 rounded-2xl p-4 border border-gray-100 dark:border-[#3a3a3c] flex flex-col items-center justify-center text-center">
                      <div className="bg-white dark:bg-[#2c2c2e] p-2 rounded-full shadow-sm mb-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                      </div>
                      <span className="text-lg font-black text-gray-900 dark:text-zinc-100 leading-none">
                        {(selectedItem.calorie_source === 'auto' || selectedItem.calorie_source === 'detailed') ? '~' : ''}{selectedItem.calories}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">{t.calories}</span>
                      {(selectedItem.calorie_source === 'auto' || selectedItem.calorie_source === 'detailed') && (
                        <div className="flex items-center text-[9px] text-primary mt-1 font-bold">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> {t.aiEstimate}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hazırlık Süresi veya Diğer Metrik */}
                  <div className="bg-gray-50 dark:bg-[#3a3a3c]/60 rounded-2xl p-4 border border-gray-100 dark:border-[#3a3a3c] flex flex-col items-center justify-center text-center">
                    <div className="bg-white dark:bg-[#2c2c2e] p-2 rounded-full shadow-sm mb-2">
                      <Utensils className="h-5 w-5 text-blue-500" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{t.stock}</span>
                    {selectedItem.is_available ? (
                      <span className="text-sm font-black text-emerald-600">{t.available}</span>
                    ) : (
                      <span className="text-sm font-black text-red-600">{t.soldOut}</span>
                    )}
                  </div>
                </div>

                {/* Alerjenler */}
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div className="mt-2 bg-gray-50 dark:bg-[#3a3a3c]/60 rounded-2xl p-4 border border-gray-100 dark:border-[#3a3a3c]">
                    <h4 className="text-[11px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
                      <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                      {t.allergens}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.allergens.map((alg) => (
                        <span key={alg} className="bg-white dark:bg-[#2c2c2e] text-gray-800 dark:text-zinc-200 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center border border-gray-200 dark:border-zinc-700">
                          <span className="mr-1.5 text-sm">{getAllergenIcon(alg)}</span> {alg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

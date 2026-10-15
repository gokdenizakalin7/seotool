'use client'

import React from 'react'
import { Clock, Globe, Mail, MapPin, MessageCircle, Navigation, Phone, Star } from 'lucide-react'
import { useSiteLang } from './i18n'
import type { SiteRestaurant } from './types'

function SocialIcon({ name }: { name: 'instagram' | 'facebook' | 'tiktok' | 'x' | 'youtube' }) {
  const common = { viewBox: '0 0 24 24', className: 'h-5 w-5', 'aria-hidden': true } as const
  switch (name) {
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.9">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v2.6c-1.4.1-2.6-.3-3.9-1.1v5.6c0 3.9-3.7 6.3-7 4.9-2.6-1.1-3.7-4.3-2.3-6.9 1-1.9 3-2.9 5.1-2.6v2.7c-.3-.1-.7-.1-1-.1-1.2.1-2.1 1.1-2 2.3.1 1.2 1.2 2.1 2.4 2 1.1-.1 1.9-1 1.9-2.1V3h2.9z" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8 1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3-5.2 3z" />
        </svg>
      )
  }
}

function ActionButton({ href, icon, label, primaryColor }: { href: string; icon: React.ReactNode; label: string; primaryColor: string }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex flex-col items-center gap-1.5 rounded-[20px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 px-2 py-3.5 text-center shadow-sm transition-transform hover:-translate-y-0.5"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: primaryColor }}>
        {icon}
      </span>
      <span className="text-xs font-bold text-gray-800 dark:text-zinc-100">{label}</span>
    </a>
  )
}

/** İletişim sekmesi: işletmenin panelde girdiği bilgilerden oluşur; boş alanlar gösterilmez */
export function ContactView({ restaurant, primaryColor }: { restaurant: SiteRestaurant; primaryColor: string }) {
  const { t } = useSiteLang()

  const phone = (restaurant.business_phone || '').replace(/[^\d+]/g, '')
  const whatsapp = (restaurant.whatsapp_number || '').replace(/\D/g, '')
  const email = restaurant.contact_email || ''
  const website = restaurant.website_url || ''
  const addressLine = [restaurant.address, restaurant.city].filter(Boolean).join(', ')
  const mapsQuery = encodeURIComponent(addressLine || restaurant.name)
  const directionsUrl = restaurant.google_maps_url || (addressLine ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : '')

  const socials = [
    restaurant.instagram_handle && { name: 'instagram' as const, label: 'Instagram', href: `https://instagram.com/${restaurant.instagram_handle.replace(/^@+/, '')}` },
    restaurant.facebook_url && { name: 'facebook' as const, label: 'Facebook', href: restaurant.facebook_url },
    restaurant.tiktok_handle && { name: 'tiktok' as const, label: 'TikTok', href: `https://www.tiktok.com/@${restaurant.tiktok_handle.replace(/^@+/, '')}` },
    restaurant.x_handle && { name: 'x' as const, label: 'X', href: `https://x.com/${restaurant.x_handle.replace(/^@+/, '')}` },
    restaurant.youtube_url && { name: 'youtube' as const, label: 'YouTube', href: restaurant.youtube_url },
  ].filter(Boolean) as { name: 'instagram' | 'facebook' | 'tiktok' | 'x' | 'youtube'; label: string; href: string }[]

  const actions = [
    phone && { href: `tel:${phone}`, icon: <Phone className="h-5 w-5" />, label: t.call },
    whatsapp && { href: `https://wa.me/${whatsapp}`, icon: <MessageCircle className="h-5 w-5" />, label: t.whatsapp },
    email && { href: `mailto:${email}`, icon: <Mail className="h-5 w-5" />, label: t.email },
    website && { href: website, icon: <Globe className="h-5 w-5" />, label: t.website },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[]

  const isEmpty = !actions.length && !addressLine && !socials.length && !restaurant.working_hours && !restaurant.google_review_url

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-5 mb-24">
      <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-zinc-100">{t.navContact}</h2>

      {isEmpty && (
        <div className="rounded-[28px] bg-white dark:bg-[#2c2c2e] py-16 text-center text-gray-400 dark:text-zinc-500 shadow-sm">
          <Phone className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">{t.contactEmpty}</p>
        </div>
      )}

      {actions.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(actions.length, 4)}, minmax(0, 1fr))` }}>
          {actions.map((a) => (
            <ActionButton key={a.href} {...a} primaryColor={primaryColor} />
          ))}
        </div>
      )}

      {(addressLine || directionsUrl) && (
        <section className="overflow-hidden rounded-[24px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 shadow-sm">
          {addressLine && (
            <iframe
              title={t.address}
              src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-56 w-full border-0"
            />
          )}
          <div className="flex items-start gap-3 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primaryColor }} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t.address}</p>
              {addressLine && <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{addressLine}</p>}
            </div>
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Navigation className="h-3.5 w-3.5" /> {t.directions}
              </a>
            )}
          </div>
        </section>
      )}

      {restaurant.working_hours && (
        <section className="flex items-start gap-3 rounded-[24px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 p-4 shadow-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primaryColor }} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t.hours}</p>
            <p className="whitespace-pre-line text-sm font-semibold text-gray-800 dark:text-zinc-100">{restaurant.working_hours}</p>
          </div>
        </section>
      )}

      {socials.length > 0 && (
        <section className="rounded-[24px] bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 p-4 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t.followUs}</p>
          <div className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 px-3.5 py-2 text-sm font-semibold text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <SocialIcon name={s.name} /> {s.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {restaurant.google_review_url && (
        <a
          href={restaurant.google_review_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[24px] border border-amber-200 dark:border-amber-500/20 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/5 p-4 shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
            <Star className="h-5 w-5 fill-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900 dark:text-zinc-100">{t.reviewUs}</span>
            <span className="block text-xs text-gray-600 dark:text-zinc-400">{t.reviewDesc}</span>
          </span>
          <span className="text-gray-400">→</span>
        </a>
      )}
    </main>
  )
}

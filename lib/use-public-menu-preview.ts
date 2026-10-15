'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Menu, Restaurant } from '@/lib/types'

/** Müşteri sayfasının beklediği (DB sütun adlı) restoran nesnesi. */
export function toPublicRestaurant(r: Restaurant | null | undefined, primaryColor?: string) {
  const b = r?.businessInfo
  return {
    id: r?.id,
    name: r?.name,
    logo_url: r?.branding?.logoUrl || '',
    cover_url: r?.branding?.coverUrl || r?.branding?.bannerUrl || '',
    business_type: r?.businessType,
    address: b?.address,
    city: b?.city,
    business_phone: b?.phone,
    working_hours: b?.workingHours,
    instagram_handle: b?.instagramHandle,
    whatsapp_number: b?.whatsappNumber,
    google_maps_url: b?.googleMapsUrl,
    google_review_url: b?.googleReviewUrl,
    contact_email: b?.contactEmail,
    website_url: b?.websiteUrl,
    facebook_url: b?.facebookUrl,
    tiktok_handle: b?.tiktokHandle,
    x_handle: b?.xHandle,
    youtube_url: b?.youtubeUrl,
    about_text: r?.about?.text,
    wifi_name: b?.wifi_name,
    wifi_password: b?.wifi_password,
    primary_color: primaryColor || r?.branding?.primaryColor,
    branding: { primaryColor: primaryColor || r?.branding?.primaryColor },
  }
}

/**
 * Müşteri menü sayfasını iframe'de (?preview=1) gösterip düzenlemeleri postMessage ile aktarır.
 * Dönen ref, <iframe ref={iframeRef} src={`/menu/${subdomain}?preview=1`} /> öğesine verilir.
 */
export function usePublicMenuPreview(params: {
  menu: Menu | null
  restaurant: Restaurant | null | undefined
  primaryColor?: string
}) {
  const { menu, restaurant, primaryColor } = params
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const send = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'qr-preview-data',
        menu,
        primaryColor: primaryColor || restaurant?.branding?.primaryColor,
        restaurant: toPublicRestaurant(restaurant, primaryColor),
      },
      window.location.origin
    )
  }, [menu, restaurant, primaryColor])

  useEffect(() => {
    send()
  }, [send])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'qr-preview-ready') send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [send])

  return iframeRef
}

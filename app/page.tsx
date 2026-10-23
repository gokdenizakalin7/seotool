import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'
import { canonicalOrigin } from '@/lib/site-url'
import { jsonLdHtml } from '@/lib/site-seo'

/**
 * Ana sayfa sunucuda çizilir: arama motorları ve paylaşım önizlemeleri içeriği JS çalıştırmadan görür.
 * (Panel SPA'sı içinde "/"a dönülünce aynı LandingPage ClientApp'ten çizilir.)
 */

const TITLE = 'QR Menü: Fotoğraftan Dijital Karekod Menü | QR Chef'
const DESCRIPTION =
  'Restoran ve kafeler için QR menü: menünüzün fotoğrafını çekin, yapay zekâ ürün, fiyat ve kalorileri çıkarsın. Masa QR kodu ve işletme sitesi tek panelde.'
const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: 'QR Chef — yapay zekâ destekli QR menü' }

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: '/',
    siteName: 'QR Chef',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
}

function homeJsonLd() {
  const origin = canonicalOrigin()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'QR Chef',
        url: `${origin}/`,
        logo: `${origin}/icon.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'QR Chef',
        url: `${origin}/`,
        inLanguage: 'tr-TR',
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  }
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(homeJsonLd()) }} />
      <LandingPage />
    </>
  )
}

import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'
import { HomeSections } from '@/components/landing/HomeSections'
import { MarketingFooterLinks } from '@/components/marketing/MarketingFooterLinks'
import { canonicalOrigin } from '@/lib/site-url'
import { jsonLdHtml } from '@/lib/site-seo'
import { HOME_FAQ } from '@/lib/marketing/home-faq'
import { faqLd, marketingMetadata, OG_IMAGE, ORGANIZATION_ID, WEBSITE_ID } from '@/lib/marketing/seo'

/**
 * Ana sayfa sunucuda çizilir: arama motorları ve paylaşım önizlemeleri içeriği JS çalıştırmadan görür.
 * İşletme türleri, SSS ve rehber bölümleri ile alt bilgi bağlantıları sunucu bileşeni olarak LandingPage'e verilir.
 * (Panel SPA'sı içinde "/"a dönülünce aynı LandingPage ClientApp'ten bu bölümler olmadan çizilir.)
 */

const TITLE = 'QR Menü: Fotoğraftan Dijital Karekod Menü | QR Chef'
const DESCRIPTION =
  'Restoran ve kafeler için QR menü: menünüzün fotoğrafını çekin, yapay zekâ ürün, fiyat ve kalorileri çıkarsın. Masa QR kodu ve işletme sitesi tek panelde.'

export const metadata: Metadata = marketingMetadata({ title: TITLE, description: DESCRIPTION, path: '/' })

function homeJsonLd() {
  const origin = canonicalOrigin()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID(),
        name: 'QR Chef',
        url: `${origin}/`,
        logo: `${origin}/icon.png`,
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID(),
        name: 'QR Chef',
        url: `${origin}/`,
        inLanguage: 'tr-TR',
        publisher: { '@id': ORGANIZATION_ID() },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${origin}/#app`,
        name: 'QR Chef',
        description: DESCRIPTION,
        url: `${origin}/`,
        image: `${origin}${OG_IMAGE.url}`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'QR menü ve dijital menü yönetimi',
        operatingSystem: 'Web',
        inLanguage: 'tr-TR',
        // Hizmet şu an ücretsiz (bkz. Kullanım Koşulları); ücretli plan gelirse burası güncellenmeli
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
        featureList: [
          'Menü fotoğrafından yapay zekâ ile otomatik aktarım',
          'Porsiyon başına kalori tahmini',
          'Bileşen ve alerjen bilgisi',
          'Masa bazlı QR kodlar',
          'İşletme sitesi: menü, etkinlikler, hakkımızda, iletişim',
          'Kampanyalar ve takvimli fiyat planları',
        ],
        publisher: { '@id': ORGANIZATION_ID() },
      },
    ],
  }
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(homeJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd(HOME_FAQ)) }} />
      <LandingPage sections={<HomeSections />} footerLinks={<MarketingFooterLinks tone="dark" />} />
    </>
  )
}

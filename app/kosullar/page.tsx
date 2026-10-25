import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  description: 'QR Chef QR menü ve işletme sitesi hizmetinin kullanım koşulları: hesap, içerik, hizmet kapsamı, sorumluluk ve uyuşmazlık hükümleri.',
  alternates: { canonical: '/kosullar' },
}

// Sunucuda çizilir (arama motoru metni JS'siz görür). Statik klasör app/[slug] işletme sitesinin bu adresi
// yakalamaması için de gerekli (bkz. lib/site-url.ts RESERVED_SLUGS)
export default function LegalRoutePage() {
  return <LegalPage kind="terms" />
}

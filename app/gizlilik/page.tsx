import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
  description: 'QR Chef gizlilik politikası ve KVKK aydınlatma metni: hangi kişisel verilerin hangi amaçla işlendiği, saklama süreleri ve başvuru haklarınız.',
  alternates: { canonical: '/gizlilik' },
}

// Sunucuda çizilir (arama motoru metni JS'siz görür). Statik klasör app/[slug] işletme sitesinin bu adresi
// yakalamaması için de gerekli (bkz. lib/site-url.ts RESERVED_SLUGS)
export default function LegalRoutePage() {
  return <LegalPage kind="privacy" />
}

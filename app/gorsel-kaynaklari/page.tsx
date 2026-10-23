import type { Metadata } from 'next'
import { ClientApp } from '@/components/ClientApp'

export const metadata: Metadata = { title: 'Görsel Kaynakları', robots: { index: false, follow: true } }

// Panel (SPA) yolu: app/[slug] işletme sitesinin bu adresi yakalamaması için statik klasör (bkz. lib/site-url.ts RESERVED_SLUGS)
export default function ImageCreditsPage() {
  return <ClientApp />
}

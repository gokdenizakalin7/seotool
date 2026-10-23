import type { Metadata } from 'next'
import { ClientApp } from '@/components/ClientApp'

export const metadata: Metadata = { title: 'Kullanım Koşulları' }

// Panel (SPA) yolu: app/[slug] işletme sitesinin bu adresi yakalamaması için statik klasör (bkz. lib/site-url.ts RESERVED_SLUGS)
export default function LegalRoutePage() {
  return <ClientApp />
}

'use client'

import { ClientApp } from '@/components/ClientApp'

// Panel (SPA) yolu: app/[slug] işletme sitesinin bu adresi yakalamaması için statik klasör (bkz. lib/site-url.ts RESERVED_SLUGS)
export default function AdminPage() {
  return <ClientApp />
}

import { permanentRedirect } from 'next/navigation'

// Restoran rehberi kaldırıldı; eski bağlantılar ana sayfaya (308). Statik klasör app/[slug]'ın bu adresi yakalamaması için kalır (bkz. lib/site-url.ts RESERVED_SLUGS)
export default function BusinessPage() {
  permanentRedirect('/')
}

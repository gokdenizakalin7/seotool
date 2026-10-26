import Link from 'next/link'
import { FOOTER_COLUMNS } from '@/lib/marketing/nav'

/**
 * Tanıtım sayfalarının alt bilgi bağlantıları (sunucu bileşeni: bağlantı listesi istemci paketine girmez).
 * Ana sayfada koyu (landing), içerik sayfalarında açık zeminde.
 */
export function MarketingFooterLinks({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const heading = tone === 'dark' ? 'text-white/80' : 'text-gray-900'
  // Koyu zeminde en az white/70: daha soluk tonlar WCAG kontrast oranını (4.5:1) karşılamıyor
  const link = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
  return (
    <nav aria-label="Site haritası" className="grid grid-cols-1 gap-8 sm:grid-cols-3">
      {FOOTER_COLUMNS.map((col) => (
        <div key={col.title}>
          <p className={`text-sm font-bold ${heading}`}>{col.title}</p>
          <ul className="mt-3 space-y-2">
            {col.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`text-sm transition-colors ${link}`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

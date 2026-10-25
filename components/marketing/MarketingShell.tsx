import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { QrChefMark, QrChefWordmark } from '@/components/brand/qr-chef-logo'
import { MarketingFooterLinks } from '@/components/marketing/MarketingFooterLinks'

/**
 * İçerik sayfalarının (/qr-menu, /blog) iskeleti: üst menü, içerik, kayıt çağrısı ve site haritası alt bilgisi.
 * Sunucu bileşeni; sayfa JS'siz okunur.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center font-extrabold text-xl text-gray-900 tracking-tight" aria-label="QR Chef ana sayfa">
            <QrChefMark size={32} secondary="#9ca3af" className="mr-2.5" />
            <QrChefWordmark chefClassName="text-gray-400" />
          </Link>
          <nav aria-label="Ana menü" className="ml-auto flex items-center gap-5 text-sm font-semibold">
            <Link href="/qr-menu" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Çözümler
            </Link>
            <Link href="/blog" className="hidden text-gray-600 hover:text-gray-900 sm:inline">
              Rehber
            </Link>
            <Link href="/login" className="text-gray-600 hover:text-gray-900">
              Giriş
            </Link>
            <Link href="/signup" className="rounded-full bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
              Ücretsiz Başla
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-20 border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <MarketingFooterLinks />
          <p className="mt-10 text-xs text-gray-400">© {new Date().getFullYear()} QR Chef • QR Menü ve İşletme Sitesi</p>
        </div>
      </footer>
    </div>
  )
}

/** Sayfa sonu kayıt çağrısı */
export function SignupCta({ title, text }: { title: string; text: string }) {
  return (
    <section className="mx-auto mt-16 max-w-4xl px-4 sm:px-6">
      <div className="rounded-3xl bg-gray-900 px-6 py-10 text-center text-white sm:px-12">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/70">{text}</p>
        <Link
          href="/signup"
          className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 font-bold text-gray-900 transition-transform hover:scale-105"
        >
          Ücretsiz Başla <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

/** Görünür kırıntı: Ana sayfa › … (BreadcrumbList yapısal verisiyle aynı sırada) */
export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Konum" className="text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">›</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-gray-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-gray-700">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

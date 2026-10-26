import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Breadcrumbs, MarketingShell, SignupCta } from '@/components/marketing/MarketingShell'
import { ExampleSites } from '@/components/marketing/ExampleSites'
import { BUSINESS_PAGES, businessPagePath } from '@/lib/marketing/business-pages'
import { breadcrumbLd, marketingMetadata } from '@/lib/marketing/seo'
import { listExampleSites } from '@/lib/server/marketing'
import { jsonLdHtml } from '@/lib/site-seo'

/** İşletme türlerine göre QR menü sayfalarının dizini ve QR Chef kullanan işletmeler (saatte bir yenilenir) */
export const revalidate = 3600

const TITLE = 'İşletme Türüne Göre QR Menü: Kafe, Restoran, Bar, Pastane | QR Chef'
const DESCRIPTION =
  'Kafe, restoran, bar, nargile kafe, pastane, kebapçı, burger ve meyhane için QR menü. İşletmenize uygun özellikleri ve QR Chef kullanan gerçek işletmeleri görün.'

export const metadata: Metadata = marketingMetadata({ title: TITLE, description: DESCRIPTION, path: '/qr-menu' })

export default async function QrMenuIndexPage() {
  const examples = await listExampleSites({ limit: 12 })
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            breadcrumbLd([
              { name: 'QR Chef', path: '/' },
              { name: 'QR Menü Çözümleri', path: '/qr-menu' },
            ])
          ),
        }}
      />
      <section className="bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
          <Breadcrumbs items={[{ href: '/', label: 'Ana sayfa' }, { label: 'QR Menü Çözümleri' }]} />
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">İşletmenize göre QR menü</h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Her işletmenin menüsü farklı dertlerle değişir: kafede mevsimlik içecekler, barda happy hour, pastanede alerjenler, meyhanede
            günün balığı. QR Chef aynı panelde hepsine cevap verir; aşağıdan işletme türünüze uygun kullanım örneklerini inceleyin.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_PAGES.map((p) => (
            <li key={p.slug}>
              <Link
                href={businessPagePath(p.slug)}
                className="group flex h-full flex-col rounded-3xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
              >
                <h2 className="text-xl font-bold text-gray-900">{p.h1}</h2>
                <p className="mt-2 flex-1 text-gray-600">{p.description}</p>
                <span className="mt-4 inline-flex items-center text-sm font-bold text-gray-900 group-hover:underline">
                  {p.name} QR menü <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ExampleSites title="QR Chef kullanan işletmeler" sites={examples} />

      <SignupCta
        title="Menünüz on dakikada dijitalde"
        text="Fotoğraftan menü aktarımı, masa QR kodları ve işletme siteniz tek panelde. QR Chef şu an ücretsiz."
      />
    </MarketingShell>
  )
}

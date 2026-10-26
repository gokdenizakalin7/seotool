import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Sparkles } from 'lucide-react'
import { Breadcrumbs, MarketingShell, SignupCta } from '@/components/marketing/MarketingShell'
import { ExampleSites } from '@/components/marketing/ExampleSites'
import { BUSINESS_PAGES, businessPagePath, getBusinessPage } from '@/lib/marketing/business-pages'
import { BLOG_POSTS, blogPostPath } from '@/lib/blog/posts'
import { breadcrumbLd, faqLd, marketingMetadata } from '@/lib/marketing/seo'
import { listExampleSites } from '@/lib/server/marketing'
import { jsonLdHtml } from '@/lib/site-seo'

/**
 * İşletme türüne göre QR menü sayfası (/qr-menu/kafe …). Metin lib/marketing/business-pages.ts'te; örnek siteler
 * saatte bir yenilenir. Listede olmayan tür 404.
 */
export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return BUSINESS_PAGES.map((p) => ({ tur: p.slug }))
}

type Params = Promise<{ tur: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = getBusinessPage((await params).tur)
  if (!page) return {}
  return marketingMetadata({ title: `${page.title} | QR Chef`, description: page.description, path: businessPagePath(page.slug) })
}

/** Her işletme türünde ortak olan özellikler (kısa) */
const COMMON_FEATURES = [
  'Menü fotoğrafından yapay zekâ ile otomatik aktarım',
  'Porsiyon başına kalori tahmini, bileşen ve alerjen bilgisi',
  'Genel ve masa bazlı QR kodlar, baskıya hazır şablonlar',
  'qr-chef.com.tr/isletmeniz adresinde menü, etkinlik, hakkımızda ve iletişim sayfaları',
  'Kampanyalar ve gün/saate göre değişen fiyat planları',
  'Türkçe, İngilizce, Arapça ve Rusça site arayüzü',
]

export default async function BusinessTypePage({ params }: { params: Params }) {
  const page = getBusinessPage((await params).tur)
  if (!page) notFound()
  const examples = await listExampleSites({ type: page.type, limit: 6 })
  const others = BUSINESS_PAGES.filter((p) => p.slug !== page.slug)

  const crumbs = [
    { name: 'QR Chef', path: '/' },
    { name: 'QR Menü Çözümleri', path: '/qr-menu' },
    { name: `${page.name} QR Menü`, path: businessPagePath(page.slug) },
  ]

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd(page.faq)) }} />

      <section className="bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
          <Breadcrumbs items={[{ href: '/', label: 'Ana sayfa' }, { href: '/qr-menu', label: 'QR Menü Çözümleri' }, { label: page.name }]} />
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">{page.h1}</h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">{page.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-gray-900 px-6 py-3 font-bold text-white hover:bg-gray-700">
              Ücretsiz QR menü oluştur
            </Link>
            {examples[0] && (
              <Link href={`/${examples[0].slug}`} className="rounded-full border border-gray-300 px-6 py-3 font-bold text-gray-800 hover:bg-gray-50">
                Örnek menüyü gör
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-4 max-w-4xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">{page.name} menülerinde sık kullanılan kategoriler</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {page.categories.map((c) => (
            <li key={c} className="rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-sm font-medium text-gray-700">
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-gray-600">
          Menünüzün fotoğrafını yüklediğinizde kategoriler ürünlerinizle birlikte otomatik oluşur; sıralarını ve adlarını dilediğiniz gibi
          değiştirebilirsiniz.
        </p>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-gray-900">
          {page.plural} için QR Chef&apos;te neler var?
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {page.benefits.map((b) => (
            <article key={b.title} className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
              <Sparkles className="h-6 w-6 text-gray-900" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-bold text-gray-900">{b.title}</h3>
              <p className="mt-2 leading-relaxed text-gray-600">{b.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-4xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Her QR Chef menüsünde</h2>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COMMON_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-3 text-gray-700">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </section>

      <ExampleSites title={`QR Chef kullanan ${page.plural.toLocaleLowerCase('tr')}`} sites={examples} />

      <section className="mx-auto mt-16 max-w-4xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Sık sorulan sorular</h2>
        <dl className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
          {page.faq.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-bold text-gray-900">{f.q}</dt>
              <dd className="mt-2 leading-relaxed text-gray-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto mt-16 grid grid-cols-1 max-w-4xl gap-10 px-4 sm:grid-cols-2 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Diğer işletme türleri</h2>
          <ul className="mt-3 space-y-2">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={businessPagePath(p.slug)} className="text-gray-600 hover:text-gray-900 hover:underline">
                  {p.h1}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Rehber</h2>
          <ul className="mt-3 space-y-2">
            {BLOG_POSTS.map((p) => (
              <li key={p.slug}>
                <Link href={blogPostPath(p.slug)} className="text-gray-600 hover:text-gray-900 hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SignupCta
        title={`${page.name} menünüzü bugün dijitale taşıyın`}
        text="Menünüzün fotoğrafını yükleyin, site adresinizi seçin, QR kodunuzu basın. QR Chef şu an ücretsiz."
      />
    </MarketingShell>
  )
}

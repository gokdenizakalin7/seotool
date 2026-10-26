import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BUSINESS_PAGES, businessPagePath } from '@/lib/marketing/business-pages'
import { BLOG_POSTS, blogPostPath } from '@/lib/blog/posts'
import { HOME_FAQ } from '@/lib/marketing/home-faq'

/**
 * Ana sayfanın sunucuda çizilen bölümleri (app/page.tsx → LandingPage'e prop): işletme türleri, rehber ve SSS.
 * İçerik sayfalarına iç bağlantı verir; metinleri istemci paketine girmez. Panel SPA'sındaki landing'de yoktur.
 */
export function HomeSections() {
  return (
    <>
      <section className="w-full py-24" aria-labelledby="isletme-turleri">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 text-center">
            <h2 id="isletme-turleri" className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              İşletmenize göre QR menü
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/50">
              Kafeden meyhaneye, her işletme türü için hazır kategori yapısı ve o türe özel kullanım örnekleri.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BUSINESS_PAGES.map((p) => (
              <li key={p.slug}>
                <Link
                  href={businessPagePath(p.slug)}
                  className="group flex h-full flex-col rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:bg-white/10"
                >
                  <h3 className="text-lg font-bold text-white">{p.name} QR Menü</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">{p.categories.slice(0, 4).join(', ')}…</p>
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-white/80 group-hover:text-white">
                    İncele <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="w-full py-24" aria-labelledby="sss">
        <div className="container mx-auto max-w-4xl px-4 md:px-6">
          <h2 id="sss" className="text-center text-4xl font-bold tracking-tight text-white md:text-5xl">
            Sık sorulan sorular
          </h2>
          <dl className="mt-12 divide-y divide-white/10 rounded-[32px] border border-white/10 bg-white/5 px-6 backdrop-blur-xl md:px-10">
            {HOME_FAQ.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="text-lg font-bold text-white">{f.q}</dt>
                <dd className="mt-2 leading-relaxed text-white/60">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="w-full pb-24" aria-labelledby="rehber">
        <div className="container mx-auto max-w-5xl px-4 md:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="rehber" className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              QR menü rehberi
            </h2>
            <Link href="/blog" className="shrink-0 text-sm font-semibold text-white/70 hover:text-white">
              Tüm yazılar →
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {BLOG_POSTS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={blogPostPath(p.slug)}
                  className="block h-full rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:bg-white/10"
                >
                  <h3 className="text-lg font-bold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{p.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

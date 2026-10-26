import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs, MarketingShell, SignupCta } from '@/components/marketing/MarketingShell'
import { BLOG_POSTS, blogPostPath, getBlogPost } from '@/lib/blog/posts'
import { BLOG_BODIES } from '@/lib/blog/bodies'
import { BUSINESS_PAGES, businessPagePath } from '@/lib/marketing/business-pages'
import { articleLd, breadcrumbLd, faqLd, formatDateTr, marketingMetadata } from '@/lib/marketing/seo'
import { jsonLdHtml } from '@/lib/site-seo'

/** Rehber yazısı: derleme anında statik üretilir; listede olmayan adres 404 */
export const dynamicParams = false

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = getBlogPost((await params).slug)
  if (!post) return {}
  return marketingMetadata({
    title: post.title,
    description: post.description,
    path: blogPostPath(post.slug),
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  })
}

/** Yazı gövdesi tipografisi (typography eklentisi yok; alt öğe seçicileriyle) */
const PROSE =
  'text-[17px] leading-8 text-gray-700 [&_p]:mt-5 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-gray-900 ' +
  '[&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-gray-900 [&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 ' +
  '[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-gray-900 [&_a]:font-semibold [&_a]:text-gray-900 ' +
  '[&_a]:underline [&_a]:underline-offset-2 [&_em]:text-gray-500'

export default async function BlogPostPage({ params }: { params: Params }) {
  const post = getBlogPost((await params).slug)
  const Body = post && BLOG_BODIES[post.slug]
  if (!post || !Body) notFound()
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug)

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleLd(post)) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            breadcrumbLd([
              { name: 'QR Chef', path: '/' },
              { name: 'Rehber', path: '/blog' },
              { name: post.shortTitle, path: blogPostPath(post.slug) },
            ])
          ),
        }}
      />
      {post.faq?.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd(post.faq)) }} /> : null}

      <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Breadcrumbs items={[{ href: '/', label: 'Ana sayfa' }, { href: '/blog', label: 'Rehber' }, { label: post.shortTitle }]} />
        <header className="mt-6">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-[42px]">{post.title}</h1>
          <p className="mt-4 text-sm text-gray-500">
            QR Chef Rehber · <time dateTime={post.updatedAt}>{formatDateTr(post.updatedAt)}</time> · {post.readingMinutes} dk okuma
          </p>
        </header>

        <div className={`mt-6 ${PROSE}`}>
          <Body />
        </div>

        {post.faq?.length ? (
          <section className="mt-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Sık sorulan sorular</h2>
            <dl className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
              {post.faq.map((f) => (
                <div key={f.q} className="py-5">
                  <dt className="font-bold text-gray-900">{f.q}</dt>
                  <dd className="mt-2 leading-relaxed text-gray-600">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {post.sources?.length ? (
          <section className="mt-10">
            <h2 className="text-base font-bold text-gray-900">Kaynaklar</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-600">
              {post.sources.map((s) => (
                <li key={s.label}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <SignupCta
        title="QR menünüzü on dakikada hazırlayın"
        text="Menünüzün fotoğrafını yükleyin; ürünler, fiyatlar ve kaloriler otomatik çıksın. QR Chef şu an ücretsiz."
      />

      <section className="mx-auto mt-16 grid grid-cols-1 max-w-3xl gap-10 px-4 sm:grid-cols-2 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Diğer yazılar</h2>
          <ul className="mt-3 space-y-2">
            {related.map((p) => (
              <li key={p.slug}>
                <Link href={blogPostPath(p.slug)} className="text-gray-600 hover:text-gray-900 hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">İşletmenize göre QR menü</h2>
          <ul className="mt-3 space-y-2">
            {BUSINESS_PAGES.map((p) => (
              <li key={p.slug}>
                <Link href={businessPagePath(p.slug)} className="text-gray-600 hover:text-gray-900 hover:underline">
                  {p.h1}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingShell>
  )
}

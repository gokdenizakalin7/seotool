import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs, MarketingShell, SignupCta } from '@/components/marketing/MarketingShell'
import { BLOG_POSTS, blogPostPath } from '@/lib/blog/posts'
import { breadcrumbLd, formatDateTr, marketingMetadata } from '@/lib/marketing/seo'
import { jsonLdHtml } from '@/lib/site-seo'

const TITLE = 'QR Menü Rehberi: Mevzuat, Kurulum ve İpuçları | QR Chef'
const DESCRIPTION =
  'Restoran ve kafeler için QR menü rehberi: QR menü zorunlu mu, menüde kalori ve alerjen bilgisi, QR menü nasıl yapılır ve daha fazlası.'

export const metadata: Metadata = marketingMetadata({ title: TITLE, description: DESCRIPTION, path: '/blog' })

export default function BlogIndexPage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            breadcrumbLd([
              { name: 'QR Chef', path: '/' },
              { name: 'Rehber', path: '/blog' },
            ])
          ),
        }}
      />
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Breadcrumbs items={[{ href: '/', label: 'Ana sayfa' }, { label: 'Rehber' }]} />
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">QR menü rehberi</h1>
        <p className="mt-4 text-lg text-gray-600">
          Restoran, kafe ve barlar için dijital menü, mevzuat ve misafir deneyimi üzerine pratik yazılar.
        </p>

        <ul className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug} className="py-7">
              <article>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                  <Link href={blogPostPath(post.slug)} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 leading-relaxed text-gray-600">{post.description}</p>
                <p className="mt-3 text-sm text-gray-400">
                  <time dateTime={post.updatedAt}>{formatDateTr(post.updatedAt)}</time> · {post.readingMinutes} dk okuma
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
      <SignupCta
        title="Menünüzü dijitale taşıyın"
        text="Fotoğraftan menü aktarımı, kalori ve alerjen bilgisi, masa QR kodları ve işletme siteniz tek panelde."
      />
    </MarketingShell>
  )
}

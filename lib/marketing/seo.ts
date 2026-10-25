import type { Metadata } from 'next'
import { canonicalOrigin } from '@/lib/site-url'

/**
 * QR Chef'in kendi tanıtım sayfaları (ana sayfa, /qr-menu, /blog) için meta etiketi ve yapısal veri yardımcıları.
 * Kuruluş ve web sitesi kimlikleri ana sayfadaki JSON-LD ile aynı (@id ile bağlanır).
 */

export const ORGANIZATION_ID = () => `${canonicalOrigin()}/#organization`
export const WEBSITE_ID = () => `${canonicalOrigin()}/#website`

export const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: 'QR Chef — yapay zekâ destekli QR menü' }

/** Tanıtım sayfası meta etiketleri; title mutlak verilir (ör. "… | QR Chef" sayfa başlığında zaten var) */
export function marketingMetadata({
  title,
  description,
  path,
  type = 'website',
  publishedTime,
  modifiedTime,
}: {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
}): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: 'tr_TR',
      url: path,
      siteName: 'QR Chef',
      title,
      description,
      images: [OG_IMAGE],
      ...(type === 'article' ? { publishedTime, modifiedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  }
}

/** Kırıntı; son öğe bulunulan sayfa */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  const origin = canonicalOrigin()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: `${origin}${item.path}` })),
  }
}

export function faqLd(faq: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

export function articleLd(post: { slug: string; title: string; description: string; publishedAt: string; updatedAt: string }) {
  const origin = canonicalOrigin()
  const url = `${origin}/blog/${post.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    inLanguage: 'tr-TR',
    datePublished: `${post.publishedAt}T09:00:00+03:00`,
    dateModified: `${post.updatedAt}T09:00:00+03:00`,
    image: `${origin}${OG_IMAGE.url}`,
    author: { '@type': 'Organization', '@id': ORGANIZATION_ID(), name: 'QR Chef', url: `${origin}/` },
    publisher: { '@id': ORGANIZATION_ID() },
    isPartOf: { '@id': WEBSITE_ID() },
  }
}

/** "1 Ekim 2026" */
export function formatDateTr(ymd: string): string {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(
    new Date(`${ymd}T12:00:00+03:00`)
  )
}

import { BLOG_POSTS, blogPostPath } from '@/lib/blog/posts'
import { BUSINESS_PAGES, businessPagePath } from '@/lib/marketing/business-pages'

/**
 * Tanıtım sayfalarının (ana sayfa, /qr-menu, /blog) ortak alt bilgi bağlantıları. Her sayfadan içerik sayfalarına
 * düz <a> bağlantısı: arama motoru tüm rehber ve işletme türü sayfalarını ana sayfadan bulur.
 */
export const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'İşletmeniz için QR menü',
    links: BUSINESS_PAGES.map((p) => ({ href: businessPagePath(p.slug), label: `${p.name} QR Menü` })),
  },
  {
    title: 'Rehber',
    links: [{ href: '/blog', label: 'Tüm yazılar' }, ...BLOG_POSTS.map((p) => ({ href: blogPostPath(p.slug), label: p.shortTitle }))],
  },
  {
    title: 'QR Chef',
    links: [
      { href: '/', label: 'Ana sayfa' },
      { href: '/signup', label: 'Ücretsiz kayıt' },
      { href: '/login', label: 'Giriş yap' },
      { href: '/gizlilik', label: 'Gizlilik Politikası' },
      { href: '/kosullar', label: 'Kullanım Koşulları' },
    ],
  },
]

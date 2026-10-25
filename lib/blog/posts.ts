import type { BlogPostMeta } from './types'

/**
 * Yayındaki rehber yazıları (liste sayfasında bu sırayla). Yalnızca metin: alt bilgi bağlantıları ve sitemap
 * istemci paketine yazı gövdesi taşımadan buradan okur. Gövdeler lib/blog/bodies.ts'te, posts/<slug>.tsx dosyalarında.
 */
export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'qr-menu-zorunlu-mu',
    title: 'QR Menü Zorunlu mu? Fiyat Etiketi Yönetmeliği ve Masadaki Karekod',
    shortTitle: 'QR menü zorunlu mu?',
    description:
      'Restoran ve kafelerde QR menü zorunlu mu? 11 Ekim 2025 Fiyat Etiketi Yönetmeliği değişikliği: kapıda fiyat listesi, masada karekod ve basılı liste talep hakkı.',
    publishedAt: '2026-10-24',
    updatedAt: '2026-10-24',
    readingMinutes: 5,
    faq: [
      {
        q: 'Restoranlarda QR menü zorunlu mu?',
        a: 'Yönetmelik masadaki fiyat listesinin karekodla gösterilmesine izin verir; karekodu zorunlu tutmaz. Karekod kullanan işletme, tüketici isterse basılı fiyat listesini ayrıca vermelidir.',
      },
      {
        q: 'Sadece QR menü yeterli mi?',
        a: 'Hayır. Giriş kapısında fiyat listesi bulunmalı ve misafir istediğinde basılı liste verilmelidir. Masadaki liste için karekod yeterlidir.',
      },
      {
        q: 'Servis ücreti fiyat listesinde yazmalı mı?',
        a: 'Evet. Liste fiyatlarının dışında servis ücreti ya da başka bir adla ücret alınacaksa bunun fiyat listesinde gösterilmesi zorunludur.',
      },
    ],
    sources: [
      { label: 'Fiyat Etiketi Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik, Resmî Gazete, 11 Ekim 2025, Sayı 33044' },
      { label: 'T.C. Tarım ve Orman Bakanlığı, Güvenilir Gıda duyurusu (30 Haziran 2026)', url: 'https://guvenilirgida.tarimorman.gov.tr/Haber/Detay/18459' },
    ],
  },
  {
    slug: 'menude-kalori-ve-alerjen-bilgisi',
    title: 'Menüde Kalori, İçerik ve Alerjen Bilgisi: 2026 Düzenlemesi ve Uygulama Rehberi',
    shortTitle: 'Menüde kalori ve alerjen bilgisi',
    description:
      'Restoran menüsünde kalori, içerik ve alerjen bilgisi: 1 Temmuz 2026 zincir işletme düzenlemesi, 14 alerjen listesi ve menüye bilgi ekleme rehberi.',
    publishedAt: '2026-10-24',
    updatedAt: '2026-10-24',
    readingMinutes: 6,
    faq: [
      {
        q: 'Menüde kalori yazmak zorunlu mu?',
        a: 'Tarım ve Orman Bakanlığı 1 Temmuz 2026 itibarıyla ulusal zincir işletmelerde içerik ve kalori bilgisinin sipariş öncesinde sunulmasını duyurdu. Diğer işletmeler için Bakanlığın güncel duyuruları takip edilmelidir.',
      },
      {
        q: 'Kalori ve içerik bilgisi QR menüde verilebilir mi?',
        a: 'Evet. Bakanlık duyurusuna göre bilgiler menüler, duvar panoları, dijital ekranlar ya da masalardaki karekodlar aracılığıyla sunulabilir.',
      },
      {
        q: 'Menüde hangi alerjenler belirtilmeli?',
        a: 'Gluten içeren tahıllar, kabuklular, yumurta, balık, yer fıstığı, soya, süt, sert kabuklu meyveler, kereviz, hardal, susam, kükürt dioksit ve sülfitler, acı bakla ve yumuşakçalar olmak üzere 14 alerjen.',
      },
    ],
    sources: [
      { label: 'T.C. Tarım ve Orman Bakanlığı, Güvenilir Gıda duyurusu (30 Haziran 2026)', url: 'https://guvenilirgida.tarimorman.gov.tr/Haber/Detay/18459' },
      { label: 'Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği ve Kılavuzu' },
    ],
  },
  {
    slug: 'qr-menu-nedir',
    title: 'QR Menü Nedir, Nasıl Çalışır? Restoran ve Kafeler İçin Rehber',
    shortTitle: 'QR menü nedir?',
    description:
      'QR menü nedir, nasıl çalışır, basılı menüye göre avantajları neler? Restoran ve kafeler için karekod menü rehberi: iyi bir QR menüde olması gerekenler.',
    publishedAt: '2026-10-24',
    updatedAt: '2026-10-24',
    readingMinutes: 5,
    faq: [
      {
        q: 'QR menüyü açmak için uygulama gerekir mi?',
        a: 'Hayır. Güncel telefonların kamerası karekodu doğrudan okur ve menüyü tarayıcıda açar; ayrıca uygulama indirmek gerekmez.',
      },
      {
        q: 'Fiyat değişince karekodu yeniden basmak gerekir mi?',
        a: 'Hayır. Karekod yalnızca menünün adresini taşır. Menüde yaptığınız değişiklikler aynı karekodla görünür.',
      },
      {
        q: 'QR menü ücretli mi?',
        a: 'Ücretli ve ücretsiz seçenekler vardır. QR Chef şu an ücretsiz sunulmaktadır.',
      },
    ],
  },
  {
    slug: 'qr-menu-nasil-yapilir',
    title: 'QR Menü Nasıl Yapılır? Fotoğraftan 10 Dakikada Karekod Menü',
    shortTitle: 'QR menü nasıl yapılır?',
    description:
      'QR menü nasıl yapılır? Menünüzün fotoğrafından dijital menü oluşturma, ürün bilgileri, site adresi ve karekodu basma adımları; boyut ve yerleşim ipuçları.',
    publishedAt: '2026-10-24',
    updatedAt: '2026-10-24',
    readingMinutes: 6,
    faq: [
      {
        q: 'QR menü yapmak ne kadar sürer?',
        a: 'Basılı menünüzün fotoğrafından aktarımla ürünler birkaç dakikada çıkar; kontrol edip site bilgilerinizi girmekle birlikte çoğu işletme yarım saat içinde yayına hazır olur.',
      },
      {
        q: 'Karekod hangi boyutta basılmalı?',
        a: 'Masada okunacak karekod için kenar uzunluğunun en az 3 cm olması önerilir. Uzaktan okunacak kapı ve vitrin karekodları daha büyük basılmalıdır.',
      },
      {
        q: 'Masalar için ayrı karekod gerekir mi?',
        a: 'Zorunlu değildir; tek bir karekod da menüyü açar. Masa bazlı karekodlar ise hangi masadan kaç kez okutulduğunu görmenizi sağlar.',
      },
    ],
  },
]

export function getBlogPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}

export const blogPostPath = (slug: string) => `/blog/${slug}`

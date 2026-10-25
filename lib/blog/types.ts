/** Rehber yazısı (/blog/<slug>): metin dışı bilgiler. Gövde sunucu bileşeni olarak posts/<slug>.tsx'te. */
export interface BlogPostMeta {
  slug: string
  title: string
  /** Bağlantı metni (alt bilgi, ilgili yazılar) */
  shortTitle: string
  /** Meta açıklaması ve liste özeti (en fazla ~160 karakter) */
  description: string
  /** YYYY-MM-DD */
  publishedAt: string
  updatedAt: string
  readingMinutes: number
  /** Yazının sonunda gösterilir ve FAQPage yapısal verisi olur */
  faq?: { q: string; a: string }[]
  /** Dış kaynaklar (mevzuat vb.): yazının sonunda listelenir */
  sources?: { label: string; url?: string }[]
}

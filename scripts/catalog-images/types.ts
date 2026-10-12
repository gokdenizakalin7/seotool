/** Katalog görsel üretimi — ortak tipler */

export interface SeedCategory {
  slug: string
  parent: string | null
  name: string
  name_en: string
  icon: string
  display_order: number
}

export interface SeedItem {
  slug: string
  primary_category: string
  name: string
  name_en: string
  description: string
  description_en: string
  price_suggested: string
  calories: number | null
  allergens: string[]
  tags: string[]
  image_url: string
  display_order: number
}

export interface Seed {
  categories: SeedCategory[]
  items: SeedItem[]
  templates: unknown[]
}

export type BackendName = 'stock' | 'pollinations' | 'cloudflare' | 'drawthings'

export type StockSource = 'pixabay' | 'openverse' | 'wikimedia'

export interface ImageCredit {
  source: StockSource
  source_url: string
  creator: string | null
  license: string
  license_url: string | null
}

export interface ManifestEntry {
  hash: string
  bytes: number
  thumbBytes: number
  /** true: yalnız {slug}.webp (SINGLE_SIZE), -s varyantı yok */
  single?: boolean
  backend: BackendName
  model: string
  promptVersion: number
  seed: number
  credit?: ImageCredit
  generatedAt: string
}

export interface Manifest {
  version: 1
  items: Record<string, ManifestEntry>
  cloudflare: { neurons: Record<string, number> }
}

export interface FailureEntry {
  error: string
  kind: ErrorKind
  backend: BackendName
  attempts: number
  at: string
}

export type ErrorKind = 'quota' | 'rate' | 'capacity' | 'transient' | 'fatal' | 'nomatch'

export class BackendError extends Error {
  constructor(message: string, public kind: ErrorKind, public retryAfterMs?: number) {
    super(message)
    this.name = 'BackendError'
  }
}

export interface Override {
  /** Prompt'ta ürün adı/açıklaması yerine kullanılacak jenerik konu (markalar için) */
  subject?: string
  note?: string
  /** true: stok aramasına girmez (logo/marka riski), doğrudan AI */
  skipStock?: boolean
  /**
   * Stok aramasında ürün adı yerine kullanılacak sorgular (daraltandan genişleyene).
   * Verilirse skipStock ve marka kategorisi filtresi atlanır: sorgu jeneriktir, hakem etiketli şişeyi zaten eler.
   */
  stockQueries?: string[]
  /** Stok hakemine ek kabul kuralı (ör. "karton yerine bardakta meyve suyu da olur") */
  judgeNote?: string
  /** Üretim yok: bu slug'ın görseli kopyalanır (ör. tüm biralar için tek sabit bardak) */
  sameAs?: string
}

export interface GenerateContext {
  item: SeedItem
  /** Yapraktan köke kategori slug'ları */
  chainSlugs: string[]
  /** Yapraktan köke kategori adları (TR) */
  chainNames: string[]
  /** Yapraktan köke kategori adları (EN) */
  chainNamesEn: string[]
  prompt: string
  seed: number
  /** AI üretim boyutu (kare) */
  size: number
  override?: Override
}

export interface GenerateResult {
  bytes: Buffer
  model: string
  credit?: ImageCredit
}

export interface Backend {
  name: BackendName
  /** Varsayılan paralellik */
  concurrency: number
  /** İstekler arası en az aralık (ms, paralellik başına) */
  minIntervalMs: number
  generate(ctx: GenerateContext): Promise<GenerateResult>
}

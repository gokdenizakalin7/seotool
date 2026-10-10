/**
 * Katalog eşleştirme çekirdeği — saf ve izomorfik (sunucu, istemci ve testlerde aynı kod).
 *
 * Akış: ad → Türkçe katlama → dolgu kelime temizliği → takma ad / tam eşleşme /
 * kelime sırası / kategori çekirdeği / trigram+Jaccard bulanık eşleşme.
 * Eşikler: ≥ AUTO_THRESHOLD otomatik, ≥ SUGGEST_THRESHOLD öneri, altı eşleşme yok.
 */

export const AUTO_THRESHOLD = 0.85
export const SUGGEST_THRESHOLD = 0.55
export const CANDIDATE_MIN = 0.45
export const MIN_FUZZY_LEN = 4
export const MAX_CANDIDATES = 5

/* ───────────── Normalizasyon ───────────── */

const TR_MAP: Record<string, string> = {
  Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
}

/**
 * Türkçe harfleri ASCII'ye katlar ve küçük harfe çevirir.
 * Katlama toLowerCase'den ÖNCE yapılır: JS'de 'İ'.toLowerCase() === 'i̇' (i + birleşik nokta).
 */
export function foldTurkish(s: string): string {
  let out = ''
  for (const ch of s) out += TR_MAP[ch] ?? ch
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Harf/rakam dışını boşluğa çevirir. "Makarna (Pesto)" → "makarna pesto" */
export function normalizeBasic(s: string): string {
  return foldTurkish(s).replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

/** Hacim / ağırlık ifadeleri: "300ml", "0,5 lt", "33 cl", "150 gr" (+ "lik/luk" eki) */
const UNIT_RE = /\b\d+(?:[.,]\d+)?\s*(?:ml|cl|lt|l|gr|g|kg|cc|oz|cm)\b(?:l[iu]k)?/g

/** Boy, porsiyon, kap ve bağlaç jetonları — ürün kimliğini değiştirmez */
const FILLER_TOKENS = new Set([
  'buyuk', 'kucuk', 'orta', 'boy', 'porsiyon', 'porsiyonluk', 'adet', 'tek', 'cift', 'duble', 'double',
  'tabak', 'kase', 'bardak', 'fincan', 'sise', 'kutu', 'kadeh', 'tane', 'kisilik', 'yarim', 'tam',
  'soslu', 'sos', 'ile', 've', 'ekstra', 'extra',
])

/** Menülerde sık görülen eş anlamlı yazımlar (katlanmış, boşlukla ayrılmış hal üzerinde) */
const SYNONYMS: [RegExp, string][] = [
  [/\b(?:ice|iced)\s*tea\b/g, 'soguk cay'],
  [/\bbuzlu cay\b/g, 'soguk cay'],
  [/\bice (?:latte|coffee|americano|mocha)\b/g, (m: string) => m.replace(/^ice /, 'iced ')] as unknown as [RegExp, string],
  [/\bred ?bull\b/g, 'red bull'],
  [/\b(?:coca ?cola|cocacola|coke)\b/g, 'kola'],
  [/\bcola\b/g, 'kola'],
  [/\bcheese ?burger\b/g, 'cheeseburger'],
  [/\bhot ?dog\b/g, 'hotdog'],
  [/\bmilk ?shake\b/g, 'milkshake'],
  [/\bspagetti\b/g, 'spaghetti'],
  [/\bfettucc?ini?e?\b/g, 'fettuccine'],
  [/\bfrench fries\b/g, 'patates kizartmasi'],
]

function applySynonyms(spaced: string): string {
  let out = spaced
  for (const [re, to] of SYNONYMS) out = out.replace(re, to as string)
  return out
}

/** Hacim: "0,5 lt" → 500, "33 cl" → 330, "300ml" → 300; yoksa null */
export function extractVolumeMl(raw: string): number | null {
  const m = foldTurkish(raw || '').match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|lt|l)\b/)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  if (Number.isNaN(n)) return null
  const unit = m[2]
  return Math.round(unit === 'ml' ? n : unit === 'cl' ? n * 10 : n * 1000)
}

/**
 * Eşleştirme anahtarı: katla, eş anlamlıları birleştir, hacim ve dolgu jetonlarını at, sayıları at.
 * "KIYMALI PİDE (BÜYÜK)" → "kiymali pide", "Ayran 300ml" → "ayran", "Çay (Bardak)" → "cay",
 * "Ice Tea Şeftali" → "soguk cay seftali". Temizlik adı boşaltırsa temel normalizasyona düşer ("Su", "Tek").
 */
export function normalizeDishName(raw: string): string {
  const folded = applySynonyms(foldTurkish(raw || '').replace(UNIT_RE, ' ').replace(/[^a-z0-9]+/g, ' '))
  const tokens = folded
    .split(' ')
    .filter((t) => t && !FILLER_TOKENS.has(t) && !/^\d+$/.test(t))
  return tokens.join(' ') || normalizeBasic(raw || '')
}

export function tokenSortKey(key: string): string {
  return key.split(' ').filter(Boolean).sort().join(' ')
}

const COMBO_RE = /(\s\+\s|\s&\s|\sve\s|\/|\bmenu\b|\bmenü\b|\bcombo\b|\bkombo\b|\bset\b|\bikili\b|\buclu\b|\büçlü\b)/i

/** "Döner + Ayran", "Burger Menü" gibi birleşik ürünler tek katalog ürününe otomatik bağlanmaz */
export function isComboName(raw: string): boolean {
  return COMBO_RE.test(` ${foldTurkish(raw || '')} `)
}

/* ───────────── Benzerlik ───────────── */

/** pg_trgm tarzı: her kelime "  kelime " diye doldurulur, 3-gramlar birleştirilir (kelime sırası önemsiz) */
export function trigrams(key: string): Set<string> {
  const set = new Set<string>()
  for (const w of key.split(' ')) {
    if (!w) continue
    const p = `  ${w} `
    for (let i = 0; i <= p.length - 3; i++) set.add(p.slice(i, i + 3))
  }
  return set
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0
  const [small, large] = a.size < b.size ? [a, b] : [b, a]
  let inter = 0
  for (const x of small) if (large.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

export function trigramSimilarity(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b))
}

export function tokenJaccard(a: string, b: string): number {
  return jaccard(new Set(a.split(' ').filter(Boolean)), new Set(b.split(' ').filter(Boolean)))
}

/* ───────────── Kategori ipuçları ───────────── */

/**
 * Kaba Türkçe kök: çoğul ("pideler" → "pide", "yemekleri" → "yemek"), iyelik ("corbasi" → "corba",
 * "kahvesi" → "kahve", "kebabi" → "kebap") ve son ünsüz sertleşmesi (b→p, d→t, g→k). Her iki tarafa
 * aynı uygulandığı için dilbilgisel doğruluk değil tutarlılık önemlidir.
 */
export function stemTr(token: string): string {
  let t = token.replace(/(lari|leri)$/, '').replace(/(lar|ler)$/, '')
  if (t.length > 4 && /[aeiou](si|su)$/.test(t)) t = t.slice(0, -2)
  else if (t.length > 4 && /[bcdfghjklmnprstvyz](i|u)$/.test(t)) t = t.slice(0, -1)
  return t.replace(/b$/, 'p').replace(/d$/, 't').replace(/g$/, 'k')
}

/** Kategori ailesine ait özel adlar: "penne" bir makarna, "hamburger" bir burger */
const FAMILY_TOKENS: Record<string, string> = {
  penne: 'makarna', spaghetti: 'makarna', fettuccine: 'makarna', linguine: 'makarna', tagliatelle: 'makarna',
  rigatoni: 'makarna', farfalle: 'makarna', lazanya: 'makarna', lasagna: 'makarna', ravioli: 'makarna',
  hamburger: 'burger', cheeseburger: 'burger',
}

const CATEGORY_STOP = new Set(['ve', 'ile', 'diger', 'bazli', 'ozel', 'cesitleri', 'ekstralari', 'menuleri'])

/** Kategori adından anlamlı kök jetonlar: "Soğuk Mezeler" → ["soguk", "meze"] */
export function categoryStems(name: string): string[] {
  return normalizeBasic(name)
    .split(' ')
    .filter((t) => t.length >= 3 && !CATEGORY_STOP.has(t))
    .map(stemTr)
}

/** Ad anahtarından kategori köklerini çıkarır: "kiymali pide" @ Pideler → "kiymali" */
export function coreKey(nameKey: string, stems: string[]): string {
  if (stems.length === 0) return nameKey
  return nameKey
    .split(' ')
    .filter((t) => t && !stems.includes(stemTr(t)) && !(FAMILY_TOKENS[t] && stems.includes(FAMILY_TOKENS[t])))
    .join(' ')
}

const DRINK_WORDS = new Set([
  'icecek', 'icecekler', 'kahve', 'kahveler', 'cay', 'caylar', 'kokteyl', 'kokteyller', 'bira', 'biralar',
  'sarap', 'saraplar', 'raki', 'rakilar', 'viski', 'viskiler', 'votka', 'cin', 'rom', 'tekila', 'likor',
  'likorler', 'shot', 'shotlar', 'smoothie', 'milkshake', 'soda', 'sodalar', 'limonata', 'limonatalar',
  'ayran', 'enerji', 'bubble', 'su', 'sular', 'gazli', 'alkollu', 'alkolsuz', 'frappe', 'latte', 'espresso',
  'filtre', 'serbet', 'serbetler', 'icecekleri', 'bar',
])
const FOOD_WORDS = new Set([
  'yemek', 'yemekler', 'yemekleri', 'kebap', 'kebaplar', 'kofte', 'kofteler', 'pide', 'pideler', 'lahmacun',
  'lahmacunlar', 'burger', 'burgerler', 'pizza', 'pizzalar', 'makarna', 'makarnalar', 'corba', 'corbalar',
  'meze', 'mezeler', 'salata', 'salatalar', 'tatli', 'tatlilar', 'kahvalti', 'baslangic', 'baslangiclar',
  'ana', 'doner', 'donerler', 'durum', 'durumler', 'sandvic', 'sandvicler', 'tost', 'tostlar', 'borek',
  'borekler', 'pastane', 'firin', 'dondurma', 'dondurmalar', 'waffle', 'nargile', 'balik', 'tavuk', 'et',
  'cocuk', 'sushi', 'manti', 'mantilar', 'pilav', 'pilavlar', 'atistirmalik', 'atistirmaliklar', 'kurabiye',
  'kek', 'kekler', 'pasta', 'pastalar', 'ekmek', 'ekmekler', 'gozleme', 'gozlemeler', 'omlet', 'yumurta',
  'kokorec', 'sakatat', 'sokak', 'lezzetleri', 'steak', 'kahvaltilar', 'kahvaltilik', 'sicak',
])

export type CatalogRoot = 'icecekler' | 'yiyecekler'

/** Taranan kategori adından kök tahmini; belirsizse null (ceza uygulanmaz) */
export function categoryRoot(categoryName: string | undefined | null): CatalogRoot | null {
  if (!categoryName) return null
  const tokens = normalizeBasic(categoryName).split(' ').filter(Boolean)
  const drink = tokens.some((t) => DRINK_WORDS.has(t))
  // "Sıcak Mezeler" gibi adlarda "sicak" yiyecek listesinde de var: her iki tarafta sayılırsa belirsiz
  const food = tokens.some((t) => FOOD_WORDS.has(t) && t !== 'sicak') || (tokens.includes('sicak') && !drink)
  if (drink && !food) return 'icecekler'
  if (food && !drink) return 'yiyecekler'
  return null
}

/** Menü/işletme adının jetonlarını üründen atar: "medusa special burger" → "special burger" */
export function stripVenueTokens(nameKey: string, menuName: string | undefined | null): string {
  if (!menuName) return nameKey
  const venue = new Set(normalizeBasic(menuName).split(' ').filter((t) => t.length >= 4))
  if (venue.size === 0) return nameKey
  const kept = nameKey.split(' ').filter((t) => t && !venue.has(t))
  return kept.length ? kept.join(' ') : nameKey
}

/* ───────────── Tipler ───────────── */

export interface CatalogItemRow {
  id: string
  slug: string
  name: string
  name_en: string | null
  image_url: string | null
  primary_category_id: string
  calories: number | null
  allergens: string[] | null
  description: string | null
  display_order: number | null
}

export interface CatalogCategoryRow {
  id: string
  parent_id: string | null
  slug: string
  name: string
}

export interface CatalogAliasRow {
  alias_norm: string
  item_id: string
  confirmations: number
}

export interface CatalogEntry {
  id: string
  slug: string
  name: string
  name_en: string | null
  image_url: string
  category_id: string
  /** Kökten yaprağa kategori adları, ör. ["Yiyecekler", "Ana Yemekler", "Pideler"] */
  category_path: string[]
  category_root: CatalogRoot | null
  calories: number | null
  allergens: string[]
  description: string
  display_order: number
  name_key: string
  name_en_key: string
  sort_key: string
  core_key: string
  category_stems: string[]
  /** Kategori yolu adlarının normalize hali (ipucu karşılaştırması için) */
  category_keys: string[]
  /** Temel normalizasyon (dolgu kelimeler dahil): eşitlik bozmada kullanılır */
  name_basic: string
  volume_ml: number | null
  tri: Set<string>
  tri_en: Set<string>
}

export type MatchVia = 'exact' | 'exact_en' | 'alias' | 'token_sort' | 'category_core' | 'fuzzy' | 'llm' | 'manual'

export interface CatalogMatch {
  item_id: string
  slug: string
  name: string
  image_url: string
  category: string
  score: number
  via: MatchVia
}

export type CatalogMatchLevel = 'auto' | 'suggest' | 'none' | 'confirmed'

export interface CatalogMatchInfo {
  level: CatalogMatchLevel
  top?: CatalogMatch
  candidates: CatalogMatch[]
}

export interface CatalogIndex {
  entries: CatalogEntry[]
  byId: Map<string, CatalogEntry>
  byKey: Map<string, CatalogEntry[]>
  byEnKey: Map<string, CatalogEntry[]>
  aliases: Map<string, { item_id: string; confirmations: number }[]>
}

/* ───────────── İndeks ───────────── */

export function buildCatalogIndex(
  items: CatalogItemRow[],
  categories: CatalogCategoryRow[],
  aliases: CatalogAliasRow[] = []
): CatalogIndex {
  const catById = new Map(categories.map((c) => [c.id, c]))
  const pathCache = new Map<string, CatalogCategoryRow[]>()
  const pathOf = (id: string): CatalogCategoryRow[] => {
    const hit = pathCache.get(id)
    if (hit) return hit
    const chain: CatalogCategoryRow[] = []
    const seen = new Set<string>()
    for (let cur = catById.get(id); cur && !seen.has(cur.id); cur = cur.parent_id ? catById.get(cur.parent_id) : undefined) {
      seen.add(cur.id)
      chain.unshift(cur)
    }
    pathCache.set(id, chain)
    return chain
  }

  const entries: CatalogEntry[] = items.map((it) => {
    const chain = pathOf(it.primary_category_id)
    const rootSlug = chain[0]?.slug
    const leaf = chain[chain.length - 1]
    const parent = chain[chain.length - 2]
    const stems = [...categoryStems(leaf?.name || ''), ...(parent ? categoryStems(parent.name) : [])]
    const name_key = normalizeDishName(it.name)
    const name_en_key = it.name_en ? normalizeDishName(it.name_en) : ''
    return {
      id: it.id,
      slug: it.slug,
      name: it.name,
      name_en: it.name_en,
      image_url: it.image_url || '',
      category_id: it.primary_category_id,
      category_path: chain.map((c) => c.name),
      category_root: rootSlug === 'icecekler' || rootSlug === 'yiyecekler' ? rootSlug : null,
      calories: it.calories ?? null,
      allergens: it.allergens || [],
      description: it.description || '',
      display_order: it.display_order ?? 0,
      name_key,
      name_en_key,
      sort_key: tokenSortKey(name_key),
      core_key: coreKey(name_key, stems),
      category_stems: stems,
      category_keys: chain.map((c) => normalizeBasic(c.name)),
      name_basic: normalizeBasic(it.name),
      volume_ml: extractVolumeMl(it.name),
      tri: trigrams(name_key),
      tri_en: name_en_key ? trigrams(name_en_key) : new Set<string>(),
    }
  })

  const byId = new Map(entries.map((e) => [e.id, e]))
  const byKey = new Map<string, CatalogEntry[]>()
  const byEnKey = new Map<string, CatalogEntry[]>()
  for (const e of entries) {
    byKey.set(e.name_key, [...(byKey.get(e.name_key) || []), e])
    if (e.name_en_key) byEnKey.set(e.name_en_key, [...(byEnKey.get(e.name_en_key) || []), e])
  }
  const aliasMap = new Map<string, { item_id: string; confirmations: number }[]>()
  for (const a of aliases) {
    if (!byId.has(a.item_id)) continue
    aliasMap.set(a.alias_norm, [...(aliasMap.get(a.alias_norm) || []), { item_id: a.item_id, confirmations: a.confirmations }])
  }
  return { entries, byId, byKey, byEnKey, aliases: aliasMap }
}

/* ───────────── Sıralama ───────────── */

export interface MatchQuery {
  name: string
  category?: string | null
  menuName?: string | null
}

function toMatch(e: CatalogEntry, score: number, via: MatchVia): CatalogMatch {
  return {
    item_id: e.id,
    slug: e.slug,
    name: e.name,
    image_url: e.image_url,
    category: e.category_path[e.category_path.length - 1] || '',
    score: Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000,
    via,
  }
}

/** Taranan kategori adı ile katalog kategori yolunun en iyi benzerliği (0-1) */
export function categoryHintScore(category: string | null | undefined, e: CatalogEntry): number {
  if (!category) return 0
  const key = normalizeBasic(category)
  if (!key) return 0
  const stems = categoryStems(category)
  let best = 0
  for (const ck of e.category_keys) {
    if (ck === key) return 1
    best = Math.max(best, trigramSimilarity(key, ck))
  }
  if (stems.some((s) => e.category_stems.includes(s))) best = Math.max(best, 0.8)
  return best
}

/** Aynı skorlu adaylar arasında: hacim eşitliği → kategori ipucu → ham jeton örtüşmesi → görseli olan → display_order */
function pickBest(list: CatalogEntry[], q: MatchQuery, qVolume: number | null, qBasic: string): CatalogEntry {
  return [...list].sort((a, b) => {
    if (qVolume != null) {
      const v = (b.volume_ml === qVolume ? 1 : 0) - (a.volume_ml === qVolume ? 1 : 0)
      if (v) return v
    }
    const h = categoryHintScore(q.category, b) - categoryHintScore(q.category, a)
    if (Math.abs(h) > 1e-9) return h
    const o = tokenJaccard(qBasic, b.name_basic) - tokenJaccard(qBasic, a.name_basic)
    if (Math.abs(o) > 1e-9) return o
    const img = (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0)
    if (img) return img
    return a.display_order - b.display_order
  })[0]
}

function levelFor(score: number, combo: boolean): CatalogMatchLevel {
  if (score >= AUTO_THRESHOLD) return combo ? 'suggest' : 'auto'
  if (score >= SUGGEST_THRESHOLD) return 'suggest'
  return 'none'
}

export function rankCandidates(q: MatchQuery, index: CatalogIndex): CatalogMatchInfo {
  const raw = (q.name || '').trim()
  const key = normalizeDishName(raw)
  if (!key) return { level: 'none', candidates: [] }

  const combo = isComboName(raw)
  const qVolume = extractVolumeMl(raw)
  const qBasic = normalizeBasic(raw)
  const best = new Map<string, CatalogMatch>()
  const offer = (e: CatalogEntry, score: number, via: MatchVia) => {
    const s = Math.min(1, score)
    const prev = best.get(e.id)
    if (!prev || prev.score + 1e-9 < s) best.set(e.id, toMatch(e, s, via))
  }

  // 1) Öğrenilmiş takma adlar
  const aliasHits = index.aliases.get(key)
  if (aliasHits && aliasHits.length) {
    const top = [...aliasHits].sort((a, b) => b.confirmations - a.confirmations)[0]
    const e = index.byId.get(top.item_id)
    if (e) offer(e, top.confirmations >= 2 ? 1 : 0.8, 'alias')
  }

  // 2) Tam eşleşme (TR / EN)
  const exact = index.byKey.get(key)
  if (exact && exact.length) offer(pickBest(exact, q, qVolume, qBasic), 1, 'exact')
  const exactEn = index.byEnKey.get(key)
  if (exactEn && exactEn.length) offer(pickBest(exactEn, q, qVolume, qBasic), 1, 'exact_en')

  // 3) Kelime sırası farklı: "Dürüm Tavuk Döner" ≈ "Tavuk Döner Dürüm"
  const sortKey = tokenSortKey(key)
  // 4) Kategori çekirdeği: "Kıymalı" @ "Pideler" → "Kıymalı Pide"
  const catStems = q.category ? categoryStems(q.category) : []
  const qCore = coreKey(key, catStems)
  const venueKey = stripVenueTokens(key, q.menuName)
  const qTri = trigrams(key)
  const qTriVenue = venueKey !== key ? trigrams(venueKey) : null
  const qRoot = categoryRoot(q.category)
  const fuzzyOk = key.length >= MIN_FUZZY_LEN

  for (const e of index.entries) {
    if (e.sort_key === sortKey) offer(e, 0.97, 'token_sort')
    if (catStems.length && qCore && qCore === e.core_key && categoryHintScore(q.category, e) >= 0.6) {
      offer(e, 0.9, 'category_core')
    }
    if (!fuzzyOk) continue
    const tri = Math.max(jaccard(qTri, e.tri), e.tri_en.size ? jaccard(qTri, e.tri_en) : 0)
    const tok = Math.max(tokenJaccard(key, e.name_key), e.name_en_key ? tokenJaccard(key, e.name_en_key) : 0)
    let score = 0.55 * tri + 0.45 * tok
    if (qTriVenue) {
      const triV = Math.max(jaccard(qTriVenue, e.tri), e.tri_en.size ? jaccard(qTriVenue, e.tri_en) : 0)
      const tokV = Math.max(tokenJaccard(venueKey, e.name_key), e.name_en_key ? tokenJaccard(venueKey, e.name_en_key) : 0)
      score = Math.max(score, 0.55 * triV + 0.45 * tokV)
    }
    if (score < CANDIDATE_MIN - 0.1) continue
    if (categoryHintScore(q.category, e) >= 0.6) score += 0.05
    if (qRoot && e.category_root && qRoot !== e.category_root) score -= 0.15
    // Bulanık skor tam/sıralı eşleşmenin (1.0 / 0.97) altında kalır ki `via` doğru kalsın
    if (score >= CANDIDATE_MIN) offer(e, Math.min(score, 0.96), 'fuzzy')
  }

  const tie = (m: CatalogMatch) => {
    const e = index.byId.get(m.item_id)!
    return (qVolume != null && e.volume_ml === qVolume ? 10 : 0) + tokenJaccard(qBasic, e.name_basic)
  }
  const candidates = [...best.values()]
    .filter((m) => m.score >= CANDIDATE_MIN)
    .sort((a, b) => b.score - a.score || tie(b) - tie(a))
    .slice(0, MAX_CANDIDATES)
  if (candidates.length === 0) return { level: 'none', candidates: [] }
  const top = candidates[0]
  const level = levelFor(top.score, combo)
  return { level, top: level === 'none' ? undefined : top, candidates }
}

/** Arama kutusu: eşik yok, en iyi `limit` sonuç */
export function searchCatalog(query: string, index: CatalogIndex, limit = 8): CatalogMatch[] {
  const key = normalizeDishName(query)
  if (!key) return []
  const qTri = trigrams(key)
  const tokens = key.split(' ')
  const scored: CatalogMatch[] = []
  for (const e of index.entries) {
    const keys = [e.name_key, e.name_en_key].filter(Boolean)
    let score = 0
    for (const k of keys) {
      if (k === key) score = Math.max(score, 1)
      else if (k.startsWith(key)) score = Math.max(score, 0.95)
      else if (k.split(' ').some((t) => tokens.every((qt) => t.startsWith(qt)) || tokens.some((qt) => t.startsWith(qt) && qt.length >= 3)))
        score = Math.max(score, 0.9)
      else if (k.includes(key)) score = Math.max(score, 0.85)
    }
    if (score === 0) score = Math.max(jaccard(qTri, e.tri), e.tri_en.size ? jaccard(qTri, e.tri_en) : 0)
    if (score >= 0.3) scored.push(toMatch(e, score, 'manual'))
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'tr')).slice(0, limit)
}

/** Katalog alerjen sözlüğü → tarama/editör sözlüğü (isteğe bağlı alerjen doldurma için) */
export const CATALOG_ALLERGEN_TO_SCAN: Record<string, string> = {
  'Süt Ürünleri': 'Süt',
  'Yer Fıstığı': 'Fıstık',
  'Kabuklu Deniz Ürünleri': 'Kabuklu deniz ürünü',
  'Sert Kabuklu Yemişler': 'Fındık',
  Yumuşakçalar: 'Kabuklu deniz ürünü',
}

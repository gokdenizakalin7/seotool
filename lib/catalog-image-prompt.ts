/**
 * Katalog ve işletme ürünleri için görsel üretim prompt'u (saf; script ve API rotası ortak).
 * Stil haritası kategori slug'ına göre; yapraktan köke yürünür, ilk eşleşen kazanır.
 */

export const PROMPT_VERSION = 1

export const STYLE_SUFFIX =
  'professional food photography, 45-degree angle, soft natural daylight, shallow depth of field, ' +
  'neutral light background, clean minimal styling, photorealistic, no text, no letters, no logos, ' +
  'no labels, no watermark, no people, no hands'

/** Kategori slug'ı → sunum/tabak tarifi */
export const STYLE_BY_CATEGORY: Record<string, string> = {
  'turk-kahvesi': 'served in a small traditional Turkish coffee cup on a saucer, with a glass of water and a piece of lokum',
  'siyah-caylar': 'served in a tulip-shaped Turkish tea glass on a small saucer, two sugar cubes',
  'bitki-caylari': 'served in a clear glass teacup, dried herbs beside it, light steam',
  'meyve-caylari': 'served in a clear glass teacup, dried fruit pieces beside it',
  'yesil-ve-ozel-caylar': 'served in a ceramic teacup with a small teapot',
  'espresso-bazli-kahveler': 'served in a ceramic cup on a saucer, latte art where appropriate',
  'filtre-kahveler': 'served in a ceramic mug with a pour-over dripper softly out of focus',
  'ozel-kahveler': 'served in a tall glass or ceramic cup with light garnish',
  kahveler: 'served in a ceramic cup on a saucer',
  caylar: 'served in a tea glass',
  'diger-sicak-icecekler': 'served in a ceramic mug, light steam, whipped cream or cinnamon where appropriate',
  'sicak-icecekler': 'served in a ceramic cup on a saucer, light steam',
  'soguk-kahveler': 'served in a tall clear glass with ice cubes and condensation, a straw',
  'soguk-caylar': 'served in a tall clear glass with ice, lemon slice',
  'limonata-ve-serbetler': 'served in a tall clear glass with ice, fresh fruit garnish',
  'taze-sikilmis-meyve-sulari': 'served in a clear glass with fresh fruit beside it',
  'meyve-sulari': 'served in a clear glass, no packaging',
  'gazli-icecekler': 'served in a tall clear glass with ice and bubbles, plain unlabeled glass bottle beside it',
  sular: 'served in a clear glass, plain unlabeled glass bottle beside it, condensation',
  'ayran-ve-sutlu-icecekler': 'served in a traditional copper cup or clear glass, foamy top',
  'smoothie-ve-milkshake': 'served in a tall glass with a straw, fruit garnish',
  'bubble-tea': 'served in a tall clear cup with tapioca pearls and a wide straw',
  'enerji-icecekleri': 'served in a tall clear glass with ice, plain unlabeled slim can beside it',
  'alkolsuz-kokteyller': 'served in a cocktail glass with fresh garnish',
  'soguk-icecekler': 'served in a tall clear glass with ice and condensation',
  biralar: 'a tall glass of cold beer with a foam head, condensation, the glass alone, no bottle in the frame',
  rakilar: 'a tall thin glass of milky-white raki with ice, a glass of water, small meze plates in the background, no bottle in the frame',
  saraplar: 'a single wine glass on its own, soft bar light, no bottle in the frame',
  viskiler: 'a double measure in a crystal tumbler with a large ice cube, the glass alone, no bottle in the frame',
  'votka-cin-rom-tekila': 'served as a single drink in its glass, the glass alone, no bottle in the frame',
  'aperatif-ve-likorler': 'in a small glass with ice, the glass alone, no bottle in the frame',
  kokteyller: 'in the appropriate cocktail glass with fresh garnish, bar counter, moody warm light',
  shotlar: 'in a shot glass on a dark bar counter',
  'alkollu-icecekler': 'in a glass on a bar counter, warm light',
  'serpme-kahvalti': 'a generous Turkish breakfast spread with many small plates, viewed from above',
  'kahvalti-tabaklari': 'on a large white plate with small bowls, viewed from above',
  'yumurta-yemekleri': 'in a small copper sahan pan, bread beside it',
  gozlemeler: 'folded on a wooden board, viewed from above',
  tostlar: 'on a wooden board, cut in half to show the melted cheese',
  pancakeler: 'stacked on a white plate with syrup and fruit',
  'kahvalti-ekstralari': 'in a small white bowl or plate',
  kahvalti: 'on a white plate, Turkish breakfast table',
  corbalar: 'in a ceramic bowl with a spoon and a lemon wedge, bread beside it',
  'soguk-mezeler': 'on a small white meze plate, olive oil drizzle',
  'sicak-mezeler': 'on a small white plate, freshly cooked',
  'zeytinyagli-yemekler': 'on a white plate with lemon wedge and olive oil drizzle',
  salatalar: 'in a wide white bowl, fresh and colorful',
  atistirmaliklar: 'on a wooden board with a small dipping bowl',
  'cerez-ve-kuruyemis': 'in small ceramic bowls',
  baslangiclar: 'on a small white plate',
  kebaplar: 'on an oval white plate with grilled tomato, grilled pepper, bulgur and lavash bread',
  kofteler: 'on a white plate with grilled pepper, tomato and rice',
  donerler: 'on a white plate with rice, grilled pepper and tomato',
  pideler: 'on a wooden board, overhead view, freshly baked',
  lahmacunlar: 'on a wooden board with lemon wedges, parsley and onions, overhead view',
  'ev-yemekleri': 'in a white ceramic bowl or plate, homestyle presentation',
  pilavlar: 'in a white bowl',
  makarnalar: 'in a wide white pasta bowl, grated cheese',
  'tavuk-yemekleri': 'on a white plate with rice and vegetables',
  'et-yemekleri': 'on a dark plate with roasted vegetables',
  'balik-ve-deniz-urunleri': 'on a white plate with lemon wedges and arugula',
  burgerler: 'on a wooden board with fries, bun with sesame seeds',
  pizzalar: 'on a wooden board, overhead view, one slice pulled',
  durumler: 'wrapped in lavash, cut in half on a wooden board',
  sandvicler: 'on a wooden board, cut diagonally',
  'sokak-lezzetleri': 'in paper wrapping on a wooden board',
  'kokorec-ve-sakatat': 'in half bread on a wooden board',
  mantilar: 'in a white bowl with garlic yoghurt and red pepper butter sauce',
  'asya-mutfagi': 'in a dark bowl with chopsticks',
  sushi: 'on a dark slate plate with chopsticks, soy sauce and ginger',
  'meksika-mutfagi': 'on a colorful plate with lime wedges and salsa',
  'dunya-mutfagi': 'on a white plate',
  'vejetaryen-ve-vegan': 'in a white bowl, fresh vegetables',
  'cocuk-menusu': 'on a colorful plate, kid-friendly portion',
  'ana-yemekler': 'on a white ceramic plate',
  'serbetli-tatlilar': 'on a small white plate, glossy syrup, pistachio crumbs',
  'sutlu-tatlilar': 'in a small ceramic bowl, cinnamon sprinkle',
  pastalar: 'a slice on a white plate with a fork',
  dondurmalar: 'scoops in a glass bowl',
  'waffle-ve-krep': 'on a white plate with fruit and chocolate drizzle',
  'geleneksel-tatlilar': 'on a small white plate',
  'meyve-ve-hafif-tatlilar': 'in a glass bowl',
  tatlilar: 'on a small white dessert plate',
  ekmekler: 'on a wooden board with a linen cloth',
  'simit-ve-pogacalar': 'on a wooden board, bakery setting',
  borekler: 'cut pieces on a white plate',
  'kurabiye-ve-kekler': 'on a white plate, bakery setting',
  'kruvasan-ve-viyenuazri': 'on a white plate, golden and flaky',
  'pastane-sandvicleri': 'on a white plate, bakery setting',
  'firin-ve-pastane': 'on a wooden board, bakery setting',
  'nargile-cesitleri': 'an ornate hookah on a lounge table, warm ambient light, fresh fruit beside it suggesting the flavor',
  'nargile-ekstralari': 'hookah accessories on a lounge table, warm ambient light',
  nargile: 'an ornate hookah on a lounge table, warm ambient light',
  'fast-food-menuler': 'a tray with the full combo: main, fries and a drink in a plain cup',
  'kahvalti-menuleri': 'a tray with a breakfast combo',
  'set-menuler': 'a tray with the full combo',
  yiyecekler: 'on a white ceramic plate',
  icecekler: 'in a clear glass',
}

const BRAND_TOKEN_RE =
  /\b(efes|tuborg|bomonti|carlsberg|heineken|corona|miller|guinness|beck'?s|yeni rak[ıi]|tekirda[ğg]|beylerbeyi|doluca|kavakl[ıi]dere|kayra|sevilen|jack daniel'?s|jameson|chivas|johnnie walker|macallan|glenfiddich|absolut|smirnoff|grey goose|bombay|gordon'?s|bacardi|captain morgan|havana club|jose cuervo|olmeca|baileys|j[äa]germeister|aperol|campari|martini|cointreau|malibu|red bull|monster|burn|coca[- ]?cola|pepsi|fanta|sprite|7up|schweppes|ulud[ağ]ğ|beypazar[ıi]|erikli|lipton|nescaf[ée]|starbucks|san pellegrino|perrier|cappy|tamek|dimes)\b/gi

export interface PromptItem {
  slug?: string
  name: string
  name_en?: string | null
  description_en?: string | null
  description?: string | null
}

export interface PromptOverride {
  subject?: string
  note?: string
}

export interface BuiltPrompt {
  prompt: string
  seed: number
  promptVersion: number
  style: string
}

/** FNV-1a 32 bit — slug + prompt sürümünden kararlı seed */
export function stableSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 2147483647
}

/** Yapraktan köke slug zinciri verilir; ilk eşleşen stil döner */
export function styleForCategoryChain(leafToRoot: string[]): string {
  for (const slug of leafToRoot) {
    const s = STYLE_BY_CATEGORY[slug]
    if (s) return s
  }
  return STYLE_BY_CATEGORY.yiyecekler
}

export function stripBrandTokens(s: string): string {
  return s.replace(BRAND_TOKEN_RE, '').replace(/\s{2,}/g, ' ').trim()
}

function trimTo(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const i = cut.lastIndexOf(' ')
  return (i > 40 ? cut.slice(0, i) : cut).trim()
}

/** Katalog ürünü: name_en + description_en + kategori stili (+ override). */
export function buildCatalogPrompt(item: PromptItem, categoryChainLeafToRoot: string[], override?: PromptOverride): BuiltPrompt {
  const style = styleForCategoryChain(categoryChainLeafToRoot)
  const subject = override?.subject
    ? override.subject
    : [stripBrandTokens(item.name_en || item.name), item.description_en ? trimTo(stripBrandTokens(item.description_en), 140) : '']
        .filter(Boolean)
        .join(', ')
  const prompt = `${subject}, ${style}, ${STYLE_SUFFIX}`
  return { prompt, seed: stableSeed(`${item.slug || item.name}:${PROMPT_VERSION}`), promptVersion: PROMPT_VERSION, style }
}

/** Kategori adı anahtar kelimelerinden stil slug'ı tahmini (işletme ürünleri için) */
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/kahve|coffee|latte|espresso/i, 'espresso-bazli-kahveler'],
  [/çay|cay|tea/i, 'siyah-caylar'],
  [/kokteyl|cocktail/i, 'kokteyller'],
  [/bira|beer/i, 'biralar'],
  [/şarap|sarap|wine/i, 'saraplar'],
  [/rakı|raki/i, 'rakilar'],
  [/viski|whisk/i, 'viskiler'],
  [/soğuk|soguk|limonata|smoothie|milkshake|meyve suyu|içecek|icecek|drink|soda|kola|ayran/i, 'soguk-icecekler'],
  [/çorba|corba|soup/i, 'corbalar'],
  [/meze|başlangıç|baslangic|starter/i, 'soguk-mezeler'],
  [/salata|salad/i, 'salatalar'],
  [/kebap|kebab|ızgara|izgara|grill/i, 'kebaplar'],
  [/köfte|kofte/i, 'kofteler'],
  [/döner|doner|dürüm|durum|wrap/i, 'durumler'],
  [/pide/i, 'pideler'],
  [/lahmacun/i, 'lahmacunlar'],
  [/pizza/i, 'pizzalar'],
  [/burger/i, 'burgerler'],
  [/makarna|pasta/i, 'makarnalar'],
  [/balık|balik|deniz|fish|seafood/i, 'balik-ve-deniz-urunleri'],
  [/tavuk|chicken/i, 'tavuk-yemekleri'],
  [/et |steak|dana|kuzu/i, 'et-yemekleri'],
  [/mantı|manti/i, 'mantilar'],
  [/sushi/i, 'sushi'],
  [/kahvaltı|kahvalti|breakfast|omlet|yumurta/i, 'kahvalti-tabaklari'],
  [/tost|sandviç|sandvic|sandwich/i, 'tostlar'],
  [/tatlı|tatli|dessert|baklava|künefe|kunefe/i, 'serbetli-tatlilar'],
  [/pasta|cake|cheesecake/i, 'pastalar'],
  [/dondurma|ice cream/i, 'dondurmalar'],
  [/waffle|krep|crepe/i, 'waffle-ve-krep'],
  [/nargile|hookah|shisha/i, 'nargile-cesitleri'],
  [/menü|menu|combo/i, 'fast-food-menuler'],
  [/fırın|firin|börek|borek|poğaça|pogaca|simit|pastane|bakery/i, 'firin-ve-pastane'],
]

export function guessStyleSlug(categoryName: string | null | undefined): string {
  if (!categoryName) return 'yiyecekler'
  for (const [re, slug] of CATEGORY_KEYWORDS) if (re.test(categoryName)) return slug
  return 'yiyecekler'
}

/** İşletme ürünü: Türkçe ad + açıklama; stil kategori adından tahmin edilir. */
export function buildItemPrompt(input: { name: string; description?: string | null; category?: string | null }): BuiltPrompt {
  const styleSlug = guessStyleSlug(input.category)
  const style = STYLE_BY_CATEGORY[styleSlug] || STYLE_BY_CATEGORY.yiyecekler
  const subject = [stripBrandTokens(input.name), input.description ? trimTo(stripBrandTokens(input.description), 140) : '']
    .filter(Boolean)
    .join(', ')
  const prompt = `${subject} (Turkish restaurant dish), ${style}, ${STYLE_SUFFIX}`
  return { prompt, seed: stableSeed(`${input.name}:${PROMPT_VERSION}`), promptVersion: PROMPT_VERSION, style }
}

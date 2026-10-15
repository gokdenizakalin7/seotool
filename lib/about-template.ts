/**
 * "Hakkımızda" için yapay zekâ kullanmadan üretilen varsayılan metin: işletme türü, adı, şehri,
 * kategorileri ve öne çıkan ürünlerinden. İşletme metin yazmadıysa sitede bu gösterilir;
 * AI üretimi başarısız olursa da yedek olarak kullanılır.
 */

const TYPE_PHRASES: Record<string, string> = {
  cafe: 'kafe',
  restaurant: 'restoran',
  kebab: 'kebap ve ocakbaşı restoranı',
  pub: 'bar',
  nargile: 'nargile kafe',
  fastfood: 'burger ve fast food restoranı',
  bakery: 'pastane ve fırın',
  meyhane: 'meyhane',
}

const TYPE_CLOSING: Record<string, string> = {
  cafe: 'Güzel bir kahve ve keyifli bir sohbet için sizi bekliyoruz.',
  restaurant: 'Sofranızı paylaşmaktan mutluluk duyarız.',
  kebab: 'Ateşte pişen lezzetler için sizi bekliyoruz.',
  pub: 'Arkadaşlarınızla keyifli bir akşam için sizi bekliyoruz.',
  nargile: 'Dostlarınızla keyifli vakit geçirmek için sizi bekliyoruz.',
  fastfood: 'Hızlı ve doyurucu bir öğün için sizi bekliyoruz.',
  bakery: 'Taze ürünlerimizi tatmanız için sizi bekliyoruz.',
  meyhane: 'Uzun sofralar ve güzel muhabbet için sizi bekliyoruz.',
}

const BACK_VOWELS = 'aıou'
const FRONT_VOWELS = 'eiöü'
const HARD_CONSONANTS = 'çfhkpsşt'

/** Türkçe bulunma eki: İstanbul'da, İzmir'de, Muş'ta, Eskişehir'de */
export function locativeSuffix(word: string): string {
  const lower = word.toLocaleLowerCase('tr').trim()
  let vowel = 'a'
  for (let i = lower.length - 1; i >= 0; i--) {
    const ch = lower[i]
    if (BACK_VOWELS.includes(ch) || FRONT_VOWELS.includes(ch)) {
      vowel = ch
      break
    }
  }
  const a = FRONT_VOWELS.includes(vowel) ? 'e' : 'a'
  const last = lower[lower.length - 1] || ''
  const d = HARD_CONSONANTS.includes(last) ? 't' : 'd'
  return `'${d}${a}`
}

/** ["a","b","c"] → "a, b ve c" */
export function joinTurkishList(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

export interface AboutTemplateInput {
  name: string
  businessType?: string | null
  /** business_types.label (ör. "Kafe / All Day"); tür sözlükte yoksa kullanılır */
  typeLabel?: string | null
  city?: string | null
  categories?: string[]
  featured?: string[]
}

export function businessTypePhrase(businessType?: string | null, typeLabel?: string | null): string {
  if (businessType && TYPE_PHRASES[businessType]) return TYPE_PHRASES[businessType]
  const label = (typeLabel || '').split('/')[0].trim()
  return label ? label.toLocaleLowerCase('tr') : 'işletme'
}

export function buildAboutTemplate(input: AboutTemplateInput): string {
  const name = input.name.trim() || 'İşletmemiz'
  const phrase = businessTypePhrase(input.businessType, input.typeLabel)
  const city = (input.city || '').trim()

  const intro = city
    ? `${name}, ${city}${locativeSuffix(city)} misafirlerini ağırlayan bir ${phrase}.`
    : `${name}, misafirlerini sıcak bir atmosferde ağırlayan bir ${phrase}.`

  const categories = Array.from(new Set((input.categories || []).map((c) => c.trim()).filter(Boolean)))
    .slice(0, 4)
    .map((c) => c.toLocaleLowerCase('tr'))
  const featured = Array.from(new Set((input.featured || []).map((f) => f.trim()).filter(Boolean))).slice(0, 3)

  const sentences = [intro]
  if (categories.length) sentences.push(`Menümüzde ${joinTurkishList(categories)} gibi seçenekler bulabilirsiniz.`)
  if (featured.length) sentences.push(`Öne çıkan lezzetlerimiz arasında ${joinTurkishList(featured)} yer alıyor.`)

  const closing = (input.businessType && TYPE_CLOSING[input.businessType]) || 'Sizi de aramızda görmekten mutluluk duyarız.'
  return `${sentences.join(' ')}\n\n${closing}`
}

/**
 * Ürün bileşenleri (items.ingredients) için ortak yardımcılar — saf; editör, API rotası ve testlerde aynı kod.
 */

export const INGREDIENT_MAX_LENGTH = 40

/** Boşlukları toparlar ve ilk harfi büyütür: "  pul  biber " → "Pul biber". Geri kalan harflere dokunmaz ("Jack Daniel's"). */
export function normalizeIngredient(raw: string): string {
  const s = (raw || '').replace(/\s+/g, ' ').trim().slice(0, INGREDIENT_MAX_LENGTH).trim()
  return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : ''
}

export function sameIngredient(a: string, b: string): boolean {
  return a.toLocaleLowerCase('tr-TR') === b.toLocaleLowerCase('tr-TR')
}

/** Normalleştirir, boşları ve büyük/küçük harf farkıyla tekrarlananları atar; ilk geçen sıra korunur */
export function uniqueIngredients(list: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of list) {
    const v = normalizeIngredient(raw)
    if (v && !out.some((x) => sameIngredient(x, v))) out.push(v)
  }
  return out
}

/** Önerilerden henüz seçilmemiş olanlar */
export function pendingSuggestions(suggestions: readonly string[], selected: readonly string[]): string[] {
  return uniqueIngredients(suggestions).filter((s) => !selected.some((x) => sameIngredient(x, s)))
}

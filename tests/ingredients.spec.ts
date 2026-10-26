import { test, expect } from '@playwright/test'
import { normalizeIngredient, pendingSuggestions, uniqueIngredients } from '../lib/ingredients'

test.describe('bileşenler', () => {
  test('normalleştirme', () => {
    expect(normalizeIngredient('  pul  biber ')).toBe('Pul biber')
    expect(normalizeIngredient('ıspanak')).toBe('Ispanak')
    expect(normalizeIngredient('incir')).toBe('İncir')
    expect(normalizeIngredient("Jack Daniel's")).toBe("Jack Daniel's")
    expect(normalizeIngredient('   ')).toBe('')
    expect(normalizeIngredient('x'.repeat(60))).toHaveLength(40)
  })
  test('tekrarlar büyük/küçük harf farkıyla atılır, sıra korunur', () => {
    expect(uniqueIngredients(['Kıyma', 'soğan', 'kıyma', '', 'Soğan', 'Pul biber'])).toEqual(['Kıyma', 'Soğan', 'Pul biber'])
  })
  test('seçili olanlar önerilerden düşer', () => {
    expect(pendingSuggestions(['Kıyma', 'pul biber', 'Kimyon', 'Soğan'], ['kıyma', 'Soğan'])).toEqual(['Pul biber', 'Kimyon'])
  })
})

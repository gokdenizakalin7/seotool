import { test, expect } from '@playwright/test'
import { displayPrice, formatPrice, parsePrice, roundAmount } from '../lib/price'

test.describe('parsePrice', () => {
  test('Türkçe ve İngilizce biçimler', () => {
    expect(parsePrice('85 ₺')).toEqual({ amount: 85, currency: '₺' })
    expect(parsePrice('85,50')).toEqual({ amount: 85.5, currency: null })
    expect(parsePrice('1.250 ₺')?.amount).toBe(1250)
    expect(parsePrice('1.250,50 ₺')?.amount).toBe(1250.5)
    expect(parsePrice('1,250.50')?.amount).toBe(1250.5)
    expect(parsePrice('12.5')?.amount).toBe(12.5)
    expect(parsePrice('85TL')).toEqual({ amount: 85, currency: '₺' })
    expect(parsePrice('€ 12')).toEqual({ amount: 12, currency: '€' })
    expect(parsePrice(40)).toEqual({ amount: 40, currency: null })
    expect(parsePrice('0')?.amount).toBe(0)
  })
  test('okunamayan fiyatlar null', () => {
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('85-95')).toBeNull()
    expect(parsePrice('S:50/L:70')).toBeNull()
    expect(parsePrice('Sorunuz')).toBeNull()
    expect(parsePrice('12,345,6')).toBeNull()
    expect(parsePrice('85,')).toBeNull()
    expect(parsePrice(null)).toBeNull()
  })
})

test.describe('formatPrice / roundAmount', () => {
  test('biçimlendirme', () => {
    expect(formatPrice(1250)).toBe('1.250 ₺')
    expect(formatPrice(85.5)).toBe('85,50 ₺')
    expect(formatPrice(12, '$')).toBe('12 $')
  })
  test('menü gösterimi: simgesiz fiyata para birimi eklenir', () => {
    expect(displayPrice('450')).toBe('450 ₺')
    expect(displayPrice('1250')).toBe('1.250 ₺')
    expect(displayPrice('85,5', '$')).toBe('85,50 $')
    expect(displayPrice('170 ₺')).toBe('170 ₺')
    expect(displayPrice('12 TL')).toBe('12 TL')
    expect(displayPrice('S:50/L:70')).toBe('S:50/L:70')
    expect(displayPrice('450', null)).toBe('450 ₺')
    expect(displayPrice(undefined)).toBe('')
  })
  test('yuvarlama', () => {
    expect(roundAmount(97.75, 'none')).toBe(97.75)
    expect(roundAmount(97.75, '1')).toBe(98)
    expect(roundAmount(97.75, '5')).toBe(100)
    expect(roundAmount(92, '10')).toBe(90)
    expect(roundAmount(-5, '1')).toBe(0)
  })
})

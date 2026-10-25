import { test, expect } from '@playwright/test'
import {
  clipText,
  geoFromMapsUrl,
  internationalPhone,
  menuDescription,
  menuJsonLd,
  openingHoursFromText,
  readableName,
} from '../lib/site-seo'
import type { Menu } from '../lib/types'

test('meta açıklaması kelime sınırında kesilir', () => {
  expect(clipText('  kısa   metin ')).toBe('kısa metin')
  const long = 'kelime '.repeat(40)
  const out = clipText(long, 50)
  expect(out.length).toBeLessThanOrEqual(50)
  expect(out.endsWith('…')).toBe(true)
  expect(out).not.toContain('kelim…')
})

test('tamamı büyük harf kategori adı okunur hâle gelir', () => {
  expect(readableName('SICAK İÇECEKLER')).toBe('Sıcak İçecekler')
  expect(readableName('SOĞUK KAHVELER')).toBe('Soğuk Kahveler')
  expect(readableName('Kahvaltı')).toBe('Kahvaltı')
  expect(readableName('Tost & SANDVİÇ')).toBe('Tost & SANDVİÇ')
  expect(readableName('123')).toBe('123')
})

test('telefon uluslararası biçimde', () => {
  expect(internationalPhone('05310289830')).toBe('+905310289830')
  expect(internationalPhone('0 (531) 028 98 30')).toBe('+905310289830')
  expect(internationalPhone('+90 531 028 98 30')).toBe('+905310289830')
  expect(internationalPhone('5310289830')).toBe('+905310289830')
  expect(internationalPhone('444 1 444')).toBe('444 1 444')
})

test('Google Haritalar adresinden koordinat', () => {
  // Yer kaydının koordinatı (!3d!4d) harita merkezine (@) tercih edilir
  expect(
    geoFromMapsUrl('https://www.google.com/maps/place/Medusa+Cafe/@41.1042193,28.8947757,17z/data=!4m8!3m7!1s0x1:0x2!8m2!3d41.1042153!4d28.8973506')
  ).toEqual({ latitude: 41.1042153, longitude: 28.8973506 })
  expect(geoFromMapsUrl('https://www.google.com/maps/@40.99,29.02,15z')).toEqual({ latitude: 40.99, longitude: 29.02 })
  expect(geoFromMapsUrl('https://maps.app.goo.gl/DrdpUvc7qa7S8Y9S9')).toBeNull()
  expect(geoFromMapsUrl(null)).toBeNull()
})

test('çalışma saati yalnızca her gün geçerli tek aralıksa yapısal veriye çevrilir', () => {
  expect(openingHoursFromText('12.00 - 02.00')?.[0]).toMatchObject({ opens: '12:00', closes: '02:00' })
  expect(openingHoursFromText('Her gün 09:00–23:30')?.[0]).toMatchObject({ opens: '09:00', closes: '23:30' })
  expect(openingHoursFromText('09:00 - 24:00')?.[0]).toMatchObject({ opens: '09:00', closes: '00:00' })
  // Gün adı, birden fazla aralık ya da serbest metin: yanlış bilgi vermemek için yazılmaz
  expect(openingHoursFromText('Hafta içi 09:00-22:00, hafta sonu 10:00-24:00')).toBeNull()
  expect(openingHoursFromText('Pazartesi kapalı, 10:00 - 22:00')).toBeNull()
  expect(openingHoursFromText('Öğlen 12:00 - 15:00 / Akşam 18:00 - 23:00')).toBeNull()
  expect(openingHoursFromText('Sabaha kadar açığız')).toBeNull()
  expect(openingHoursFromText('')).toBeNull()
})

const menu = {
  id: 'm',
  categories: [
    { id: 'kampanyalar', name: 'Kampanyalar', is_active: true, items: [{ id: 'k', name: 'Paket', price: '170 ₺' }] },
    {
      id: 'c1',
      name: 'SICAK İÇECEKLER',
      is_active: true,
      items: [
        { id: 'i1', name: 'Çay', price: '35 ₺', calories: 2, tags: ['vegan'], image_url: '/catalog/cay.webp?v=1' },
        { id: 'i2', name: 'Salep', price: 'S:50 / L:70', image_url: 'data:image/webp;base64,AAA' },
      ],
    },
    { id: 'c2', name: 'Tatlılar', is_active: true, items: [{ id: 'i3', name: 'Künefe', price: '1.250,50 ₺', allergens: ['Süt'] }] },
    { id: 'c3', name: 'Boş', is_active: true, items: [] },
  ],
} as unknown as Menu

test('menü açıklaması kategorilerden (kampanya ve boş kategori hariç)', () => {
  const d = menuDescription({ name: 'Medusa Cafe', city: 'İstanbul' }, menu)
  expect(d).toBe('Medusa Cafe (İstanbul) menüsü ve güncel fiyatları: Sıcak İçecekler ve Tatlılar. Kalori ve alerjen bilgileriyle.')
  expect(menuDescription({ name: 'X' }, undefined)).toContain('X:')
})

test('menü yapısal verisi: fiyat, diyet, mutlak görsel; base64 görsel ve okunamayan fiyat yazılmaz', () => {
  const ld = menuJsonLd({ name: 'Medusa Cafe', currency: '₺' }, 'medusa-cafe', menu)!
  expect(ld['@type']).toBe('Menu')
  expect(ld.hasMenuSection.map((s) => s.name)).toEqual(['Sıcak İçecekler', 'Tatlılar'])
  const [cay, salep] = ld.hasMenuSection[0].hasMenuItem as any[]
  expect(cay.offers).toEqual({ '@type': 'Offer', price: '35.00', priceCurrency: 'TRY' })
  expect(cay.suitableForDiet).toEqual(['https://schema.org/VeganDiet'])
  expect(cay.image).toMatch(/^https:\/\/.+\/catalog\/cay\.webp\?v=1$/)
  expect(cay.nutrition.calories).toBe('2 kcal')
  expect(salep.offers).toBeUndefined()
  expect(salep.image).toBeUndefined()
  expect((ld.hasMenuSection[1].hasMenuItem as any[])[0].offers.price).toBe('1250.50')
  expect(menuJsonLd({ name: 'X' }, 'x', undefined)).toBeNull()
})

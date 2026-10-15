import { test, expect } from '@playwright/test'
import { buildAboutTemplate, joinTurkishList, locativeSuffix } from '../lib/about-template'
import {
  normalizeEmail,
  normalizeFacebookUrl,
  normalizeTiktok,
  normalizeWebUrl,
  normalizeXHandle,
  normalizeYoutubeUrl,
  profileToDbColumns,
  profileUpdateSchema,
} from '../lib/restaurant-profile'

test('Türkçe bulunma eki ve liste', () => {
  expect(locativeSuffix('İstanbul')).toBe("'da")
  expect(locativeSuffix('İzmir')).toBe("'de")
  expect(locativeSuffix('Muş')).toBe("'ta")
  expect(locativeSuffix('Eskişehir')).toBe("'de")
  expect(locativeSuffix('Antalya')).toBe("'da")
  expect(joinTurkishList(['a', 'b', 'c'])).toBe('a, b ve c')
})

test('otomatik hakkımızda metni', () => {
  const text = buildAboutTemplate({
    name: 'Ada Kafe',
    businessType: 'cafe',
    city: 'İzmir',
    categories: ['SICAK İÇECEKLER', 'Tatlılar'],
    featured: ['San Sebastian'],
  })
  expect(text).toContain("Ada Kafe, İzmir'de misafirlerini ağırlayan bir kafe.")
  expect(text).toContain('sıcak içecekler ve tatlılar')
  expect(text).toContain('San Sebastian')
  expect(buildAboutTemplate({ name: 'X', typeLabel: 'Kokoreççi / Sokak' })).toContain('bir kokoreççi.')
})

test('iletişim alanı normalleştiricileri', () => {
  expect(normalizeEmail(' Merhaba@Kafe.com ')).toBe('merhaba@kafe.com')
  expect(normalizeEmail('kafe@')).toBe('')
  expect(normalizeWebUrl('kafe.com')).toBe('https://kafe.com/')
  expect(normalizeWebUrl('javascript:alert(1)')).toBe('')
  expect(normalizeFacebookUrl('facebook.com/kafe')).toBe('https://facebook.com/kafe')
  expect(normalizeFacebookUrl('https://evil.com/facebook.com')).toBe('')
  expect(normalizeYoutubeUrl('https://www.youtube.com/@kafe')).toBe('https://www.youtube.com/@kafe')
  expect(normalizeTiktok('https://www.tiktok.com/@kafe.ada')).toBe('kafe.ada')
  expect(normalizeXHandle('https://twitter.com/kafe_ada')).toBe('kafe_ada')
})

test('hakkımızda kaydı: boş metin otomatiğe döner', () => {
  const filled = profileToDbColumns(profileUpdateSchema.parse({ aboutText: 'Merhaba <b>', aboutSource: 'ai' }))
  expect(filled).toEqual({ about_text: 'Merhaba b', about_source: 'ai' })
  expect(profileToDbColumns(profileUpdateSchema.parse({ aboutText: '  ' }))).toEqual({ about_text: null, about_source: null })
})

test('site adresi alanı doğrulaması', () => {
  expect(profileUpdateSchema.parse({ siteSlug: ' Medusa-Cafe ' }).siteSlug).toBe('medusa-cafe')
  expect(profileUpdateSchema.safeParse({ siteSlug: 'dashboard' }).success).toBe(false)
  expect(profileUpdateSchema.safeParse({ siteSlug: 'a' }).success).toBe(false)
  expect(profileUpdateSchema.safeParse({ siteSlug: 'kafe ada' }).success).toBe(false)
  expect(profileUpdateSchema.safeParse({ siteSlug: '-kafe' }).success).toBe(false)
  // DB sütununa route yazar; profileToDbColumns dokunmaz
  expect(profileToDbColumns(profileUpdateSchema.parse({ siteSlug: 'medusa-cafe' }))).toEqual({})
})

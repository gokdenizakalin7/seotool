import { test, expect } from '@playwright/test'
import {
  normalizeInstagram,
  normalizeWhatsapp,
  normalizeGoogleUrl,
  profileUpdateSchema,
  profileToDbColumns,
  orgRowToRestaurant,
  buildChecklist,
} from '../lib/restaurant-profile'

test.describe('normalizeInstagram', () => {
  test('kabul edilen biçimler', () => {
    expect(normalizeInstagram('@qolay')).toBe('qolay')
    expect(normalizeInstagram('qolay.menu')).toBe('qolay.menu')
    expect(normalizeInstagram('https://www.instagram.com/qolay/?hl=tr')).toBe('qolay')
    expect(normalizeInstagram('instagram.com/qolay')).toBe('qolay')
  })
  test('geçersiz girdiler', () => {
    expect(normalizeInstagram('')).toBe('')
    expect(normalizeInstagram('a b')).toBe('')
    expect(normalizeInstagram('<script>')).toBe('')
    expect(normalizeInstagram('x'.repeat(31))).toBe('')
  })
})

test.describe('normalizeWhatsapp', () => {
  test('Türkiye biçimleri', () => {
    expect(normalizeWhatsapp('0532 123 45 67')).toBe('905321234567')
    expect(normalizeWhatsapp('+90 532 123 45 67')).toBe('905321234567')
    expect(normalizeWhatsapp('5321234567')).toBe('905321234567')
    expect(normalizeWhatsapp('00905321234567')).toBe('905321234567')
  })
  test('geçersiz', () => {
    expect(normalizeWhatsapp('')).toBe('')
    expect(normalizeWhatsapp('abc')).toBe('')
    expect(normalizeWhatsapp('123')).toBe('')
  })
})

test.describe('normalizeGoogleUrl', () => {
  test('Google alan adları', () => {
    expect(normalizeGoogleUrl('https://maps.app.goo.gl/abc')).toContain('https://maps.app.goo.gl/abc')
    expect(normalizeGoogleUrl('g.page/r/xyz/review')).toBe('https://g.page/r/xyz/review')
    expect(normalizeGoogleUrl('http://www.google.com/maps?q=1')).toMatch(/^https:\/\/www\.google\.com/)
  })
  test('Google dışı / sahte alan adları reddedilir', () => {
    expect(normalizeGoogleUrl('https://evil.com')).toBe('')
    expect(normalizeGoogleUrl('https://google.com.evil.com')).toBe('')
    expect(normalizeGoogleUrl('https://notgoogle.com')).toBe('')
    expect(normalizeGoogleUrl('javascript:alert(1)')).toBe('')
    expect(normalizeGoogleUrl('')).toBe('')
  })
})

test.describe('profileUpdateSchema', () => {
  test('HTML karakterlerini temizler ve kırpar', () => {
    const r = profileUpdateSchema.parse({ name: '  <b>Kafe</b>  ' })
    expect(r.name).toBe('bKafe/b')
  })
  test('geçersiz işletme türü ve renk reddedilir', () => {
    // Türlerin varlığı sunucuda business_types tablosundan doğrulanır; şema yalnızca biçimi denetler
    expect(profileUpdateSchema.safeParse({ businessType: 'Nope!' }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ primaryColor: 'red' }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ businessType: 'cafe', primaryColor: '#aabbcc' }).success).toBe(true)
  })
  test('uzunluk sınırı', () => {
    expect(profileUpdateSchema.parse({ wifiName: 'a'.repeat(100) }).wifiName).toHaveLength(32)
  })
})

test.describe('profileToDbColumns', () => {
  test('sadece verilen alanları eşler', () => {
    const cols = profileToDbColumns(
      profileUpdateSchema.parse({ businessType: 'cafe', instagramHandle: '@qolay', whatsappNumber: '05321234567' })
    )
    expect(cols).toEqual({
      business_type: 'cafe',
      instagram_handle: 'qolay',
      whatsapp_number: '905321234567',
    })
  })
  test('completeOnboarding zaman damgası yazar', () => {
    const cols = profileToDbColumns({ completeOnboarding: true })
    expect(typeof cols.onboarding_completed_at).toBe('string')
    expect(profileToDbColumns({ completeOnboarding: false })).toEqual({})
  })
})

test.describe('orgRowToRestaurant + buildChecklist', () => {
  test('boş satır güvenli varsayılanlar', () => {
    const r = orgRowToRestaurant({ id: '1', subdomain: 's' })
    expect(r.name).toBe('Restoranım')
    expect(r.onboardingCompletedAt).toBeNull()
    expect(r.branding?.primaryColor).toBe('#e11d48')
    expect(buildChecklist(r).every((i) => !i.done)).toBe(true)
  })
  test('dolu satır checklist işaretler', () => {
    const r = orgRowToRestaurant({
      id: '1',
      subdomain: 's',
      business_type: 'cafe',
      logo_url: 'x',
      business_phone: '1',
      address: 'a',
      wifi_name: 'w',
      instagram_handle: 'i',
      google_review_url: 'g',
    })
    const items = buildChecklist(r, { hasMenu: true, hasTables: false })
    const done = Object.fromEntries(items.map((i) => [i.id, i.done]))
    expect(done).toMatchObject({ type: true, logo: true, contact: true, wifi: true, instagram: true, review: true, menu: true, qr: false })
  })
  test('null restaurant', () => {
    expect(buildChecklist(null).every((i) => !i.done)).toBe(true)
  })
})

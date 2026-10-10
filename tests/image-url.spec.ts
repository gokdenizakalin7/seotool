import { test, expect } from '@playwright/test'
import { catalogImageUrl, catalogThumbUrl, isCatalogImage } from '../lib/image-url'

test.describe('image-url', () => {
  test('katalog görseli için -s varyantı türetir, ?v= korunur', () => {
    expect(catalogThumbUrl('/catalog/adana-kebap.webp?v=abc12345')).toBe('/catalog/adana-kebap-s.webp?v=abc12345')
    expect(catalogThumbUrl('/catalog/adana-kebap.webp')).toBe('/catalog/adana-kebap-s.webp')
  })
  test('zaten küçük boy ise ve katalog dışı URL ise aynen döner', () => {
    expect(catalogThumbUrl('/catalog/adana-kebap-s.webp')).toBe('/catalog/adana-kebap-s.webp')
    expect(catalogThumbUrl('https://x.supabase.co/storage/v1/object/public/menu-images/orgs/1/items/a.webp')).toBe(
      'https://x.supabase.co/storage/v1/object/public/menu-images/orgs/1/items/a.webp'
    )
    expect(catalogThumbUrl('data:image/webp;base64,AAAA')).toBe('data:image/webp;base64,AAAA')
    expect(catalogThumbUrl('')).toBe('')
    expect(catalogThumbUrl(undefined)).toBe('')
  })
  test('isCatalogImage ve catalogImageUrl', () => {
    expect(isCatalogImage('/catalog/x.webp')).toBe(true)
    expect(isCatalogImage('https://images.unsplash.com/a.jpg')).toBe(false)
    expect(catalogImageUrl('kunefe', 'deadbeefcafe0123')).toBe('/catalog/kunefe.webp?v=deadbeef')
    expect(catalogImageUrl('kunefe')).toBe('/catalog/kunefe.webp')
  })
})

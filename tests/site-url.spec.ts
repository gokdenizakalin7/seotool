import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  RESERVED_SLUGS,
  isReservedSlug,
  isValidSiteSlug,
  legacyMenuRedirectPath,
  sitePath,
  siteUrl,
  slugInput,
  slugifyBusinessName,
  tableQrUrl,
} from '../lib/site-url'

test('ayrılmış adlar veritabanındaki son is_reserved_slug tanımıyla aynı (migration 19)', () => {
  const sql = readFileSync(path.join(__dirname, '../supabase/migrations/19_reserve_qr_menu_slug.sql'), 'utf8')
  const block = sql.slice(sql.indexOf('FUNCTION public.is_reserved_slug'), sql.indexOf(']::text[]'))
  const fromSql = [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort()
  expect(fromSql).toEqual([...RESERVED_SLUGS].sort())
})

test('panel yolları işletme adı olamaz', () => {
  for (const slug of ['dashboard', 'admin', 'login', 'signup', 'onboarding', 'business', 'gorsel-kaynaklari', 'menu', 'api', 'blog', 'qr-menu']) {
    expect(isReservedSlug(slug)).toBe(true)
    expect(isValidSiteSlug(slug)).toBe(false)
  }
  expect(isValidSiteSlug('kafe-ada')).toBe(true)
  expect(isValidSiteSlug('Kafe')).toBe(false)
  expect(isValidSiteSlug('-kafe')).toBe(false)
  expect(isValidSiteSlug('robots.txt')).toBe(false)
})

test('site adresleri ve masa QR', () => {
  expect(sitePath('kafe-ada')).toBe('/kafe-ada')
  expect(sitePath('kafe-ada', 'etkinlikler')).toBe('/kafe-ada/etkinlikler')
  expect(siteUrl('kafe-ada', '', { table: 'Masa 1', tid: undefined })).toBe('/kafe-ada?table=Masa+1')
  expect(tableQrUrl('kafe-ada', { id: 'tbl-123', name: 'Bahçe 2' })).toBe('/kafe-ada?table=Bah%C3%A7e+2')
  expect(tableQrUrl('kafe-ada', { id: '0b7c', name: 'A' })).toBe('/kafe-ada?table=A&tid=0b7c')
})

test('eski /menu adresi sorguyu korur', () => {
  expect(legacyMenuRedirectPath('kafe-ada', 'table=Masa%201&tid=abc')).toBe('/kafe-ada?table=Masa%201&tid=abc')
  expect(legacyMenuRedirectPath('kafe-ada', '')).toBe('/kafe-ada')
})

test('işletme adından site adresi', () => {
  expect(slugifyBusinessName('Medusa Cafe')).toBe('medusa-cafe')
  expect(slugifyBusinessName('Köşe Kafe')).toBe('kose-kafe')
  expect(slugifyBusinessName('İSTANBUL Çay -- Evi!')).toBe('istanbul-cay-evi')
  expect(slugifyBusinessName('  ---  ')).toBe('')
  expect(slugifyBusinessName('a'.repeat(50)).length).toBe(40)
  expect(isValidSiteSlug(slugifyBusinessName('Medusa Cafe'))).toBe(true)
  // Yazarken sondaki tire korunur, kaydederken kırpılır
  expect(slugInput('medusa-')).toBe('medusa-')
  expect(slugifyBusinessName('medusa-')).toBe('medusa')
})

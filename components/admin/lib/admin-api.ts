import { authFetch } from '@/lib/api-client'

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: any) {
    super(message)
    this.name = 'AdminApiError'
  }
}

/** Admin uçlarına JSON istek; hata durumunda sunucunun Türkçe mesajıyla fırlatır. */
export async function adminApi<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await authFetch(url, {
    method: opts.method || 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AdminApiError(data?.error || `İstek başarısız (${res.status})`, res.status, data?.code, data)
  }
  return data as T
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
}

export function qs(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function fmtDate(v: string | null | undefined): string {
  return v ? dateFmt.format(new Date(v)) : '—'
}

export function fmtDateTime(v: string | null | undefined): string {
  return v ? dateTimeFmt.format(new Date(v)) : '—'
}

/** "3 gün önce" gibi göreli zaman */
export function fmtRelative(v: string | null | undefined): string {
  if (!v) return 'Hiç'
  const diff = Date.now() - new Date(v).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'Az önce'
  if (min < 60) return `${min} dk önce`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} saat önce`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} gün önce`
  return fmtDate(v)
}

export function isBanned(bannedUntil: string | null | undefined): boolean {
  return !!bannedUntil && new Date(bannedUntil).getTime() > Date.now()
}

/** Harf + rakam + sembol içeren, okunması kolay 12 karakterlik şifre */
export function generatePassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#%*?'
  const all = letters + digits + symbols
  const rand = (n: number) => {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0] % n
  }
  const chars = [letters[rand(letters.length)], digits[rand(digits.length)], symbols[rand(symbols.length)]]
  while (chars.length < 12) chars.push(all[rand(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Dosyayı data URL olarak okur */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })
}

export function slugify(input: string): string {
  return input
    .toLocaleLowerCase('tr')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Yazarken kullanılan subdomain temizleyici: sondaki tireyi silmez (kullanıcı yazmaya devam edebilsin) */
export function subdomainInput(input: string): string {
  return input
    .toLocaleLowerCase('tr')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.create': 'Restoran oluşturuldu',
  'organization.update': 'Restoran bilgileri güncellendi',
  'organization.delete': 'Restoran silindi',
  'organization.suspend': 'Hesap askıya alındı',
  'organization.activate': 'Hesap aktifleştirildi',
  'organization.impersonate': 'Panele girildi',
  'member.add': 'Üye eklendi',
  'member.create': 'Yeni üye oluşturuldu',
  'member.role': 'Üye rolü değişti',
  'member.remove': 'Üye çıkarıldı',
  'user.update': 'Kullanıcı güncellendi',
  'user.password': 'Şifre belirlendi',
  'user.ban': 'Kullanıcı engellendi',
  'user.unban': 'Kullanıcı engeli kaldırıldı',
  'user.delete': 'Kullanıcı silindi',
  'catalog_category.create': 'Kategori eklendi',
  'catalog_category.update': 'Kategori güncellendi',
  'catalog_category.delete': 'Kategori silindi',
  'catalog_category.reorder': 'Kategoriler sıralandı',
  'catalog_item.create': 'Katalog ürünü eklendi',
  'catalog_item.update': 'Katalog ürünü güncellendi',
  'catalog_item.delete': 'Katalog ürünü silindi',
  'catalog_item.image_upload': 'Katalog görseli yüklendi',
  'catalog_item.image_generate': 'Katalog görseli AI ile üretildi',
  'catalog_item.image_remove': 'Katalog görseli kaldırıldı',
  'business_type.create': 'İşletme türü eklendi',
  'business_type.update': 'İşletme türü güncellendi',
  'business_type.delete': 'İşletme türü silindi',
  'template.create': 'Şablon oluşturuldu',
  'template.update': 'Şablon güncellendi',
  'template.delete': 'Şablon silindi',
  'template.content': 'Şablon içeriği değişti',
  'template.categories': 'Şablon kategorileri değişti',
  'template.items': 'Şablon ürünleri değişti',
  'settings.update': 'Platform ayarları değişti',
}

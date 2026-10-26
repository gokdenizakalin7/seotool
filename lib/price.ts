/**
 * Serbest metin fiyatları ("85 ₺", "85,50", "1.250 ₺", "12.5 TL") sayıya çevirip geri biçimlendirir.
 * Okunamayan fiyatlar (aralık, "S:50 / L:70", metin) null döner; fiyat planları bunlara dokunmaz.
 */

export interface ParsedPrice {
  amount: number
  /** Metinde geçen para birimi simgesi (₺, $, €, £); yoksa null */
  currency: string | null
}

const CURRENCY_TOKENS = /₺|TL|TRY|\$|€|£/gi

function normalizeCurrency(token: string): string {
  const t = token.toUpperCase()
  if (t === 'TL' || t === 'TRY') return '₺'
  return token
}

export function parsePrice(input: unknown): ParsedPrice | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? { amount: input, currency: null } : null
  }
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null

  const symbols = raw.match(CURRENCY_TOKENS)
  const currency = symbols ? normalizeCurrency(symbols[0]) : null
  const s = raw.replace(CURRENCY_TOKENS, '').replace(/\s+/g, '')
  if (!/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null

  let normalized: string
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    // İkisi birden varsa sondaki ondalık ayracıdır: 1.250,50 → 1250.50 · 1,250.50 → 1250.50
    const decimalIsComma = s.lastIndexOf(',') > s.lastIndexOf('.')
    const [thousands, decimal] = decimalIsComma ? ['.', ','] : [',', '.']
    const [intPart, fracPart, ...rest] = s.split(decimal)
    if (rest.length || !fracPart || fracPart.length > 2) return null
    const groups = intPart.split(thousands)
    if (groups.slice(1).some((g) => g.length !== 3)) return null
    normalized = `${groups.join('')}.${fracPart}`
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.'
    const parts = s.split(sep)
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0]}.${parts[1]}` // 85,50 · 12.5
    } else if (parts.slice(1).every((p) => p.length === 3)) {
      normalized = parts.join('') // 1.250 · 1,250 · 1.250.000
    } else {
      return null
    }
  } else {
    normalized = s
  }

  const amount = Number(normalized)
  return Number.isFinite(amount) ? { amount, currency } : null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Türkçe biçim: 1250 → "1.250 ₺", 85.5 → "85,50 ₺" */
export function formatPrice(amount: number, currency: string | null | undefined = '₺'): string {
  const value = round2(amount)
  const fraction = Number.isInteger(value) ? 0 : 2
  const text = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: fraction, maximumFractionDigits: fraction }).format(value)
  const symbol = (currency || '').trim()
  return symbol ? `${text} ${symbol}` : text
}

/**
 * Menüde gösterilecek fiyat: simgesiz sayıya işletmenin para birimi eklenir ("450" → "450 ₺", "1250" → "1.250 ₺").
 * Simgesi olan ("85 ₺") ya da okunamayan ("S:50 / L:70") metin olduğu gibi kalır.
 */
export function displayPrice(text: string | null | undefined, currency: string | null | undefined = '₺'): string {
  const raw = (text ?? '').trim()
  const parsed = parsePrice(raw)
  if (!parsed || parsed.currency) return raw
  return formatPrice(parsed.amount, currency || '₺')
}

export type Rounding = 'none' | '1' | '5' | '10'

/** Fiyatı en yakın 1 / 5 / 10'un katına yuvarlar ('none': kuruş hassasiyeti); negatif olmaz */
export function roundAmount(amount: number, rounding: Rounding = 'none'): number {
  const n = Math.max(0, amount)
  if (rounding === 'none') return round2(n)
  const step = Number(rounding)
  return Math.round(n / step) * step
}

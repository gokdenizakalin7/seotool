import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { sanitizeText } from '@/lib/sanitizer'
import { matchScannedItems, searchCatalogServer } from '@/lib/server/catalog-matcher'

export const maxDuration = 30

const postSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        category: z.string().max(80).optional().nullable(),
      })
    )
    .min(1)
    .max(300),
  menuName: z.string().max(100).optional().nullable(),
})

function rateLimited(req: NextRequest) {
  const rl = checkRateLimit(`catalog_match_${getClientIp(req)}`, RATE_LIMITS.CATALOG_MATCH.limit, RATE_LIMITS.CATALOG_MATCH.windowSeconds)
  if (rl.success) return null
  return NextResponse.json(
    { error: 'Çok fazla arama yaptınız, biraz bekleyin.', code: 'RATE_LIMIT_EXCEEDED', retryAfter: rl.resetSeconds },
    { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } }
  )
}

/** GET /api/catalog/match?q=latte&limit=8 — "Katalogdan seç" arama kutusu */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const limited = rateLimited(req)
  if (limited) return limited

  const params = req.nextUrl.searchParams
  const q = sanitizeText(params.get('q') || '', 80)
  const limit = Math.min(20, Math.max(1, parseInt(params.get('limit') || '8', 10) || 8))
  if (q.length < 2) return NextResponse.json({ results: [] })

  try {
    const results = await searchCatalogServer(q, limit)
    return NextResponse.json({ results })
  } catch (e) {
    console.error('catalog search error:', e)
    return NextResponse.json({ error: 'Katalog araması yapılamadı.' }, { status: 500 })
  }
}

/** POST /api/catalog/match { items: [{ name, category? }], menuName? } — toplu eşleştirme */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const limited = rateLimited(req)
  if (limited) return limited

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const items = parsed.data.items.map((it) => ({
    name: sanitizeText(it.name, 120),
    category: it.category ? sanitizeText(it.category, 80) : null,
  }))
  const results = await matchScannedItems(items, { menuName: parsed.data.menuName ? sanitizeText(parsed.data.menuName, 100) : null })
  return NextResponse.json({ results })
}

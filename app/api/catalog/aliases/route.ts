import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/auth-middleware'
import { checkRateLimit, consumeQuota, getClientIp, getQuota, RATE_LIMITS } from '@/lib/rate-limiter'
import { sanitizeText } from '@/lib/sanitizer'
import { isComboName, normalizeDishName } from '@/lib/catalog-match'
import { getCatalogIndex, invalidateCatalogIndex } from '@/lib/server/catalog-matcher'

const schema = z.object({
  pairs: z
    .array(z.object({ alias: z.string().min(1).max(120), item_id: z.uuid() }))
    .min(1)
    .max(200),
})

/**
 * POST /api/catalog/aliases { pairs: [{ alias, item_id }] }
 * İşletme sahibinin onayladığı "menüdeki ad → katalog ürünü" eşleşmelerini öğrenir.
 * Yalnız bilgi taşıyan çiftler kaydedilir (ürünün kendi adı değil, birleşik menü değil, ≥ 3 karakter).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const rl = checkRateLimit(`catalog_alias_${getClientIp(req)}`, RATE_LIMITS.CATALOG_ALIAS.limit, RATE_LIMITS.CATALOG_ALIAS.windowSeconds)
  if (!rl.success) {
    return NextResponse.json({ error: 'Çok fazla istek, biraz bekleyin.' }, { status: 429, headers: { 'Retry-After': String(rl.resetSeconds) } })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const index = await getCatalogIndex()
  const seen = new Set<string>()
  const rows: { alias_norm: string; item_id: string; alias: string }[] = []
  let skipped = 0

  for (const pair of parsed.data.pairs) {
    const alias = sanitizeText(pair.alias, 120)
    const aliasNorm = normalizeDishName(alias)
    const entry = index.byId.get(pair.item_id)
    const dedupeKey = `${aliasNorm}|${pair.item_id}`
    if (
      !entry ||
      aliasNorm.length < 3 ||
      isComboName(alias) ||
      aliasNorm === entry.name_key ||
      aliasNorm === entry.name_en_key ||
      seen.has(dedupeKey)
    ) {
      skipped++
      continue
    }
    // Aynı kullanıcı aynı takma adı günde bir kez saydırır
    const quotaKey = `alias_${auth.user.id}_${aliasNorm}`
    if (!getQuota(quotaKey, RATE_LIMITS.ALIAS_PER_USER.limit).allowed) {
      skipped++
      continue
    }
    consumeQuota(quotaKey, RATE_LIMITS.ALIAS_PER_USER.windowSeconds)
    seen.add(dedupeKey)
    rows.push({ alias_norm: aliasNorm, item_id: pair.item_id, alias })
  }

  if (rows.length === 0) return NextResponse.json({ saved: 0, skipped })

  const { data, error } = await supabaseAdmin.rpc('confirm_catalog_aliases', { p_pairs: rows })
  if (error) {
    console.error('confirm_catalog_aliases error:', error)
    return NextResponse.json({ error: 'Takma adlar kaydedilemedi.' }, { status: 500 })
  }
  invalidateCatalogIndex()
  return NextResponse.json({ saved: typeof data === 'number' ? data : rows.length, skipped })
}

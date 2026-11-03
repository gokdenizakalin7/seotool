import { NextResponse } from 'next/server'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { requirePanelUser } from '@/lib/auth-middleware'
import type { CatalogTemplateSummary } from '@/lib/catalog-templates'

// PostgREST varsayılan olarak 1000 satırda keser; tabloyu sayfalayarak oku.
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select(columns).range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < size) break
  }
  return out
}

/** GET /api/templates[?business_type=cafe] — aktif şablonlar, display_order sıralı. */
export async function GET(request: Request) {
  try {
    const auth = await requirePanelUser(request)
    if ('response' in auth) return auth.response

    const businessType = new URL(request.url).searchParams.get('business_type')

    let q = db
      .from('menu_templates')
      .select('id, slug, business_type, name, tagline, venue_type, icon, color, cover_image, description, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (businessType) q = q.eq('business_type', businessType)
    const { data: templates, error } = await q
    if (error) throw new Error(error.message)
    if (!templates || templates.length === 0) return NextResponse.json({ templates: [] })

    const ids = new Set(templates.map((t) => t.id))
    const [tplItems, tplCats, cats, items] = await Promise.all([
      fetchAll<{ template_id: string; item_id: string }>('menu_template_items', 'template_id, item_id'),
      fetchAll<{ template_id: string; category_id: string; display_order: number }>(
        'menu_template_categories',
        'template_id, category_id, display_order'
      ),
      fetchAll<{ id: string; parent_id: string | null; name: string }>('catalog_categories', 'id, parent_id, name'),
      fetchAll<{ id: string; primary_category_id: string }>('catalog_items', 'id, primary_category_id'),
    ])

    const catById = new Map(cats.map((c) => [c.id, c]))
    const itemCat = new Map(items.map((i) => [i.id, i.primary_category_id]))

    // Kategorinin seviye-2 atası (kök = seviye 1). Kök ya da bulunamazsa null.
    const l2Of = (id: string): string | null => {
      const chain: string[] = []
      for (let cur = catById.get(id); cur; cur = cur.parent_id ? catById.get(cur.parent_id) : undefined) {
        chain.unshift(cur.id)
      }
      return chain[1] ?? null
    }

    const itemsByTpl = new Map<string, string[]>()
    for (const r of tplItems) {
      if (!ids.has(r.template_id)) continue
      const list = itemsByTpl.get(r.template_id) ?? []
      list.push(r.item_id)
      itemsByTpl.set(r.template_id, list)
    }
    const orderByTplCat = new Map<string, number>()
    for (const r of tplCats) orderByTplCat.set(`${r.template_id}:${r.category_id}`, r.display_order)

    const result: CatalogTemplateSummary[] = templates.map((t) => {
      const itemIds = itemsByTpl.get(t.id) ?? []
      const perMain = new Map<string, number>()
      for (const itemId of itemIds) {
        const catId = itemCat.get(itemId)
        const main = catId ? l2Of(catId) : null
        if (main) perMain.set(main, (perMain.get(main) ?? 0) + 1)
      }
      const categories = [...perMain.entries()]
        .sort(
          ([a], [b]) =>
            (orderByTplCat.get(`${t.id}:${a}`) ?? 9999) - (orderByTplCat.get(`${t.id}:${b}`) ?? 9999)
        )
        .map(([id, itemCount]) => ({ name: catById.get(id)!.name, itemCount }))

      return {
        slug: t.slug,
        businessType: t.business_type,
        name: t.name,
        tagline: t.tagline ?? '',
        venueType: t.venue_type ?? '',
        icon: t.icon ?? '',
        color: t.color ?? '#e11d48',
        coverImage: t.cover_image ?? '',
        description: t.description ?? '',
        itemCount: itemIds.length,
        categories,
      }
    })

    return NextResponse.json({ templates: result })
  } catch (err) {
    console.error('Templates list error:', err)
    return NextResponse.json({ error: 'Şablonlar yüklenemedi.' }, { status: 500 })
  }
}

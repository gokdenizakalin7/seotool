import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { logAdminAction } from '@/lib/server/admin/audit'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { localizeOrgItemImages } from '@/lib/server/localize-item-images'
import { logUnmatched, matchScannedItems } from '@/lib/server/catalog-matcher'

export const maxDuration = 300

const itemSchema = z.object({
  name: z.string().min(1),
  price: z.string().default('0'),
  description: z.string().default(''),
  imageUrl: z.string().default(''),
})

const categorySchema = z.object({
  name: z.string().min(1),
  items: z.array(itemSchema).default([]),
})

const importSchema = z.object({
  subdomain: z.string().min(1),
  menuName: z.string().min(1),
  categories: z.array(categorySchema).min(1),
})

export async function POST(request: NextRequest) {
  return adminRoute(request, 'import-menu', async (user) => {
    const parsed = await parseBody(request, importSchema)
    if ('response' in parsed) return parsed.response

    const { subdomain, menuName, categories } = parsed.data

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (!org) return jsonError(404, `"${subdomain}" adlı işletme bulunamadı.`)

    const menuId = `menu-${randomUUID()}`

    // Kataloğa eşleştirme (fotoğraftan taramadaki kural): kesin eşleşen ürün kataloğa bağlanır.
    // İşletmenin kendi görseli korunur; görseli olmayan ürüne katalog görseli verilir.
    const flat = categories.flatMap((cat) => cat.items.map((item) => ({ name: item.name, category: cat.name })))
    const infos = await matchScannedItems(flat, { menuName })
    let k = 0
    let catalogLinked = 0
    let catalogImages = 0
    const matched = categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        const info = infos[k++]
        if (info?.level !== 'auto' || !info.top) return { ...item, catalogItemId: null as string | null }
        catalogLinked++
        const useCatalogImage = !item.imageUrl.trim() && Boolean(info.top.image_url)
        if (useCatalogImage) catalogImages++
        return { ...item, catalogItemId: info.top.item_id, imageUrl: useCatalogImage ? info.top.image_url : item.imageUrl }
      }),
    }))
    const unmatched = flat
      .map((it, i) => ({ it, info: infos[i] }))
      .filter(({ info }) => info?.level !== 'auto')
      .map(({ it, info }) => ({ name: it.name, category_name: it.category, best_slug: info?.top?.slug ?? null, best_score: info?.top?.score ?? null }))
    if (unmatched.length) logUnmatched(unmatched)

    const menusPayload = [
      {
        id: menuId,
        name: menuName,
        description: '',
        image_url: '',
        is_listed: true,
        layout: 'list',
        available_days: [0, 1, 2, 3, 4, 5, 6],
        categories: matched.map((cat, catIdx) => ({
          id: `cat-${randomUUID()}`,
          name: cat.name,
          description: '',
          is_active: true,
          display_order: catIdx,
          items: cat.items.map((item, itemIdx) => ({
            id: `item-${randomUUID()}`,
            name: item.name,
            description: item.description,
            price: item.price,
            image_url: item.imageUrl,
            catalog_item_id: item.catalogItemId,
            is_available: true,
            display_order: itemIdx,
          })),
        })),
      },
    ]

    const { error } = await supabaseAdmin.rpc('sync_menus_transaction', {
      p_org_id: org.id,
      p_menus: menusPayload,
    })

    if (error) {
      console.error('Import menu RPC error:', error)
      return jsonError(500, `Menü aktarılamadı: ${error.message}`)
    }

    const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0)

    // Crawl edilen dış görseller hotlink kalmasın: WebP'ye çevrilip Storage'a alınır
    const images = await localizeOrgItemImages(org.id)

    await logAdminAction({
      actor: user,
      action: 'import_menu',
      targetType: 'organization',
      targetId: org.id,
      after: { menuName, categoryCount: categories.length, itemCount: totalItems, catalogLinked, catalogImages, imagesConverted: images.converted, imagesFailed: images.failed },
    })

    return NextResponse.json({
      success: true,
      menuName,
      categoryCount: categories.length,
      itemCount: totalItems,
      catalog: { linked: catalogLinked, imagesFromCatalog: catalogImages },
      images,
    })
  })
}

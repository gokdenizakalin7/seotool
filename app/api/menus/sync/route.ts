import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { isDataImageUrl, storeItemDataUrl } from '@/lib/server/localize-item-images'
import { isMissingSchemaError } from '@/lib/restaurant-profile'
import { z } from 'zod'

// Liste alanları null gelebilir (betikle eklenmiş eski ürünler); RPC dizi olmayan değeri '{}' yazar
const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  image_url: z.string().optional(),
  allergens: z.array(z.string()).nullable().optional(),
  ingredients: z.array(z.string()).nullable().optional(),
  calories: z.number().nullable().optional(),
  is_available: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
  display_order: z.number().optional(),
  // Kataloğa bağlantı; zod bilinmeyen alanları attığı için burada açıkça geçirilir
  catalog_item_id: z.uuid().nullable().optional(),
})

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  parent_id: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().optional(),
  items: z.array(itemSchema).optional(),
})

const menuSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  image_url: z.string().optional(),
  is_listed: z.boolean().optional(),
  layout: z.string().optional(),
  available_days: z.array(z.number()).optional(),
  categories: z.array(categorySchema).optional(),
})

const payloadSchema = z.object({
  subdomain: z.string().min(1),
  menus: z.array(menuSchema),
})

function normalizeMenusForRpc(menus: z.infer<typeof menuSchema>[]) {
  return menus.map((menu) => ({
    ...menu,
    categories: (menu.categories || []).map((cat, catIndex) => ({
      ...cat,
      display_order: cat.display_order ?? catIndex,
      items: (cat.items || []).map((item, itemIndex) => ({
        ...item,
        price: item.price != null ? String(item.price) : '0',
        display_order: item.display_order ?? itemIndex,
      })),
    })),
  }))
}

const IMAGE_UPLOAD_CONCURRENCY = 6

/**
 * Panelde yüklenen ürün fotoğrafları base64 gelir: kayıttan önce Storage'a yüklenip adresle değiştirilir
 * (veritabanında base64 kalırsa müşteri sayfasının HTML'i MB'larca büyür). Aynı görsel bir kez yüklenir;
 * yüklenemeyen görsel olduğu gibi kaydedilir, kayıt bozulmaz. { istemci ürün kimliği: yeni adres } döner.
 */
async function storeDataUrlImages(organizationId: string, menus: z.infer<typeof menuSchema>[]): Promise<Record<string, string>> {
  const itemsByData = new Map<string, z.infer<typeof itemSchema>[]>()
  for (const menu of menus) {
    for (const cat of menu.categories || []) {
      for (const item of cat.items || []) {
        if (!isDataImageUrl(item.image_url)) continue
        itemsByData.set(item.image_url, [...(itemsByData.get(item.image_url) || []), item])
      }
    }
  }

  const stored: Record<string, string> = {}
  const queue = [...itemsByData]
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [dataUrl, items] = next
      try {
        const url = await storeItemDataUrl(organizationId, dataUrl)
        for (const item of items) {
          item.image_url = url
          if (item.id) stored[item.id] = url
        }
      } catch (e) {
        console.warn('menus/sync görsel yüklenemedi:', (e as Error).message)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(IMAGE_UPLOAD_CONCURRENCY, queue.length) }, worker))
  return stored
}

function parseIdMap(rpcData: unknown): Record<string, string> {
  if (!rpcData) return {}
  if (typeof rpcData === 'object' && !Array.isArray(rpcData)) {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(rpcData as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  }
  return {}
}

async function buildIdMapFallback(
  organizationId: string,
  menus: z.infer<typeof menuSchema>[]
): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {}
  for (const menu of menus) {
    if (!menu.id.startsWith('menu-')) {
      idMap[menu.id] = menu.id
      continue
    }
    const { data } = await supabase
      .from('menus')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', menu.name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.id) idMap[menu.id] = data.id
  }
  return idMap
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = payloadSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: result.error.format() },
        { status: 400 }
      )
    }

    const { subdomain, menus } = result.data

    const access = await requireSubdomainAccess(request, subdomain)
    if ('response' in access) return access.response
    const organizationId = access.organizationId

    const { data: ownMenus } = await supabase
      .from('menus')
      .select('id')
      .eq('organization_id', organizationId)
    const ownMenuIds = new Set((ownMenus || []).map((m) => m.id))

    for (const menu of menus) {
      if (!menu.id.startsWith('menu-') && !ownMenuIds.has(menu.id)) {
        return NextResponse.json(
          { error: 'Bu menüyü düzenleme yetkiniz yok.', code: 'FORBIDDEN_RESOURCE' },
          { status: 403 }
        )
      }
    }

    // Gizli ürün varken items.is_hidden sütunu yoksa (migration 20 çalışmamış) RPC alanı sessizce yok sayar;
    // kullanıcı ürünü gizledim sanmasın diye kayıt yapılmadan uyarı döner
    if (menus.some((m) => m.categories?.some((c) => c.items?.some((i) => i.is_hidden)))) {
      const { error: colErr } = await supabase.from('items').select('is_hidden').limit(1)
      if (isMissingSchemaError(colErr)) {
        return NextResponse.json(
          {
            error: 'Menüde gizleme için veritabanı güncellemesi bekleniyor (supabase/migrations/20_item_hidden.sql).',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        )
      }
    }

    const storedImages = await storeDataUrlImages(organizationId, menus)
    const menusPayload = normalizeMenusForRpc(menus)

    const { data: rpcData, error } = await supabase.rpc('sync_menus_transaction', {
      p_org_id: organizationId,
      p_menus: menusPayload,
    })

    if (error) {
      console.error('RPC sync error:', error)
      return NextResponse.json(
        { error: 'Senkronizasyon sırasında veritabanı hatası oluştu.', details: error.message },
        { status: 500 }
      )
    }

    let idMap = parseIdMap(rpcData)
    if (Object.keys(idMap).length === 0) {
      idMap = await buildIdMapFallback(organizationId, menus)
    }

    // Editör base64 görseli yeni adresle değiştirsin (sonraki kayıtta yeniden yüklenmesin); kimlik kayıttan sonraki gerçek kimlik
    const imageUrls: Record<string, string> = {}
    for (const [id, url] of Object.entries(storedImages)) imageUrls[idMap[id] ?? id] = url

    return NextResponse.json({ success: true, idMap, imageUrls })
  } catch (err: unknown) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Menü kaydedilemedi.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'
import { z } from 'zod'

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  image_url: z.string().optional(),
  allergens: z.array(z.string()).optional(),
  ingredients: z.array(z.string()).optional(),
  calories: z.number().nullable().optional(),
  is_available: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
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

    return NextResponse.json({ success: true, idMap })
  } catch (err: unknown) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Menü kaydedilemedi.' }, { status: 500 })
  }
}

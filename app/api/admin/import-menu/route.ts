import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { logAdminAction } from '@/lib/server/admin/audit'
import { z } from 'zod'
import { randomUUID } from 'crypto'

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

    const menusPayload = [
      {
        id: menuId,
        name: menuName,
        description: '',
        image_url: '',
        is_listed: true,
        layout: 'list',
        available_days: [0, 1, 2, 3, 4, 5, 6],
        categories: categories.map((cat, catIdx) => ({
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

    await logAdminAction({
      actor: user,
      action: 'import_menu',
      targetType: 'organization',
      targetId: org.id,
      after: { menuName, categoryCount: categories.length, itemCount: totalItems },
    })

    return NextResponse.json({
      success: true,
      menuName,
      categoryCount: categories.length,
      itemCount: totalItems,
    })
  })
}

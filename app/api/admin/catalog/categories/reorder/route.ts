import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, parseBody } from '@/lib/server/admin/http'
import { reorderSchema } from '@/lib/server/admin/schemas'
import { catalogChanged } from '@/lib/server/admin/catalog'
import { logAdminAction } from '@/lib/server/admin/audit'

/** PUT /api/admin/catalog/categories/reorder { orders: [{ id, displayOrder }] } */
export async function PUT(request: NextRequest) {
  return adminRoute(request, 'catalog category reorder', async (actor) => {
    const body = await parseBody(request, reorderSchema)
    if ('response' in body) return body.response
    const now = new Date().toISOString()
    for (const o of body.data.orders) {
      const { error } = await supabaseAdmin
        .from('catalog_categories')
        .update({ display_order: o.displayOrder, admin_edited_at: now, updated_at: now })
        .eq('id', o.id)
      if (error) throw error
    }
    catalogChanged()
    await logAdminAction({
      actor,
      action: 'catalog_category.reorder',
      targetType: 'catalog_category',
      after: { count: body.data.orders.length },
    })
    return NextResponse.json({ success: true })
  })
}

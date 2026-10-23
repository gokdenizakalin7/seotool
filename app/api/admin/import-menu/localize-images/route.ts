import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, jsonError, parseBody } from '@/lib/server/admin/http'
import { logAdminAction } from '@/lib/server/admin/audit'
import { localizeOrgItemImages } from '@/lib/server/localize-item-images'

export const maxDuration = 300

const schema = z.object({ subdomain: z.string().min(1) })

/** Bir işletmenin dış adresli ürün görsellerini WebP'ye çevirip Storage'a taşır. */
export async function POST(request: NextRequest) {
  return adminRoute(request, 'localize-images', async (user) => {
    const parsed = await parseBody(request, schema)
    if ('response' in parsed) return parsed.response
    const { subdomain } = parsed.data

    const { data: org } = await supabaseAdmin.from('organizations').select('id').eq('subdomain', subdomain).single()
    if (!org) return jsonError(404, `"${subdomain}" adlı işletme bulunamadı.`)

    const result = await localizeOrgItemImages(org.id)

    await logAdminAction({
      actor: user,
      action: 'localize_item_images',
      targetType: 'organization',
      targetId: org.id,
      after: { converted: result.converted, failed: result.failed, uniqueImages: result.uniqueImages },
    })

    return NextResponse.json({ success: true, ...result })
  })
}

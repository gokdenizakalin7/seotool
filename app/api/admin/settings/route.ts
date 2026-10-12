import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminRoute, parseBody } from '@/lib/server/admin/http'
import { settingsSchema } from '@/lib/server/admin/schemas'
import { clearPlatformSettingsCache, getPlatformSettings } from '@/lib/server/platform-settings'
import { logAdminAction } from '@/lib/server/admin/audit'

/** GET /api/admin/settings */
export async function GET(request: NextRequest) {
  return adminRoute(request, 'settings', async () => {
    clearPlatformSettingsCache()
    return NextResponse.json({ settings: await getPlatformSettings() })
  })
}

/** PATCH /api/admin/settings — yalnızca gönderilen anahtarlar güncellenir */
export async function PATCH(request: NextRequest) {
  return adminRoute(request, 'settings update', async (actor) => {
    const body = await parseBody(request, settingsSchema)
    if ('response' in body) return body.response

    clearPlatformSettingsCache()
    const current = await getPlatformSettings()
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    const now = new Date().toISOString()

    for (const [key, value] of Object.entries(body.data)) {
      if (value === undefined || (current as any)[key] === value) continue
      const { error } = await supabaseAdmin
        .from('platform_settings')
        .upsert({ key, value, updated_at: now, updated_by: actor.id })
      if (error) throw error
      before[key] = (current as any)[key]
      after[key] = value
    }
    clearPlatformSettingsCache()

    if (Object.keys(after).length) {
      await logAdminAction({ actor, action: 'settings.update', targetType: 'settings', before, after })
    }
    return NextResponse.json({ settings: await getPlatformSettings(), changed: Object.keys(after) })
  })
}

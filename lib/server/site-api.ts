import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isMissingSchemaError } from '@/lib/restaurant-profile'

/** İşletme sitesi API route'larının ortak yardımcıları (fiyat planı, kampanya, etkinlik) */

export function jsonError(status: number, error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status })
}

/** İstek gövdesini şemayla doğrular; hata varsa ilk mesajla 400 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: jsonError(400, 'Geçersiz istek gövdesi.') }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Gönderilen bilgiler geçersiz.'
    return { response: jsonError(400, message, 'VALIDATION') }
  }
  return { data: parsed.data }
}

/** Veritabanı hatasını yanıta çevirir; migration 15 uygulanmamışsa açıklayıcı 503 */
export function dbErrorResponse(label: string, error: { code?: string; message?: string } | null) {
  if (isMissingSchemaError(error)) {
    return jsonError(503, 'Bu özellik için veritabanı güncellemesi henüz uygulanmadı.', 'MIGRATION_REQUIRED')
  }
  console.error(`${label}:`, error?.message || error)
  return jsonError(500, 'İşlem sırasında bir hata oluştu.')
}

export interface OrgMenuItemRef {
  id: string
  name: string
  price: string
  category_id: string
}

/** İşletmenin tüm menülerindeki ürün ve kategoriler: istemciden gelen kimliklerin sahipliğini doğrulamak için */
export async function getOrgMenuScope(orgId: string): Promise<{ items: Map<string, OrgMenuItemRef>; categoryIds: Set<string> }> {
  const { data, error } = await supabaseAdmin
    .from('menus')
    .select('id, categories ( id, items ( id, name, price, category_id ) )')
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  const items = new Map<string, OrgMenuItemRef>()
  const categoryIds = new Set<string>()
  for (const menu of (data || []) as any[]) {
    for (const cat of menu.categories || []) {
      categoryIds.add(cat.id)
      for (const item of cat.items || []) items.set(item.id, item)
    }
  }
  return { items, categoryIds }
}

export const nowIso = () => new Date().toISOString()

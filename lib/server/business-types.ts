import { supabaseAdmin } from '@/lib/supabase-admin'
import { BUSINESS_TYPES } from '@/lib/business-types'

/**
 * İşletme türü kaydı var mı? Restoran sahibi yalnızca aktif türleri, admin pasifleri de seçebilir.
 * business_types tablosu yoksa (migration 11 öncesi) koddaki listeye bakılır.
 */
export async function businessTypeExists(slug: string, { includeInactive = false } = {}): Promise<boolean> {
  let q = supabaseAdmin.from('business_types').select('slug').eq('slug', slug)
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error) return BUSINESS_TYPES.some((t) => t.id === slug)
  return !!data
}

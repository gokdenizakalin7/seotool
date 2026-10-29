import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Menü parmak izi: eski sekme koruması.
 *
 * Editör menüyü yüklerken sunucu, menünün veritabanındaki içeriğinin özetini (parmak izi) verir; Kaydet bu
 * özeti geri gönderir. Kaydetmeden önce sunucu güncel içeriğin özetini yeniden hesaplar: farklıysa menü bu
 * sekme açıldıktan sonra başka bir yerden (başka sekme, cihaz, panel işlemi ya da betik) değişmiştir ve
 * Kaydet, o değişikliklerin üzerine yazmasın diye reddedilir.
 *
 * Özet, zaman damgalarına değil içeriğe dayanır: kategori ve ürün satırlarının tüm sütunları (görsel, açıklama,
 * fiyat, gizli/stok durumu…) ile menünün kendi alanları dahildir. Satır sırası sonucu etkilemez.
 */

/** /api/menus/load ile aynı seçim: parmak izi her iki tarafta aynı veriden hesaplanır */
export const MENU_LOAD_SELECT =
  'id, name, description, image_url, is_listed, layout, created_at, updated_at, categories(*, items(*))'

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = stable((value as Record<string, unknown>)[key])
    return out
  }
  return value
}

const byId = (a: { id?: unknown }, b: { id?: unknown }) => String(a.id).localeCompare(String(b.id))

export function menuFingerprint(menuRow: Record<string, unknown>): string {
  const { categories, ...menuFields } = menuRow
  const cats = [...((categories as Record<string, unknown>[]) || [])].sort(byId).map((cat) => {
    const { items, ...catFields } = cat
    return { cat: stable(catFields), items: [...((items as Record<string, unknown>[]) || [])].sort(byId).map(stable) }
  })
  return createHash('sha1').update(JSON.stringify({ menu: stable(menuFields), cats })).digest('hex')
}

/** İşletmenin (ya da verilen) menülerinin güncel parmak izleri: { menuId: parmak izi } */
export async function loadMenuFingerprints(organizationId: string, menuIds?: string[]): Promise<Record<string, string>> {
  let q = supabaseAdmin.from('menus').select(MENU_LOAD_SELECT).eq('organization_id', organizationId)
  if (menuIds?.length) q = q.in('id', menuIds)
  const { data, error } = await q
  if (error) throw new Error('menü parmak izi okunamadı: ' + error.message)
  const out: Record<string, string> = {}
  for (const row of data || []) out[(row as { id: string }).id] = menuFingerprint(row as Record<string, unknown>)
  return out
}

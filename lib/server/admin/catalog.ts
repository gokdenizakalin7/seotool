import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAll } from '@/lib/server/fetch-all'
import { invalidateCatalogIndex } from '@/lib/server/catalog-matcher'
import type { AdminCatalogCategory, AdminCatalogItem } from '@/lib/admin-types'

export const CATEGORY_COLUMNS = 'id, parent_id, slug, name, name_en, icon, display_order, is_active, admin_edited_at'
export const ITEM_COLUMNS =
  'id, slug, primary_category_id, name, name_en, description, description_en, price_suggested, image_url, allergens, calories, tags, display_order, is_active, admin_edited_at, updated_at'

export function mapCategory(r: any, itemCount = 0): AdminCatalogCategory {
  return {
    id: r.id,
    parentId: r.parent_id,
    slug: r.slug,
    name: r.name,
    nameEn: r.name_en || '',
    icon: r.icon || '',
    displayOrder: r.display_order ?? 0,
    isActive: !!r.is_active,
    itemCount,
    adminEditedAt: r.admin_edited_at || null,
  }
}

export function mapItem(r: any): AdminCatalogItem {
  return {
    id: r.id,
    slug: r.slug,
    categoryId: r.primary_category_id,
    name: r.name,
    nameEn: r.name_en || '',
    description: r.description || '',
    descriptionEn: r.description_en || '',
    priceSuggested: r.price_suggested || '',
    imageUrl: r.image_url || '',
    allergens: r.allergens || [],
    calories: r.calories ?? null,
    tags: r.tags || [],
    displayOrder: r.display_order ?? 0,
    isActive: !!r.is_active,
    adminEditedAt: r.admin_edited_at || null,
    updatedAt: r.updated_at || null,
  }
}

export async function loadAllCategories() {
  return fetchAll<any>(supabaseAdmin, 'catalog_categories', CATEGORY_COLUMNS, (q) => q.order('display_order'))
}

/** Bir kategorinin kendisi + tüm alt kategorileri */
export function descendantIds(categories: { id: string; parent_id: string | null }[], rootId: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const c of categories) {
    if (!c.parent_id) continue
    const list = children.get(c.parent_id) || []
    list.push(c.id)
    children.set(c.parent_id, list)
  }
  const out = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of children.get(id) || []) {
      if (!out.has(child)) {
        out.add(child)
        stack.push(child)
      }
    }
  }
  return out
}

/** Ürün sayısı ve kaç restoranda kullanıldığı */
export async function attachUsage(items: AdminCatalogItem[]): Promise<AdminCatalogItem[]> {
  if (!items.length) return items
  const { data, error } = await supabaseAdmin.rpc('admin_catalog_usage', { p_item_ids: items.map((i) => i.id) })
  if (error) {
    console.error('admin_catalog_usage:', error.message)
    return items
  }
  const byId = new Map<string, any>(((data || []) as any[]).map((r) => [r.catalog_item_id, r]))
  return items.map((i) => ({
    ...i,
    usageCount: Number(byId.get(i.id)?.usage_count ?? 0),
    orgCount: Number(byId.get(i.id)?.org_count ?? 0),
  }))
}

/** Katalog değişince eşleştirme indeksini tazele */
export function catalogChanged() {
  invalidateCatalogIndex()
}

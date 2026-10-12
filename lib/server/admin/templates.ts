import type { AdminTemplate } from '@/lib/admin-types'

export const TEMPLATE_COLUMNS =
  'id, slug, business_type, name, tagline, venue_type, icon, color, cover_image, description, display_order, is_active'

export function mapTemplate(r: any, counts: { categories?: number; items?: number } = {}): AdminTemplate {
  return {
    id: r.id,
    slug: r.slug,
    businessType: r.business_type || null,
    name: r.name,
    tagline: r.tagline || '',
    venueType: r.venue_type || '',
    icon: r.icon || '',
    color: r.color || '#e11d48',
    coverImage: r.cover_image || '',
    description: r.description || '',
    displayOrder: r.display_order ?? 0,
    isActive: !!r.is_active,
    categoryCount: counts.categories ?? 0,
    itemCount: counts.items ?? 0,
  }
}

export function templateToDb(input: Record<string, any>): Record<string, any> {
  const m: Record<string, any> = {}
  const set = (col: string, v: any) => {
    if (v !== undefined) m[col] = v
  }
  set('business_type', input.businessType === '' ? null : input.businessType)
  set('name', input.name)
  set('tagline', input.tagline)
  set('venue_type', input.venueType)
  set('icon', input.icon)
  set('color', input.color)
  set('cover_image', input.coverImage)
  set('description', input.description)
  set('display_order', input.displayOrder)
  set('is_active', input.isActive)
  return m
}

import type { AdminBusinessType } from '@/lib/admin-types'

export const BUSINESS_TYPE_COLUMNS =
  'slug, label, icon, hint, color, cover_image, default_template_slug, display_order, is_active'

export function mapBusinessType(r: any, orgCount = 0): AdminBusinessType {
  return {
    slug: r.slug,
    label: r.label,
    icon: r.icon || '',
    hint: r.hint || '',
    color: r.color || '#e11d48',
    coverImage: r.cover_image || '',
    defaultTemplateSlug: r.default_template_slug || null,
    displayOrder: r.display_order ?? 0,
    isActive: !!r.is_active,
    orgCount,
  }
}

export function businessTypeToDb(input: Record<string, any>): Record<string, any> {
  const m: Record<string, any> = {}
  const set = (col: string, v: any) => {
    if (v !== undefined) m[col] = v
  }
  set('label', input.label)
  set('icon', input.icon)
  set('hint', input.hint)
  set('color', input.color)
  set('cover_image', input.coverImage)
  set('default_template_slug', input.defaultTemplateSlug === '' ? null : input.defaultTemplateSlug)
  set('display_order', input.displayOrder)
  set('is_active', input.isActive)
  return m
}

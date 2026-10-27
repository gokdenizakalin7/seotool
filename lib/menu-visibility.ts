import type { Menu } from '@/lib/types'

/**
 * Müşteriye gösterilecek menü: "Menüde gizle" işaretli ürünler (is_hidden) çıkarılır.
 * Stokta olmayan ürünler (is_available = false) kalır; menüde "Tükendi" olarak görünür.
 */
export function withoutHiddenItems<T extends Menu>(menu: T): T {
  if (!menu.categories?.some((c) => c.items?.some((i) => i.is_hidden))) return menu
  return {
    ...menu,
    categories: menu.categories.map((c) => ({ ...c, items: (c.items || []).filter((i) => !i.is_hidden) })),
  }
}

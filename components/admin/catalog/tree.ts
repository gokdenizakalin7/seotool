import type { AdminCatalogCategory } from '@/lib/admin-types'

export interface CategoryNode extends AdminCatalogCategory {
  children: CategoryNode[]
  depth: number
  /** Kendisi + alt kategorilerdeki ürün sayısı */
  totalItems: number
  path: string
}

const byOrder = (a: AdminCatalogCategory, b: AdminCatalogCategory) =>
  a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'tr')

export function buildTree(categories: AdminCatalogCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>()
  for (const c of categories) nodes.set(c.id, { ...c, children: [], depth: 0, totalItems: c.itemCount, path: c.name })
  const roots: CategoryNode[] = []
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  const walk = (list: CategoryNode[], depth: number, prefix: string): number => {
    list.sort(byOrder)
    let sum = 0
    for (const n of list) {
      n.depth = depth
      n.path = prefix ? `${prefix} › ${n.name}` : n.name
      n.totalItems = n.itemCount + walk(n.children, depth + 1, n.path)
      sum += n.totalItems
    }
    return sum
  }
  walk(roots, 0, '')
  return roots
}

/** Ağacı derinlik sırasıyla düz listeye çevirir (select seçenekleri ve şablon sıralaması için) */
export function flattenTree(roots: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = []
  const walk = (list: CategoryNode[]) => {
    for (const n of list) {
      out.push(n)
      walk(n.children)
    }
  }
  walk(roots)
  return out
}

/** Kategori ve tüm atalarının id'leri */
export function ancestorIds(categories: AdminCatalogCategory[], id: string): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const out: string[] = []
  for (let cur = byId.get(id); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
    if (out.includes(cur.id)) break
    out.push(cur.id)
  }
  return out
}

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * PostgREST varsayılan olarak 1000 satırda keser; tabloyu sayfalayarak okur.
 * `filter` ile ek koşul eklenebilir: fetchAll(db, 'catalog_items', 'id, slug', q => q.eq('is_active', true))
 */
export async function fetchAll<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  filter?: (q: any) => any,
  /** Sayfalar arasında satır atlanmaması/tekrarlanmaması için benzersiz sıralama (ör. ['id']) */
  stableOrder: string[] = []
): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    let q: any = db.from(table).select(columns)
    if (filter) q = filter(q)
    for (const col of stableOrder) q = q.order(col)
    const { data, error } = await q.range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < size) break
  }
  return out
}

/**
 * Küme döndüren RPC'ler de PostgREST max-rows (varsayılan 1000) ile kesilir; sayfalayarak okur.
 * RPC'nin kendi ORDER BY'ı benzersiz olmalıdır.
 */
export async function fetchAllRpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await (db.rpc(fn, args) as any).range(from, from + size - 1)
    if (error) throw new Error(`${fn}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < size) break
  }
  return out
}

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * PostgREST varsayılan olarak 1000 satırda keser; tabloyu sayfalayarak okur.
 * `filter` ile ek koşul eklenebilir: fetchAll(db, 'catalog_items', 'id, slug', q => q.eq('is_active', true))
 */
export async function fetchAll<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  filter?: (q: any) => any
): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    let q: any = db.from(table).select(columns)
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < size) break
  }
  return out
}

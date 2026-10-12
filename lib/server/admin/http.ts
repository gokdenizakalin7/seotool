import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { requireSuperAdmin, type AuthUser } from '@/lib/auth-middleware'

/** Admin uçları için ortak yardımcılar. */

export function jsonError(status: number, error: string, code?: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...(code ? { code } : {}), ...extra }, { status })
}

/**
 * Süper admin doğrulaması + hata yakalama. Beklenmeyen hatalar 500 olarak döner, ayrıntısı loglanır.
 */
export async function adminRoute(
  req: Request,
  label: string,
  fn: (user: AuthUser) => Promise<Response>
): Promise<Response> {
  const auth = await requireSuperAdmin(req)
  if ('response' in auth) return auth.response
  try {
    return await fn(auth.user)
  } catch (err: any) {
    console.error(`admin ${label} error:`, err)
    return jsonError(500, 'İşlem sırasında beklenmeyen bir hata oluştu.', 'INTERNAL')
  }
}

export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { response: Response }> {
  const raw = await req.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path?.length ? `${first.path.join('.')}: ` : ''
    return { response: jsonError(400, `Geçersiz veri. ${where}${first?.message || ''}`.trim(), 'VALIDATION') }
  }
  return { data: parsed.data }
}

/** Supabase Postgres hata kodları: benzersizlik ihlali */
export function isUniqueViolation(error: { code?: string } | null | undefined) {
  return error?.code === '23505'
}

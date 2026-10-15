import type { EventInput } from '@/lib/site-schemas'
import { isOrgMediaUrl } from '@/lib/server/storage'

/** Etkinlik satırı sütunları (API route'ları ortak) */
export function eventColumns(input: EventInput) {
  return {
    title: input.title,
    description: input.description,
    starts_at: input.startsAt,
    ends_at: input.endsAt || null,
    repeat_weekly: input.repeatWeekly,
    repeat_until: input.repeatWeekly ? input.repeatUntil || null : null,
    poster_url: input.posterUrl || null,
    is_published: input.isPublished,
    updated_at: new Date().toISOString(),
  }
}

/** Afiş yalnızca bu işletmenin etkinlik klasöründen olabilir (başka adresler kabul edilmez) */
export function posterAllowed(orgId: string, url: string | null | undefined) {
  return !url || isOrgMediaUrl(url, orgId, 'events/')
}

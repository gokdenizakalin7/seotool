import { supabaseAdmin } from '@/lib/supabase-admin'
import { isMissingSchemaError } from '@/lib/restaurant-profile'
import type { Campaign } from '@/lib/campaigns'
import type { SiteEvent } from '@/lib/events'
import type { PricePlan, PriceModeState, ScheduleWindow } from '@/lib/price-plan'
import type { Rounding } from '@/lib/price'

/**
 * İşletme sitesi modüllerinin (fiyat planı, kampanya, etkinlik) DB okuma ve satır → nesne dönüşümleri.
 * Hem müşteri sayfası hem panel API'leri kullanır. Migration 15 uygulanmamışsa boş liste döner.
 */

/* ---------------- Satır dönüşümleri ---------------- */

const toNumber = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function toSchedule(raw: unknown): ScheduleWindow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((w) => w && Array.isArray(w.days) && typeof w.start === 'string' && typeof w.end === 'string')
    .map((w) => ({ days: w.days.map(Number).filter((d: number) => d >= 1 && d <= 7), start: w.start, end: w.end }))
}

export const PRICE_PLAN_SELECT =
  'id, name, banner_text, adjustment_type, adjustment_value, rounding, excluded_category_ids, schedule, schedule_enabled, display_order, price_plan_item_overrides ( item_id, price )'

export function mapPricePlanRow(row: any): PricePlan {
  const overrides: Record<string, number | null> = {}
  for (const o of row.price_plan_item_overrides || []) {
    overrides[o.item_id] = o.price == null ? null : toNumber(o.price)
  }
  return {
    id: row.id,
    name: row.name,
    bannerText: row.banner_text || null,
    adjustmentType: row.adjustment_type === 'fixed' ? 'fixed' : 'percent',
    adjustmentValue: toNumber(row.adjustment_value),
    rounding: (['none', '1', '5', '10'].includes(row.rounding) ? row.rounding : 'none') as Rounding,
    excludedCategoryIds: row.excluded_category_ids || [],
    schedule: toSchedule(row.schedule),
    scheduleEnabled: !!row.schedule_enabled,
    displayOrder: toNumber(row.display_order),
    overrides,
  }
}

export function priceModeFromOrg(row: any): PriceModeState {
  return {
    mode: row?.price_mode === 'manual' ? 'manual' : 'auto',
    activePlanId: row?.active_price_plan_id || null,
    manualUntil: row?.price_manual_until || null,
  }
}

export const CAMPAIGN_SELECT =
  'id, kind, name, description, price, image_url, is_active, display_order, valid_from, valid_until, schedule, campaign_items ( item_id, item_name, quantity, price, display_order, items ( id, name, price, image_url, is_available, category_id ) )'

export function mapCampaignRow(row: any): Campaign {
  const items = [...(row.campaign_items || [])]
    .sort((a, b) => toNumber(a.display_order) - toNumber(b.display_order))
    .map((ci: any) => ({
      itemId: ci.item_id || null,
      name: ci.item_name,
      quantity: toNumber(ci.quantity, 1),
      price: ci.price == null ? null : toNumber(ci.price),
      item: ci.items
        ? {
            id: ci.items.id,
            name: ci.items.name,
            price: ci.items.price,
            image_url: ci.items.image_url,
            is_available: ci.items.is_available,
            category_id: ci.items.category_id,
          }
        : null,
    }))
  return {
    id: row.id,
    kind: row.kind === 'per_item' ? 'per_item' : 'bundle',
    name: row.name,
    description: row.description || '',
    price: toNumber(row.price),
    imageUrl: row.image_url || null,
    isActive: !!row.is_active,
    displayOrder: toNumber(row.display_order),
    validFrom: row.valid_from || null,
    validUntil: row.valid_until || null,
    schedule: toSchedule(row.schedule),
    items,
  }
}

export const EVENT_SELECT =
  'id, title, description, starts_at, ends_at, repeat_weekly, repeat_until, poster_url, is_published'

export function mapEventRow(row: any): SiteEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at || null,
    repeatWeekly: !!row.repeat_weekly,
    repeatUntil: row.repeat_until || null,
    posterUrl: row.poster_url || null,
    isPublished: !!row.is_published,
  }
}

/* ---------------- Okuma ---------------- */

function handleError(label: string, error: any): void {
  if (isMissingSchemaError(error)) return // migration 15 henüz uygulanmadı: modül yokmuş gibi davran
  console.error(`${label}:`, error?.message || error)
}

export async function loadPricePlans(orgId: string): Promise<PricePlan[]> {
  const { data, error } = await supabaseAdmin
    .from('price_plans')
    .select(PRICE_PLAN_SELECT)
    .eq('organization_id', orgId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    handleError('loadPricePlans', error)
    return []
  }
  return (data || []).map(mapPricePlanRow)
}

export async function loadCampaigns(orgId: string, opts: { onlyActive?: boolean } = {}): Promise<Campaign[]> {
  let q = supabaseAdmin
    .from('campaigns')
    .select(CAMPAIGN_SELECT)
    .eq('organization_id', orgId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (opts.onlyActive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) {
    handleError('loadCampaigns', error)
    return []
  }
  return (data || []).map(mapCampaignRow)
}

/** publishedUpcoming: yalnızca yayındaki, bitmemiş olabilecek etkinlikler (tekrarlananlar + son 2 gün) */
export async function loadEvents(orgId: string, opts: { publishedUpcoming?: boolean } = {}): Promise<SiteEvent[]> {
  let q = supabaseAdmin.from('events').select(EVENT_SELECT).eq('organization_id', orgId).order('starts_at', { ascending: true })
  if (opts.publishedUpcoming) {
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    q = q.eq('is_published', true).or(`repeat_weekly.eq.true,starts_at.gte.${since}`)
  }
  const { data, error } = await q
  if (error) {
    handleError('loadEvents', error)
    return []
  }
  return (data || []).map(mapEventRow)
}

/** Ad değiştiren işletmenin yeni adı (eski site/QR adresleri için); yoksa null */
export async function findMovedSlug(oldSlug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('organization_slug_history')
    .select('organizations ( subdomain )')
    .eq('old_slug', oldSlug)
    .maybeSingle()
  if (error) {
    handleError('findMovedSlug', error)
    return null
  }
  const next = (data as any)?.organizations?.subdomain
  return next && next !== oldSlug ? next : null
}

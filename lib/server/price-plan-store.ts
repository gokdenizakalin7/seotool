import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PricePlanInput } from '@/lib/site-schemas'
import { getOrgMenuScope } from '@/lib/server/site-api'
import { mapPricePlanRow, PRICE_PLAN_SELECT } from '@/lib/server/site-data'
import type { PricePlan } from '@/lib/price-plan'

/** Plan satırı sütunları (istisnalar ayrı tabloda) */
function planColumns(input: PricePlanInput, excludedCategoryIds: string[]) {
  return {
    name: input.name,
    banner_text: input.bannerText || null,
    adjustment_type: input.adjustmentType,
    adjustment_value: input.adjustmentValue,
    rounding: input.rounding,
    excluded_category_ids: excludedCategoryIds,
    schedule: input.schedule,
    schedule_enabled: input.scheduleEnabled,
    updated_at: new Date().toISOString(),
  }
}

/**
 * İstemciden gelen kategori/ürün kimliklerini işletmenin menüsüyle sınar: başka işletmenin ürünü varsa hata,
 * menüden silinmiş kategori sessizce düşer.
 */
async function scopeInput(orgId: string, input: PricePlanInput) {
  const scope = await getOrgMenuScope(orgId)
  const foreign = input.overrides.find((o) => !scope.items.has(o.itemId))
  if (foreign) return { error: 'Seçilen ürünlerden biri menünüzde bulunamadı. Sayfayı yenileyip tekrar deneyin.' as const }
  const excluded = input.excludedCategoryIds.filter((id) => scope.categoryIds.has(id))
  return { excluded }
}

async function replaceOverrides(planId: string, input: PricePlanInput) {
  const { error: delErr } = await supabaseAdmin.from('price_plan_item_overrides').delete().eq('plan_id', planId)
  if (delErr) return delErr
  if (!input.overrides.length) return null
  const { error } = await supabaseAdmin
    .from('price_plan_item_overrides')
    .insert(input.overrides.map((o) => ({ plan_id: planId, item_id: o.itemId, price: o.price })))
  return error
}

async function readPlan(planId: string): Promise<PricePlan | null> {
  const { data } = await supabaseAdmin.from('price_plans').select(PRICE_PLAN_SELECT).eq('id', planId).maybeSingle()
  return data ? mapPricePlanRow(data) : null
}

export async function createPricePlan(orgId: string, input: PricePlanInput) {
  const scoped = await scopeInput(orgId, input)
  if ('error' in scoped) return { status: 400 as const, error: scoped.error }

  const { data: last } = await supabaseAdmin
    .from('price_plans')
    .select('display_order')
    .eq('organization_id', orgId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('price_plans')
    .insert({
      organization_id: orgId,
      display_order: input.displayOrder ?? ((last?.display_order ?? -1) + 1),
      ...planColumns(input, scoped.excluded),
    })
    .select('id')
    .single()
  if (error || !data) return { status: 500 as const, dbError: error }

  const overrideErr = await replaceOverrides(data.id, input)
  if (overrideErr) {
    await supabaseAdmin.from('price_plans').delete().eq('id', data.id)
    return { status: 500 as const, dbError: overrideErr }
  }
  return { status: 201 as const, plan: await readPlan(data.id) }
}

export async function updatePricePlan(orgId: string, planId: string, input: PricePlanInput) {
  const scoped = await scopeInput(orgId, input)
  if ('error' in scoped) return { status: 400 as const, error: scoped.error }

  const { data, error } = await supabaseAdmin
    .from('price_plans')
    .update({ ...planColumns(input, scoped.excluded), ...(input.displayOrder != null ? { display_order: input.displayOrder } : {}) })
    .eq('id', planId)
    .eq('organization_id', orgId)
    .select('id')
    .maybeSingle()
  if (error) return { status: 500 as const, dbError: error }
  if (!data) return { status: 404 as const, error: 'Fiyat planı bulunamadı.' }

  const overrideErr = await replaceOverrides(planId, input)
  if (overrideErr) return { status: 500 as const, dbError: overrideErr }
  return { status: 200 as const, plan: await readPlan(planId) }
}

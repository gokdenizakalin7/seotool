import { supabaseAdmin } from '@/lib/supabase-admin'
import type { CampaignInput } from '@/lib/site-schemas'
import { getOrgMenuScope } from '@/lib/server/site-api'
import { CAMPAIGN_SELECT, mapCampaignRow } from '@/lib/server/site-data'
import type { Campaign } from '@/lib/campaigns'

function campaignColumns(input: CampaignInput) {
  return {
    name: input.name,
    description: input.description,
    price: input.price,
    image_url: input.imageUrl || null,
    is_active: input.isActive,
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Kampanya ürünleri yalnızca işletmenin kendi menüsünden olabilir. Ürün adı istemciden değil
 * veritabanından kopyalanır (ürün sonradan silinse de panelde ne olduğu görünsün).
 */
async function buildComponents(orgId: string, input: CampaignInput) {
  const scope = await getOrgMenuScope(orgId)
  const rows = []
  for (const [index, component] of input.items.entries()) {
    const item = scope.items.get(component.itemId)
    if (!item) return { error: 'Seçilen ürünlerden biri menünüzde bulunamadı. Sayfayı yenileyip tekrar deneyin.' as const }
    rows.push({ item_id: item.id, item_name: item.name, quantity: component.quantity, display_order: index })
  }
  return { rows }
}

async function readCampaign(id: string): Promise<Campaign | null> {
  const { data } = await supabaseAdmin.from('campaigns').select(CAMPAIGN_SELECT).eq('id', id).maybeSingle()
  return data ? mapCampaignRow(data) : null
}

async function replaceComponents(campaignId: string, rows: { item_id: string; item_name: string; quantity: number; display_order: number }[]) {
  const { error: delErr } = await supabaseAdmin.from('campaign_items').delete().eq('campaign_id', campaignId)
  if (delErr) return delErr
  const { error } = await supabaseAdmin.from('campaign_items').insert(rows.map((r) => ({ ...r, campaign_id: campaignId })))
  return error
}

export async function createCampaign(orgId: string, input: CampaignInput) {
  const built = await buildComponents(orgId, input)
  if ('error' in built) return { status: 400 as const, error: built.error }

  const { data: last } = await supabaseAdmin
    .from('campaigns')
    .select('display_order')
    .eq('organization_id', orgId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      organization_id: orgId,
      display_order: input.displayOrder ?? ((last?.display_order ?? -1) + 1),
      ...campaignColumns(input),
    })
    .select('id')
    .single()
  if (error || !data) return { status: 500 as const, dbError: error }

  const compErr = await replaceComponents(data.id, built.rows)
  if (compErr) {
    await supabaseAdmin.from('campaigns').delete().eq('id', data.id)
    return { status: 500 as const, dbError: compErr }
  }
  return { status: 201 as const, campaign: await readCampaign(data.id) }
}

export async function updateCampaign(orgId: string, id: string, input: CampaignInput) {
  const built = await buildComponents(orgId, input)
  if ('error' in built) return { status: 400 as const, error: built.error }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update({ ...campaignColumns(input), ...(input.displayOrder != null ? { display_order: input.displayOrder } : {}) })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('id')
    .maybeSingle()
  if (error) return { status: 500 as const, dbError: error }
  if (!data) return { status: 404 as const, error: 'Kampanya bulunamadı.' }

  // Ürün listesi değiştirilemezse kampanya ürünsüz kalır ve müşteriden gizlenir (panelde uyarı görünür)
  const compErr = await replaceComponents(id, built.rows)
  if (compErr) return { status: 500 as const, dbError: compErr }
  return { status: 200 as const, campaign: await readCampaign(id) }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireSubdomainAccess } from '@/lib/auth-middleware'

export async function POST(request: Request) {
  try {
    const { subdomain, tables } = await request.json()

    if (!subdomain || typeof subdomain !== 'string') {
      return NextResponse.json({ error: 'Subdomain is required' }, { status: 400 })
    }
    if (!Array.isArray(tables)) {
      return NextResponse.json({ error: 'tables bir dizi olmalı' }, { status: 400 })
    }

    // Masa adı QR adresinin parçası: boş ad olmaz, aynı ad iki kez kullanılmaz (büyük/küçük harf duyarsız)
    const cleanName = (n: unknown) => String(n ?? '').trim().slice(0, 60)
    const nameKey = (n: string) => n.toLocaleLowerCase('tr')
    if (tables.some((t: any) => !cleanName(t?.name))) {
      return NextResponse.json({ error: 'Masa adı boş olamaz.' }, { status: 400 })
    }
    const seen = new Set<string>()
    for (const t of tables) {
      const key = nameKey(cleanName(t.name))
      if (seen.has(key)) {
        return NextResponse.json({ error: `"${cleanName(t.name)}" adında birden fazla masa var.` }, { status: 400 })
      }
      seen.add(key)
    }

    const access = await requireSubdomainAccess(request, subdomain)
    if ('response' in access) return access.response
    const orgId = access.organizationId

    // Mevcut masalar
    const { data: existingTables, error: existingErr } = await supabase
      .from('qr_tables')
      .select('id, name')
      .eq('organization_id', orgId)
    if (existingErr) throw existingErr

    const existing = existingTables || []
    const existingById = new Map(existing.map((t) => [t.id, t]))
    const existingIdByName = new Map(existing.map((t) => [nameKey(t.name), t.id]))

    // Geçici tbl- kimlikli masa, aynı adla zaten kayıtlıysa (önceki kaydın yanıtı istemciye ulaşmadan
    // tekrar kaydedildiyse) o kayda eşlenir: silinip yeniden eklenmez, okunma sayısı korunur
    const explicitIds = new Set(tables.map((t: any) => t.id).filter((id: unknown) => existingById.has(id as string)))
    const incoming: { id: string | null; name: string }[] = tables.map((t: any) => {
      const name = cleanName(t.name)
      if (explicitIds.has(t.id)) return { id: t.id as string, name }
      const sameName = existingIdByName.get(nameKey(name))
      return { id: sameName && !explicitIds.has(sameName) ? sameName : null, name }
    })
    const keptIds = new Set(incoming.map((t) => t.id).filter(Boolean))

    // Silinecek masalar (yalnızca bu organizasyonun masaları)
    const idsToDelete = existing.map((t) => t.id).filter((id) => !keptIds.has(id))
    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from('qr_tables')
        .delete()
        .eq('organization_id', orgId)
        .in('id', idsToDelete)
      if (error) throw error
    }

    const newTables = incoming
      .filter((t) => !t.id)
      .map((t) => ({ organization_id: orgId, name: t.name }))
    if (newTables.length > 0) {
      const { error } = await supabase.from('qr_tables').insert(newTables)
      if (error) throw error
    }

    // Güncelleme: yalnızca adı değişenler; okunma sayısını sunucu tutar (istemci değeri sayacı ezmesin)
    const toUpdate = incoming.filter((t) => t.id && existingById.get(t.id)?.name !== t.name)
    for (const table of toUpdate) {
      const { error } = await supabase
        .from('qr_tables')
        .update({ name: table.name })
        .eq('id', table.id)
        .eq('organization_id', orgId)
      if (error) throw error
    }

    // Yeni masaların gerçek kimlikleriyle güncel liste: istemci geçici tbl- kimliklerini tutmasın
    const { data: fresh, error: freshErr } = await supabase
      .from('qr_tables')
      .select('id, name, views')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })
    if (freshErr) throw freshErr

    return NextResponse.json({ success: true, tables: fresh || [] })
  } catch (error: any) {
    console.error('Tables sync error:', error)
    return NextResponse.json({ error: 'Masalar kaydedilemedi.' }, { status: 500 })
  }
}

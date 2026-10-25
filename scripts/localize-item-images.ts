/**
 * Ürün görsellerini Storage'a taşır: veritabanında base64 (data:) duran panel fotoğrafları ve dış adresten
 * hotlink edilen görseller WebP'ye çevrilip orgs/{orgId}/items/ altına yüklenir, ürün adresleri güncellenir.
 * base64 görseller müşteri sayfasının HTML'ine gömülüyor, sayfayı MB'larca büyütüyordu (bkz. lib/server/localize-item-images.ts).
 *
 *   npm run images:localize -- --dry-run          Hiç yazmaz, işletme başına taşınacak görsel sayısını basar
 *   npm run images:localize                       Tüm işletmeler
 *   npm run images:localize -- --org medusa-cafe  Tek işletme (site adresi)
 *
 * Gerçek çalıştırmada önce eski adresler { ürün kimliği: eski image_url } olarak yedeklenir (--backup <dosya>,
 * varsayılan: geçici klasör). Geri almak için yedekteki adresler items.image_url'e yazılabilir.
 */
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { supabaseAdmin } from '../lib/supabase-admin'
import { fetchAll } from '../lib/server/fetch-all'
import { isDataImageUrl, localizeOrgItemImages } from '../lib/server/localize-item-images'
import { isCatalogImage } from '../lib/image-url'
import { pathFromPublicUrl } from '../lib/server/storage'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const argValue = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const onlyOrg = argValue('--org')
const backupPath = argValue('--backup') || join(tmpdir(), `qr-chef-item-images-${Date.now()}.json`)

const isExternal = (url: string) => /^https?:\/\//i.test(url) && !isCatalogImage(url) && !pathFromPublicUrl(url)

type Org = { id: string; subdomain: string | null; name: string | null }

async function pendingImages(orgId: string): Promise<{ id: string; image_url: string }[]> {
  const { data, error } = await supabaseAdmin
    .from('menus')
    .select('categories(items(id, image_url))')
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  const out: { id: string; image_url: string }[] = []
  for (const menu of data || []) {
    for (const cat of (menu as any).categories || []) {
      for (const item of cat.items || []) {
        const url = item.image_url
        if (typeof url === 'string' && (isDataImageUrl(url) || isExternal(url))) out.push({ id: item.id, image_url: url })
      }
    }
  }
  return out
}

async function main() {
  const orgs = (await fetchAll<Org>(supabaseAdmin, 'organizations', 'id, subdomain, name', undefined, ['id'])).filter(
    (o) => !onlyOrg || o.subdomain === onlyOrg
  )
  if (onlyOrg && orgs.length === 0) throw new Error(`"${onlyOrg}" adlı işletme bulunamadı`)

  const backup: Record<string, string> = {}
  const todo: { org: Org; count: number }[] = []
  for (const org of orgs) {
    const items = await pendingImages(org.id)
    if (items.length === 0) continue
    const base64 = items.filter((i) => isDataImageUrl(i.image_url)).length
    console.log(`${org.subdomain || org.id}: ${items.length} görsel (${base64} base64, ${items.length - base64} dış adres)`)
    for (const item of items) backup[item.id] = item.image_url
    todo.push({ org, count: items.length })
  }
  if (todo.length === 0) return console.log('Taşınacak görsel yok.')
  if (dryRun) return console.log(`\n--dry-run: ${todo.length} işletmede ${Object.keys(backup).length} görsel taşınacak.`)

  writeFileSync(backupPath, JSON.stringify(backup))
  console.log(`\nEski adresler yedeklendi: ${backupPath}\n`)

  for (const { org } of todo) {
    const r = await localizeOrgItemImages(org.id)
    console.log(`${org.subdomain || org.id}: ${r.converted}/${r.itemsTotal} taşındı, ${r.failed} hata`)
    for (const e of r.errors) console.log(`  - ${e}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

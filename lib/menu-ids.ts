import type { Menu } from '@/lib/types'

/**
 * Kayıttan dönen { istemciId: gerçekId } haritasını menüye uygular: menü, kategori (parent_id dahil) ve ürün
 * kimlikleri. Haritada olmayan kimlikler (kayıt sürerken eklenenler) olduğu gibi kalır; bir sonraki kayıtta eşlenir.
 */
export function remapMenuIds(menu: Menu, idMap: Record<string, string>): Menu {
  if (!idMap || Object.keys(idMap).length === 0) return menu
  const map = (id: string) => idMap[id] ?? id
  return {
    ...menu,
    id: map(menu.id),
    categories: (menu.categories || []).map((cat) => ({
      ...cat,
      id: map(cat.id),
      parent_id: cat.parent_id ? map(cat.parent_id) : cat.parent_id,
      items: (cat.items || []).map((item) => (idMap[item.id] ? { ...item, id: idMap[item.id] } : item)),
    })),
  }
}

/**
 * Kayıtta Storage'a yüklenen base64 fotoğrafların yeni adresleri ({ ürün kimliği: adres }). Yalnızca hâlâ base64
 * duran görsel değişir: kayıt sürerken başka fotoğraf seçildiyse o korunur (bir sonraki kayıtta yüklenir).
 */
export function applyStoredImages(menu: Menu, imageUrls: Record<string, string>): Menu {
  if (!imageUrls || Object.keys(imageUrls).length === 0) return menu
  return {
    ...menu,
    categories: (menu.categories || []).map((cat) => ({
      ...cat,
      items: (cat.items || []).map((item) =>
        imageUrls[item.id] && item.image_url?.startsWith('data:') ? { ...item, image_url: imageUrls[item.id] } : item
      ),
    })),
  }
}

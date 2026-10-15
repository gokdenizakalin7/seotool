/**
 * Baskı şablonu SVG'lerini (components/dashboard/QRPrintTemplates.tsx) bağımsız dosyaya çevirir:
 * logo JPEG data URL olarak (bir kez), panel fontu @font-face olarak gömülür; dosya başka cihazda / matbaada da aynı görünür.
 * JPEG, aynı SVG'nin 300 DPI'da beyaz zemine çizilmesiyle üretilir.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK = 'http://www.w3.org/1999/xlink'
const JPEG_DPI = 300
// QR ortasındaki logo baskıda ~1 cm: 512 px 1200 DPI'dan fazlasını karşılar, dosya şişmez
const LOGO_MAX_PX = 512

const imageCache = new Map<string, Promise<string>>()
let fontCssPromise: Promise<string> | null = null

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Logo JPEG'e çevrilir: WebP'yi açamayan tasarım programları (eski Illustrator vb.) için. Logo QR'ın beyaz
 * oyulmuş alanına oturduğu için beyaz zemine düzleştirmek görünümü değiştirmez, dosya PNG'ye göre çok küçülür.
 */
function logoAsJpeg(url: string): Promise<string> {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Logo yüklenemedi (${r.status})`)
          return r.blob()
        })
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          const scale = Math.min(1, LOGO_MAX_PX / Math.max(bitmap.width, bitmap.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(bitmap.width * scale)
          canvas.height = Math.round(bitmap.height * scale)
          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          return canvas.toDataURL('image/jpeg', 0.92)
        })
    )
  }
  return imageCache.get(url)!
}

/** Sayfadaki geistSans @font-face'i (next/font) bulunup data URL olarak gömülür; bulunamazsa yedek font kullanılır */
function panelFontCss(): Promise<string> {
  fontCssPromise ??= (async () => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue
        if (rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim() !== 'geistSans') continue
        const src = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/)?.[1]
        if (!src) continue
        const res = await fetch(new URL(src, sheet.href || location.href))
        if (!res.ok) continue
        const data = await blobToDataUrl(await res.blob())
        return `@font-face{font-family:geistSans;src:url(${data}) format("woff");font-weight:100 900}`
      }
    }
    return ''
  })().catch(() => '')
  return fontCssPromise
}

/** Önizlemedeki şablon SVG'sinden bağımsız SVG metni */
export async function serializeQrSvg(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  for (const attr of ['class', 'style', 'data-qr-page', 'data-a4']) clone.removeAttribute(attr)

  // Her QR'daki logo bir kez gömülür (symbol), QR'lar ona <use> ile başvurur: A4'te 20 kopya dosyayı şişirmesin
  const defs = document.createElementNS(SVG_NS, 'defs')
  const symbols = new Map<string, Promise<string | null>>()
  const embed = (href: string) => {
    if (!symbols.has(href)) {
      const id = `qr-logo-${symbols.size + 1}`
      symbols.set(
        href,
        logoAsJpeg(new URL(href, location.href).href)
          .then((data) => {
            const symbol = document.createElementNS(SVG_NS, 'symbol')
            symbol.setAttribute('id', id)
            symbol.setAttribute('viewBox', '0 0 1 1')
            symbol.setAttribute('preserveAspectRatio', 'none')
            const image = document.createElementNS(SVG_NS, 'image')
            image.setAttribute('width', '1')
            image.setAttribute('height', '1')
            image.setAttribute('preserveAspectRatio', 'none')
            image.setAttribute('href', data)
            image.setAttributeNS(XLINK, 'xlink:href', data)
            symbol.appendChild(image)
            defs.appendChild(symbol)
            return id
          })
          .catch(() => null)
      )
    }
    return symbols.get(href)!
  }
  await Promise.all(
    Array.from(clone.querySelectorAll('image')).map(async (img) => {
      const href = img.getAttribute('href') || img.getAttributeNS(XLINK, 'href')
      const id = href ? await embed(href) : null
      if (!id) {
        img.remove() // Logo alınamazsa QR yine okunur (H düzeyi hata düzeltme)
        return
      }
      const use = document.createElementNS(SVG_NS, 'use')
      for (const attr of ['x', 'y', 'width', 'height', 'opacity']) {
        const value = img.getAttribute(attr)
        if (value != null) use.setAttribute(attr, value)
      }
      use.setAttribute('href', `#${id}`)
      use.setAttributeNS(XLINK, 'xlink:href', `#${id}`)
      img.replaceWith(use)
    })
  )

  const fontCss = await panelFontCss()
  if (fontCss) {
    const style = document.createElementNS(SVG_NS, 'style')
    style.textContent = fontCss
    defs.insertBefore(style, defs.firstChild)
  }
  if (defs.childNodes.length) clone.insertBefore(defs, clone.firstChild)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
}

function toMm(value: string | null): number {
  const n = parseFloat(value || '0')
  return value?.endsWith('mm') ? n : (n * 25.4) / 96
}

/** SVG metnini 300 DPI JPEG'e çevirir (beyaz zemin) */
export async function qrSvgToJpeg(svgText: string, svg: SVGSVGElement): Promise<Blob> {
  const width = Math.round((toMm(svg.getAttribute('width')) / 25.4) * JPEG_DPI)
  const height = Math.round((toMm(svg.getAttribute('height')) / 25.4) * JPEG_DPI)
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG oluşturulamadı'))), 'image/jpeg', 0.92)
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Dosya adı için: Türkçe karakterler sadeleşir, boşluklar tire olur */
export function fileSlug(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

'use client'

import { useEffect, useId, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

/**
 * Baskıya hazır QR şablonları doğrudan SVG olarak çizilir: önizleme, yazdırma, SVG ve JPEG indirme
 * aynı çizimden çıkar (bkz. lib/qr-export.ts). Ölçüler, eski HTML şablonlarının Tailwind ölçüleriyle aynıdır;
 * SVG'nin width/height'ı mm cinsindendir, böylece yazıcıda ve matbaada gerçek boyutta çıkar.
 */

export type QrLogo = (size: number) => { src: string; height: number; width: number; excavate: boolean } | undefined

// Panelin fontu (app/layout.tsx, next/font "geistSans"); dışa aktarımda SVG'ye gömülür
export const QR_FONT_FAMILY = 'geistSans, Arial, Helvetica, sans-serif'

const GRAY_900 = '#111827'
const GRAY_700 = '#374151'
const GRAY_500 = '#6b7280'
const GRAY_200 = '#e5e7eb'
const BORDER = '#e5e5e5'
const PX_TO_MM = 25.4 / 96

/* ---------- Metin ölçümü (CSS satır kutusuyla aynı yerleşim için) ---------- */

let measureCtx: CanvasRenderingContext2D | null = null
const REF = 100 // 100 birimde ölçülüp ölçeklenir: px ve mm şablonlarında aynı yardımcı

function ctxFor(weight: number) {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx!.font = `${weight} ${REF}px ${QR_FONT_FAMILY}`
  return measureCtx!
}

function textWidth(text: string, weight: number, size: number, letterSpacing = 0) {
  return (ctxFor(weight).measureText(text).width * size) / REF + letterSpacing * [...text].length
}

/** CSS'teki gibi satır kutusunun ortasına yerleşen yazının taban çizgisi */
function baseline(lineTop: number, lineHeight: number, weight: number, size: number) {
  const m = ctxFor(weight).measureText('Hg')
  const ascent = (m.fontBoundingBoxAscent ?? REF * 0.9) / REF
  const descent = (m.fontBoundingBoxDescent ?? REF * 0.22) / REF
  return lineTop + (lineHeight - (ascent + descent) * size) / 2 + ascent * size
}

function wrapLines(text: string, weight: number, size: number, maxWidth: number, letterSpacing = 0) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (!line || textWidth(next, weight, size, letterSpacing) <= maxWidth) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** text-overflow: ellipsis karşılığı */
function ellipsize(text: string, weight: number, size: number, maxWidth: number) {
  if (textWidth(text, weight, size) <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (textWidth(text.slice(0, mid).trimEnd() + '…', weight, size) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo).trimEnd() + '…'
}

/** Font yüklenince yerleşim yeniden ölçülsün (ilk ölçüm yedek fontla yapılmış olabilir) */
function useFontsReady() {
  const [, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts?.load(`800 16px ${QR_FONT_FAMILY}`).finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
}

/** shadow-md karşılığı (yalnızca akrilik standın QR çerçevesinde) */
function ShadowMd({ id }: { id: string }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
      <feOffset dy="4" result="s1" />
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
      <feOffset dy="2" result="s2" />
      <feMerge result="s">
        <feMergeNode in="s1" />
        <feMergeNode in="s2" />
      </feMerge>
      <feComponentTransfer in="s" result="shadow">
        <feFuncA type="linear" slope="0.1" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="shadow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )
}

type Common = { restaurantName: string; link: string; color: string; qrLevel: 'H' | 'M'; logoImage: QrLogo; className?: string }

/* ---------- 1. Dikey akrilik masa standı ---------- */

export function AcrylicTemplate({ restaurantName, link, color, qrLevel, logoImage, className }: Common) {
  useFontsReady()
  const shadowId = useId().replace(/:/g, '')
  const W = 320
  const inset = 24 // border-4 + p-5
  const contentW = W - inset * 2
  const cx = W / 2

  const nameLines = restaurantName ? wrapLines(restaurantName.toLocaleUpperCase('tr'), 900, 16, contentW, -0.4) : []
  const hint = 'Telefonunuzun kamerasını QR koda tutmanız yeterlidir.'
  const hintLines = wrapLines(hint, 400, 10, contentW)

  let y = inset
  const nameTop = y
  y += nameLines.length * 24 + 16
  const frameTop = y
  y += 176 + 16
  const ctaTop = y
  y += 16 + 2
  const hintTop = y
  y += hintLines.length * 15 + 16
  const poweredTop = y
  y += 13.5
  const H = y + inset

  return (
    <svg
      data-qr-page=""
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={`${(W * PX_TO_MM).toFixed(2)}mm`}
      height={`${(H * PX_TO_MM).toFixed(2)}mm`}
      fontFamily={QR_FONT_FAMILY}
      className={className}
    >
      <defs>
        <ShadowMd id={shadowId} />
      </defs>
      <rect x={2} y={2} width={W - 4} height={H - 4} rx={14} fill="#fff" stroke={color} strokeWidth={4} />
      {nameLines.map((line, i) => (
        <text
          key={i}
          x={cx}
          y={baseline(nameTop + i * 24, 24, 900, 16)}
          textAnchor="middle"
          fontSize={16}
          fontWeight={900}
          letterSpacing={-0.4}
          fill={GRAY_900}
        >
          {line}
        </text>
      ))}
      <rect x={73} y={frameTop + 1} width={174} height={174} rx={15} fill="#fff" stroke={GRAY_200} strokeWidth={2} filter={`url(#${shadowId})`} />
      <QRCodeSVG
        value={link}
        size={152}
        level={qrLevel}
        imageSettings={logoImage(152)}
        includeMargin={false}
        x={cx - 76}
        y={frameTop + 12}
      />
      <text x={cx} y={baseline(ctaTop, 16, 800, 12)} textAnchor="middle" fontSize={12} fontWeight={800} fill={GRAY_900}>
        Menüyü İncelemek İçin Okutun
      </text>
      {hintLines.map((line, i) => (
        <text key={i} x={cx} y={baseline(hintTop + i * 15, 15, 400, 10)} textAnchor="middle" fontSize={10} fill={GRAY_500}>
          {line}
        </text>
      ))}
      <text x={cx} y={baseline(poweredTop, 13.5, 400, 9)} textAnchor="middle" fontSize={9} fill={GRAY_500}>
        Powered by QR Chef
      </text>
    </svg>
  )
}

/* ---------- 2. Masa çıkartması (sticker) ---------- */

export function StickerTemplate({ restaurantName, link, color, qrLevel, logoImage, className }: Common) {
  useFontsReady()
  const S = 280
  const cx = S / 2
  // p-4 içinde justify-between: ad (20) · QR çerçevesi (144) · yönerge (16.5), aralar eşit
  const gap = (S - 40 - 20 - 144 - 16.5) / 2
  const frameTop = 20 + 20 + gap
  const ctaTop = frameTop + 144 + gap
  const name = restaurantName ? ellipsize(restaurantName, 800, 14, S - 40 - 16) : ''

  return (
    <svg
      data-qr-page=""
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${S} ${S}`}
      width={`${(S * PX_TO_MM).toFixed(2)}mm`}
      height={`${(S * PX_TO_MM).toFixed(2)}mm`}
      fontFamily={QR_FONT_FAMILY}
      className={className}
    >
      <rect x={2} y={2} width={S - 4} height={S - 4} rx={22} fill="#fff" stroke={color} strokeWidth={4} />
      {name && (
        <text x={cx} y={baseline(20, 20, 800, 14)} textAnchor="middle" fontSize={14} fontWeight={800} fill={GRAY_900}>
          {name}
        </text>
      )}
      <rect x={cx - 71.5} y={frameTop + 0.5} width={143} height={143} rx={11.5} fill="#fff" stroke={BORDER} strokeWidth={1} />
      <QRCodeSVG
        value={link}
        size={128}
        level={qrLevel}
        imageSettings={logoImage(128)}
        includeMargin={false}
        x={cx - 64}
        y={frameTop + 8}
      />
      <text x={cx} y={baseline(ctaTop, 16.5, 700, 11)} textAnchor="middle" fontSize={11} fontWeight={700} fill={GRAY_700}>
        📱 Kameranızı QR Koda Doğrultun
      </text>
    </svg>
  )
}

/* ---------- 3-4. A4 kes-kullan sayfası (mm) ---------- */

export type SheetCard = { key: string; link: string; label: string | null }

export const SHEET = { cols: 4, rows: 5, cardMm: 50 }
export const SHEET_SIZE = SHEET.cols * SHEET.rows

/** 5x5 cm kartlar, kesik çizgili kesim kılavuzu; label varsa (masa adı) işletme adının altında. */
export function A4SheetPage({
  cards,
  restaurantName,
  qrLevel,
  logoImage,
  accentColor,
  className,
}: {
  cards: SheetCard[]
  restaurantName: string
  qrLevel: 'H' | 'M'
  logoImage: QrLogo
  accentColor?: string
  className?: string
}) {
  useFontsReady()
  const { cols, cardMm } = SHEET
  const PAGE_W = 210
  const PAGE_H = 297
  const x0 = (PAGE_W - cols * cardMm) / 2
  const y0 = (PAGE_H - Math.ceil(cards.length / cols) * cardMm) / 2
  const inner = cardMm - 5 // padding 2.5mm
  const name = ellipsize(restaurantName.toLocaleUpperCase('tr'), 800, 2.8, inner)

  return (
    <svg
      data-qr-page=""
      data-a4=""
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      width={`${PAGE_W}mm`}
      height={`${PAGE_H}mm`}
      preserveAspectRatio="xMidYMin slice"
      fontFamily={QR_FONT_FAMILY}
      className={className}
    >
      <rect width={PAGE_W} height={PAGE_H} fill="#fff" />
      {cards.map((card, i) => {
        const x = x0 + (i % cols) * cardMm
        const y = y0 + Math.floor(i / cols) * cardMm
        const cx = x + cardMm / 2
        const qr = card.label ? 33 : 38
        const nameH = 2.8 * 1.15
        const pillH = 2.6 * 1.2 + 0.6
        const total = nameH + 1 + (card.label ? pillH + 1 : 0) + qr
        let top = y + 2.5 + (inner - total) / 2
        const nameTop = top
        top += nameH + 1
        const pillTop = top
        if (card.label) top += pillH + 1
        const label = card.label ? ellipsize(card.label, 700, 2.6, inner - 3) : ''
        const pillW = label ? textWidth(label, 700, 2.6) + 3 : 0
        return (
          <g key={card.key}>
            <rect x={x + 0.1} y={y + 0.1} width={cardMm - 0.2} height={cardMm - 0.2} fill="none" stroke="#b5b5b5" strokeWidth={0.2} strokeDasharray="0.6 0.6" />
            {name && (
              <text x={cx} y={baseline(nameTop, nameH, 800, 2.8)} textAnchor="middle" fontSize={2.8} fontWeight={800} fill={GRAY_900}>
                {name}
              </text>
            )}
            {label && (
              <>
                <rect x={cx - pillW / 2} y={pillTop} width={pillW} height={pillH} rx={1.06} fill={accentColor || GRAY_900} />
                <text x={cx} y={baseline(pillTop + 0.3, 2.6 * 1.2, 700, 2.6)} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="#fff">
                  {label}
                </text>
              </>
            )}
            {/* İç hesap 144 birimde (logo oranı ekrandakiyle aynı), çizim mm boyutunda */}
            <QRCodeSVG
              value={card.link}
              size={144}
              level={qrLevel}
              imageSettings={logoImage(144)}
              includeMargin={false}
              x={cx - qr / 2}
              y={top}
              width={qr}
              height={qr}
            />
          </g>
        )
      })}
    </svg>
  )
}

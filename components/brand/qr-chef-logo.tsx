import { cn } from '@/lib/utils'

/**
 * QR Chef markası: devre hatları, QR pikselleri ve yükselen okla örülmüş aşçı şapkası.
 *
 * Tek renk: ana ton `currentColor` (metin rengi), ikincil ton `secondary`.
 * Zemin rengine bağımlı değildir; QR deseni gerçek deliklerle (evenodd) açılır,
 * bu yüzden saydam/cam zeminlerde de doğru görünür.
 *
 * `simple`: 32 px ve altı için ayrıntısız sürüm (favicon, küçük rozet).
 */

/** Şapka dış hattı: üç lob (yay), omuz, bant ve elips taban. Tek kapalı yol. */
const HAT_OUTLINE =
  'M32 78A30 30 0 0 1 62 48A40 40 0 0 1 138 48A30 30 0 0 1 168 78V114H150V160A50 14 0 0 1 50 160V114H32Z'

/** Sol lob: dolu daire, içinde QR bulucu deseni ve sağa dağılan piksel delikleri (evenodd). */
const LOBE_WITH_QR =
  'M32 78a30 30 0 1 0 60 0a30 30 0 1 0-60 0Z' +
  'M44 64h24v24H44Z' +
  'M49 69h14v14H49Z' +
  'M52.5 72.5h7v7h-7Z' +
  'M76 58h6v6h-6ZM84 66h6v6h-6ZM78 76h6v6h-6ZM86 86h6v6h-6ZM72 94h6v6h-6Z'

/** Sol lob, sade: dolu daire ve tek kare delik. */
const LOBE_SIMPLE = 'M32 78a30 30 0 1 0 60 0a30 30 0 1 0-60 0ZM46 66h22v22H46Z'

/** Lobdan kopup içeriye uçan pikseller. */
const FLOATING_PIXELS = 'M96 44h6v6h-6ZM104 36h6v6h-6ZM100 56h6v6h-6ZM112 46h6v6h-6ZM94 68h6v6h-6ZM108 62h6v6h-6Z'

const RING_LEFT = 'M100 174A50 14 0 0 1 100 146'
const RING_RIGHT = 'M100 146A50 14 0 0 1 100 174'

type MarkProps = {
  /** Kare kenar uzunluğu (px) */
  size?: number
  /** İkincil ton (kontur, devre, bant sağ yarısı). Varsayılan: tema metin-soluk rengi */
  secondary?: string
  /** Ayrıntısız sürüm; 32 px ve altında kullanın */
  simple?: boolean
  className?: string
  title?: string
}

export function QrChefMark({
  size = 40,
  secondary = 'hsl(var(--muted-foreground))',
  simple = false,
  className,
  title = 'QR Chef',
}: MarkProps) {
  const outlineWidth = simple ? 16 : 12
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <path d={simple ? LOBE_SIMPLE : LOBE_WITH_QR} fill="currentColor" fillRule="evenodd" />
      <path d={HAT_OUTLINE} fill="none" stroke={secondary} strokeWidth={outlineWidth} strokeLinejoin="round" />
      {!simple && (
        <>
          <path d={FLOATING_PIXELS} fill="currentColor" />
          <path
            d="M66 140V124H92V100H118V78H134"
            fill="none"
            stroke={secondary}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M126 68L138 78L126 88"
            fill="none"
            stroke={secondary}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <g fill="currentColor">
            <circle cx={66} cy={124} r={5} />
            <circle cx={92} cy={100} r={5} />
            <circle cx={118} cy={78} r={5} />
          </g>
        </>
      )}
      <path d={RING_LEFT} fill="none" stroke="currentColor" strokeWidth={outlineWidth} />
      <path d={RING_RIGHT} fill="none" stroke={secondary} strokeWidth={outlineWidth} />
    </svg>
  )
}

type WordmarkProps = {
  /** "Chef" sözcüğünün rengi için sınıf; varsayılan soluk ton */
  chefClassName?: string
  className?: string
}

/** "QR Chef" yazısı: "QR" metin renginde, "Chef" soluk tonda. Yazı tipi ve boyut dışarıdan gelir. */
export function QrChefWordmark({ chefClassName = 'text-muted-foreground', className }: WordmarkProps) {
  return (
    <span className={cn('whitespace-nowrap', className)}>
      QR <span className={cn('font-semibold', chefClassName)}>Chef</span>
    </span>
  )
}

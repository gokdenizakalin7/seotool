'use client'

import React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** true: stokta var (yeşil, düğme sağda) · false: stok yok (kırmızı, düğme solda) */
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

/** Ürün stok anahtarı (tek tık: var ↔ yok). Müşteri menüsünde stok yok = "Tükendi". */
export function StockSwitch({ checked, onChange, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? 'Stokta var' : 'Stok yok'}
      title={checked ? 'Stokta var · tıklayınca "stok yok" olur' : 'Stok yok · tıklayınca "stokta var" olur'}
      onClick={() => onChange(!checked)}
      className={cn('inline-flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-emerald-500' : 'bg-red-500')}>
        {/* bg-white panelin koyu tema uyarlamasında koyulaşır; düğme her temada açık kalsın */}
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-zinc-50 shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
      <span className={cn('w-6 text-left text-[11px] font-semibold', checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
        {checked ? 'Var' : 'Yok'}
      </span>
    </button>
  )
}

interface HiddenProps {
  /** true: ürün müşteri menüsünde hiç görünmez */
  hidden: boolean
  onChange: (hidden: boolean) => void
  className?: string
}

/** "Menüde gizle" düğmesi (tek tık: görünür ↔ gizli). Tükendi'den farkı: ürün menüden tamamen kalkar. */
export function HiddenToggle({ hidden, onChange, className }: HiddenProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={hidden}
      aria-label="Menüde gizle"
      title={hidden ? 'Menüde gizli · tıklayınca müşteri menüsünde yeniden görünür' : 'Menüde görünür · tıklayınca müşteri menüsünden kalkar'}
      onClick={() => onChange(!hidden)}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hidden
          ? 'border-amber-500 bg-amber-500 text-white'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        className
      )}
    >
      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {hidden ? 'Gizli' : 'Gizle'}
    </button>
  )
}

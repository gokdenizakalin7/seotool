'use client'

import React from 'react'
import { BadgePercent, CircleHelp, LayoutDashboard, Menu as MenuIcon, PlayCircle, QrCode, Settings, Smartphone } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { TOUR_CHAPTERS, type TourChapterId } from '@/lib/tour/tour-steps'
import { useTour } from '@/components/tour/TourProvider'

const CHAPTER_ICONS: Record<TourChapterId, React.ElementType> = {
  genel: LayoutDashboard,
  editor: Smartphone,
  menuler: MenuIcon,
  qr: QrCode,
  ayarlar: Settings,
  site: BadgePercent,
}

/** Üst bardaki (?) düğmesi: rehberi baştan ya da istenen bölümden açar */
export function TourMenu({ className }: { className?: string }) {
  const { start } = useTour()
  // Açılır menü kapanıp odağı bıraktıktan sonra başlat
  const launch = (chapter?: TourChapterId) => setTimeout(() => start(chapter ? { chapter } : {}), 80)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-tour="header-help"
          aria-label="Panel rehberi"
          title="Panel rehberi"
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground backdrop-blur-md transition-all hover:bg-card active:scale-95',
            className
          )}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <p className="text-sm font-bold">Panel Rehberi</p>
          <p className="text-xs font-normal text-muted-foreground">Ekranda göstererek adım adım anlatır</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => launch()} className="font-semibold">
          <PlayCircle className="mr-2 h-4 w-4" /> Tüm turu baştan başlat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bölümler</DropdownMenuLabel>
        {TOUR_CHAPTERS.map((c) => {
          const Icon = CHAPTER_ICONS[c.id]
          return (
            <DropdownMenuItem key={c.id} onClick={() => launch(c.id)} className="items-start py-2">
              <Icon className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold leading-tight">{c.title}</span>
                <span className="text-xs text-muted-foreground">{c.question}</span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

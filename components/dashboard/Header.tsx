'use client'

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Menu as MenuIcon, Settings, LogOut, QrCode } from 'lucide-react'
import { signOutClient } from '@/lib/session'
import { confirmLeave } from '@/lib/leave-guard'
import { ThemeToggle } from '@/components/theme/PanelTheme'
import { useRestaurant } from '@/components/providers/RestaurantProvider'

export function Header({ 
  setIsSidebarOpen, 
  restaurantName,
  subdomain,
  logoUrl
}: { 
  setIsSidebarOpen: (open: boolean) => void;
  restaurantName?: string;
  subdomain?: string;
  logoUrl?: string;
}) {
  const navigate = useNavigate()
  const { email } = useRestaurant()

  const handleLogout = async () => {
    if (!confirmLeave()) return
    await signOutClient()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-card/60 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30 lg:px-6">
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="lg:hidden">
          <MenuIcon className="h-6 w-6" />
          <span className="sr-only">Menüyü Aç</span>
        </Button>
        <div className="flex items-center space-x-2">
          <span className="font-extrabold tracking-tight text-foreground text-lg">{restaurantName || 'Restoran Paneli'}</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <ThemeToggle />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => confirmLeave('/dashboard/qr-codes') && navigate('/dashboard/qr-codes')}
          className="hidden sm:flex"
        >
          <QrCode className="h-4 w-4 mr-1.5" /> QR Kodlar
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={logoUrl || ""} alt="Restoran logosu" className="object-contain bg-white" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {(restaurantName || 'RP').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">{restaurantName || 'Yönetici'}</p>
                <p className="truncate text-xs leading-none text-muted-foreground">{email || 'Panel kullanıcısı'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => confirmLeave('/dashboard/settings') && navigate('/dashboard/settings')}>
              <Settings className="h-4 w-4 mr-2" /> Ayarlar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

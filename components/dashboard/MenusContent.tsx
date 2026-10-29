'use client'

import React, { useState } from 'react'
import { authFetch } from '@/lib/api-client'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Eye, Trash2, Globe, EyeOff, QrCode, Smartphone, Sparkles, Camera, Utensils, RefreshCw } from 'lucide-react'
import { Menu } from '@/lib/types'
import { setStoredMenus } from '@/lib/mock-data'
import { ScanMenuModal } from '@/components/modals/ScanMenuModal'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { siteUrl } from '@/lib/site-url'

export function MenusContent() {
  const { restaurant: currentRestaurant } = useRestaurant()
  const subdomain = currentRestaurant?.subdomain || ''
  const [menus, setMenus] = useState<Menu[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Yükleme hatasında eski önbellekle devam edilmez: eski veriyle yayın/silme işlemi veritabanını ezebilir
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadMenus = async () => {
    if (!subdomain) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await authFetch(`/api/menus/load?subdomain=${subdomain}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Menüler yüklenemedi.')
      setMenus(data.menus || [])
      setStoredMenus(subdomain, data.menus || [])
    } catch (err: any) {
      console.error(err)
      setLoadError(err?.message || 'Menüler yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    loadMenus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain])

  const [isScanMenuModalOpen, setIsScanMenuModalOpen] = useState(false)
  const navigate = useNavigate()

  // Müşteri menüsü yayındaki ilk menüyü gösterir (sunucu created_at ile sıralar)
  const customerMenuId = menus.find((m) => m.is_listed)?.id
  const openCustomerMenu = () => window.open(siteUrl(subdomain), '_blank', 'noopener,noreferrer')

  const syncWithSupabase = async (updatedMenus: Menu[], previousMenus: Menu[]) => {
    try {
      const res = await authFetch('/api/menus/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain,
          menus: updatedMenus
        })
      })
      if (res.ok) {
        toast.success('Değişiklikler başarıyla kaydedildi.')
        // Yeni menüler gerçek kimlikleriyle gelsin: geçici menu- kimliği bir sonraki kayıtta kopya oluşturmasın
        await loadMenus()
      } else {
        const err = await res.json().catch(() => ({}))
        if (res.status === 409 && err.code === 'STALE_MENU') {
          // Eski sekme koruması: menüler başka yerden değişmiş; güncel listeyi çek, işlem tekrar yapılmalı
          toast.error(err.error || 'Menüler başka bir yerden değişti; liste yenilendi.', { duration: 12000 })
          await loadMenus()
          return
        }
        toast.error(`Senkronizasyon hatası: ${err.error || 'Bilinmeyen hata'}`)
        // Rollback
        setMenus(previousMenus)
        setStoredMenus(subdomain, previousMenus)
      }
    } catch (error: any) {
      console.error('Failed to sync menus with DB:', error)
      toast.error(`Bağlantı hatası: ${error.message}`)
      // Rollback
      setMenus(previousMenus)
      setStoredMenus(subdomain, previousMenus)
    }
  }

  const handleDelete = async (id: string) => {
    const target = menus.find((m) => m.id === id)
    const isCustomerMenu = id === customerMenuId
    const message =
      `"${target?.name || 'Menü'}" kalıcı olarak silinecek; tüm kategori ve ürünleri de silinir. Bu işlem geri alınamaz.` +
      (isCustomerMenu ? '\n\nBu, müşterilerinizin QR kodla gördüğü menü. Silinirse QR kodu okutan müşteriler boş sayfa görür.' : '')
    if (confirm(message)) {
      const previousMenus = [...menus]
      try {
        const updated = menus.filter(menu => menu.id !== id)
        setMenus(updated)
        setStoredMenus(subdomain, updated)

        const res = await authFetch('/api/menus/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menuId: id })
        })

        if (res.ok) {
          toast.success('Menü silindi.')
        } else {
          const err = await res.json()
          toast.error(`Silme hatası: ${err.error || 'Bilinmeyen hata'}`)
          setMenus(previousMenus)
          setStoredMenus(subdomain, previousMenus)
        }
      } catch (err: any) {
        console.error('Failed to delete menu', err)
        toast.error(`Bağlantı hatası: ${err.message}`)
        setMenus(previousMenus)
        setStoredMenus(subdomain, previousMenus)
      }
    }
  }

  const toggleMenuListing = (id: string) => {
    if (
      id === customerMenuId &&
      !confirm('Bu menü yayından kaldırılırsa QR kodu okutan müşteriler menünüzü göremez. Devam edilsin mi?')
    ) return
    const previousMenus = [...menus]
    const updated = menus.map(menu => 
      menu.id === id ? { ...menu, is_listed: !menu.is_listed } : menu
    )
    setMenus(updated)
    setStoredMenus(subdomain, updated)
    syncWithSupabase(updated, previousMenus)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      data-tour-page="menus"
      data-tour-ready={isLoading ? 'false' : 'true'}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Menü Listesi</h1>
          <p className="text-sm text-muted-foreground">Menünüzün yayın durumunu yönetin; ürün ve kategorileri canlı editörde düzenleyin</p>
        </div>
        {/* Menü varken yeni menü/tarama ikinci bir menü açar ama müşteri yalnızca ilkini görür: işlemler editöre yönlenir */}
        {menus.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openCustomerMenu} disabled={!customerMenuId}>
              <Eye className="mr-2 h-4 w-4" /> Müşteri Gözüyle Gör
            </Button>
            <Button onClick={() => navigate('/dashboard/menu-editor')}>
              <Smartphone className="mr-2 h-4 w-4" /> Canlı Editörde Düzenle
            </Button>
          </div>
        )}
      </div>

      {loadError ? (
        <div className="text-center py-16 glass-card border-dashed">
          <h3 className="text-lg font-semibold text-foreground mb-2">Menüler yüklenemedi</h3>
          <p className="text-muted-foreground mb-6">{loadError}</p>
          <Button onClick={loadMenus}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tekrar dene
          </Button>
        </div>
      ) : isLoading && menus.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : menus.length === 0 ? (
        <div className="text-center py-16 glass-card border-dashed">
          <Utensils className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Henüz Bir Menünüz Yok</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Müşterilerinize sunmak için ilk dijital menünüzü oluşturun veya fiziksel menünüzü tarayarak yapay zeka ile hemen oluşturun.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button 
              size="lg" 
              onClick={() => navigate('/dashboard/menu-editor?start=template')}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-6 text-base shadow-md w-full sm:w-auto"
            >
              <Sparkles className="h-5 w-5 mr-2" /> Hazır Menü Paketi Yükle
            </Button>

            <Button 
              size="lg" 
              onClick={() => setIsScanMenuModalOpen(true)}
              className="scan-attention bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-6 py-6 text-base shadow-md w-full sm:w-auto"
            >
              <Camera className="h-5 w-5 mr-2" /> Kendi Menünü Tara
            </Button>

            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/dashboard/menu-editor?start=blank')}
              className="border-border hover:bg-accent text-foreground font-semibold px-6 py-6 text-base w-full sm:w-auto"
            >
              <Plus className="h-5 w-5 mr-2 text-primary" /> Sıfırdan Boş Menü Başlat
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu, index) => {
            const totalItems = menu.categories?.reduce((total, cat) => total + (cat.items?.length || 0), 0) || 0
            const activeCats = menu.categories?.filter(c => c.is_active).length || 0
            
            return (
              <Card
                key={menu.id}
                data-tour={index === 0 ? 'menu-card' : undefined}
                className={`overflow-hidden hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ${!menu.is_listed ? 'opacity-70' : ''}`}
              >
                <div className="relative h-48 w-full">
                  {menu.image_url ? (
                    <img
                      src={menu.image_url}
                      alt={menu.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : null}
                  {!menu.image_url && (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                      <Utensils className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {!menu.is_listed ? (
                      <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center">
                        <EyeOff className="h-3 w-3 mr-1" /> Yayında Değil
                      </span>
                    ) : menu.id === customerMenuId ? (
                      <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center">
                        <Globe className="h-3 w-3 mr-1" /> Yayında · Müşteriler bunu görüyor
                      </span>
                    ) : (
                      <span
                        className="bg-slate-600 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center"
                        title="Müşteri menüsü yayındaki ilk menüyü gösterir"
                      >
                        <Globe className="h-3 w-3 mr-1" /> Yayında · Müşteriler görmüyor
                      </span>
                    )}
                  </div>
                </div>
                
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-bold">{menu.name}</CardTitle>
                      <CardDescription className="line-clamp-1">{menu.description || 'Açıklama bulunmuyor'}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/menu-editor?menu=${menu.id}`)}>
                          <Smartphone className="h-4 w-4 mr-2 text-primary" /> Canlı Editörde Aç
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={openCustomerMenu} disabled={menu.id !== customerMenuId}>
                          <Eye className="h-4 w-4 mr-2" /> Müşteri Gözüyle Gör
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/dashboard/qr-codes')}>
                          <QrCode className="h-4 w-4 mr-2" /> QR Kodlar & Masalar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleMenuListing(menu.id)}>
                          {menu.is_listed ? <EyeOff className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                          {menu.is_listed ? 'Yayından Kaldır' : 'Yayına Al'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 font-medium"
                          onClick={() => handleDelete(menu.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Menüyü Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t mt-2">
                    <span>{activeCats}/{menu.categories?.length || 0} Kategori Aktif • {totalItems} Ürün</span>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-primary font-bold"
                      onClick={() => navigate(`/dashboard/menu-editor?menu=${menu.id}`)}
                    >
                      Canlı Düzenle →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ScanMenuModal
        isOpen={isScanMenuModalOpen}
        onClose={() => setIsScanMenuModalOpen(false)}
        onMenuCreated={(scannedMenu) => {
          const created: Menu = {
            id: `menu-${Date.now()}`,
            name: scannedMenu.name || 'Taranan Menü',
            description: scannedMenu.description || '',
            image_url: scannedMenu.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop',
            is_listed: true,
            layout: 'grid',
            available_days: [1, 2, 3, 4, 5, 6, 7],
            categories: scannedMenu.categories || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          const previousMenus = [...menus]
          const updated = [...menus, created]
          setMenus(updated)
          setStoredMenus(subdomain, updated)
          syncWithSupabase(updated, previousMenus)
        }}
      />

    </motion.div>
  )
}

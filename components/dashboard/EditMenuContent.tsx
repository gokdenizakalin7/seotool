'use client'

import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, ArrowLeft, Trash2, Edit, Utensils, Clock, Check, Save } from 'lucide-react'
import { catalogThumbUrl } from '@/lib/image-url'
import { mockMenusByRestaurant } from '@/lib/mock-data'
import { Menu, MenuItem, MenuCategory } from '@/lib/types'
import { motion } from 'framer-motion'

export function EditMenuContent() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Find menu or fallback — safe resolution without undefined key access
  const allMenus = Object.values(mockMenusByRestaurant).flat()
  const fallbackMenu: Menu = allMenus[0] || {
    id: 'menu-default',
    name: 'Varsayılan Menü',
    description: '',
    image_url: '',
    is_listed: true,
    available_days: [1, 2, 3, 4, 5, 6, 7],
    layout: 'grid' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    categories: []
  }
  const initialMenu: Menu = allMenus.find(m => m.id === id) || fallbackMenu

  const [menuName, setMenuName] = useState(initialMenu.name)
  const [menuDescription, setMenuDescription] = useState(initialMenu.description)
  const [startTime, setStartTime] = useState(initialMenu.start_time || '08:00')
  const [endTime, setEndTime] = useState(initialMenu.end_time || '23:00')
  const [categories, setCategories] = useState<MenuCategory[]>(initialMenu.categories || [])

  // Modals for Category & Item
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDesc, setNewCategoryDesc] = useState('')

  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemCalories, setNewItemCalories] = useState('')
  const [newItemAllergens, setNewItemAllergens] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const [days, setDays] = useState<Record<string, boolean>>({
    pazartesi: true,
    sali: true,
    carsamba: true,
    persembe: true,
    cuma: true,
    cumartesi: true,
    pazar: true,
  })

  const dayLabels: Record<string, string> = {
    pazartesi: 'Pazartesi',
    sali: 'Salı',
    carsamba: 'Çarşamba',
    persembe: 'Perşembe',
    cuma: 'Cuma',
    cumartesi: 'Cumartesi',
    pazar: 'Pazar',
  }

  const handleAddCategory = () => {
    if (!newCategoryName) return
    const newCat: MenuCategory = {
      id: `cat-${Date.now()}`,
      name: newCategoryName,
      description: newCategoryDesc,
      display_order: categories.length + 1,
      is_active: true,
      items: []
    }
    setCategories(prev => [...prev, newCat])
    setNewCategoryName('')
    setNewCategoryDesc('')
    setIsAddCategoryOpen(false)
  }

  const handleDeleteCategory = (catId: string) => {
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  const handleAddItem = () => {
    if (!newItemName || !newItemPrice || !selectedCategoryId) return
    const item: MenuItem = {
      id: `item-${Date.now()}`,
      name: newItemName,
      description: newItemDesc,
      price: newItemPrice.includes('₺') ? newItemPrice : `${newItemPrice} ₺`,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
      allergens: newItemAllergens ? newItemAllergens.split(',').map(s => s.trim()) : [],
      calories: newItemCalories ? parseInt(newItemCalories) : undefined,
      display_order: 1,
      is_available: true
    }

    setCategories(prev => prev.map(cat => {
      if (cat.id === selectedCategoryId) {
        return {
          ...cat,
          items: [...cat.items, item]
        }
      }
      return cat
    }))

    setNewItemName('')
    setNewItemDesc('')
    setNewItemPrice('')
    setNewItemCalories('')
    setNewItemAllergens('')
    setIsAddItemOpen(false)
  }

  const handleDeleteItem = (catId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.filter(i => i.id !== itemId)
        }
      }
      return cat
    }))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/menus')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Menülere Geri Dön
        </Button>
        <Button onClick={handleSave} className="bg-primary text-white">
          {savedSuccess ? <Check className="mr-2 h-4 w-4 text-green-300" /> : <Save className="mr-2 h-4 w-4" />}
          {savedSuccess ? 'Değişiklikler Kaydedildi!' : 'Menüyü Kaydet'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sol Kolon: Menü Temel Bilgileri */}
        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Menü Bilgileri</CardTitle>
              <CardDescription>Başlık ve çalışma saatleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-name">Menü Adı</Label>
                <Input
                  id="menu-name"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-description">Açıklama</Label>
                <Textarea
                  id="menu-description"
                  value={menuDescription}
                  onChange={(e) => setMenuDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="start-time" className="text-xs">Başlangıç Saati</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-time" className="text-xs">Bitiş Saati</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Geçerli Günler</Label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {Object.entries(days).map(([day, checked]) => (
                    <div key={day} className="flex items-center space-x-1">
                      <Checkbox
                        id={`edit-${day}`}
                        checked={checked}
                        onCheckedChange={(c) => setDays(prev => ({ ...prev, [day]: c as boolean }))}
                      />
                      <Label htmlFor={`edit-${day}`} className="cursor-pointer text-xs">{dayLabels[day] || day}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Kolon: Kategoriler ve Ürünler */}
        <div className="space-y-6 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Kategoriler ve Yemekler</h2>
            <Button size="sm" onClick={() => setIsAddCategoryOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Kategori Ekle
            </Button>
          </div>

          {categories.length === 0 && (
            <Card className="p-8 text-center bg-muted/40 border-dashed">
              <Utensils className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground font-medium">Henüz bir kategori eklenmemiş</p>
              <p className="text-xs text-muted-foreground mb-4">Menünüzü oluşturmak için ilk kategorinizi ekleyin (Örn: Çorbalar, Ana Yemekler, İçecekler)</p>
              <Button size="sm" onClick={() => setIsAddCategoryOpen(true)}>Kategori Ekle</Button>
            </Card>
          )}

          {categories.map((cat) => (
            <Card key={cat.id} className="shadow-sm">
              <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">{cat.name}</CardTitle>
                  {cat.description && <CardDescription className="text-xs">{cat.description}</CardDescription>}
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedCategoryId(cat.id)
                      setIsAddItemOpen(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ürün Ekle
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-red-500"
                    onClick={() => handleDeleteCategory(cat.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {cat.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Bu kategoride henüz ürün bulunmuyor.</p>
                ) : (
                  <div className="divide-y">
                    {cat.items.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                        <div className="flex items-center space-x-3">
                          {item.image_url && (
                            <img src={catalogThumbUrl(item.image_url)} alt={item.name} loading="lazy" decoding="async" className="w-12 h-12 rounded object-cover border" />
                          )}
                          <div>
                            <div className="font-semibold text-sm text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                            {item.allergens && item.allergens.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {item.allergens.map((a) => (
                                  <span key={a} className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.2 rounded border border-red-200">
                                    {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-sm text-primary">{item.price}</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleDeleteItem(cat.id, item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Kategori Ekleme Modalı */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Yeni Kategori Ekle</DialogTitle>
            <DialogDescription>Örn: Başlangıçlar, Burgerler, İçecekler</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="cat-name">Kategori Adı</Label>
              <Input
                id="cat-name"
                placeholder="Örn: Tatlılar & Pastalar"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-desc">Açıklama (İsteğe bağlı)</Label>
              <Input
                id="cat-desc"
                placeholder="Örn: Günlük taze hazırlanan tatlılarımız"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Vazgeç</Button>
            <Button onClick={handleAddCategory}>Kategoriyi Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ürün Ekleme Modalı */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Yeni Ürün Ekle</DialogTitle>
            <DialogDescription>Yemek veya içeceğin ayrıntılarını ve fiyatını girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="item-name">Ürün Adı</Label>
              <Input
                id="item-name"
                placeholder="Örn: Tereyağlı İskender Kebap"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-price">Fiyat</Label>
              <Input
                id="item-price"
                placeholder="Örn: 280 ₺"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-desc">Açıklama & İçindekiler</Label>
              <Textarea
                id="item-desc"
                placeholder="Örn: Özel sos, pide, yoğurt ve eritilmiş tereyağı ile"
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="item-allergens">Alerjenler (Virgülle)</Label>
                <Input
                  id="item-allergens"
                  placeholder="Gluten, Süt"
                  value={newItemAllergens}
                  onChange={(e) => setNewItemAllergens(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-cal">Kalori (kcal)</Label>
                <Input
                  id="item-cal"
                  type="number"
                  placeholder="750"
                  value={newItemCalories}
                  onChange={(e) => setNewItemCalories(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>Vazgeç</Button>
            <Button onClick={handleAddItem}>Ürünü Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

'use client'

import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, PauseCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { clearImpersonation } from '@/lib/impersonation'

/**
 * Restoran paneli üst bantları:
 *  - Süper admin "Panele Gir" ile başka restoranı görüntülüyorsa
 *  - Restoran askıya alınmışsa (sebebiyle; panel salt-okunur, kaydetme 423 döner)
 */
export function AccountBanners() {
  const navigate = useNavigate()
  const { restaurant, impersonating, isSuspended } = useRestaurant()
  const lastToast = useRef(0)

  useEffect(() => {
    const onSuspended = () => {
      if (Date.now() - lastToast.current < 4000) return
      lastToast.current = Date.now()
      toast.error('Hesabınız askıya alındığı için değişiklik kaydedilemedi.')
    }
    window.addEventListener('org-suspended', onSuspended)
    return () => window.removeEventListener('org-suspended', onSuspended)
  }, [])

  if (!restaurant) return null

  return (
    <>
      {impersonating && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-900 dark:text-blue-100 lg:px-6">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              <b>{restaurant.name}</b> restoranını sistem yöneticisi olarak görüntülüyorsunuz. Yaptığınız değişiklikler bu restorana kaydedilir.
              {restaurant.status === 'suspended' && ' (Restoran askıda)'}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const id = restaurant.id
              clearImpersonation()
              navigate(`/admin/restaurants/${id}`)
            }}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Admin paneline dön
          </Button>
        </div>
      )}
      {isSuspended && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-800 dark:text-red-200 lg:px-6">
          <p className="flex items-center gap-2 font-semibold">
            <PauseCircle className="h-4 w-4 shrink-0" /> Hesabınız askıya alındı
          </p>
          <p className="mt-0.5 text-xs">
            Sebep: {restaurant.statusReason || 'belirtilmemiş'}. Müşteri menünüz şu an kapalı ve panelde değişiklik yapılamıyor. Bilgi için
            bizimle iletişime geçin.
          </p>
        </div>
      )}
    </>
  )
}

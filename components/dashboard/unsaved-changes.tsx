'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { setLeaveInterceptor } from '@/lib/leave-guard'
import { setScrollNavGuard } from '@/components/dashboard/ScrollNavigation'

/**
 * Kaydedilmemiş değişiklik koruması (Web Sitem sayfaları).
 *
 *  - useBeforeUnload: sayfa yenileme / sekme kapatmada tarayıcının kendi uyarısı.
 *  - useUnsavedChanges: panel içi geçişleri (sol menü bağlantıları, üst bar düğmeleri, çıkış, kaydırma ile geçiş) durdurur;
 *    UnsavedChangesDialog ile "devam et / kaydetmeden çık / kaydet ve çık" sorar.
 *  - Modal editörler kapatma anında aynı diyaloğu kendileri gösterir (sayfa geçişi modal açıkken zaten yapılamaz).
 */

export function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}

interface Pending {
  to?: string
  proceed?: () => void
}

export function useUnsavedChanges(dirty: boolean) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<Pending | null>(null)
  useBeforeUnload(dirty)

  useEffect(() => {
    if (!dirty) return
    // Site içi bağlantılar (sol menü vb.): tarayıcı penceresi yerine kendi diyaloğumuz
    const onClickCapture = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) return
      if (href === window.location.pathname + window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      setPending({ to: href })
    }
    document.addEventListener('click', onClickCapture, true)
    setScrollNavGuard((to) => {
      setPending({ to })
      return true
    })
    // navigate() ile yapılan geçişler ve çıkış (üst bar / hesap menüsü)
    setLeaveInterceptor((to, proceed) => setPending({ to, proceed }))
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      setScrollNavGuard(null)
      setLeaveInterceptor(null)
    }
  }, [dirty])

  const stay = useCallback(() => setPending(null), [])
  const leave = useCallback(() => {
    const p = pending
    setPending(null)
    if (!p) return
    if (p.proceed) p.proceed()
    else if (p.to) navigate(p.to)
  }, [pending, navigate])

  return { open: !!pending, stay, leave }
}

export function UnsavedChangesDialog({
  open,
  saving,
  onStay,
  onDiscard,
  onSave,
  discardLabel = 'Kaydetmeden çık',
  saveLabel = 'Kaydet ve çık',
}: {
  open: boolean
  saving?: boolean
  onStay: () => void
  onDiscard: () => void
  onSave: () => void | Promise<void>
  discardLabel?: string
  saveLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onStay()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" /> Kaydedilmemiş değişiklikler var
          </DialogTitle>
          <DialogDescription>Yaptığınız değişiklikleri henüz kaydetmediniz. Kaydetmeden çıkarsanız bu değişiklikler kaybolacak.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="ghost" onClick={onStay} disabled={saving} className="w-full sm:w-auto">
            Düzenlemeye devam et
          </Button>
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
            className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 sm:w-auto"
          >
            {discardLabel}
          </Button>
          <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saveLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

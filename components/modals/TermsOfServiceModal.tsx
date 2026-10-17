'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LegalMeta, TermsOfServiceText } from '@/components/legal/LegalTexts'

/** Kullanım Koşulları: koyu arka planlı sayfalarda da okunabilsin diye pencere her temada beyaz */
export function TermsOfServiceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border-gray-200 bg-white text-gray-800 backdrop-blur-none dark:border-gray-200 dark:bg-white dark:text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Kullanım Koşulları</DialogTitle>
          <DialogDescription asChild>
            <div className="text-gray-600">
              <LegalMeta />
              <span className="mt-1 block text-xs">
                Tam metin:{' '}
                <a href="/kosullar" target="_blank" rel="noreferrer" className="underline">
                  /kosullar
                </a>
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <TermsOfServiceText />
        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

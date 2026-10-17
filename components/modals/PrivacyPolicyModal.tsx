'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LegalMeta, PrivacyPolicyText } from '@/components/legal/LegalTexts'

/** Gizlilik Politikası ve KVKK Aydınlatma Metni: pencere her temada beyaz (okunabilirlik) */
export function PrivacyPolicyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border-gray-200 bg-white text-gray-800 backdrop-blur-none dark:border-gray-200 dark:bg-white dark:text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Gizlilik Politikası ve KVKK Aydınlatma Metni</DialogTitle>
          <DialogDescription asChild>
            <div className="text-gray-600">
              <LegalMeta />
              <span className="mt-1 block text-xs">
                Tam metin:{' '}
                <a href="/gizlilik" target="_blank" rel="noreferrer" className="underline">
                  /gizlilik
                </a>
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <PrivacyPolicyText />
        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

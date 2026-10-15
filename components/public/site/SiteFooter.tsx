'use client'

import { useState } from 'react'
import { PublicTermsOfServiceModal } from '@/components/modals/PublicTermsOfServiceModal'
import { PublicPrivacyPolicyModal } from '@/components/modals/PublicPrivacyPolicyModal'
import { useSiteLang } from './i18n'
import type { SiteRestaurant } from './types'

export function SiteFooter({
  restaurant,
  hasImageCredits = false,
  withBottomNav = false,
}: {
  restaurant: SiteRestaurant
  hasImageCredits?: boolean
  /** Mobilde altta sabit sekme çubuğu varsa altbilgi onun altında kalmasın */
  withBottomNav?: boolean
}) {
  const { t } = useSiteLang()
  const [isTermsOpen, setIsTermsOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)

  return (
    <>
      <footer
        className={`bg-white dark:bg-[#2c2c2e] border-t py-4 text-center text-xs text-gray-500 dark:text-zinc-500 space-y-2 mt-auto ${
          withBottomNav ? 'pb-24 sm:pb-4' : ''
        }`}
      >
        <div className="container mx-auto px-4">
          <p className="flex items-center justify-center gap-1.5">
            {restaurant.logo_url && <img src={restaurant.logo_url} alt="" className="h-4 w-4 rounded object-contain" />}©{' '}
            {new Date().getFullYear()} {restaurant.name} • Powered by <strong>QR Chef</strong>
          </p>
          <div className="flex justify-center space-x-4 mt-1.5 text-[11px]">
            <button onClick={() => setIsTermsOpen(true)} className="hover:underline text-gray-400 dark:text-zinc-500">
              {t.terms}
            </button>
            <button onClick={() => setIsPrivacyOpen(true)} className="hover:underline text-gray-400 dark:text-zinc-500">
              {t.privacy}
            </button>
            {hasImageCredits && (
              <a href="/gorsel-kaynaklari" target="_blank" rel="noopener noreferrer" className="hover:underline text-gray-400 dark:text-zinc-500">
                {t.imageCredits}
              </a>
            )}
          </div>
        </div>
      </footer>

      <PublicTermsOfServiceModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <PublicPrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </>
  )
}

'use client'

import { MustChangePasswordGate } from '@/components/auth/MustChangePasswordGate'
import { OnboardingGuard } from '@/components/auth/RouteGuards'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

/** /onboarding: oturum kalkanı ve kurulum sihirbazı tek pakette */
export function OnboardingRoute() {
  return (
    <>
      <MustChangePasswordGate />
      <OnboardingGuard>
        <OnboardingWizard />
      </OnboardingGuard>
    </>
  )
}

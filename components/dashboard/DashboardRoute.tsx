'use client'

import { MustChangePasswordGate } from '@/components/auth/MustChangePasswordGate'
import { AuthGuard } from '@/components/auth/RouteGuards'
import { RestaurantProvider } from '@/components/providers/RestaurantProvider'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

/** /dashboard/*: oturum kalkanı, restoran verisi ve panel iskeleti tek pakette (Supabase istemcisi ana pakete girmez) */
export function DashboardRoute() {
  return (
    <>
      <MustChangePasswordGate />
      <AuthGuard>
        <RestaurantProvider>
          <DashboardLayout />
        </RestaurantProvider>
      </AuthGuard>
    </>
  )
}

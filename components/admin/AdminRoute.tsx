'use client'

import { AdminGuard } from '@/components/auth/RouteGuards'
import { AdminApp } from '@/components/admin/AdminApp'

/** /admin/*: süper admin kalkanı ve admin paneli tek pakette */
export function AdminRoute() {
  return (
    <AdminGuard>
      <AdminApp />
    </AdminGuard>
  )
}

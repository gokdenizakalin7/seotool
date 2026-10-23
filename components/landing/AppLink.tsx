'use client'

import { forwardRef, type AnchorHTMLAttributes } from 'react'
import NextLink from 'next/link'
import { Link as RouterLink, useInRouterContext } from 'react-router-dom'

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string }

/**
 * Landing iki yerde çizilir: sunucuda / (app/page.tsx, arama motorları için) ve panel SPA'sının içinde
 * (ClientApp, ör. girişten logoya basınca). Router içindeyse react-router, değilse Next bağlantısı.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink({ to, ...props }, ref) {
  const inRouter = useInRouterContext()
  return inRouter ? <RouterLink ref={ref} to={to} {...props} /> : <NextLink ref={ref} href={to} {...props} />
})

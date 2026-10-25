'use client'

import { createContext, forwardRef, useContext, type AnchorHTMLAttributes, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import NextLink from 'next/link'

export type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string }

/**
 * Panel SPA'sı (ClientApp) react-router bağlantısını bu bağlamla verir. Bu dosya react-router'ı içe aktarmaz:
 * sunucuda çizilen sayfaların (ana sayfa, hukuki sayfalar) paketine ~26 KB router kodu girmesin.
 */
export const RouterLinkContext = createContext<ForwardRefExoticComponent<AppLinkProps & RefAttributes<HTMLAnchorElement>> | null>(null)

/**
 * Landing iki yerde çizilir: sunucuda / (app/page.tsx, arama motorları için) ve panel SPA'sının içinde
 * (ClientApp, ör. girişten logoya basınca). SPA içindeyse react-router, değilse Next bağlantısı.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink({ to, ...props }, ref) {
  const RouterLink = useContext(RouterLinkContext)
  return RouterLink ? <RouterLink ref={ref} to={to} {...props} /> : <NextLink ref={ref} href={to} {...props} />
})

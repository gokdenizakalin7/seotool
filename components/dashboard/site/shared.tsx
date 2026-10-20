'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Database, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/api-client'
import { siteUrl, type SitePage } from '@/lib/site-url'
import type { Menu, MenuItem } from '@/lib/types'

/** İşletme sitesi panel sayfalarının ortak parçaları */

export class SiteApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message)
  }
}

/** authFetch + JSON; hata durumunda sunucunun Türkçe mesajıyla fırlatır */
export async function siteApi<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {}
  const res = await authFetch(url, {
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json), headers: { 'Content-Type': 'application/json', ...(rest.headers || {}) } } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new SiteApiError(data?.error || 'İşlem başarısız oldu.', data?.code, res.status)
  return data as T
}

export function SitePageShell({
  title,
  description,
  subdomain,
  page,
  actions,
  tourPage,
  tourReady,
  children,
}: {
  title: string
  description: string
  subdomain?: string
  /** "Sitede gör" bağlantısının hedefi */
  page?: SitePage
  actions?: React.ReactNode
  /** Panel rehberi: sayfa kimliği ve verinin yüklendiği bilgisi */
  tourPage?: string
  tourReady?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
      data-tour-page={tourPage}
      data-tour-ready={tourPage ? (tourReady ? 'true' : 'false') : undefined}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {subdomain && page !== undefined && (
            <Button variant="outline" asChild>
              <a href={siteUrl(subdomain, page)} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Sitede Gör
              </a>
            </Button>
          )}
          {actions}
        </div>
      </div>
      {children}
    </motion.div>
  )
}

/** Migration uygulanmadıysa (API 503 MIGRATION_REQUIRED) gösterilen açıklama */
export function MigrationNotice({ file = '15_business_site.sql' }: { file?: string }) {
  return (
    <div className="glass-card border-dashed p-8 text-center">
      <Database className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <h3 className="mb-1 text-lg font-semibold text-foreground">Veritabanı güncellemesi bekleniyor</h3>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        Bu özellik için <code className="font-mono">supabase/migrations/{file}</code> dosyasının Supabase SQL
        Editor&apos;de çalıştırılması gerekiyor.
      </p>
    </div>
  )
}

export interface FlatMenuItem {
  item: MenuItem
  categoryId: string
  categoryName: string
  parentCategoryId: string | null
  menuId: string
  menuName: string
}

/**
 * İşletmenin menüleri (/api/menus/load, 30 sn önbellekli). customerMenu: müşterinin gördüğü (yayındaki ilk) menü.
 * Kampanya ve fiyat planı ürün seçicileri yalnızca işletmenin kendi ürünlerini listeler.
 */
export function useOrgMenus(subdomain: string | undefined) {
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!subdomain) return
    setLoading(true)
    setError(null)
    try {
      const data = await siteApi<{ menus: Menu[] }>(`/api/menus/load?subdomain=${encodeURIComponent(subdomain)}`)
      setMenus(data.menus || [])
    } catch (e: any) {
      setError(e?.message || 'Menüler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    reload()
  }, [reload])

  const customerMenu = useMemo(() => menus.find((m) => m.is_listed) || menus[0] || null, [menus])

  const flatten = useCallback((list: Menu[]): FlatMenuItem[] => {
    const out: FlatMenuItem[] = []
    for (const menu of list) {
      for (const cat of menu.categories || []) {
        for (const item of cat.items || []) {
          out.push({
            item,
            categoryId: cat.id,
            categoryName: cat.name,
            parentCategoryId: cat.parent_id || null,
            menuId: menu.id,
            menuName: menu.name,
          })
        }
      }
    }
    return out
  }, [])

  const allItems = useMemo(() => flatten(menus), [menus, flatten])
  const customerItems = useMemo(() => (customerMenu ? flatten([customerMenu]) : []), [customerMenu, flatten])

  return { menus, customerMenu, allItems, customerItems, loading, error, reload }
}

/** "2026-10-16T18:00" (datetime-local, yerel saat) ↔ ISO */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

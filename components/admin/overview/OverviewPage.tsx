'use client'

import React from 'react'
import { Link } from 'react-router-dom'
import { Building2, Eye, ImageOff, Package, PauseCircle, Plus, QrCode, Users, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AdminOrgRow, AdminStats, AuditLogEntry } from '@/lib/admin-types'
import { ErrorBanner, LoadingBlock, PageHeader, Panel, PanelTitle, StatCard } from '../shared/ui'
import { useAdminQuery } from '../lib/use-admin-query'
import { AuditList } from '../audit/AuditList'
import { fmtDateTime } from '../lib/admin-api'

const n = (v: number | undefined) => (v ?? 0).toLocaleString('tr-TR')

export function OverviewPage() {
  const stats = useAdminQuery<{ stats: AdminStats }>('/api/admin/stats')
  const suspended = useAdminQuery<{ organizations: AdminOrgRow[] }>('/api/admin/organizations?status=suspended&size=8')
  const audit = useAdminQuery<{ entries: AuditLogEntry[] }>('/api/admin/audit?size=10')
  const s = stats.data?.stats

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        description="Platformdaki restoranlar, kullanıcılar, menüler ve katalogun güncel durumu"
        actions={
          <Button asChild>
            <Link to="/admin/restaurants?new=1">
              <Plus className="mr-1.5 h-4 w-4" /> Yeni Restoran
            </Link>
          </Button>
        }
      />

      {stats.error && <ErrorBanner message={stats.error} onRetry={stats.reload} />}
      {stats.loading && !s ? (
        <LoadingBlock />
      ) : s ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Restoranlar"
            icon={Building2}
            value={n(s.organizations)}
            hint={`${n(s.organizations_active)} aktif · ${n(s.organizations_pending)} başvuru · ${n(s.organizations_suspended)} askıda`}
            tone={s.organizations_pending || s.organizations_suspended ? 'warn' : 'good'}
          />
          <StatCard
            label="Kullanıcılar"
            icon={Users}
            value={n(s.users)}
            hint={s.users_banned ? `${n(s.users_banned)} engelli` : 'Engelli kullanıcı yok'}
            tone={s.users_banned ? 'warn' : undefined}
          />
          <StatCard label="Yayındaki Menüler" icon={Utensils} value={n(s.menus_listed)} hint={`${n(s.menus)} menü · ${n(s.items)} ürün`} />
          <StatCard
            label="Menü Görüntüleme (30 gün)"
            icon={Eye}
            value={n(s.views_30d)}
            hint={`${n(s.tables)} QR masa · ${n(s.qr_views)} masa okutması`}
          />
          <StatCard
            label="Katalog Ürünleri"
            icon={Package}
            value={n(s.catalog_items_active)}
            hint={`${n(s.catalog_items)} toplam · ${n(s.catalog_categories)} kategori`}
          />
          <StatCard
            label="Görseli Olmayan Ürün"
            icon={ImageOff}
            value={n(s.catalog_items - s.catalog_items_with_image)}
            hint={
              <Link to="/admin/catalog/items?image=missing" className="underline-offset-2 hover:underline">
                Eksik görselleri tamamla →
              </Link>
            }
            tone={s.catalog_items - s.catalog_items_with_image > 0 ? 'warn' : 'good'}
          />
          <StatCard label="Menü Şablonları" icon={QrCode} value={n(s.templates)} hint="İşletme türlerine göre hazır menüler" />
          <StatCard
            label="Kurulumu Tamamlayan"
            icon={Building2}
            value={n(s.organizations_onboarded)}
            hint={`${n(s.organizations - s.organizations_onboarded)} restoran sihirbazda`}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            actions={
              <Link to="/admin/restaurants?status=suspended" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Tümü →
              </Link>
            }
          >
            Askıdaki Restoranlar
          </PanelTitle>
          {suspended.loading && !suspended.data ? (
            <LoadingBlock />
          ) : suspended.data?.organizations.length ? (
            <ul className="divide-y divide-border/60">
              {suspended.data.organizations.map((o) => (
                <li key={o.id} className="py-2.5">
                  <Link to={`/admin/restaurants/${o.id}`} className="flex items-start justify-between gap-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{o.name}</p>
                      <p className="truncate text-xs text-red-700/80 dark:text-red-300/80">
                        <PauseCircle className="mr-1 inline h-3 w-3" />
                        {o.statusReason || 'Sebep girilmemiş'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(o.statusChangedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Askıya alınmış restoran yok.</p>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            actions={
              <Link to="/admin/audit" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Tümü →
              </Link>
            }
          >
            Son İşlemler
          </PanelTitle>
          {audit.loading && !audit.data ? <LoadingBlock /> : <AuditList entries={audit.data?.entries || []} />}
        </Panel>
      </div>
    </>
  )
}

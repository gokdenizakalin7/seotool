'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Monitor, QrCode, Smartphone, Tablet } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminOrgRow, AdminStats } from '@/lib/admin-types'
import { ErrorBanner, LoadingBlock, PageHeader, Panel, PanelTitle, StatCard } from '../shared/ui'
import { useAdminQuery } from '../lib/use-admin-query'

const n = (v: number | undefined) => (v ?? 0).toLocaleString('tr-TR')
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })

const DEVICE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  mobile: { label: 'Mobil', icon: Smartphone },
  tablet: { label: 'Tablet', icon: Tablet },
  desktop: { label: 'Masaüstü', icon: Monitor },
  unknown: { label: 'Bilinmiyor', icon: Eye },
}

/** Tek seriden sütun grafik: tek renk, ince sütunlar, üzerine gelince değer */
function BarSeries({ data, label }: { data: { key: string; label: string; value: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const active = hover !== null ? data[hover] : null
  return (
    <div>
      <div className="mb-2 h-5 text-xs text-muted-foreground">
        {data.every((d) => !d.value) ? (
          <span>Bu dönemde kayıt yok</span>
        ) : active ? (
          <span>
            <b className="text-foreground">{active.label}</b> · {n(active.value)} {label}
          </span>
        ) : (
          <span>Ayrıntı için sütunların üzerine gelin</span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[2px] border-b border-border/70" onMouseLeave={() => setHover(null)} role="img" aria-label={label}>
        {data.map((d, i) => (
          <div
            key={d.key}
            className="flex h-full flex-1 cursor-default items-end"
            onMouseEnter={() => setHover(i)}
            title={`${d.label}: ${n(d.value)}`}
          >
            <div
              className={`mx-auto w-full max-w-[36px] rounded-t-[4px] transition-opacity ${hover === null || hover === i ? 'bg-primary' : 'bg-primary/40'}`}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const stats = useAdminQuery<{ stats: AdminStats }>('/api/admin/stats')
  const orgs = useAdminQuery<{ organizations: AdminOrgRow[] }>('/api/admin/organizations?size=200')
  const s = stats.data?.stats

  const daily = useMemo(
    () => (s?.views_daily || []).map((d) => ({ key: d.day, label: dayFmt.format(new Date(d.day)), value: Number(d.count) })),
    [s]
  )
  // Son 12 hafta, kayıt olmayan haftalar 0 (SQL yalnızca kayıt olan haftaları döner; hafta başı Pazartesi, UTC)
  const weekly = useMemo(() => {
    const byWeek = new Map((s?.signups_weekly || []).map((d) => [String(d.week).slice(0, 10), Number(d.count)]))
    const now = new Date()
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)))
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(monday.getTime() - (11 - i) * 7 * 86400_000)
      const key = d.toISOString().slice(0, 10)
      return { key, label: `${dayFmt.format(d)} haftası`, value: byWeek.get(key) || 0 }
    })
  }, [s])
  const devices = useMemo(() => {
    const entries = Object.entries(s?.views_by_device || {}).map(([k, v]) => [k, Number(v)] as const)
    const total = entries.reduce((a, [, v]) => a + v, 0)
    return entries.sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, value: v, pct: total ? Math.round((v / total) * 100) : 0 }))
  }, [s])
  const top = useMemo(
    () => [...(orgs.data?.organizations || [])].sort((a, b) => b.views30d - a.views30d || b.qrViews - a.qrViews).slice(0, 15),
    [orgs.data]
  )

  return (
    <>
      <PageHeader title="Analitik" description="Müşteri menüsü görüntülemeleri, cihazlar ve yeni kayıtlar (son 30 gün)" />
      {stats.error && <ErrorBanner message={stats.error} onRetry={stats.reload} />}
      {stats.loading && !s ? (
        <LoadingBlock />
      ) : s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Menü görüntüleme (30 gün)" icon={Eye} value={n(s.views_30d)} hint="Aynı ziyaretçi 30 dakikada bir sayılır" />
            <StatCard label="QR masa okutması (toplam)" icon={QrCode} value={n(s.qr_views)} hint={`${n(s.tables)} QR masa`} />
            <StatCard label="Yayındaki menü" icon={Eye} value={n(s.menus_listed)} hint={`${n(s.organizations_active)} aktif restoran`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Panel>
              <PanelTitle>Günlük menü görüntüleme</PanelTitle>
              <BarSeries data={daily} label="görüntüleme" />
            </Panel>
            <Panel>
              <PanelTitle>Cihaz dağılımı</PanelTitle>
              {devices.length ? (
                <ul className="space-y-3">
                  {devices.map((d) => {
                    const meta = DEVICE_LABELS[d.key] || DEVICE_LABELS.unknown
                    return (
                      <li key={d.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <meta.icon className="h-4 w-4 text-muted-foreground" /> {meta.label}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            %{d.pct} · {n(d.value)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${d.pct}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Son 30 günde kayıtlı görüntüleme yok.</p>
              )}
            </Panel>
          </div>

          <Panel>
            <PanelTitle>Haftalık yeni restoran (son 12 hafta)</PanelTitle>
            <BarSeries data={weekly} label="yeni restoran" />
          </Panel>
        </>
      ) : null}

      <Panel className="p-0 sm:p-0">
        <div className="p-5 pb-2">
          <h2 className="text-base font-bold">En çok görüntülenen restoranlar</h2>
        </div>
        {orgs.loading && !orgs.data ? (
          <LoadingBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Restoran</TableHead>
                <TableHead className="text-right">Görüntüleme (30 gün)</TableHead>
                <TableHead className="text-right">QR okutma (toplam)</TableHead>
                <TableHead className="text-right">Masa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link to={`/admin/restaurants/${o.id}`} className="font-medium hover:underline">
                      {o.name}
                    </Link>
                    {o.status === 'suspended' && <span className="ml-2 text-xs text-red-600">askıda</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{n(o.views30d)}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(o.qrViews)}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(o.tableCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, ExternalLink, LogIn, PauseCircle, PlayCircle, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminOrgRow } from '@/lib/admin-types'
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  OrgStatusBadge,
  PageHeader,
  Pager,
  Panel,
  SuspendDialog,
  Tabs,
  useDebounced,
} from '../shared/ui'
import { adminApi, errorMessage, fmtDate, fmtRelative, isBanned, qs } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { startImpersonation } from '../lib/impersonate'
import { CreateRestaurantDialog } from './CreateRestaurantDialog'
import { sitePath } from '@/lib/site-url'

type StatusFilter = 'all' | 'active' | 'suspended'

interface ListResponse {
  organizations: AdminOrgRow[]
  total: number
  page: number
  size: number
  counts: { all: number; active: number; suspended: number }
}

export function RestaurantsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebounced(search)
  const status = (params.get('status') as StatusFilter) || 'all'
  const page = Number(params.get('page')) || 1
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1')
  const [suspendTarget, setSuspendTarget] = useState<AdminOrgRow | null>(null)

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if ((params.get('q') || '') !== q) update({ q: q || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const list = useAdminQuery<ListResponse>(
    `/api/admin/organizations${qs({ q, status: status === 'all' ? null : status, page, size: 50 })}`
  )

  const setStatus = async (org: AdminOrgRow, next: 'active' | 'suspended', reason = '') => {
    try {
      await adminApi(`/api/admin/organizations/${org.id}/status`, { method: 'PATCH', body: { status: next, reason } })
      toast.success(next === 'suspended' ? `"${org.name}" askıya alındı.` : `"${org.name}" aktifleştirildi.`)
      setSuspendTarget(null)
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const counts = list.data?.counts

  return (
    <>
      <PageHeader
        title="Restoranlar"
        description="Restoran hesapları, sahipleri, hesap durumları ve menüleri"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Restoran
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<StatusFilter>
          value={status}
          onChange={(v) => update({ status: v === 'all' ? null : v, page: null })}
          tabs={[
            { id: 'all', label: `Tümü${counts ? ` (${counts.all})` : ''}` },
            { id: 'active', label: `Aktif${counts ? ` (${counts.active})` : ''}` },
            { id: 'suspended', label: `Askıda${counts ? ` (${counts.suspended})` : ''}` },
          ]}
        />
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ad, subdomain, yetkili, e-posta, telefon…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}

      <Panel className="p-0 sm:p-0">
        {list.loading && !list.data ? (
          <LoadingBlock />
        ) : !list.data?.organizations.length ? (
          <EmptyState icon={Building2} title="Restoran bulunamadı" hint={q ? 'Aramayı değiştirmeyi deneyin.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Restoran</TableHead>
                  <TableHead>Sahip</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Menü / Ürün</TableHead>
                  <TableHead>Son giriş</TableHead>
                  <TableHead>Kayıt</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.organizations.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/admin/restaurants/${o.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {o.logoUrl ? (
                          <img src={o.logoUrl} alt="" className="h-9 w-9 rounded-xl border border-border/60 bg-white object-contain" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted text-xs font-bold">
                            {o.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{o.name}</p>
                          <a
                            href={sitePath(o.subdomain)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            /{o.subdomain} <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {o.owner ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.ownerName || '—'}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">{o.owner.email}</p>
                          {o.owner.isSuperAdmin && (
                            <Badge tone="blue" className="mt-1" title="Süper admin hesabına bağlı restoran (kayıt tetikleyicisi oluşturur)">
                              Sistem yöneticisi
                            </Badge>
                          )}
                          {isBanned(o.owner.bannedUntil) && (
                            <Badge tone="red" className="mt-1">
                              Giriş engelli
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge tone="amber" title="Bu restorana bağlı kullanıcı yok; detaydan üye ekleyin">
                          Sahipsiz
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <OrgStatusBadge status={o.status} reason={o.statusReason} changedAt={o.statusChangedAt} />
                      {!o.onboardingCompleted && (
                        <Badge tone="blue" className="mt-1">
                          Kurulumda
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {o.listedMenuCount}/{o.menuCount} · {o.itemCount}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtRelative(o.owner?.lastSignInAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Bu restoranın paneline gir"
                          onClick={() => startImpersonation(o.id, navigate).catch((e) => toast.error(errorMessage(e)))}
                        >
                          <LogIn className="mr-1 h-3.5 w-3.5" /> Panele Gir
                        </Button>
                        {o.status === 'active' ? (
                          <Button size="sm" variant="ghost" title="Askıya al" className="text-red-600 hover:bg-red-500/10" onClick={() => setSuspendTarget(o)}>
                            <PauseCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" title="Aktifleştir" className="text-green-600 hover:bg-green-500/10" onClick={() => setStatus(o, 'active')}>
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {list.data && (
          <div className="px-4 pb-3">
            <Pager page={page} size={list.data.size} total={list.data.total} onPage={(p) => update({ page: String(p) })} />
          </div>
        )}
      </Panel>

      <CreateRestaurantDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v)
          if (!v && params.get('new')) update({ new: null })
        }}
        onCreated={() => list.reload()}
      />

      {suspendTarget && (
        <SuspendDialog
          open
          onOpenChange={(v) => !v && setSuspendTarget(null)}
          orgName={suspendTarget.name}
          onSubmit={(reason) => setStatus(suspendTarget, 'suspended', reason)}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Menü / Ürün: yayındaki menü / toplam menü · ürün sayısı. Detay için satıra tıklayın.{' '}
        <Link to="/admin/users" className="underline-offset-2 hover:underline">
          Tüm kullanıcılar →
        </Link>
      </p>
    </>
  )
}

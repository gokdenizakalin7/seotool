'use client'

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MEMBER_ROLE_LABELS, type AdminUserRow } from '@/lib/admin-types'
import { Badge, EmptyState, ErrorBanner, LoadingBlock, PageHeader, Pager, Panel, Tabs, useDebounced } from '../shared/ui'
import { fmtDate, fmtRelative, isBanned, qs } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { UserEditDialog, type EditableUser } from './UserEditDialog'
import { CreateUserDialog } from './CreateUserDialog'

type Filter = 'all' | 'banned' | 'orphan'

interface ListResponse {
  users: AdminUserRow[]
  total: number
  size: number
  counts: { all: number; banned: number; orphan: number }
}

export function UsersPage() {
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState<EditableUser | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const list = useAdminQuery<ListResponse>(`/api/admin/users${qs({ q, filter: filter === 'all' ? null : filter, page, size: 50 })}`)
  const counts = list.data?.counts

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Panele giriş yapabilen tüm hesaplar: e-posta, şifre, giriş engeli ve restoran üyelikleri"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni kullanıcı
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<Filter>
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          tabs={[
            { id: 'all', label: `Tümü${counts ? ` (${counts.all})` : ''}` },
            { id: 'banned', label: `Engelli${counts ? ` (${counts.banned})` : ''}` },
            { id: 'orphan', label: `Restoransız${counts ? ` (${counts.orphan})` : ''}` },
          ]}
        />
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="E-posta, ad veya restoran…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}

      <Panel className="p-0 sm:p-0">
        {list.loading && !list.data ? (
          <LoadingBlock />
        ) : !list.data?.users.length ? (
          <EmptyState icon={Users} title="Kullanıcı bulunamadı" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Restoran</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="hidden lg:table-cell">Son giriş</TableHead>
                  <TableHead className="hidden lg:table-cell">Kayıt</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="flex items-center gap-1.5 font-medium">
                        {u.ownerName || '—'}
                        {u.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 text-blue-600" aria-label="Sistem yöneticisi" />}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      {u.memberships.length ? (
                        <div className="space-y-0.5">
                          {u.memberships.map((m) => (
                            <Link key={m.organizationId} to={`/admin/restaurants/${m.organizationId}`} className="block text-sm hover:underline">
                              {m.name}{' '}
                              <span className="text-xs text-muted-foreground">
                                · {MEMBER_ROLE_LABELS[m.role] || m.role}
                                {m.status === 'suspended' && ' · askıda'}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{u.isSuperAdmin ? 'Sistem yöneticisi' : 'Restoransız'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {isBanned(u.bannedUntil) ? <Badge tone="red">Giriş engelli</Badge> : <Badge tone="green">Giriş açık</Badge>}
                        {u.mustChangePassword && <Badge tone="amber">Şifre değiştirmeli</Badge>}
                        {!u.emailConfirmedAt && <Badge tone="neutral">E-posta onaysız</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{fmtRelative(u.lastSignInAt)}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{fmtDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEdit({
                            id: u.id,
                            email: u.email,
                            ownerName: u.ownerName,
                            mustChangePassword: u.mustChangePassword,
                            bannedUntil: u.bannedUntil,
                            lastSignInAt: u.lastSignInAt,
                            isRootAdmin: u.isRootAdmin,
                          })
                        }
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {list.data && (
          <div className="px-4 pb-3">
            <Pager page={page} size={list.data.size} total={list.data.total} onPage={setPage} />
          </div>
        )}
      </Panel>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={list.reload} />
      <UserEditDialog user={edit} onOpenChange={(v) => !v && setEdit(null)} onChanged={list.reload} />
    </>
  )
}

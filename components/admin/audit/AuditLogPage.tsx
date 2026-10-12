'use client'

import React, { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { AuditLogEntry } from '@/lib/admin-types'
import { ErrorBanner, LoadingBlock, NativeSelect, PageHeader, Pager, Panel, useDebounced } from '../shared/ui'
import { qs } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'
import { AuditList } from './AuditList'

const TARGETS = [
  ['', 'Tüm kayıtlar'],
  ['organization', 'Restoranlar'],
  ['user', 'Kullanıcılar'],
  ['catalog_category', 'Katalog kategorileri'],
  ['catalog_item', 'Katalog ürünleri'],
  ['business_type', 'İşletme türleri'],
  ['template', 'Şablonlar'],
  ['settings', 'Ayarlar'],
] as const

export function AuditLogPage() {
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [targetType, setTargetType] = useState('')
  const [page, setPage] = useState(1)
  const list = useAdminQuery<{ entries: AuditLogEntry[]; total: number; size: number }>(
    `/api/admin/audit${qs({ q, targetType, page, size: 50 })}`
  )

  return (
    <>
      <PageHeader title="İşlem Geçmişi" description="Admin panelinden yapılan her değişiklik: ne, kim, ne zaman ve neden" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Restoran/ürün adı, admin e-postası veya sebep…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <NativeSelect
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value)
            setPage(1)
          }}
          className="sm:w-56"
        >
          {TARGETS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}
      <Panel>
        {list.loading && !list.data ? <LoadingBlock /> : <AuditList entries={list.data?.entries || []} />}
        {list.data && <Pager page={page} size={list.data.size} total={list.data.total} onPage={setPage} />}
      </Panel>
    </>
  )
}

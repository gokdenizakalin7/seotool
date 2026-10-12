'use client'

import React from 'react'
import type { AuditLogEntry } from '@/lib/admin-types'
import { AUDIT_ACTION_LABELS, fmtDateTime } from '../lib/admin-api'

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Evet' : 'Hayır'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

/** Denetim kayıtları: ne, kim, ne zaman, sebep ve değişen alanlar */
export function AuditList({ entries, showTarget = true }: { entries: AuditLogEntry[]; showTarget?: boolean }) {
  if (!entries.length) return <p className="py-6 text-center text-sm text-muted-foreground">Henüz kayıt yok.</p>
  return (
    <ul className="divide-y divide-border/60">
      {entries.map((e) => {
        const keys = Array.from(new Set([...Object.keys(e.after || {}), ...Object.keys(e.before || {})]))
        return (
          <li key={e.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-semibold text-foreground">
                {AUDIT_ACTION_LABELS[e.action] || e.action}
                {showTarget && e.targetLabel && <span className="font-normal text-muted-foreground"> · {e.targetLabel}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmtDateTime(e.createdAt)} · {e.actorEmail || 'sistem'}
              </span>
            </div>
            {e.reason && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sebep: {e.reason}</p>}
            {keys.length > 0 && (
              <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {keys.slice(0, 8).map((k) => (
                  <div key={k} className="font-mono">
                    <span className="text-foreground/70">{k}</span>:{' '}
                    {e.before && k in e.before && <span className="line-through opacity-70">{formatValue(e.before[k])}</span>}
                    {e.before && k in e.before && e.after && k in e.after && ' → '}
                    {e.after && k in e.after && <span>{formatValue(e.after[k])}</span>}
                  </div>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

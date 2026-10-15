'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, EyeOff, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Repeat, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog, Field, Switch } from '@/components/admin/shared/ui'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { compressImageFile, IMAGE_PRESETS } from '@/lib/image-compression'
import {
  endFromInputs,
  eventOccurrences,
  formatEventDay,
  formatEventTime,
  fromIstanbulInput,
  toIstanbulInput,
  type SiteEvent,
} from '@/lib/events'
import { cn } from '@/lib/utils'
import { MigrationNotice, SiteApiError, SitePageShell, siteApi } from './shared'

interface Draft {
  id?: string
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  repeatWeekly: boolean
  repeatUntil: string
  posterUrl: string | null
  isPublished: boolean
}

function todayIstanbul(): string {
  return toIstanbulInput(new Date().toISOString()).date
}

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  date: todayIstanbul(),
  startTime: '21:00',
  endTime: '',
  repeatWeekly: false,
  repeatUntil: '',
  posterUrl: null,
  isPublished: true,
})

function draftFromEvent(e: SiteEvent): Draft {
  const start = toIstanbulInput(e.startsAt)
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    date: start.date,
    startTime: start.time,
    endTime: e.endsAt ? toIstanbulInput(e.endsAt).time : '',
    repeatWeekly: e.repeatWeekly,
    repeatUntil: e.repeatUntil || '',
    posterUrl: e.posterUrl,
    isPublished: e.isPublished,
  }
}

export function EventsContent() {
  const { restaurant, isSuspended } = useRestaurant()
  const subdomain = restaurant?.subdomain || ''
  const [events, setEvents] = useState<SiteEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SiteEvent | null>(null)

  const load = useCallback(async () => {
    if (!subdomain) return
    setLoading(true)
    setError(null)
    try {
      const data = await siteApi<{ events: SiteEvent[] }>(`/api/site/events?subdomain=${encodeURIComponent(subdomain)}`)
      setEvents(data.events || [])
    } catch (e: any) {
      if (e instanceof SiteApiError && e.code === 'MIGRATION_REQUIRED') setMigrationMissing(true)
      else setError(e?.message || 'Etkinlikler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    load()
  }, [load])

  // Yaklaşan: bitmemiş bir oturumu olan (taslaklar dahil); geçmiş: tamamen bitmiş
  const { upcoming, past } = useMemo(() => {
    const now = new Date()
    const rows = events.map((e) => ({ event: e, next: eventOccurrences([{ ...e, isPublished: true }], now, 400, 1)[0] || null }))
    return {
      upcoming: rows.filter((r) => r.next).sort((a, b) => a.next!.start.localeCompare(b.next!.start)),
      past: rows.filter((r) => !r.next).sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt)),
    }
  }, [events])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await siteApi(`/api/site/events/${deleteTarget.id}?subdomain=${encodeURIComponent(subdomain)}`, { method: 'DELETE' })
      toast.success('Etkinlik silindi.')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const renderRow = ({ event, next }: { event: SiteEvent; next: { start: string; end: string; isNow: boolean } | null }) => {
    const when = next || { start: event.startsAt, end: event.endsAt || event.startsAt, isNow: false }
    return (
      <div key={event.id} className={cn('glass-card flex gap-4 p-4', !event.isPublished && 'opacity-70')}>
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {event.posterUrl ? (
            <img src={event.posterUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <CalendarDays className="h-7 w-7" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate font-bold text-foreground">{event.title}</h3>
          <p className="text-sm text-muted-foreground">
            {formatEventDay(when.start)} · {formatEventTime(when.start)}
            {event.endsAt && `–${formatEventTime(when.end)}`}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {when.isNow && <span className="rounded-full bg-red-500 px-2 py-0.5 text-white">Şu an sürüyor</span>}
            {event.repeatWeekly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                <Repeat className="h-3 w-3" /> Her hafta{event.repeatUntil && ` · ${event.repeatUntil.split('-').reverse().join('.')} tarihine kadar`}
              </span>
            )}
            {!event.isPublished && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                <EyeOff className="h-3 w-3" /> Yayında değil
              </span>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setEditing(draftFromEvent(event))} disabled={isSuspended}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Düzenle
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(event)} disabled={isSuspended}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Sil
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SitePageShell
      title="Etkinlikler"
      description="Canlı müzik, maç yayını, quiz gecesi… Sitenizin Etkinlikler sekmesinde ve o gün menünün üstünde duyurulur."
      subdomain={subdomain}
      page="etkinlikler"
      actions={
        !migrationMissing && (
          <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended || loading}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Etkinlik
          </Button>
        )
      }
    >
      {migrationMissing ? (
        <MigrationNotice />
      ) : error ? (
        <div className="glass-card border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tekrar dene
          </Button>
        </div>
      ) : loading && events.length === 0 ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      ) : events.length === 0 ? (
        <div className="glass-card border-dashed p-10 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-lg font-semibold text-foreground">Henüz etkinlik yok</h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            İlk etkinliğinizi ekleyin; haftalık tekrarlananlar (ör. her cuma canlı müzik) otomatik olarak takvimde görünür.
          </p>
          <Button onClick={() => setEditing(emptyDraft())} disabled={isSuspended}>
            <Plus className="mr-2 h-4 w-4" /> İlk Etkinliği Ekle
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Yaklaşan</h2>
            {upcoming.length ? <div className="grid gap-4 md:grid-cols-2">{upcoming.map(renderRow)}</div> : <p className="text-sm text-muted-foreground">Yaklaşan etkinlik yok.</p>}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Geçmiş</h2>
              <div className="grid gap-4 md:grid-cols-2">{past.map(renderRow)}</div>
            </section>
          )}
        </div>
      )}

      {editing && (
        <EventEditor
          draft={editing}
          subdomain={subdomain}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Etkinlik silinsin mi?"
        description={`"${deleteTarget?.title}" ve afişi kalıcı olarak silinecek.`}
        confirmLabel="Sil"
        destructive
        onConfirm={handleDelete}
      />
    </SitePageShell>
  )
}

function EventEditor({
  draft: initial,
  subdomain,
  onClose,
  onSaved,
}: {
  draft: Draft
  subdomain: string
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const uploadPoster = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImageFile(file, IMAGE_PRESETS.MENU_COVER)
      const data = await siteApi<{ url: string }>('/api/site/events/poster', {
        method: 'POST',
        json: { subdomain, dataUrl: compressed.dataUrl },
      })
      update({ posterUrl: data.url })
    } catch (e: any) {
      toast.error(e?.message || 'Afiş yüklenemedi.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (draft.title.trim().length < 2) return toast.error('Etkinlik adı en az 2 karakter olmalı.')
    if (!draft.date || !draft.startTime) return toast.error('Tarih ve başlangıç saatini girin.')
    if (draft.endTime && draft.endTime === draft.startTime) return toast.error('Bitiş saati başlangıçla aynı olamaz.')
    setSaving(true)
    try {
      await siteApi(draft.id ? `/api/site/events/${draft.id}` : '/api/site/events', {
        method: draft.id ? 'PATCH' : 'POST',
        json: {
          subdomain,
          title: draft.title,
          description: draft.description,
          startsAt: fromIstanbulInput(draft.date, draft.startTime),
          endsAt: draft.endTime ? endFromInputs(draft.date, draft.startTime, draft.endTime) : null,
          repeatWeekly: draft.repeatWeekly,
          repeatUntil: draft.repeatWeekly && draft.repeatUntil ? draft.repeatUntil : null,
          posterUrl: draft.posterUrl,
          isPublished: draft.isPublished,
        },
      })
      toast.success('Etkinlik kaydedildi.')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const crossesMidnight = draft.endTime && draft.endTime < draft.startTime

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && !uploading && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? 'Etkinliği düzenle' : 'Yeni etkinlik'}</DialogTitle>
          <DialogDescription>Saatler İstanbul saatine göredir.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Etkinlik adı">
            <Input value={draft.title} maxLength={120} placeholder="Canlı Müzik: Akustik Gece" onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Açıklama (isteğe bağlı)">
            <Textarea
              value={draft.description}
              maxLength={1000}
              rows={3}
              placeholder="Sanatçı, program, rezervasyon bilgisi…"
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tarih">
              <Input type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} />
            </Field>
            <Field label="Başlangıç">
              <Input type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })} />
            </Field>
            <Field label="Bitiş (isteğe bağlı)" hint={crossesMidnight ? 'Ertesi gün biter' : 'Boşsa 4 saat sayılır'}>
              <Input type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Her hafta tekrarla</p>
                <p className="text-xs text-muted-foreground">Aynı gün ve saatte her hafta sitede görünür.</p>
              </div>
              <Switch checked={draft.repeatWeekly} onChange={(v) => update({ repeatWeekly: v })} label="Her hafta tekrarla" />
            </div>
            {draft.repeatWeekly && (
              <Field label="Son tarih (isteğe bağlı)">
                <Input type="date" value={draft.repeatUntil} min={draft.date} onChange={(e) => update({ repeatUntil: e.target.value })} />
              </Field>
            )}
          </div>

          <Field label="Afiş (isteğe bağlı)" group>
            <div className="flex items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-xl bg-muted">
                {draft.posterUrl ? (
                  <img src={draft.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />}
                  {draft.posterUrl ? 'Değiştir' : 'Afiş yükle'}
                </Button>
                {draft.posterUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => update({ posterUrl: null })}>
                    Kaldır
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) uploadPoster(file)
                }}
              />
            </div>
          </Field>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Sitede yayınla</p>
              <p className="text-xs text-muted-foreground">Kapalıyken taslak olarak saklanır.</p>
            </div>
            <Switch checked={draft.isPublished} onChange={(v) => update({ isPublished: v })} label="Sitede yayınla" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

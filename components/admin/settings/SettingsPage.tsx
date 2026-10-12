'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ErrorBanner, Field, LoadingBlock, PageHeader, Panel, PanelTitle, Spinner, Switch } from '../shared/ui'
import { adminApi, errorMessage } from '../lib/admin-api'
import { useAdminQuery } from '../lib/use-admin-query'

interface Settings {
  signup_enabled: boolean
  image_gen_org_daily_cap: number
  image_gen_daily_cap: number
  suspended_menu_message: string
}

export function SettingsPage() {
  const q = useAdminQuery<{ settings: Settings }>('/api/admin/settings')
  const [f, setF] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.data) setF(q.data.settings)
  }, [q.data])

  if (q.error) return <ErrorBanner message={q.error} onRetry={q.reload} />
  if (!f || !q.data) return <LoadingBlock />

  const initial = q.data.settings
  const changed = (Object.keys(f) as (keyof Settings)[]).filter((k) => f[k] !== initial[k])

  const save = async () => {
    setBusy(true)
    try {
      const body = Object.fromEntries(changed.map((k) => [k, f[k]]))
      const res = await adminApi<{ settings: Settings }>('/api/admin/settings', { method: 'PATCH', body })
      q.setData({ settings: res.settings })
      toast.success('Ayarlar kaydedildi.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Platform Ayarları" description="Tüm restoranları etkileyen ayarlar. Değişiklikler en geç 1 dakika içinde geçerli olur." />

      <Panel>
        <PanelTitle>Kayıt</PanelTitle>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-semibold">Herkese açık kayıt</span>
            <span className="block text-xs text-muted-foreground">
              Kapalıyken /signup sayfasından yeni hesap açılamaz; restoranları yalnızca bu panelden oluşturabilirsiniz.
            </span>
          </span>
          <Switch checked={f.signup_enabled} onChange={(v) => setF({ ...f, signup_enabled: v })} />
        </label>
      </Panel>

      <Panel>
        <PanelTitle>AI ürün görseli kotası (günlük)</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Restoran başına" hint="Bir restoranın günde üretebileceği görsel sayısı">
            <Input
              type="number"
              min={0}
              value={f.image_gen_org_daily_cap}
              onChange={(e) => setF({ ...f, image_gen_org_daily_cap: Number(e.target.value) })}
            />
          </Field>
          <Field label="Platform toplamı" hint="Cloudflare ücretsiz havuzu ~380 görsel/gün (512px)">
            <Input type="number" min={0} value={f.image_gen_daily_cap} onChange={(e) => setF({ ...f, image_gen_daily_cap: Number(e.target.value) })} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Askıdaki restoranlar</PanelTitle>
        <Field label="Müşteri menüsünde gösterilen mesaj">
          <Textarea
            value={f.suspended_menu_message}
            onChange={(e) => setF({ ...f, suspended_menu_message: e.target.value })}
            rows={2}
            maxLength={300}
          />
        </Field>
      </Panel>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={!changed.length || busy} onClick={() => setF(initial)}>
          Geri al
        </Button>
        <Button disabled={!changed.length || busy} onClick={save}>
          {busy && <Spinner className="mr-1.5" />}
          Kaydet
        </Button>
      </div>
    </>
  )
}

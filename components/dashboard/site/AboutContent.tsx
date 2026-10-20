'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Info, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/admin/shared/ui'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { useBusinessTypes } from '@/lib/use-business-types'
import { buildAboutTemplate } from '@/lib/about-template'
import { UnsavedChangesDialog, useUnsavedChanges } from '@/components/dashboard/unsaved-changes'
import { SitePageShell, siteApi, useOrgMenus } from './shared'

const MAX = 2000
type Source = 'ai' | 'manual' | 'template'

export function AboutContent() {
  const { restaurant, save, isSuspended } = useRestaurant()
  const subdomain = restaurant?.subdomain || ''
  const saved = restaurant?.about?.text || ''
  const [text, setText] = useState(saved)
  const [source, setSource] = useState<Source>((restaurant?.about?.source as Source) || 'manual')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState<{ text: string; source: Source } | null>(null)
  const { get: getBusinessType } = useBusinessTypes()
  const org = useOrgMenus(subdomain)

  // Restoran sonradan yüklenirse / başka yerden güncellenirse
  useEffect(() => {
    setText(restaurant?.about?.text || '')
    setSource((restaurant?.about?.source as Source) || 'manual')
  }, [restaurant?.about?.text, restaurant?.about?.source])

  // Metin boşken sitede gösterilecek otomatik metin
  const templateText = useMemo(() => {
    if (!restaurant) return ''
    const cats = org.customerMenu?.categories || []
    return buildAboutTemplate({
      name: restaurant.name,
      businessType: restaurant.businessType,
      typeLabel: getBusinessType(restaurant.businessType || '')?.label,
      city: restaurant.businessInfo?.city,
      categories: cats.filter((c) => !c.parent_id && c.is_active && c.items?.length).map((c) => c.name),
      featured: cats.flatMap((c) => c.items || []).filter((i) => i.is_featured).map((i) => i.name),
    })
  }, [restaurant, org.customerMenu, getBusinessType])

  const dirty = text.trim() !== saved.trim()
  // Kaydedilmemiş metin varken sayfadan ayrılma uyarısı
  const guard = useUnsavedChanges(dirty && !isSuspended)

  const generate = async () => {
    setGenerating(true)
    try {
      const data = await siteApi<{ text: string; source: Source }>('/api/site/about/generate', { method: 'POST', json: { subdomain } })
      if (data.source === 'template') toast.message('Yapay zekâ şu an kullanılamıyor; işletme bilgilerinizden bir metin hazırlandı.')
      if (text.trim()) setConfirmReplace(data)
      else {
        setText(data.text)
        setSource(data.source)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      await save({ aboutText: text.trim(), aboutSource: text.trim() ? source : undefined })
      toast.success(text.trim() ? 'Hakkımızda metni kaydedildi.' : 'Sitede otomatik metin gösterilecek.')
      return true
    } catch (e: any) {
      toast.error(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <SitePageShell
      title="Hakkımızda"
      description="Sitenizin Hakkımızda sekmesi. İşletme türünüz ve menünüzden otomatik oluşturulur; dilediğiniz gibi değiştirebilirsiniz."
      subdomain={subdomain}
      page="hakkimizda"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">İşletmenizi anlatın</CardTitle>
              <CardDescription>Kısa ve samimi tutun: neyi en iyi yaptığınız, atmosferiniz, sizi farklı kılan.</CardDescription>
            </div>
            <Button variant="outline" onClick={generate} disabled={generating || isSuspended}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              AI ile oluştur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            rows={9}
            maxLength={MAX}
            placeholder={templateText}
            onChange={(e) => {
              setText(e.target.value)
              setSource('manual')
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {text.length}/{MAX}
              {text.trim() && source === 'ai' && ' · Yapay zekâ ile oluşturuldu'}
            </span>
            {saved && (
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setText('')}>
                <RotateCcw className="h-3.5 w-3.5" /> Otomatik metne dön
              </button>
            )}
          </div>

          {!text.trim() && (
            <div className="flex gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Boş bırakırsanız sitede şu metin görünür:</p>
                <p className="mt-1 whitespace-pre-line">{templateText}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || isSuspended || !dirty}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>

      <UnsavedChangesDialog
        open={guard.open}
        saving={saving}
        onStay={guard.stay}
        onDiscard={() => {
          setText(saved)
          guard.leave()
        }}
        onSave={async () => {
          if (await handleSave()) guard.leave()
        }}
      />

      <ConfirmDialog
        open={!!confirmReplace}
        onOpenChange={(v) => !v && setConfirmReplace(null)}
        title="Mevcut metin değiştirilsin mi?"
        description="Yazdığınız metnin yerine yeni oluşturulan metin konacak. Kaydetmeden önce düzenleyebilirsiniz."
        confirmLabel="Değiştir"
        onConfirm={() => {
          if (confirmReplace) {
            setText(confirmReplace.text)
            setSource(confirmReplace.source)
          }
          setConfirmReplace(null)
        }}
      />
    </SitePageShell>
  )
}

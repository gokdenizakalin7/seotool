'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { confirmLeave, setLeaveGuard } from '@/lib/leave-guard'
import { motion } from 'framer-motion'
import { Check, Store, Wifi, Palette, KeyRound, Share2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { SLUG_RE, isReservedSlug } from '@/lib/site-url'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import {
  BasicsSection,
  BrandSection,
  ContactSection,
  SiteAddressSection,
  SocialSection,
  WifiSection,
  draftFromRestaurant,
  draftToPatch,
  CONTACT_EXTRA_KEYS,
  type ProfileDraft,
  type SectionKey,
} from '@/components/onboarding/profile-sections'

type TabId = 'isletme' | 'sosyal' | 'wifi' | 'marka' | 'sifre'
const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'isletme', label: 'İşletme & Adres', icon: Store },
  { id: 'sosyal', label: 'Sosyal & İletişim', icon: Share2 },
  { id: 'wifi', label: 'Wi-Fi & Misafir Bilgisi', icon: Wifi },
  { id: 'marka', label: 'Logo & Tema', icon: Palette },
  { id: 'sifre', label: 'Giriş Şifresi', icon: KeyRound },
]

export function SettingsContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId) || 'isletme'
  const [activeTab, setActiveTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? initialTab : 'isletme')

  const { restaurant, save, role } = useRestaurant()
  const canEditSlug = role === 'superadmin'
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromRestaurant(restaurant))
  const [isSaving, setIsSaving] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(restaurant?.id ?? null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Restoran sonradan yüklenirse taslağı bir kez doldur
  useEffect(() => {
    if (restaurant && loadedFor !== restaurant.id) {
      setDraft(draftFromRestaurant(restaurant))
      setLoadedFor(restaurant.id)
    }
  }, [restaurant, loadedFor])

  // Restoran başka yerden güncellenirse (ör. logodan alınan renk) kullanıcının dokunmadığı alanlar da güncellensin;
  // yoksa Kaydet eski değeri geri yazar
  const baseline = useMemo(() => draftFromRestaurant(restaurant), [restaurant])
  const prevBaselineRef = useRef(baseline)
  useEffect(() => {
    const prev = prevBaselineRef.current
    prevBaselineRef.current = baseline
    setDraft((d) => {
      const next = { ...d }
      for (const k of Object.keys(baseline) as (keyof ProfileDraft)[]) {
        if (d[k] === prev[k]) next[k] = baseline[k]
      }
      return next
    })
  }, [baseline])

  const isDirty = !!restaurant && loadedFor === restaurant.id &&
    (Object.keys(baseline) as (keyof ProfileDraft)[]).some((k) => draft[k] !== baseline[k])

  // Kaydedilmemiş değişiklik varken sekmeyi kapatma ve sol menüden ayrılma uyarısı
  useEffect(() => {
    if (!isDirty) return
    setLeaveGuard('Kaydedilmemiş değişiklikleriniz var. Kaydetmeden çıkılsın mı?')
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClickCapture = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) return
      if (!confirmLeave(href)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClickCapture, true)
    return () => {
      setLeaveGuard(null)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [isDirty])

  const selectTab = (id: TabId) => {
    setActiveTab(id)
    setSearchParams({ tab: id }, { replace: true })
  }

  const handleSave = async () => {
    if (!restaurant) return
    if (draft.name.trim().length < 2) {
      toast.error('İşletme adı en az 2 karakter olmalı.')
      return
    }
    setIsSaving(true)
    try {
      // Site iletişim alanları yalnızca değiştiyse gönderilir (migration 15 uygulanmamışsa diğer ayarlar yine kaydedilsin)
      const sections: SectionKey[] = ['basics', 'brand', 'contact', 'wifi', 'social']
      if (CONTACT_EXTRA_KEYS.some((k) => draft[k] !== baseline[k])) sections.push('contactExtra')
      if (canEditSlug && draft.siteSlug !== baseline.siteSlug) {
        const slug = draft.siteSlug.replace(/-+$/, '')
        if (slug.length < 2 || !SLUG_RE.test(slug)) {
          toast.error('Site adresi en az 2 karakter olmalı; yalnızca küçük harf, rakam ve tire.')
          return
        }
        if (isReservedSlug(slug)) {
          toast.error('Bu ad sistem sayfalarına ayrılmış; başka bir site adresi seçin.')
          return
        }
        sections.push('siteAddress')
      }
      const next = await save(draftToPatch(draft, sections))
      setDraft(draftFromRestaurant(next))
      toast.success('Ayarlar kaydedildi.')
    } catch (e: any) {
      toast.error(e?.message || 'Kaydedilirken hata oluştu.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error('Şifre en az 8 karakter olmalı.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor.')
      return
    }
    setIsChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsChangingPassword(false)
    if (error) {
      toast.error('Şifre güncellenemedi. Lütfen tekrar giriş yapıp deneyin.')
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Şifreniz güncellendi.')
  }

  if (!restaurant) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
      data-tour-page="settings"
      data-tour-ready="true"
    >
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Restoran Ayarları</h1>
        <p className="text-sm text-muted-foreground">İşletme bilgilerinizi, logonuzu, Wi-Fi, sosyal medya ve Google yorum bağlantılarınızı yönetin</p>
      </div>

      <div className="flex space-x-2 border-b overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-3 text-sm rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-primary text-white font-semibold' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'isletme' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">İşletme Türü ve Adı</CardTitle>
              <CardDescription>Menü önerileri ve görünüm işletme türünüze göre şekillenir</CardDescription>
            </CardHeader>
            <CardContent>
              <BasicsSection draft={draft} setDraft={setDraft} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Site Adresi</CardTitle>
              <CardDescription>
                {canEditSlug ? 'QR kodun açtığı adres (yalnızca sistem yöneticisi değiştirebilir)' : 'QR kodunuzun açtığı adres'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SiteAddressSection draft={draft} setDraft={setDraft} currentSlug={restaurant.subdomain} editable={canEditSlug} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">İletişim ve Konum</CardTitle>
              <CardDescription>Telefon, adres, çalışma saatleri ve harita bağlantısı</CardDescription>
            </CardHeader>
            <CardContent>
              <ContactSection draft={draft} setDraft={setDraft} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'sosyal' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center">
              <Share2 className="h-5 w-5 mr-2 text-primary" /> Sosyal Medya & İletişim Bilgileri
            </CardTitle>
            <CardDescription>
              Sitenizin İletişim sayfası bu bilgilerle oluşur: müşteriler Instagram profilinizi açabilir, WhatsApp’tan yazabilir,
              e-posta gönderebilir ve memnun kaldıklarında Google’da yorum bırakabilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SocialSection draft={draft} setDraft={setDraft} extended />
          </CardContent>
        </Card>
      )}

      {activeTab === 'wifi' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center">
              <Wifi className="h-5 w-5 mr-2 text-primary" /> Menü Wi-Fi Paylaşımı
            </CardTitle>
            <CardDescription>Müşteriler şifrenizi menüden tek tıkla kopyalayabilir.</CardDescription>
          </CardHeader>
          <CardContent>
            <WifiSection draft={draft} setDraft={setDraft} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'marka' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center">
              <Palette className="h-5 w-5 mr-2 text-primary" /> Logo, Kapak ve Renk
            </CardTitle>
            <CardDescription>Logo ve kapak görseli yüklenir yüklenmez kaydedilir; renk için aşağıdaki kaydet düğmesini kullanın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <BrandSection draft={draft} setDraft={setDraft} />
            <div className="space-y-1.5">
              <Label className="font-semibold">Para Birimi Simgesi</Label>
              <Input
                value={draft.currency}
                maxLength={10}
                onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
                className="w-36 font-bold"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'sifre' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Giriş Şifresi Değiştir</CardTitle>
            <CardDescription>Yönetici paneli giriş şifrenizi güncelleyin (en az 8 karakter)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-1">
              <Label>Yeni Şifre</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Yeni Şifre (Tekrar)</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Şifreyi Güncelle'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab !== 'sifre' && (
        <div className="flex items-center justify-end pt-4">
          {isDirty && <span className="mr-3 text-xs font-semibold text-amber-600 dark:text-amber-400">Kaydedilmemiş değişiklikler var</span>}
          <Button onClick={handleSave} disabled={isSaving || !isDirty} className="bg-primary text-white px-8">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="h-4 w-4 mr-2" /> Değişiklikleri Kaydet</>)}
          </Button>
        </div>
      )}
    </motion.div>
  )
}

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Camera, Check, ChefHat, Loader2, Plus, QrCode, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PanelThemeProvider, PanelBackground, ThemeToggle } from '@/components/theme/PanelTheme'
import { RestaurantProvider, useRestaurant } from '@/components/providers/RestaurantProvider'
import { usePublicMenuPreview } from '@/lib/use-public-menu-preview'
import { useBusinessTypes } from '@/lib/use-business-types'
import { useCatalogTemplates } from '@/lib/use-catalog-templates'
import { siteUrl } from '@/lib/site-url'
import {
  BasicsSection,
  BrandSection,
  ContactSection,
  SocialSection,
  WifiSection,
  applyDraftToRestaurant,
  draftFromRestaurant,
  draftToPatch,
  type ProfileDraft,
} from './profile-sections'

type StepId = 'basics' | 'brand' | 'contact' | 'wifi' | 'social' | 'menu'

const STEPS: { id: StepId; title: string; desc: string; skippable: boolean }[] = [
  { id: 'basics', title: 'İşletmeni tanıyalım', desc: 'Adını ve ne tür bir işletme olduğunu seç. Menün ve önerilerimiz buna göre şekillenir.', skippable: false },
  { id: 'brand', title: 'Logo ve görünüm', desc: 'Logon menünün üstünde, panelde ve QR kodlarında görünür.', skippable: true },
  { id: 'contact', title: 'İletişim ve konum', desc: 'Müşterilerin seni arayıp yol tarifi alabilmesi için.', skippable: true },
  { id: 'wifi', title: 'Misafir Wi-Fi bilgisi', desc: 'Müşteri menüyü açınca şifreyi tek tıkla kopyalayabilsin.', skippable: true },
  { id: 'social', title: 'Sosyal medya ve yorumlar', desc: 'Instagram, WhatsApp ve Google yorum linkini ekle; memnun müşteri seni Google’da puanlasın.', skippable: true },
  { id: 'menu', title: 'Menünü oluştur', desc: 'Nasıl başlamak istersin? Sonradan her şeyi düzenleyebilirsin.', skippable: false },
]

function Wizard() {
  const navigate = useNavigate()
  const { restaurant, isLoading, save } = useRestaurant()
  const [stepIdx, setStepIdx] = useState(0)
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromRestaurant(null))
  const [busy, setBusy] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // İlk yüklemede taslağı doldur ve kaldığı adıma git
  useEffect(() => {
    if (!restaurant || initialized) return
    setDraft(draftFromRestaurant(restaurant))
    const saved = STEPS.findIndex((s) => s.id === restaurant.onboardingStep)
    if (saved > 0) setStepIdx(saved)
    setInitialized(true)
  }, [restaurant, initialized])

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1
  const progress = ((stepIdx + 1) / STEPS.length) * 100

  const previewRestaurant = useMemo(() => applyDraftToRestaurant(restaurant, draft), [restaurant, draft])
  const iframeRef = usePublicMenuPreview({ menu: null, restaurant: previewRestaurant, primaryColor: draft.primaryColor })

  const { get: getBusinessType } = useBusinessTypes()
  const typeInfo = getBusinessType(draft.businessType)
  const { templates: typeTemplates } = useCatalogTemplates(
    draft.businessType || null,
    stepIdx === STEPS.length - 1 && !!draft.businessType
  )
  const canContinueBasics = draft.name.trim().length >= 2 && !!draft.businessType

  const persist = async (sections: Parameters<typeof draftToPatch>[1], nextStep: StepId | 'done') => {
    await save({ ...draftToPatch(draft, sections), onboardingStep: nextStep })
  }

  const goNext = async (skip = false) => {
    if (busy) return
    setBusy(true)
    try {
      const next = STEPS[stepIdx + 1]
      if (step.id === 'basics') {
        if (!canContinueBasics) return
        await persist(['basics', 'brand'], next.id)
      } else if (!skip) {
        const map: Record<string, Parameters<typeof draftToPatch>[1]> = {
          brand: ['brand'],
          contact: ['contact'],
          wifi: ['wifi'],
          social: ['social'],
        }
        await persist(map[step.id] || [], next.id)
      } else {
        await save({ onboardingStep: next.id })
      }
      setStepIdx(stepIdx + 1)
    } catch (e: any) {
      toast.error(e?.message || 'Kaydedilemedi, lütfen tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  const finish = async (start: 'scan' | 'template' | 'blank' | 'dashboard', templateId?: string) => {
    if (busy) return
    setBusy(true)
    try {
      await save({ completeOnboarding: true, onboardingStep: 'done' })
      if (start === 'dashboard') {
        navigate('/dashboard', { replace: true })
        return
      }
      const q = new URLSearchParams({ start })
      if (templateId) q.set('template', templateId)
      navigate(`/dashboard/menu-editor?${q.toString()}`, { replace: true })
    } catch (e: any) {
      toast.error(e?.message || 'Tamamlanamadı, lütfen tekrar deneyin.')
      setBusy(false)
    }
  }

  if (isLoading || !restaurant) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Seçilen işletme tipine ait şablonlar (önerilen en başta)
  const recommended = typeTemplates.find((t) => t.slug === typeInfo?.templateId) ?? typeTemplates[0]
  const otherTemplates = typeTemplates.filter((t) => t.slug !== recommended?.slug)
  const menuUrl = siteUrl(restaurant.subdomain)

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PanelBackground />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 lg:px-8">
        {/* Üst bar */}
        <header className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2 font-extrabold text-xl">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60">
              <QrCode className="h-5 w-5" />
              <ChefHat className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-background p-0.5" />
            </div>
            QR Chef
          </div>
          <div className="flex items-center gap-3">
            {stepIdx >= 1 && !isLast && (
              <button
                type="button"
                onClick={() => finish('dashboard')}
                disabled={busy}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Kurulumu sonra tamamla
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* İlerleme */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Adım {stepIdx + 1} / {STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
        </div>

        <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Form */}
          <div className="glass-card rounded-[28px] p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{step.title}</h1>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>

                {step.id === 'basics' && (
                  <>
                    <BasicsSection draft={draft} setDraft={setDraft} />
                    <p className="text-xs text-muted-foreground break-all">
                      Menü adresin: <span className="font-mono font-semibold text-foreground">{menuUrl}</span>
                    </p>
                  </>
                )}
                {step.id === 'brand' && <BrandSection draft={draft} setDraft={setDraft} />}
                {step.id === 'contact' && <ContactSection draft={draft} setDraft={setDraft} />}
                {step.id === 'wifi' && <WifiSection draft={draft} setDraft={setDraft} />}
                {step.id === 'social' && <SocialSection draft={draft} setDraft={setDraft} />}

                {step.id === 'menu' && (
                  <div className="grid gap-3">
                    <MenuChoice
                      icon={<Camera className="h-6 w-6" />}
                      title="Menü fotoğrafını tara"
                      desc="Kağıt menünün fotoğrafını çek, yapay zeka saniyeler içinde dijitalleştirsin ve kalorileri hesaplasın."
                      badge="En hızlısı"
                      onClick={() => finish('scan')}
                      disabled={busy}
                    />
                    {recommended ? (
                      <MenuChoice
                        icon={<Sparkles className="h-6 w-6" />}
                        title={`${typeInfo?.icon ?? ''} ${recommended.name}`}
                        desc={`${recommended.itemCount} ürünlük hazır menü; ürünleri ve fiyatları sonradan değiştirirsin.`}
                        badge="Sana önerilen"
                        onClick={() => finish('template', recommended.slug)}
                        disabled={busy}
                      />
                    ) : (
                      <MenuChoice
                        icon={<Sparkles className="h-6 w-6" />}
                        title="Hazır şablonlardan seç"
                        desc="Kafe, ocakbaşı, pub ve daha fazlası için hazır menüler."
                        onClick={() => finish('template')}
                        disabled={busy}
                      />
                    )}
                    {otherTemplates.map((t) => (
                      <MenuChoice
                        key={t.slug}
                        icon={<span className="text-xl leading-none">{t.icon}</span>}
                        title={t.name}
                        desc={`${t.tagline} · ${t.itemCount} ürün`}
                        onClick={() => finish('template', t.slug)}
                        disabled={busy}
                      />
                    ))}
                    <MenuChoice
                      icon={<Plus className="h-6 w-6" />}
                      title="Boş menüyle başla"
                      desc="Kategori ve ürünleri kendin eklersin."
                      onClick={() => finish('blank')}
                      disabled={busy}
                    />
                  </div>
                )}

                {/* Alt gezinme */}
                {step.id !== 'menu' && (
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={stepIdx === 0 || busy}
                      onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                    >
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> Geri
                    </Button>
                    <div className="flex items-center gap-2">
                      {step.skippable && (
                        <Button type="button" variant="outline" disabled={busy} onClick={() => goNext(true)}>
                          Şimdilik geç
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => goNext(false)}
                        disabled={busy || (step.id === 'basics' && !canContinueBasics)}
                        className="min-w-32 font-bold"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Devam <ArrowRight className="ml-1.5 h-4 w-4" /></>)}
                      </Button>
                    </div>
                  </div>
                )}
                {step.id === 'menu' && (
                  <div className="flex items-center justify-between pt-2">
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setStepIdx((i) => i - 1)}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> Geri
                    </Button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => finish('dashboard')}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      Menüyü sonra oluşturacağım
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Canlı önizleme */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Müşterin böyle görecek
              </p>
              <div className="mx-auto h-[640px] w-[320px] overflow-hidden rounded-[40px] border-[8px] border-zinc-900 bg-white shadow-2xl">
                <iframe
                  ref={iframeRef}
                  title="Canlı Önizleme"
                  src={`/menu/${restaurant.subdomain}?preview=1`}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function MenuChoice({
  icon,
  title,
  desc,
  badge,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  badge?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-card hover:shadow-lg disabled:opacity-60"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{title}</span>
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              <Check className="h-3 w-3" /> {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  )
}

export function OnboardingWizard() {
  return (
    <PanelThemeProvider>
      <RestaurantProvider>
        <Wizard />
      </RestaurantProvider>
    </PanelThemeProvider>
  )
}

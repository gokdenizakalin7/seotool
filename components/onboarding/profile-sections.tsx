'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, Check, Globe, Wand2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/api-client'
import { SLUG_RE, isReservedSlug, siteOrigin, slugInput, slugifyBusinessName } from '@/lib/site-url'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBusinessTypes } from '@/lib/use-business-types'
import { compressImageFile, IMAGE_PRESETS } from '@/lib/image-compression'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import type { Restaurant } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Taslak modeli: sihirbaz ve ayarlar sayfası ortak kullanır           */
/* ------------------------------------------------------------------ */

export interface ProfileDraft {
  name: string
  businessType: string
  primaryColor: string
  currency: string
  phone: string
  address: string
  city: string
  workingHours: string
  googleMapsUrl: string
  wifiName: string
  wifiPassword: string
  instagramHandle: string
  googleReviewUrl: string
  whatsappNumber: string
  /** İşletme sitesi adresi (qr-chef.com.tr/<siteSlug>); yalnızca ayarlar sayfasında değiştirilir */
  siteSlug: string
  /* İşletme sitesi iletişim sayfası (Ayarlar > Sosyal & İletişim) */
  contactEmail: string
  websiteUrl: string
  facebookUrl: string
  tiktokHandle: string
  xHandle: string
  youtubeUrl: string
}

/** Yalnızca ayarlar sayfasında düzenlenen site iletişim alanları (sihirbaz göndermez) */
export const CONTACT_EXTRA_KEYS = ['contactEmail', 'websiteUrl', 'facebookUrl', 'tiktokHandle', 'xHandle', 'youtubeUrl'] as const

export function draftFromRestaurant(r: Restaurant | null): ProfileDraft {
  const b = r?.businessInfo
  return {
    name: r?.name || '',
    businessType: r?.businessType || '',
    primaryColor: r?.branding?.primaryColor || '#e11d48',
    currency: r?.currency || '₺',
    phone: b?.phone || '',
    address: b?.address || '',
    city: b?.city || '',
    workingHours: b?.workingHours || '',
    googleMapsUrl: b?.googleMapsUrl || '',
    wifiName: b?.wifi_name || '',
    wifiPassword: b?.wifi_password || '',
    instagramHandle: b?.instagramHandle || '',
    googleReviewUrl: b?.googleReviewUrl || '',
    whatsappNumber: b?.whatsappNumber || '',
    siteSlug: r?.subdomain || '',
    contactEmail: b?.contactEmail || '',
    websiteUrl: b?.websiteUrl || '',
    facebookUrl: b?.facebookUrl || '',
    tiktokHandle: b?.tiktokHandle || '',
    xHandle: b?.xHandle || '',
    youtubeUrl: b?.youtubeUrl || '',
  }
}

/** Taslağı önizleme için Restaurant nesnesine yansıtır (kaydetmeden). */
export function applyDraftToRestaurant(r: Restaurant | null, d: ProfileDraft): Restaurant | null {
  if (!r) return r
  return {
    ...r,
    name: d.name || r.name,
    currency: d.currency || r.currency,
    businessType: d.businessType || r.businessType,
    businessInfo: {
      ...r.businessInfo,
      phone: d.phone,
      address: d.address,
      city: d.city,
      workingHours: d.workingHours,
      googleMapsUrl: d.googleMapsUrl,
      wifi_name: d.wifiName,
      wifi_password: d.wifiPassword,
      instagramHandle: d.instagramHandle.replace(/^@+/, ''),
      googleReviewUrl: d.googleReviewUrl,
      whatsappNumber: d.whatsappNumber,
      contactEmail: d.contactEmail,
      websiteUrl: d.websiteUrl,
      facebookUrl: d.facebookUrl,
      tiktokHandle: d.tiktokHandle.replace(/^@+/, ''),
      xHandle: d.xHandle.replace(/^@+/, ''),
      youtubeUrl: d.youtubeUrl,
    },
    branding: { ...r.branding, primaryColor: d.primaryColor },
  }
}

export type SectionKey = 'basics' | 'brand' | 'contact' | 'wifi' | 'social' | 'contactExtra' | 'siteAddress'

/** Bölüme ait taslak alanlarını API gövdesine çevirir. */
export function draftToPatch(d: ProfileDraft, sections: SectionKey[]) {
  const p: Record<string, unknown> = {}
  if (sections.includes('basics')) {
    p.name = d.name
    if (d.businessType) p.businessType = d.businessType
  }
  if (sections.includes('brand')) {
    p.primaryColor = d.primaryColor
    p.currency = d.currency
  }
  if (sections.includes('contact')) {
    p.phone = d.phone
    p.address = d.address
    p.city = d.city
    p.workingHours = d.workingHours
    p.googleMapsUrl = d.googleMapsUrl
  }
  if (sections.includes('wifi')) {
    p.wifiName = d.wifiName
    p.wifiPassword = d.wifiPassword
  }
  if (sections.includes('social')) {
    p.instagramHandle = d.instagramHandle
    p.googleReviewUrl = d.googleReviewUrl
    p.whatsappNumber = d.whatsappNumber
  }
  if (sections.includes('contactExtra')) {
    for (const key of CONTACT_EXTRA_KEYS) p[key] = d[key]
  }
  if (sections.includes('siteAddress')) p.siteSlug = d.siteSlug
  return p
}

interface SectionProps {
  draft: ProfileDraft
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bölümler                                                            */
/* ------------------------------------------------------------------ */

export function BasicsSection({ draft, setDraft }: SectionProps) {
  const { types: businessTypes, get: getBusinessType } = useBusinessTypes()
  return (
    <div className="space-y-5">
      <Field label="İşletme Adı">
        <Input
          value={draft.name}
          maxLength={100}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Örn: Köşe Kafe"
        />
      </Field>

      <div className="space-y-2">
        <Label className="font-semibold">İşletme Türü</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {businessTypes.map((t) => {
            const active = draft.businessType === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    businessType: t.id,
                    // Kullanıcı rengi henüz özelleştirmediyse türün rengini öner
                    primaryColor:
                      !d.businessType || d.primaryColor === (getBusinessType(d.businessType)?.color ?? '')
                        ? t.color
                        : d.primaryColor,
                  }))
                }
                className={cn(
                  'relative rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5',
                  active
                    ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/40'
                    : 'border-border bg-card/60 hover:bg-card'
                )}
              >
                {active && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
                <div className="text-2xl mb-1">{t.icon}</div>
                <div className="text-sm font-bold leading-tight">{t.label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{t.hint}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ImageUploader({
  kind,
  label,
  hint,
  aspect = 'square',
}: {
  kind: 'logo' | 'cover'
  label: string
  hint?: string
  aspect?: 'square' | 'wide'
}) {
  const { restaurant, uploadAsset, removeAsset } = useRestaurant()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const url = kind === 'logo' ? restaurant?.branding?.logoUrl : restaurant?.branding?.coverUrl

  const onFile = async (file?: File) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error('Yalnızca PNG, JPG veya WebP yükleyebilirsiniz.')
      return
    }
    setBusy(true)
    try {
      const c = await compressImageFile(file, kind === 'logo' ? IMAGE_PRESETS.LOGO : IMAGE_PRESETS.MENU_COVER)
      await uploadAsset(kind, c.dataUrl)
      toast.success(kind === 'logo' ? 'Logo yüklendi.' : 'Kapak görseli yüklendi.')
    } catch (e: any) {
      toast.error(e?.message || 'Görsel yüklenemedi.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = async () => {
    setBusy(true)
    try {
      await removeAsset(kind)
    } catch (e: any) {
      toast.error(e?.message || 'Kaldırılamadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            'relative shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card/60 hover:bg-card flex items-center justify-center transition-colors',
            aspect === 'square' ? 'h-24 w-24' : 'h-24 w-40'
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className={cn('h-full w-full', kind === 'logo' ? 'object-contain p-1' : 'object-cover')} />
          ) : (
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </button>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-sm font-semibold text-primary hover:underline text-left"
          >
            {url ? 'Değiştir' : 'Görsel seç'}
          </button>
          {url && (
            <button type="button" onClick={onRemove} disabled={busy} className="text-xs text-muted-foreground hover:text-red-500 inline-flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Kaldır
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </Field>
  )
}

export function BrandSection({ draft, setDraft }: SectionProps) {
  const { restaurant } = useRestaurant()
  const lastServerColorRef = useRef(restaurant?.branding?.primaryColor)

  // Sunucu rengi değişince (ör. logo yüklemeden otomatik çıkarım) taslağı güncelle;
  // kullanıcı düzenlerken draft ile karşılaştırma yapma — anında eski renge döner.
  useEffect(() => {
    const c = restaurant?.branding?.primaryColor
    if (!c || c === lastServerColorRef.current) return
    lastServerColorRef.current = c
    setDraft((d) => ({ ...d, primaryColor: c }))
  }, [restaurant?.branding?.primaryColor, setDraft])

  return (
    <div className="space-y-5">
      <ImageUploader kind="logo" label="Logo" hint="Menünüzün üstünde, panelde ve QR kodların ortasında görünür. Önerilen: 512×512 px, kare (1:1), şeffaf PNG. Logoyu kenarlardan biraz boşluk bırakarak ortalayın." />
      <ImageUploader
        kind="cover"
        label="Kapak Görseli"
        aspect="wide"
        hint="Menünün üst bölümünde görünür. Önerilen: 1200×500 px (yatay, yaklaşık 12:5). Mobilde üst/alt kenarlar kırpılabilir; önemli kısımları ortada tutun, alt-sol köşe işletme adıyla kaplanır. Yüklemezseniz işletme türünüze uygun hazır bir görsel kullanılır."
      />
      <Field label="Ana Renk">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={draft.primaryColor}
            onChange={(e) => setDraft((d) => ({ ...d, primaryColor: e.target.value }))}
            className="h-12 w-12 cursor-pointer rounded-lg border p-1"
          />
          <Input
            value={draft.primaryColor}
            maxLength={7}
            onChange={(e) => setDraft((d) => ({ ...d, primaryColor: e.target.value }))}
            className="w-36 font-mono"
          />
        </div>
      </Field>
    </div>
  )
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid'

const SLUG_MESSAGES: Record<Exclude<SlugStatus, 'idle' | 'checking'>, string> = {
  available: 'Bu adres kullanılabilir.',
  taken: 'Bu adres başka bir işletme tarafından kullanılıyor.',
  reserved: 'Bu ad sistem sayfalarına ayrılmış; başka bir adres seçin.',
  invalid: 'En az 2 karakter; yalnızca küçük harf, rakam ve tire. Tireyle başlayıp bitemez.',
}

/**
 * Site adresi (qr-chef.com.tr/<slug>). İşletme için salt okunur; yalnızca sistem yöneticisi (panele girmişken)
 * değiştirebilir: yazarken normalize edilir ve boş olup olmadığı sorulur.
 */
export function SiteAddressSection({
  draft,
  setDraft,
  currentSlug,
  editable = false,
}: SectionProps & { currentSlug: string; editable?: boolean }) {
  const host = siteOrigin().replace(/^https?:\/\//, '')
  const [status, setStatus] = useState<SlugStatus>('idle')
  const slug = draft.siteSlug
  const changed = slug !== currentSlug
  const suggestion = slugifyBusinessName(draft.name)

  useEffect(() => {
    if (!changed || !editable) {
      setStatus('idle')
      return
    }
    const normalized = slug.replace(/-+$/, '')
    if (normalized.length < 2 || !SLUG_RE.test(normalized)) {
      setStatus('invalid')
      return
    }
    if (isReservedSlug(normalized)) {
      setStatus('reserved')
      return
    }
    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(
          `/api/organizations/slug-available?subdomain=${encodeURIComponent(currentSlug)}&slug=${encodeURIComponent(normalized)}`
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error)
        setStatus(data.available ? 'available' : (data.reason as SlugStatus) || 'taken')
      } catch {
        setStatus('idle')
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [slug, changed, currentSlug, editable])

  if (!editable) {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Müşterilerinizin QR ile açtığı adres: </span>
          <span className="font-mono font-semibold">{host ? `${host}/` : '/'}{currentSlug}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Adres değişikliğini yalnızca sistem yöneticisi yapabilir; isterseniz destekle iletişime geçin. Değişiklikte eski adres
          ve basılı QR kodlar yeni adrese yönlendirilir.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Field label="Site adresi" hint="Müşterilerin QR ile açtığı adres. Küçük harf, rakam ve tire kullanılabilir.">
        <div className="flex items-center rounded-xl border border-input bg-background/40 pl-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
          <span className="shrink-0 text-sm text-muted-foreground">{host ? `${host}/` : '/'}</span>
          <Input
            value={slug}
            maxLength={40}
            spellCheck={false}
            autoCapitalize="none"
            className="border-0 bg-transparent pl-0 shadow-none focus-visible:ring-0 font-mono"
            onChange={(e) => setDraft((d) => ({ ...d, siteSlug: slugInput(e.target.value) }))}
            onBlur={() => setDraft((d) => ({ ...d, siteSlug: d.siteSlug.replace(/-+$/, '') }))}
          />
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        {suggestion && suggestion !== slug && (
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, siteSlug: suggestion }))}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> İşletme adından öner: {suggestion}
          </Button>
        )}
        {changed && status === 'checking' && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kontrol ediliyor…
          </span>
        )}
        {changed && status === 'available' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> {SLUG_MESSAGES.available}
          </span>
        )}
        {changed && (status === 'taken' || status === 'reserved' || status === 'invalid') && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {SLUG_MESSAGES[status]}
          </span>
        )}
      </div>

      {changed ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Adresi değiştirdiğinizde eski adres (<span className="font-mono">/{currentSlug}</span>) ve basılmış QR kodlarınız otomatik
            olarak yeni adrese yönlendirilir; yeniden bastırmanız gerekmez.
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Mevcut adres: <span className="font-mono">{host ? `${host}/` : '/'}{currentSlug}</span>
        </p>
      )}
    </div>
  )
}

export function ContactSection({ draft, setDraft }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Telefon">
          <Input value={draft.phone} maxLength={30} placeholder="0212 000 00 00" onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
        </Field>
        <Field label="Şehir">
          <Input value={draft.city} maxLength={50} placeholder="İstanbul" onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
        </Field>
      </div>
      <Field label="Açık Adres">
        <Input value={draft.address} maxLength={300} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
      </Field>
      <Field label="Çalışma Saatleri" hint="Menüde bilgi şeridinde görünür.">
        <Input value={draft.workingHours} maxLength={100} placeholder="Her gün 09:00 - 01:00" onChange={(e) => setDraft((d) => ({ ...d, workingHours: e.target.value }))} />
      </Field>
      <Field label="Google Haritalar Linki" hint="Google Haritalar'da işletmenizi açın, Paylaş > Bağlantıyı kopyala. Müşteriler tek tıkla yol tarifi alır.">
        <Input value={draft.googleMapsUrl} placeholder="https://maps.app.goo.gl/..." onChange={(e) => setDraft((d) => ({ ...d, googleMapsUrl: e.target.value }))} />
      </Field>
    </div>
  )
}

export function WifiSection({ draft, setDraft }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Wi-Fi Ağ Adı (SSID)">
          <Input value={draft.wifiName} maxLength={32} placeholder="Örn: Kafe_Misafir" onChange={(e) => setDraft((d) => ({ ...d, wifiName: e.target.value }))} />
        </Field>
        <Field label="Wi-Fi Şifresi">
          <Input value={draft.wifiPassword} maxLength={63} placeholder="Şifresizse boş bırakın" onChange={(e) => setDraft((d) => ({ ...d, wifiPassword: e.target.value }))} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Doldurursanız menüde &quot;Ücretsiz Wi-Fi&quot; kartı ve şifreyi kopyala düğmesi görünür. Boş bırakırsanız hiç gösterilmez.</p>
    </div>
  )
}

/** extended: ayarlar sayfasında site iletişim alanları da gösterilir (Facebook, TikTok, X, YouTube, e-posta, web) */
export function SocialSection({ draft, setDraft, extended = false }: SectionProps & { extended?: boolean }) {
  return (
    <div className="space-y-4">
      {extended && <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sosyal medya</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Instagram" hint="@kullaniciadi veya profil linki yazabilirsiniz.">
          <div className="relative">
            <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">@</span>
            <Input
              className="pl-7"
              value={draft.instagramHandle}
              maxLength={80}
              placeholder="kafeadi"
              onChange={(e) => setDraft((d) => ({ ...d, instagramHandle: e.target.value.replace(/^@+/, '') }))}
            />
          </div>
        </Field>
        <Field label="WhatsApp Numarası" hint="05xx ile yazabilirsiniz, otomatik düzeltilir.">
          <Input value={draft.whatsappNumber} maxLength={30} placeholder="0555 000 00 00" onChange={(e) => setDraft((d) => ({ ...d, whatsappNumber: e.target.value }))} />
        </Field>
      </div>
      <Field
        label="Google Yorum Linki"
        hint="Google İşletme Profili > Yorum isteyin > Bağlantıyı kopyalayın. Menüdeki “Yorum Yap” düğmesi müşterileri bu bağlantıya götürür."
      >
        <Input value={draft.googleReviewUrl} placeholder="https://g.page/r/.../review" onChange={(e) => setDraft((d) => ({ ...d, googleReviewUrl: e.target.value }))} />
      </Field>
      {extended && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Facebook" hint="Sayfanızın bağlantısı">
              <Input value={draft.facebookUrl} maxLength={300} placeholder="https://facebook.com/kafeadi" onChange={(e) => setDraft((d) => ({ ...d, facebookUrl: e.target.value }))} />
            </Field>
            <Field label="TikTok" hint="@kullaniciadi veya profil linki">
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">@</span>
                <Input className="pl-7" value={draft.tiktokHandle} maxLength={80} placeholder="kafeadi" onChange={(e) => setDraft((d) => ({ ...d, tiktokHandle: e.target.value.replace(/^@+/, '') }))} />
              </div>
            </Field>
            <Field label="X (Twitter)" hint="@kullaniciadi veya profil linki">
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">@</span>
                <Input className="pl-7" value={draft.xHandle} maxLength={80} placeholder="kafeadi" onChange={(e) => setDraft((d) => ({ ...d, xHandle: e.target.value.replace(/^@+/, '') }))} />
              </div>
            </Field>
            <Field label="YouTube" hint="Kanal bağlantısı">
              <Input value={draft.youtubeUrl} maxLength={300} placeholder="https://youtube.com/@kafeadi" onChange={(e) => setDraft((d) => ({ ...d, youtubeUrl: e.target.value }))} />
            </Field>
          </div>
          <p className="pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">İletişim</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-posta" hint="Sitenizin İletişim sayfasında görünür.">
              <Input type="email" value={draft.contactEmail} maxLength={200} placeholder="merhaba@kafeadi.com" onChange={(e) => setDraft((d) => ({ ...d, contactEmail: e.target.value }))} />
            </Field>
            <Field label="Web Sitesi" hint="Varsa kendi web siteniz.">
              <Input value={draft.websiteUrl} maxLength={300} placeholder="https://kafeadi.com" onChange={(e) => setDraft((d) => ({ ...d, websiteUrl: e.target.value }))} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Telefon, adres ve harita bağlantısı &quot;İşletme &amp; Adres&quot; sekmesinden gelir. Doldurduğunuz tüm bilgiler sitenizin
            İletişim sayfasında otomatik görünür; boş bıraktıklarınız gösterilmez.
          </p>
        </>
      )}
    </div>
  )
}

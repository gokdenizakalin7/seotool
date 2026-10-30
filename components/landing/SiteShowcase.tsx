'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppLink } from '@/components/landing/AppLink'
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  BadgePercent,
  CalendarDays,
  Camera,
  Check,
  Clock,
  Globe,
  Info,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Receipt,
} from 'lucide-react'

/**
 * Landing: "işletme sitesi" tanıtımı.
 * Kaydırdıkça sabit kalan telefon maketi, soldaki bloğa göre ekranını değiştirir;
 * üstte yazılan site adresi, altta üç adım ve kapanış çağrısı.
 */

const SITE_HOST = 'qr-chef.com.tr'
const DEMO_SLUG = 'lezzet-duragi'
const DEMO_NAME = 'Lezzet Durağı'

type ModuleKey = 'events' | 'campaigns' | 'plans' | 'contact'

const MODULES: {
  key: ModuleKey
  icon: React.ComponentType<{ className?: string }>
  kicker: string
  title: string
  desc: string
  bullets: string[]
}[] = [
  {
    key: 'events',
    icon: CalendarDays,
    kicker: 'Etkinlikler',
    title: 'Canlı müzik, kahvaltı günü, maç gecesi: hepsi sitenizde',
    desc: 'Yaklaşan etkinlikleri tarih ve saatiyle ekleyin. Misafirleriniz "Bugün" ve "Bu Hafta" sekmelerinden görsün; süresi geçen etkinlik listeden kendiliğinden düşsün.',
    bullets: ['Tarih, saat ve açıklama', '"Bugün" ve "Bu Hafta" filtreleri', 'Geçmiş etkinlikler otomatik kalkar'],
  },
  {
    key: 'campaigns',
    icon: BadgePercent,
    kicker: 'Kampanyalar',
    title: 'Menünüzden ürün seçin, kampanya fiyatını yazın, bitiş tarihini belirleyin',
    desc: 'Kampanya menünüzle aynı üründen beslenir; fiyatı ayrı yerde tekrar yazmazsınız. Geçerlilik tarihi dolduğunda müşteriye gösterilmez, siz hiçbir şey yapmazsınız.',
    bullets: ['Menüden ürün seçimi', 'Pakette eski fiyat ve % avantaj', 'Tarihi dolan kampanya gizlenir'],
  },
  {
    key: 'plans',
    icon: Receipt,
    kicker: 'Fiyat Planları',
    title: 'Yaz menüsü, etkinlik fiyatları, happy hour: fiyat setlerini önceden hazırlayın',
    desc: 'Birden fazla fiyat listesi tutun, tek tıkla aralarında geçin. Hangi planın yayında olduğunu panel size söyler; menünüz ve QR kodunuz değişmez.',
    bullets: ['Birden fazla fiyat listesi', 'Tek tıkla geçiş', '"Müşteriler şu an görüyor" göstergesi'],
  },
  {
    key: 'contact',
    icon: Info,
    kicker: 'Hakkımızda ve İletişim',
    title: 'Hikayeniz, adresiniz, çalışma saatleriniz: misafir sormadan bulsun',
    desc: 'Hakkımızda sayfasında işletmenizi anlatın. İletişim sayfasında telefon, WhatsApp ve Instagram tek dokunuşla açılır; adres haritada, yol tarifi tek dokunuşta.',
    bullets: ['Hikayeniz, isterseniz yapay zekâyla yazılmış', 'Ara, WhatsApp, Instagram tek dokunuşla', 'Adres, harita ve çalışma saatleri'],
  },
]

const STEPS = [
  { icon: Camera, title: 'Menünüzün fotoğrafını çekin', desc: 'Yapay zeka ürünleri, fiyatları ve kalorileri çıkarır. Menünüz dakikalar içinde hazır.' },
  { icon: Globe, title: 'Site adresinizi seçin', desc: `${SITE_HOST}/işletmeniz adresi anında açılır. Hakkımızda ve iletişim bilgilerinizi doldurun.` },
  { icon: QrCode, title: 'QR kodu basın, gerisini sitede yönetin', desc: 'Etkinlik, kampanya ve fiyat planlarını panelden ekleyin; masadaki QR hep aynı kalır.' },
]

/** Görünür olunca site adresini harf harf yazar */
function TypedUrl() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    if (!inView) return
    const id = setInterval(() => {
      setTyped((n) => {
        if (n >= DEMO_SLUG.length) {
          clearInterval(id)
          return n
        }
        return n + 1
      })
    }, 90)
    return () => clearInterval(id)
  }, [inView])

  const done = typed >= DEMO_SLUG.length

  return (
    <div
      ref={ref}
      className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3.5 font-mono text-base text-white/90 shadow-[0_0_40px_rgba(255,255,255,0.06)] backdrop-blur-xl md:text-xl"
      aria-label={`Örnek site adresi: ${SITE_HOST}/${DEMO_SLUG}`}
    >
      <Globe className="h-5 w-5 shrink-0 text-white/50" aria-hidden="true" />
      <span className="truncate">
        <span className="text-white/50">{SITE_HOST}/</span>
        <span className="text-white">{DEMO_SLUG.slice(0, typed)}</span>
        <span className={`ml-0.5 inline-block h-5 w-[2px] translate-y-[3px] bg-white ${done ? 'animate-pulse' : ''}`} aria-hidden="true" />
      </span>
      <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Yayında
      </span>
    </div>
  )
}

/* ---------- Telefon ekranları ---------- */

function ScreenEvents() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['Bugün', 'Bu Hafta', 'Tümü'].map((t, i) => (
          <span key={t} className={`rounded-full px-3 py-1 text-[11px] font-bold ${i === 1 ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}>{t}</span>
        ))}
      </div>
      {[
        { d: 'CUM', n: '18', t: 'Canlı Müzik: Akustik Gece', s: '21:00 · Rezervasyon önerilir' },
        { d: 'CMT', n: '19', t: 'Serpme Kahvaltı Günü', s: '09:00 – 13:00 · Bahçe' },
        { d: 'PAZ', n: '20', t: 'Derbi Gecesi · Büyük Ekran', s: '19:00 · Masa ayırtın' },
      ].map((e, i) => (
        <motion.div
          key={e.t}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.12 }}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-black">
            <span className="text-[9px] font-bold leading-none">{e.d}</span>
            <span className="text-base font-extrabold leading-tight">{e.n}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-white">{e.t}</p>
            <p className="truncate text-[11px] text-white/50">{e.s}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function ScreenCampaigns() {
  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="overflow-hidden rounded-2xl border border-white/15 bg-white/10"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <p className="text-[13px] font-extrabold text-white">Hafta İçi Öğle Menüsü</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-black">%20</span>
        </div>
        <div className="divide-y divide-white/10 border-t border-white/10">
          {[
            { n: 'Izgara Köfte + Ayran', o: '320', y: '255' },
            { n: 'Tavuk Şiş + Salata', o: '290', y: '230' },
            { n: 'Mercimek Çorbası + Pide', o: '120', y: '95' },
          ].map((p, i) => (
            <motion.div
              key={p.n}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center justify-between px-3.5 py-2.5 text-[12px]"
            >
              <span className="text-white/85">{p.n}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-white/40 line-through">{p.o} ₺</span>
                <span className="font-extrabold text-white">{p.y} ₺</span>
              </span>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-black/30 px-3.5 py-2 text-[10px] font-semibold text-white/60">
          <Clock className="h-3 w-3" aria-hidden="true" /> 31 Ekim'e kadar · 12:00–15:00
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="rounded-2xl border border-dashed border-white/15 p-3 text-center text-[11px] text-white/40"
      >
        Tarihi dolan kampanya burada görünmez
      </motion.div>
    </div>
  )
}

function ScreenPlans() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/40">Fiyat planı</p>
        <div className="space-y-1.5">
          {[
            { n: 'Standart', on: false },
            { n: 'Etkinlik Fiyatları', on: true },
            { n: 'Yaz Menüsü', on: false },
          ].map((p, i) => (
            <motion.div
              key={p.n}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12px] ${p.on ? 'bg-white text-black' : 'text-white/60'}`}
            >
              <span className="font-bold">{p.n}</span>
              {p.on ? (
                <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Müşteriler şu an görüyor
                </span>
              ) : (
                <span className="text-[10px]">Geç</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
        {[
          { n: 'Latte', p: '140' },
          { n: 'Limonata', p: '120' },
          { n: 'Cheesecake', p: '210' },
        ].map((p, i) => (
          <div key={p.n} className="flex items-center justify-between px-3.5 py-2.5 text-[12px]">
            <span className="text-white/85">{p.n}</span>
            <motion.span
              key={p.p}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="font-extrabold text-white"
            >
              {p.p} ₺
            </motion.span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenContact() {
  return (
    <div className="space-y-3">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[12px] leading-relaxed text-white/70"
      >
        2009'dan beri aynı sokakta, aynı tarifle. Hamur her sabah elde açılır, köfte günlük çekilir.
      </motion.p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { i: Phone, t: 'Ara' },
          { i: MessageCircle, t: 'WhatsApp' },
          { i: Instagram, t: 'Instagram' },
        ].map((a, idx) => (
          <motion.div
            key={a.t}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-black"
          >
            <a.i className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-bold">{a.t}</span>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/70"
      >
        <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" /> Bağdat Cad. No:112, Kadıköy</p>
        <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" /> Her gün 09:00 – 23:30</p>
        <div className="mt-1 h-16 rounded-xl bg-[radial-gradient(circle_at_60%_40%,rgba(255,255,255,0.18),rgba(255,255,255,0.04))]" aria-hidden="true" />
      </motion.div>
    </div>
  )
}

const SCREEN: Record<ModuleKey, { nav: string; render: () => React.ReactNode }> = {
  events: { nav: 'Etkinlikler', render: () => <ScreenEvents /> },
  campaigns: { nav: 'Menü', render: () => <ScreenCampaigns /> },
  plans: { nav: 'Menü', render: () => <ScreenPlans /> },
  contact: { nav: 'İletişim', render: () => <ScreenContact /> },
}

function PhoneMockup({ active }: { active: ModuleKey }) {
  const navItems = ['Menü', 'Etkinlikler', 'Hakkımızda', 'İletişim']
  const current = SCREEN[active]
  return (
    <div className="relative mx-auto w-[300px] max-w-full">
      <div className="absolute -inset-8 rounded-[60px] bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[44px] border border-white/20 bg-[#0a0c10] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="overflow-hidden rounded-[36px] bg-[#0f1218]">
          <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold text-white/60">
            <span>09:41</span>
            <span className="h-5 w-20 rounded-full bg-black" aria-hidden="true" />
            <span>●●●</span>
          </div>
          <div className="px-4 pb-2 pt-2">
            <p className="text-[15px] font-extrabold tracking-tight text-white">{DEMO_NAME}</p>
            <p className="truncate font-mono text-[10px] text-white/40">{SITE_HOST}/{DEMO_SLUG}</p>
          </div>
          <div className="flex gap-1.5 overflow-hidden px-4 pb-3">
            {navItems.map((n) => (
              <span
                key={n}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${n === current.nav ? 'bg-white text-black' : 'bg-white/10 text-white/60'}`}
              >
                {n}
              </span>
            ))}
          </div>
          <div className="h-[380px] px-3.5 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {current.render()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Bölüm ---------- */

export function SiteShowcase() {
  const [active, setActive] = useState<ModuleKey>('events')
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
  const glowY = useTransform(scrollYProgress, [0, 1], [-200, 200])

  return (
    <>
      {/* Giriş: site adresi */}
      <section className="relative w-full overflow-hidden py-24 md:py-32">
        <div className="container relative z-10 mx-auto max-w-4xl space-y-8 px-4 text-center md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="space-y-5"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md">
              <Globe className="h-4 w-4" aria-hidden="true" /> Yeni: İşletme Sitesi
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
              Sadece menü değil,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40">işletmenizin sitesi</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-white/60 md:text-xl">
              QR kodunuz artık bir menüye değil, işletmenizin kendi adresine açılıyor. Etkinlikler, kampanyalar, fiyat planları, hakkımızda ve iletişim; hepsi tek panelden, tek adreste.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <TypedUrl />
          </motion.div>
          <motion.ul
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.4 } } }}
            className="flex flex-wrap justify-center gap-2"
            aria-label="Sitenizde bulunanlar"
          >
            {['Menü', 'Etkinlikler', 'Kampanyalar', 'Fiyat Planları', 'Hakkımızda', 'İletişim'].map((p) => (
              <motion.li
                key={p}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80"
              >
                {p}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* Modüller: solda bloklar, sağda sabit telefon */}
      <section ref={sectionRef} className="relative w-full overflow-x-clip">
        {/* Ortalama Framer'da: style.y satır içi transform yazıp Tailwind'in -translate-x-1/2'sini eziyordu; ışık sağa
            kayıp sayfayı telefonda ~900px'e genişletiyor, iOS'ta sayfa boşluğa kaydırılabiliyordu */}
        <motion.div
          style={{ x: '-50%', y: glowY }}
          className="pointer-events-none absolute left-1/2 top-1/3 h-[700px] w-[700px] max-w-full rounded-full bg-white/5 blur-[140px]"
          aria-hidden="true"
        />
        <div className="container relative z-10 mx-auto px-4 md:px-6 lg:grid lg:grid-cols-2 lg:gap-20">
          <div>
            {MODULES.map((m, i) => (
              <motion.article
                key={m.key}
                onViewportEnter={() => setActive(m.key)}
                viewport={{ amount: 0.5 }}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex min-h-[70vh] flex-col justify-center py-16 lg:py-24"
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                    <m.icon className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                    0{i + 1} · {m.kicker}
                  </span>
                </div>
                <h3 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl">{m.title}</h3>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">{m.desc}</p>
                <ul className="mt-6 space-y-2.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-white/80">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                {/* Dar ekranda telefon bloğun altında */}
                <div className="mt-10 flex justify-center lg:hidden">
                  <PhoneMockup active={m.key} />
                </div>
              </motion.article>
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-28 flex h-[calc(100vh-7rem)] items-center">
              <PhoneMockup active={active} />
            </div>
          </div>
        </div>
      </section>

      {/* Üç adım */}
      <section className="w-full py-24 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Üç adımda yayında</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/50">Tasarımcı, yazılımcı ya da ajans gerekmez.</p>
          </motion.div>
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
              >
                <span className="absolute right-6 top-5 text-6xl font-extrabold text-white/10" aria-hidden="true">{i + 1}</span>
                <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black">
                  <s.icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-white/60">{s.desc}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Kapanış */}
      <section className="w-full px-4 pb-28 md:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="container relative mx-auto max-w-4xl overflow-hidden rounded-[40px] border border-white/15 bg-white/10 px-6 py-16 text-center backdrop-blur-2xl md:px-16"
        >
          <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/20 blur-[100px]" aria-hidden="true" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            İşletmenizin adresi bugün açılsın
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/60">
            Menünüzü yükleyin, adresinizi seçin, QR kodunuzu basın. Etkinlik ve kampanyalarınızı dilediğiniz zaman ekleyin.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-14 rounded-full bg-white px-8 text-lg font-bold text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:bg-gray-200" asChild>
              <AppLink to="/signup">
                Ücretsiz Başla <ArrowRight className="ml-2 h-5 w-5" />
              </AppLink>
            </Button>
            <span className="font-mono text-sm text-white/40">{SITE_HOST}/işletmeniz</span>
          </div>
        </motion.div>
      </section>
    </>
  )
}

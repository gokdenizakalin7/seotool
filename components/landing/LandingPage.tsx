'use client'

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { QrCode, Smartphone, Eye, Wifi, ShieldCheck, Utensils, Sparkles, ArrowRight, Wand2, Flame, ChefHat } from 'lucide-react'
import { TermsOfServiceModal } from '@/components/modals/TermsOfServiceModal'
import { PrivacyPolicyModal } from '@/components/modals/PrivacyPolicyModal'
import { ContactModal } from '@/components/modals/ContactModal'
import { motion, AnimatePresence } from 'framer-motion'
import { QrChefMark, QrChefWordmark } from '@/components/brand/qr-chef-logo'
import { SiteShowcase } from '@/components/landing/SiteShowcase'

const BACKGROUND_IMAGES = [
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop', // Luxury bar/restaurant
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop', // Fine dining plating
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2574&auto=format&fit=crop', // Dark moody restaurant
  'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=2070&auto=format&fit=crop', // Chef plating food
  'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?q=80&w=2574&auto=format&fit=crop', // Elegant table setup
  'https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=2070&auto=format&fit=crop', // Steak on grill
]

export function LandingPage() {
  const [isTermsOpen, setIsTermsOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-black text-white font-sans selection:bg-white/30"
    >
      {/* Dynamic Luxury Background */}
      <div className="fixed inset-0 z-0 bg-black">
        {BACKGROUND_IMAGES.map((img, index) => (
          <div
            key={img}
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url("${img}")` 
            }}
          />
        ))}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/50 to-black/80 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Glassmorphism Header */}
        <header className="px-6 lg:px-12 h-20 flex items-center fixed w-full bg-black/20 backdrop-blur-xl border-b border-white/10 z-50">
          <Link className="flex items-center justify-center font-extrabold text-2xl text-white tracking-tight" to="/">
            <QrChefMark size={40} secondary="rgba(255,255,255,0.6)" className="mr-3" />
            <QrChefWordmark chefClassName="text-white/60" />
          </Link>
          <nav className="ml-auto flex gap-6 sm:gap-8 items-center">
            <Link
              to="/login"
              className="text-sm font-semibold text-white/70 hover:text-white transition-colors"
            >
              Giriş Yap
            </Link>
            <Button size="sm" className="bg-white text-black hover:bg-white/90 rounded-full px-6 font-bold" asChild>
              <Link to="/signup">
                Ücretsiz Başla
              </Link>
            </Button>
          </nav>
        </header>

        <main className="flex-1 pt-20">
          {/* Hero Section */}
          <section className="w-full min-h-[90vh] flex items-center justify-center py-20 px-4 md:px-6">
            <div className="container mx-auto text-center max-w-5xl">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex flex-col items-center space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  <ChefHat className="h-4 w-4" /> Yeni Nesil Akıllı QR Menü
                </div>
                
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 pb-4">
                  Bir Fotoğraf Yeter, <br className="hidden md:block" />Gerisini Biz Hallederiz
                </h1>
                
                <p className="max-w-[700px] text-white/70 text-lg md:text-2xl font-light leading-relaxed mx-auto">
                  Saatlerce ürün eklemeyi unutun. Yapay zeka menünüzü saniyeler içinde okur, dijitalleştirir ve her yemeğin <strong className="text-white font-semibold">kalorisini sizin için hesaplar.</strong>
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-8 justify-center items-center">
                  <Button size="lg" className="h-14 px-8 rounded-full bg-white text-black hover:bg-gray-200 font-bold text-lg shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105" asChild>
                    <Link to="/signup">
                      Hemen Başlayın <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" className="h-14 px-8 rounded-full border-white/20 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:text-white font-bold text-lg transition-all" asChild>
                    <Link to="/login">Giriş Yap</Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="w-full py-24 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="container px-4 md:px-6 mx-auto relative z-10">
              <div className="text-center space-y-4 mb-20">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Güçlü ve Zarif Özellikler</h2>
                <p className="text-white/50 max-w-2xl mx-auto text-lg">Yönetimi basitleştiren, misafir deneyimini mükemmelleştiren araçlar.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { icon: Wand2, title: 'Yapay Zeka ile Anında Menü Tarama', desc: 'Fiziksel menünüzün fotoğrafını çekin! AI asistanımız saniyeler içinde tüm menünüzü dijitalleştirsin.', highlight: true },
                  { icon: Flame, title: 'Otomatik Kalori Hesaplama', desc: 'Eklediğiniz yemeklerin malzemelerini yapay zeka analiz eder ve porsiyon başına düşen kaloriyi otomatik hesaplar.', highlight: true },
                  { icon: Smartphone, title: 'Canlı Telefon Önizlemesi', desc: 'Menünüzü düzenlerken anında nasıl göründüğünü interaktif simülatörde test edin.' },
                  { icon: Eye, title: 'Akıllı Kategori Kontrolü', desc: 'İstediğiniz menü kategorisini (örn: Kahvaltı) tek tıkla anında açıp kapatın.' },
                  { icon: QrCode, title: 'Masa Bazlı Özel QR', desc: 'Hem genel menü QR kodu hem de masalara özel lüks QR kodları oluşturun.' },
                  { icon: Utensils, title: 'Detaylı İçerik Sunumu', desc: 'Yemeklerin kalori, alerjen ve içerik detaylarını şık rozetlerle misafirlerinize gösterin.' },
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className={`p-8 rounded-[32px] backdrop-blur-xl transition-colors group relative overflow-hidden ${feature.highlight ? 'bg-white/10 border border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.08)] hover:bg-white/20 hover:border-white/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
                  >
                    {feature.highlight && (
                      <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:opacity-80 transition-opacity">
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${feature.highlight ? 'bg-white/20 text-white shadow-inner' : 'bg-white/10 text-white'}`}>
                      <feature.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-white flex items-center">
                      {feature.title}
                    </h3>
                    <p className="text-white/60 leading-relaxed">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* İşletme sitesi tanıtımı: kaydırdıkça canlanan modül bölümleri */}
          <SiteShowcase />
        </main>

        <footer className="w-full py-8 px-6 border-t border-white/10 bg-black/40 backdrop-blur-md">
          <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40 font-medium">© 2026 QR Chef • Lüks Menü Sistemi</p>
            <nav className="flex gap-6">
              <button onClick={() => setIsTermsOpen(true)} className="text-sm text-white/40 hover:text-white transition-colors">
                Kullanım Koşulları
              </button>
              <button onClick={() => setIsPrivacyOpen(true)} className="text-sm text-white/40 hover:text-white transition-colors">
                Gizlilik Politikası
              </button>
            </nav>
          </div>
        </footer>

        <TermsOfServiceModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
        <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
        <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      </div>
    </motion.div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrChefMark, QrChefWordmark } from '@/components/brand/qr-chef-logo'
import { setClientSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { clearImpersonation } from '@/lib/impersonation'
import { primeApiCache } from '@/lib/api-client'
import { preloadWhenIdle } from '@/lib/lazy-page'
import { DashboardContent, DashboardRoute } from '@/components/lazy-pages'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  // Kullanıcı bilgilerini yazarken panel paketleri iner: girişten sonra panel beklemeden açılır
  useEffect(() => preloadWhenIdle([DashboardRoute, DashboardContent]), [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // 1. Supabase'e doğrudan değil, kendi arka ucumuz (API) üzerinden bağlanıyoruz.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim()
        })
      })

      const responseData = await res.json()

      if (!res.ok || responseData.error) {
        setError(responseData.error || 'E-posta veya şifre hatalı.')
        setIsLoading(false)
        return
      }

      const authData = responseData.data

      if (!authData?.user) {
        setError('Kullanıcı bilgisi alınamadı.')
        setIsLoading(false)
        return
      }

      // Tarayıcıya oturumu kaydet
      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
      })

      // Yetkileri /api/auth/me uç noktasından çek
      const meRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authData.session.access_token}` }
      })
      const meData = await meRes.json()

      if (!meRes.ok || meData.error) {
        setError(meData.error || 'Kullanıcı yetkileri alınamadı.')
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      // Önceki "Panele Gir" seçimi yeni oturuma taşınmasın
      clearImpersonation()

      // Süper admin kontrolü
      if (meData.role === 'superadmin') {
        setClientSession({ role: meData.role, userId: meData.id })
        localStorage.setItem('user_role', meData.role)
        // Panel ve kalkanlar aynı yanıtı yeniden istemesin (sayfa yenilenmeden geçiliyor; oturum
        // kaydı önbelleği temizlediği için setClientSession'dan sonra)
        primeApiCache('/api/auth/me', meData)
        navigate('/admin', { replace: true })
        return
      }

      // Normal Restoran Kullanıcısı Kontrolü
      if (meData.organization) {
        const org = meData.organization
        
        localStorage.setItem('currentRestaurant', JSON.stringify({
          subdomain: org.subdomain,
          name: org.name,
          id: org.id
        }))
        localStorage.setItem('user_role', meData.role)
        localStorage.removeItem('is_admin')
        
        setClientSession({ role: meData.role, restaurant: org, userId: meData.id })
        primeApiCache('/api/auth/me', meData)
        navigate(org.onboardingCompleted === false ? '/onboarding' : '/dashboard', { replace: true })
      } else {
        setError('Hesabınıza atanmış bir restoran bulunamadı. Lütfen yönetici ile iletişime geçin.')
        await supabase.auth.signOut()
      }

    } catch (err) {
      console.error(err)
      setError('Giriş yapılırken beklenmeyen bir hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black font-sans">
      {/* Background Image & Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop")'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70 backdrop-blur-[2px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px] px-6"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
            className="relative inline-flex items-center justify-center w-24 h-24 rounded-[28px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-6"
          >
            <QrChefMark size={68} secondary="rgba(255,255,255,0.6)" className="text-white" />
          </motion.div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
            <QrChefWordmark chefClassName="text-white/60" />
          </h1>
          <p className="text-white/60 font-medium text-lg">Restoran Yönetim Paneli</p>
        </div>

        {/* Glassmorphism Card */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-8 rounded-[32px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider pl-1">E-Posta Adresi</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="email"
                    placeholder="ad@ornek.com"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 text-white placeholder-white/30 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider pl-1">Şifre</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="password"
                    placeholder="••••••••"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 text-white placeholder-white/30 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 mt-2 bg-red-500/20 border border-red-500/30 rounded-2xl text-red-100 text-sm font-medium text-center backdrop-blur-md">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center items-center py-4 px-4 border border-transparent text-base font-extrabold rounded-2xl text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-white/30 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 mt-2"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-black" />
              ) : (
                <>
                  Giriş Yap
                  <ArrowRight className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform text-black" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/60">
          Hesabınız yok mu?{' '}
          <Link to="/signup" className="font-bold text-white underline">Ücretsiz kayıt olun</Link>
        </p>

        <div className="mt-6 text-center">
          <p className="text-sm font-medium text-white/40">
            2026 © QR Chef Yönetim Sistemi
          </p>
        </div>
      </motion.div>
    </div>
  )
}

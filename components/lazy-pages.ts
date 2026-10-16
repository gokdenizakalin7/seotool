import { lazyPage } from '@/lib/lazy-page'

/**
 * Uygulamanın sayfaları ayrı paketlerdir: giriş sayfası admin/editör kodunu, müşteri tarafı panel kodunu indirmez.
 * Paket tanımları burada; ClientApp, panel iskeleti ve giriş sayfası önceden yükleme için buradan kullanır.
 */

export const LandingPage = lazyPage(() => import('@/components/landing/LandingPage').then((m) => m.LandingPage))
export const BusinessDirectory = lazyPage(() => import('@/components/landing/BusinessDirectory').then((m) => m.BusinessDirectory))
export const Login = lazyPage(() => import('@/components/auth/Login').then((m) => m.Login))
export const Signup = lazyPage(() => import('@/components/auth/Signup').then((m) => m.Signup))
export const OnboardingRoute = lazyPage(() => import('@/components/onboarding/OnboardingRoute').then((m) => m.OnboardingRoute))
export const ImageCredits = lazyPage(() => import('@/components/public/ImageCredits').then((m) => m.ImageCredits))
export const LegalPage = lazyPage(() => import('@/components/legal/LegalPage').then((m) => m.LegalPage))
export const AdminRoute = lazyPage(() => import('@/components/admin/AdminRoute').then((m) => m.AdminRoute))

// Restoran paneli: kalkan + iskelet (kenar çubuğu, üst bar) ve sayfalar
export const DashboardRoute = lazyPage(() => import('@/components/dashboard/DashboardRoute').then((m) => m.DashboardRoute))
export const DashboardContent = lazyPage(() => import('@/components/dashboard/DashboardContent').then((m) => m.DashboardContent))
export const LiveMenuEditor = lazyPage(() => import('@/components/dashboard/LiveMenuEditor').then((m) => m.LiveMenuEditor))
export const MenusContent = lazyPage(() => import('@/components/dashboard/MenusContent').then((m) => m.MenusContent))
export const QRCodesContent = lazyPage(() => import('@/components/dashboard/QRCodesContent').then((m) => m.QRCodesContent))
export const SettingsContent = lazyPage(() => import('@/components/dashboard/SettingsContent').then((m) => m.SettingsContent))
// İşletme sitesi modülleri
export const PricePlansContent = lazyPage(() => import('@/components/dashboard/site/PricePlansContent').then((m) => m.PricePlansContent))
export const CampaignsContent = lazyPage(() => import('@/components/dashboard/site/CampaignsContent').then((m) => m.CampaignsContent))
export const EventsContent = lazyPage(() => import('@/components/dashboard/site/EventsContent').then((m) => m.EventsContent))
export const AboutContent = lazyPage(() => import('@/components/dashboard/site/AboutContent').then((m) => m.AboutContent))

/** Panel açılınca boşta indirilen sayfalar: menüler arası geçişte paket beklenmez */
export const DASHBOARD_PAGES = [
  DashboardContent,
  LiveMenuEditor,
  MenusContent,
  QRCodesContent,
  SettingsContent,
  PricePlansContent,
  CampaignsContent,
  EventsContent,
  AboutContent,
]

/**
 * Açılan adresin sayfa paketleri (ClientApp ilk çizimden önce indirir; rotalar ClientApp ve DashboardLayout'takilerle aynı).
 * Panelde iskeletle birlikte açılan alt sayfa da iner: kullanıcı iki ayrı yükleme beklemez.
 */
export function pagesForPath(path: string) {
  if (path.startsWith('/dashboard')) {
    const sub = path.replace(/^\/dashboard\/?/, '')
    const page = sub.startsWith('menu-editor') || sub.startsWith('menus/')
      ? LiveMenuEditor
      : sub.startsWith('menus')
        ? MenusContent
        : sub.startsWith('qr-codes')
          ? QRCodesContent
          : sub.startsWith('settings')
            ? SettingsContent
            : sub.startsWith('price-plans')
              ? PricePlansContent
              : sub.startsWith('campaigns')
                ? CampaignsContent
                : sub.startsWith('events')
                  ? EventsContent
                  : sub.startsWith('about')
                    ? AboutContent
                    : DashboardContent
    return [DashboardRoute, page]
  }
  if (path.startsWith('/admin')) return [AdminRoute]
  if (path === '/login' || path === '/activate') return [Login]
  if (path === '/signup') return [Signup]
  if (path === '/onboarding') return [OnboardingRoute]
  if (path === '/business') return [BusinessDirectory]
  if (path === '/gorsel-kaynaklari') return [ImageCredits]
  if (path === '/kosullar' || path === '/gizlilik') return [LegalPage]
  return [LandingPage]
}

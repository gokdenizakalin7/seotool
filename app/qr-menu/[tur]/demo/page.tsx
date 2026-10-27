import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/public/site/SiteShell'
import { PublicMenuView } from '@/components/public/PublicMenuView'
import { BUSINESS_PAGES, businessPagePath, getBusinessPage } from '@/lib/marketing/business-pages'
import { getDemoMenu } from '@/lib/marketing/demo-menus'
import { SITE_THEME_SCRIPT } from '@/lib/site-theme'

/**
 * İşletme türünün demo QR menüsü (/qr-menu/kafe/demo). Müşteri sitesiyle aynı arayüz, kurgusal test verisiyle
 * (lib/marketing/demo-menus.ts) çizilir; veritabanı yok. ?embed=1: tür sayfasındaki telefon çerçevesi için şeritsiz.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return BUSINESS_PAGES.map((p) => ({ tur: p.slug }))
}

type Params = Promise<{ tur: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = getBusinessPage((await params).tur)
  if (!page) return {}
  return {
    title: { absolute: `${page.name} QR menü demosu | QR Chef` },
    description: `${page.name} için örnek QR menü: kategoriler, fiyatlar, kalori ve alerjen bilgisiyle. Ürünler ve işletme örnektir.`,
    alternates: { canonical: businessPagePath(page.slug) },
    robots: { index: false, follow: true },
  }
}

export default async function DemoMenuPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { tur } = await params
  const page = getBusinessPage(tur)
  const demo = getDemoMenu(tur)
  if (!page || !demo) notFound()
  const embed = (await searchParams).embed === '1'

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SITE_THEME_SCRIPT }} />
      {!embed && (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-gray-900 px-4 py-2.5 text-center text-sm text-white">
          <span className="font-medium">Bu bir demo menüdür; işletme, ürünler ve fiyatlar örnektir.</span>
          <span className="flex items-center gap-3">
            <Link href={businessPagePath(page.slug)} className="text-white/70 underline-offset-2 hover:text-white hover:underline">
              ← {page.name} QR menü
            </Link>
            <Link href="/signup" className="rounded-full bg-white px-3.5 py-1 font-bold text-gray-900 hover:bg-gray-200">
              Ücretsiz QR menü oluştur
            </Link>
          </span>
        </div>
      )}
      <SiteShell restaurant={demo.restaurant}>
        <PublicMenuView restaurant={demo.restaurant} menu={demo.menu} />
      </SiteShell>
    </>
  )
}

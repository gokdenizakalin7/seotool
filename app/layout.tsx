import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Önden yüklenmez: müşteri menüsü sistem fontunu kullanır, QR'dan gelen ilk ziyarette menünün JS'iyle yarışmasın
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  preload: false,
});

// Yalnızca tüm sayfalarda doğru olanlar: canonical, Open Graph görseli ve JSON-LD ana sayfada (app/page.tsx);
// burada olsalar işletme siteleri (app/[slug]) dahil her sayfaya miras kalırdı
export const metadata: Metadata = {
  metadataBase: new URL(canonicalOrigin()),
  title: { default: "QR Chef - Dijital QR Menü Yönetim Sistemi", template: "%s | QR Chef" },
  description: "QR kodlu dijital menülerinizi kolayca oluşturun, yönetin ve paylaşın.",
  applicationName: "QR Chef",
};

import { Toaster } from 'sonner';
import { canonicalOrigin } from '@/lib/site-url';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: menü sayfasındaki tema betiği <html>'e "dark" sınıfını hidrasyondan önce ekler
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

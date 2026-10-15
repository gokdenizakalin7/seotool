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

export const metadata: Metadata = {
  title: "QR Chef - Dijital QR Menü Yönetim Sistemi",
  description: "QR kodlu dijital menülerinizi kolayca oluşturun, yönetin ve paylaşın.",
};

import { Toaster } from 'sonner';

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

import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Sayfa Bulunamadı' }

/** Eşleşmeyen adresler gerçek 404 döner (önceden ana sayfa 200 ile gösteriliyordu: arama motorunda kopya sayfa) */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Sayfa Bulunamadı</h1>
      <p className="text-gray-500 max-w-md">Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.</p>
      <Link href="/" className="mt-6 text-sm font-semibold text-gray-700 underline underline-offset-4">
        QR Chef ana sayfasına dön
      </Link>
    </div>
  )
}

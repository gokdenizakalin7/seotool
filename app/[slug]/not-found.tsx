import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function SiteNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">İşletme Bulunamadı</h1>
      <p className="text-gray-500 max-w-md">
        Aradığınız sayfaya ulaşılamıyor veya böyle bir işletme sistemimizde kayıtlı değil.
      </p>
      <Link href="/" className="mt-6 text-sm font-semibold text-gray-700 underline underline-offset-4">
        Ana sayfaya dön
      </Link>
    </div>
  )
}

import Link from 'next/link'
import { Smartphone } from 'lucide-react'

/** Tür sayfasında demo QR menünün telefon çerçevesinde canlı önizlemesi + tam ekran bağlantısı */
export function DemoPhone({ name, src, href }: { name: string; src: string; href: string }) {
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6" aria-labelledby="demo-menu">
      <div className="grid grid-cols-1 items-center gap-10 rounded-[32px] border border-gray-200 bg-gray-50 p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white">
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> Demo
          </span>
          <h2 id="demo-menu" className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900">
            {name} demo menüsünü deneyin
          </h2>
          <p className="mt-4 leading-relaxed text-gray-600">
            Misafirinizin karekodu okuttuğunda göreceği ekran bu. Kategorilere dokunun, ürün arayın, bir ürünü açıp kalori,
            içerik ve alerjen bilgisine bakın. İşletme, ürünler ve fiyatlar örnektir.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={href} className="rounded-full bg-gray-900 px-6 py-3 font-bold text-white hover:bg-gray-700">
              Demo menüyü tam ekran aç
            </Link>
            <Link href="/signup" className="rounded-full border border-gray-300 px-6 py-3 font-bold text-gray-800 hover:bg-white">
              Kendi menünü oluştur
            </Link>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="relative h-[620px] w-full max-w-[340px] overflow-hidden rounded-[48px] border-4 border-gray-800 bg-black p-3 shadow-2xl sm:h-[700px] sm:max-w-[360px]">
            <div className="absolute left-1/2 top-4 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
            <iframe
              src={src}
              title={`${name} demo QR menü`}
              loading="lazy"
              className="h-full w-full rounded-[38px] border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

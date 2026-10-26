import Link from 'next/link'
import { Store } from 'lucide-react'
import type { ExampleSite } from '@/lib/server/marketing'
import { sitePath } from '@/lib/site-url'

/** Yayındaki gerçek işletme siteleri: kart başına işletme adı, şehir ve site adresi */
export function ExampleSites({ title, sites }: { title: string; sites: ExampleSite[] }) {
  if (!sites.length) return null
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
      <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h2>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => (
          <li key={site.slug}>
            <Link
              href={sitePath(site.slug)}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              {site.image ? (
                <img src={site.image} alt="" loading="lazy" decoding="async" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                  <Store className="h-6 w-6" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-bold text-gray-900 group-hover:underline">{site.name} menü</span>
                <span className="block truncate text-sm text-gray-500">
                  {site.city ? `${site.city} · ` : ''}qr-chef.com.tr/{site.slug}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

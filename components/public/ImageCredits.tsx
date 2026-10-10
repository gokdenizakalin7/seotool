'use client'

import React from 'react'
import { useImageCredits } from '@/lib/use-image-credits'

/** /gorsel-kaynaklari — katalogdaki stok fotoğrafların yazar ve lisans bilgileri */
export function ImageCredits() {
  const credits = useImageCredits()

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">Görsel kaynakları</h1>
        <p className="mt-2 text-sm text-gray-600">
          Menülerdeki ürün görsellerinin bir kısmı Creative Commons veya ücretsiz stok lisansıyla paylaşılan
          fotoğraflardan alınmıştır; diğerleri yapay zeka ile üretilmiş temsili görsellerdir. Görseller
          temsilidir, sunum işletmeye göre değişebilir.
        </p>
        {credits.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">Atıf gerektiren görsel bulunmuyor.</p>
        ) : (
          <ul className="mt-6 divide-y divide-gray-200 text-sm">
            {credits.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-gray-500">
                  {c.creator ? `${c.creator} · ` : ''}
                  <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                    {c.source}
                  </a>
                  {' · '}
                  {c.license_url ? (
                    <a href={c.license_url} target="_blank" rel="noopener noreferrer" className="underline">
                      {c.license}
                    </a>
                  ) : (
                    c.license
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

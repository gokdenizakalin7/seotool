import type { ComponentType } from 'react'
import { Body as qrMenuNedir } from './posts/qr-menu-nedir'
import { Body as qrMenuNasilYapilir } from './posts/qr-menu-nasil-yapilir'
import { Body as qrMenuZorunluMu } from './posts/qr-menu-zorunlu-mu'
import { Body as kaloriAlerjen } from './posts/menude-kalori-ve-alerjen-bilgisi'

/** Yazı gövdeleri (yalnızca app/blog/[slug] sunucu sayfası içe aktarır); anahtarlar lib/blog/posts.ts ile aynı olmalı */
export const BLOG_BODIES: Record<string, ComponentType> = {
  'qr-menu-nedir': qrMenuNedir,
  'qr-menu-nasil-yapilir': qrMenuNasilYapilir,
  'qr-menu-zorunlu-mu': qrMenuZorunluMu,
  'menude-kalori-ve-alerjen-bilgisi': kaloriAlerjen,
}

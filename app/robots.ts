import type { MetadataRoute } from 'next'
import { canonicalOrigin } from '@/lib/site-url'

/**
 * Panel ve API taranmaz. /dashboard, /admin kökleri ve giriş/kayıt sayfaları noindex meta etiketiyle dışarıda kalır;
 * sonda / olduğu için "admin-kafe" gibi işletme adresleri engellenmez.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/admin/'] },
    sitemap: `${canonicalOrigin()}/sitemap.xml`,
  }
}

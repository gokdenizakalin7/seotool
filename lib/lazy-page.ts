import { createElement, lazy, useState, type ComponentType } from 'react'

export type LazyPage<P extends object = object> = ComponentType<P> & { preload: () => Promise<ComponentType<P>> }

/**
 * Ayrı paket olarak yüklenen sayfa. Paketi inmişse (preload veya önceki ziyaret) doğrudan çizilir:
 * Suspense yedeği ve React'in yedekten içeriğe geçiş beklemesi olmaz. İnmemişse React.lazy ile yüklenir.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>): LazyPage<P> {
  let promise: Promise<ComponentType<P>> | null = null
  let loaded: ComponentType<P> | null = null
  const preload = () =>
    (promise ??= load().then(
      (component) => (loaded = component),
      (err) => {
        promise = null // ağ hatasında bir sonraki denemede yeniden indirilsin
        throw err
      }
    ))
  const Lazy = lazy(() =>
    preload().then((component) => {
      try {
        sessionStorage.removeItem(RELOAD_KEY)
      } catch {}
      return { default: component }
    }, reloadOnce)
  )
  function Page(props: P) {
    // Seçim ilk çizimde sabitlenir: bileşen türü değişip sayfa (ve içindeki durum) baştan kurulmasın
    const [Component] = useState(() => (loaded ?? Lazy) as ComponentType<P>)
    return createElement(Component, props)
  }
  return Object.assign(Page, { preload })
}

const RELOAD_KEY = 'lazy-page-reloaded'

/**
 * Yeni sürüm yayınlanınca açık kalmış sekmenin paket adresleri geçersiz olur: açılmak istenen sayfa
 * yüklenemezse sayfa bir kez yenilenir (yeni sürüme geçer); yine olmazsa hata ekranı gösterilir.
 */
function reloadOnce(err: unknown): Promise<never> {
  try {
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
      return new Promise<never>(() => {})
    }
  } catch {}
  throw err
}

/**
 * Sayfa çizildikten bir süre sonra, tarayıcı boşta kalınca sayfa paketlerini indirir; temizleme fonksiyonu döner.
 * Gecikme: önden yükleme, açılmakta olan sayfanın kendi paketleriyle ve ilk çizimle yarışmasın.
 */
export function preloadWhenIdle(pages: { preload: () => unknown }[], delayMs = 1200): () => void {
  // Arka plan yüklemesi başarısızsa sessiz geçilir: sayfa açılırken yeniden denenir
  const run = () => pages.forEach((page) => Promise.resolve(page.preload()).catch(() => {}))
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  let idleId: number | null = null
  const timer = window.setTimeout(() => {
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(run, { timeout: 3000 })
    else run()
  }, delayMs)
  return () => {
    window.clearTimeout(timer)
    if (idleId !== null) w.cancelIdleCallback?.(idleId)
  }
}

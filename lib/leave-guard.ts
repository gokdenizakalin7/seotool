/**
 * Kaydedilmemiş değişiklik uyarısı: sayfa (ör. Ayarlar) kirliyken mesajı kaydeder; panelde navigate()
 * ile yapılan geçişler ve çıkış bu uyarıyı confirmLeave ile sorar. (BrowserRouter'da useBlocker yok.)
 */
let leaveMessage: string | null = null

export function setLeaveGuard(message: string | null) {
  leaveMessage = message
}

/** Ayrılmaya izin varsa true. `to` mevcut sayfaysa sorulmaz. */
export function confirmLeave(to?: string): boolean {
  if (!leaveMessage || typeof window === 'undefined') return true
  if (to && to === window.location.pathname) return true
  return window.confirm(leaveMessage)
}

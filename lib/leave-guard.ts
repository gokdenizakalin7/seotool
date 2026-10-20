/**
 * Kaydedilmemiş değişiklik uyarısı.
 *
 *  - setLeaveGuard(message): sayfa (ör. Ayarlar) kirliyken mesajı kaydeder; panelde navigate() ile yapılan geçişler
 *    ve çıkış bu uyarıyı confirmLeave / leaveTo ile (tarayıcı confirm'i) sorar. (BrowserRouter'da useBlocker yok.)
 *  - setLeaveInterceptor(fn): sayfa ayrılma isteğini kendi diyaloğuyla (kaydet / vazgeç / devam et) ele almak isterse
 *    kaydeder; leaveTo engel varsa fn'e bırakır, onaydan sonra fn proceed'i çağırır. (useUnsavedChanges kurar.)
 */
let leaveMessage: string | null = null

export function setLeaveGuard(message: string | null) {
  leaveMessage = message
}

type LeaveInterceptor = (to: string | undefined, proceed: () => void) => void
let leaveInterceptor: LeaveInterceptor | null = null

export function setLeaveInterceptor(fn: LeaveInterceptor | null) {
  leaveInterceptor = fn
}

/** Ayrılmaya izin varsa true (yalnızca tarayıcı confirm'i; diyalog kuran sayfalar için leaveTo kullanın). `to` mevcut sayfaysa sorulmaz. */
export function confirmLeave(to?: string): boolean {
  if (!leaveMessage || typeof window === 'undefined') return true
  if (to && to === window.location.pathname) return true
  return window.confirm(leaveMessage)
}

/** Ayrılma işlemini kalkandan geçirir: engel yoksa hemen, sayfa kendi diyaloğunu kurduysa onaydan sonra proceed çağrılır. */
export function leaveTo(proceed: () => void, to?: string) {
  if (typeof window === 'undefined') return proceed()
  if (to && to === window.location.pathname) return proceed()
  if (leaveInterceptor) return leaveInterceptor(to, proceed)
  if (confirmLeave(to)) proceed()
}

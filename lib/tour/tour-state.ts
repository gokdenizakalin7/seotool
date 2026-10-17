import { supabase } from '@/lib/supabase'

/**
 * Panel rehberinin "görüldü" durumu.
 *
 * Kullanıcının Supabase user_metadata.panel_tour alanında tutulur (must_change_password ile aynı yöntem):
 * cihazdan bağımsızdır ve veritabanı migration'ı gerektirmez. Sunucuya yazılamazsa (çevrimdışı vb.) aynı kayıt
 * localStorage'da da tutulur; ikisi birleştirilerek okunur.
 *
 * "Giriş" = erişim token'ındaki (JWT) session_id: her oturum açmada yeni, token yenilemede sabittir
 * (last_sign_in_at token yenilemede de değiştiği için kullanılmaz). Rehber, tamamlandığı girişin kimliğini kaydeder;
 * böylece aynı girişte sayfa yenilense ya da yeni sekme açılsa bile yeniden zorlanmaz, bir sonraki girişte zorlanır.
 */

export const TOUR_VERSION = 1

/** Rehber ilk bu kadar girişte atlanamaz biçimde gösterilir */
export const TOUR_FORCED_LOGINS = 2

const META_KEY = 'panel_tour'

interface TourMeta {
  v: number
  /** Rehberin tamamlandığı girişlerin last_sign_in_at değerleri */
  logins: string[]
  completedAt?: string
}

export interface TourLoginState {
  userId: string
  /** Bu girişin kimliği (JWT session_id) */
  loginAt: string
  meta: TourMeta
  /** Yönetici şifresiyle açılan hesap önce kendi şifresini belirler; rehber ondan sonra başlar */
  mustChangePassword: boolean
}

function localKey(userId: string) {
  return `qrchef_tour_${userId}`
}

function readLocal(userId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(userId)) || '[]')
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function writeLocal(userId: string, logins: string[]) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(logins))
  } catch {
    // depolama kapalı
  }
}

function parseMeta(raw: unknown): TourMeta {
  if (raw && typeof raw === 'object') {
    const m = raw as Partial<TourMeta>
    if (m.v === TOUR_VERSION && Array.isArray(m.logins)) {
      return {
        v: TOUR_VERSION,
        logins: m.logins.filter((s): s is string => typeof s === 'string'),
        completedAt: typeof m.completedAt === 'string' ? m.completedAt : undefined,
      }
    }
  }
  return { v: TOUR_VERSION, logins: [] }
}

/** JWT gövdesindeki session_id (Supabase her oturum açmada yeni üretir); okunamazsa null */
function sessionIdFromToken(token: string | undefined): string | null {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const id = JSON.parse(json)?.session_id
    return typeof id === 'string' && id ? id : null
  } catch {
    return null
  }
}

export async function readTourState(): Promise<TourLoginState | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null
  const meta = parseMeta(user.user_metadata?.[META_KEY])
  const logins = Array.from(new Set([...meta.logins, ...readLocal(user.id)]))
  return {
    userId: user.id,
    loginAt: sessionIdFromToken(data.session?.access_token) || user.last_sign_in_at || user.created_at || 'unknown',
    meta: { ...meta, logins },
    mustChangePassword: user.user_metadata?.must_change_password === true,
  }
}

/** Bu girişte rehber zorunlu mu? (ilk TOUR_FORCED_LOGINS girişte, her girişte bir kez) */
export function isTourForced(state: TourLoginState): boolean {
  return state.meta.logins.length < TOUR_FORCED_LOGINS && !state.meta.logins.includes(state.loginAt)
}

/** Zorunlu rehber bitince bu girişi "tamamlandı" olarak kaydeder */
export async function markTourCompleted(state: TourLoginState): Promise<void> {
  const logins = Array.from(new Set([...state.meta.logins, state.loginAt])).slice(-10)
  writeLocal(state.userId, logins)
  const meta: TourMeta = { v: TOUR_VERSION, logins, completedAt: new Date().toISOString() }
  const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: meta } })
  if (error) console.warn('Rehber durumu sunucuya kaydedilemedi:', error.message)
}

/**
 * Hukuki metinlerin sürümü ve veri sorumlusu kimliği (Kullanım Koşulları, Gizlilik Politikası / KVKK Aydınlatma Metni).
 * Kayıt sırasında kabul edilen sürüm kullanıcı meta verisine yazılır (terms_version, terms_accepted_at).
 *
 * KÖŞELİ PARANTEZLİ alanlar yayına almadan önce şirket bilgileriyle doldurulmalıdır.
 */
export const LEGAL_VERSION = '2026-10'
export const LEGAL_UPDATED_AT = '16 Ekim 2026'

export const LEGAL_COMPANY = {
  /** Ticaret unvanı (ör. "QR Chef Yazılım A.Ş.") */
  name: '[ŞİRKET UNVANI]',
  brand: 'QR Chef',
  address: '[ŞİRKET ADRESİ]',
  mersis: '[MERSİS NO]',
  taxOffice: '[VERGİ DAİRESİ / VKN]',
  kep: '[KEP ADRESİ]',
  email: '[destek@alanadi.com]',
  privacyEmail: '[kvkk@alanadi.com]',
  phone: '[TELEFON]',
  /** Uyuşmazlıklarda yetkili mahkeme şehri */
  court: '[ŞEHİR]',
  website: 'qr-chef.vercel.app',
}

/**
 * Hukuki metinlerin sürümü ve hizmeti sunan tarafın bilgileri (Kullanım Koşulları, Gizlilik Politikası / KVKK Aydınlatma Metni).
 * Kayıt sırasında kabul edilen sürüm kullanıcı meta verisine yazılır (terms_version, terms_accepted_at).
 *
 * Henüz şirket kurulmadı: hizmeti QR Chef markasıyla bir gerçek kişi sunar. Boş bırakılan alanlar metinlerde gösterilmez.
 * Şirket kurulunca unvan, adres, MERSİS, vergi ve KEP bilgileri doldurulmalı, LEGAL_VERSION ve LEGAL_UPDATED_AT güncellenmelidir.
 */
export const LEGAL_VERSION = '2026-10-25'
export const LEGAL_UPDATED_AT = '25 Ekim 2026'

export const LEGAL_COMPANY = {
  /** Ticaret unvanı; şirket kurulunca (ör. "QR Chef Yazılım A.Ş.") */
  name: '',
  /** Şirket yokken hizmeti sunan gerçek kişinin adı soyadı (KVKK m. 10: veri sorumlusunun kimliği) */
  operatorName: '',
  brand: 'QR Chef',
  address: '',
  mersis: '',
  taxOffice: '',
  kep: '',
  /** İletişim, hesap kapatma ve KVKK başvuruları */
  email: 'qr.chef.tr@gmail.com',
  phone: '',
  /** Uyuşmazlıklarda yetkili mahkeme şehri; boşsa Hukuk Muhakemeleri Kanunu'nun genel yetki kuralları */
  court: '',
  website: 'qr-chef.com.tr',
}

/**
 * Sözleşmenin tarafı ve veri sorumlusu olarak metinde geçen ad: ticaret unvanı, yoksa hizmeti sunan gerçek kişi.
 */
export function legalPartyName(): string {
  const c = LEGAL_COMPANY
  if (c.name) return c.name
  if (c.operatorName) return `${c.operatorName} (${c.brand} markasıyla hizmet veren gerçek kişi)`
  return `${c.brand} markasıyla hizmeti sunan gerçek kişi işletmeci`
}

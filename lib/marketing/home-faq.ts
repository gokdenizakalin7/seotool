/**
 * Ana sayfa "Sık sorulan sorular": landing'de görünür metin ve app/page.tsx'teki FAQPage yapısal verisi aynı listeden.
 * Yanıtlar yalnızca üründe olan özellikleri ve doğrulanmış mevzuatı anlatır (bkz. lib/blog/posts).
 */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: 'QR menü nedir?',
    a: 'QR menü, masadaki karekod telefon kamerasıyla okutulduğunda açılan dijital menüdür. Misafir uygulama indirmeden ürünleri, fiyatları, fotoğrafları ve içerik bilgilerini görür; işletme de menüyü yeniden bastırmadan panelden günceller.',
  },
  {
    q: 'QR Chef ücretli mi?',
    a: 'QR Chef şu an ücretsiz sunulmaktadır. Kayıt olduğunuzda hesabınız hemen açılır ve menünüzü hazırlamaya başlarsınız; işletme siteniz başvurunuz onaylandığında yayına girer.',
  },
  {
    q: 'Menümü tek tek yazmam gerekiyor mu?',
    a: 'Hayır. Basılı menünüzün fotoğrafını yükleyin; yapay zekâ ürün adlarını, fiyatları ve kategorileri çıkarır, kalorileri tahmin eder. Siz kontrol edip yayınlarsınız.',
  },
  {
    q: 'Fiyatı değiştirince QR kodu yeniden basmam gerekir mi?',
    a: 'Hayır. QR kod işletmenizin site adresini (qr-chef.com.tr/isletmeniz) açar. Panelde yaptığınız her değişiklik aynı kodla anında görünür.',
  },
  {
    q: 'Restoranlarda QR menü zorunlu mu?',
    a: '11 Ekim 2025 tarihli Fiyat Etiketi Yönetmeliği değişikliği, lokanta, restoran, kafe ve pastanelerde masadaki fiyat listesinin karekodla gösterilebileceğini düzenler. Misafir isterse basılı fiyat listesi ayrıca verilmeli, giriş kapısında da fiyat listesi bulunmalıdır.',
  },
  {
    q: 'Menüde kalori ve alerjen bilgisi gösterebilir miyim?',
    a: 'Evet. Her ürüne bileşen, alerjen ve porsiyon başına kalori ekleyebilirsiniz; kaloriyi yapay zekâ tahmin eder, siz onaylarsınız. Bilgiler ürün kartında ve ürün detayında görünür.',
  },
  {
    q: 'Menü dışında neler var?',
    a: 'Her işletmenin menü, etkinlikler, hakkımızda ve iletişim sayfalarından oluşan bir sitesi olur. Kampanyalar, gün ve saate göre değişen fiyat planları, masa bazlı QR kodlar, Wi-Fi kartı ve Google yorum bağlantısı da paneldedir.',
  },
]

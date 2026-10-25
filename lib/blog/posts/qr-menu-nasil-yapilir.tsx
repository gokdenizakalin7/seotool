import Link from 'next/link'

/** Yazı metni; başlık, tarih, SSS ve kaynaklar lib/blog/posts.ts'te */
export function Body() {
  return (
    <>
      <p>
        QR menü hazırlamak için tasarımcıya ya da yazılımcıya ihtiyacınız yok. Elinizdeki basılı menünün fotoğrafı ve yaklaşık on
        dakika yeterli. Bu rehberde menünüzü dijitale aktarmaktan karekodu masaya koymaya kadar her adımı ve sık yapılan hataları
        anlatıyoruz.
      </p>

      <h2>1. Menünüzü hazırlayın</h2>
      <p>
        Başlamadan önce güncel menünüzü elinizin altına alın: basılı menü, fiyat listesi ya da bir Excel dosyası olabilir. Dijitale
        geçerken kategori yapısını sadeleştirmek için de iyi bir fırsattır. Misafirin aradığını en kolay bulacağı düzen genellikle
        &quot;Başlangıçlar, Ana Yemekler, Tatlılar, İçecekler&quot; gibi sırayla ilerleyen 5–10 kategoridir.
      </p>

      <h2>2. Fotoğraftan otomatik aktarın</h2>
      <p>
        QR Chef&apos;e <Link href="/signup">ücretsiz kaydolduktan</Link> sonra işletme türünüzü seçin ve menünüzün fotoğrafını yükleyin.
        Yapay zekâ ürün adlarını, fiyatları ve kategorileri okur; her ürünün porsiyon başına kalorisini tahmin eder. Sayfa sayfa
        fotoğraf yükleyebilirsiniz. Okunan sonuçları bir düzenleme ekranında görür, gerekirse düzeltirsiniz.
      </p>
      <p>
        Basılı menünüz yoksa işletme türünüze göre hazır şablonla başlayabilir ya da ürünleri elle ekleyebilirsiniz.
      </p>

      <h2>3. Ürün bilgilerini tamamlayın</h2>
      <ul>
        <li>
          <strong>Açıklama:</strong> Bir iki cümle yeter: &quot;Dana kıyma, cheddar, karamelize soğan; patates ile&quot;. Açıklama hem
          misafirin karar vermesini kolaylaştırır hem de menüdeki aramada bulunmasını sağlar.
        </li>
        <li>
          <strong>Bileşen ve alerjen:</strong> Gluten, süt, yumurta, kabuklu yemiş gibi alerjenleri işaretleyin. Neden önemli olduğunu{' '}
          <Link href="/blog/menude-kalori-ve-alerjen-bilgisi">kalori ve alerjen rehberimizde</Link> anlattık.
        </li>
        <li>
          <strong>Görsel:</strong> Kendi fotoğrafınızı yükleyin ya da yaygın ürünler için önerilen katalog görsellerinden birini seçin.
          Görseller otomatik sıkıştırılır; menü telefonda hızlı açılır.
        </li>
        <li>
          <strong>Öne çıkanlar:</strong> En çok satan ya da en kârlı ürününüzü &quot;şefin tavsiyesi&quot; olarak işaretleyin; kategorisinin
          en üstünde vurgulu görünür.
        </li>
      </ul>

      <h2>4. Site adresinizi ve işletme bilgilerinizi girin</h2>
      <p>
        Her işletmenin <strong>qr-chef.com.tr/isletmeniz</strong> biçiminde kendi adresi olur. Adres, telefon, WhatsApp, Instagram,
        çalışma saatleri ve Wi-Fi bilgilerini girin; bunlar menü sayfasında ve iletişim sayfasında görünür. Hakkımızda metni yazmazsanız
        menünüze ve işletme türünüze göre otomatik bir metin oluşturulur.
      </p>

      <h2>5. Karekodu basın ve yerleştirin</h2>
      <p>
        Panelin QR kodlar bölümünden genel bir giriş karekodu ve her masa için ayrı karekod indirin. Masa karekodları hangi masadan
        kaç kez okutulduğunu sayar. Yazdırırken şunlara dikkat edin:
      </p>
      <ul>
        <li>
          <strong>Boyut:</strong> Masada okunacak bir karekod için kenar uzunluğu 3 cm&apos;den küçük olmamalıdır; uzaktan okunacak
          kapı ve vitrin karekodlarını daha büyük basın.
        </li>
        <li>
          <strong>Kontrast:</strong> Koyu karekod, açık zemin. Karekodun etrafında boş bir kenar bırakın; üzerine logo ya da yazı
          bindirmeyin.
        </li>
        <li>
          <strong>Yönlendirme:</strong> Karekodun altına &quot;Menü için okutun&quot; ve site adresinizi yazın; kamerası karekodu okumayan
          misafir adresi elle yazabilir.
        </li>
        <li>
          <strong>Deneme:</strong> Basmadan önce farklı telefonlarla, masadaki ışıkta okutup deneyin.
        </li>
      </ul>

      <h2>6. Mevzuatı unutmayın</h2>
      <p>
        Fiyat Etiketi Yönetmeliği, masadaki fiyat listesinin karekodla gösterilmesine izin verir; ancak misafir isterse basılı fiyat
        listesi ayrıca verilmeli ve giriş kapısında fiyat listesi bulunmalıdır. Ayrıntıları{' '}
        <Link href="/blog/qr-menu-zorunlu-mu">QR menü zorunlu mu?</Link> yazısında bulabilirsiniz.
      </p>

      <h2>Yayından sonra: menüyü canlı tutun</h2>
      <p>
        QR menünün asıl gücü güncel kalmasıdır. Fiyat değiştiğinde panelden düzeltin, biten ürünü kaldırın, mevsimlik kategorileri
        açıp kapatın. Happy hour, öğle menüsü ya da hafta sonu fiyatları için fiyat planı ve saatli kampanya tanımlayın; etkinliklerinizi
        takvime ekleyin. Masadaki karekod hiç değişmeden menünüz her gün güncel kalır.
      </p>
      <p>
        İşletme türünüze göre ipuçları için <Link href="/qr-menu">QR menü çözümleri</Link> sayfasına göz atın.
      </p>
    </>
  )
}

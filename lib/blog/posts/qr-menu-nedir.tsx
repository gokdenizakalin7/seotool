import Link from 'next/link'

/** Yazı metni; başlık, tarih, SSS ve kaynaklar lib/blog/posts.ts'te */
export function Body() {
  return (
    <>
      <p>
        QR menü, masadaki ya da kapıdaki karekodun telefon kamerasıyla okutulmasıyla açılan dijital menüdür. Misafir uygulama
        indirmez, hesap açmaz: kamerayı karekoda tuttuğunda tarayıcıda işletmenin menüsü açılır. Ürünler, fiyatlar, fotoğraflar,
        içerik ve alerjen bilgileri tek sayfada görünür.
      </p>
      <p>
        İşletme açısından en büyük fark güncellemedir. Basılı menüde fiyat değiştiğinde menüyü yeniden bastırmanız gerekir; QR
        menüde fiyatı panelden düzeltirsiniz, masadaki karekod aynı kalır ve misafir bir sonraki okutmada güncel fiyatı görür.
      </p>

      <h2>QR menü nasıl çalışır?</h2>
      <p>
        Karekodun içinde yalnızca bir internet adresi vardır; menünün kendisi karekodda saklanmaz. Bu yüzden karekod bir kez basılır,
        menü ise istediğiniz kadar değişebilir. Süreç üç adımdan oluşur:
      </p>
      <ol>
        <li>İşletme menüsünü bir QR menü panelinde hazırlar: kategoriler, ürünler, fiyatlar, görseller.</li>
        <li>Panel, menünün adresini içeren karekodu üretir; karekod masaya, kapıya ya da vitrine konur.</li>
        <li>Misafir karekodu okutur, menü telefonun tarayıcısında açılır. Değişiklikler kaydedildiği anda yayındadır.</li>
      </ol>

      <h2>Basılı menüye göre avantajları</h2>
      <ul>
        <li>
          <strong>Anında güncelleme:</strong> Fiyat, ürün ve kategori değişiklikleri baskı beklemeden yayına girer. Enflasyonun yüksek
          olduğu dönemlerde bu tek başına ciddi bir tasarruftur.
        </li>
        <li>
          <strong>Daha fazla bilgi:</strong> Basılı menüye sığmayan ürün fotoğrafı, bileşen listesi, alerjen ve kalori bilgisi dijital
          menüde her ürünün kartında yer alabilir.
        </li>
        <li>
          <strong>Hijyen ve dayanıklılık:</strong> Elden ele dolaşan, yıpranan ve lekelenen menü kartlarının yerini herkesin kendi
          telefonu alır.
        </li>
        <li>
          <strong>Kampanya ve duyuru:</strong> Happy hour, günün yemeği ya da hafta sonu etkinliği menünün üstünde duyurulabilir;
          süresi dolan kampanya kendiliğinden kalkar.
        </li>
        <li>
          <strong>Ölçüm:</strong> Menünün kaç kez, hangi masadan açıldığını görmek; yoğun saatleri ve masa kullanımını anlamaya
          yardımcı olur.
        </li>
      </ul>

      <h2>QR menü mü, dijital menü mü, karekod menü mü?</h2>
      <p>
        Üç terim de aynı şeyi anlatmak için kullanılır. &quot;Karekod&quot;, QR kodun Türkçe karşılığıdır; Fiyat Etiketi
        Yönetmeliği de bu terimi kullanır. &quot;Dijital menü&quot; daha geniştir: tablet menüler ve ekran panolar da bu kapsama
        girer. Restoran ve kafelerde en yaygın biçim, masadaki karekodla açılan web menüsüdür.
      </p>

      <h2>İyi bir QR menüde olması gerekenler</h2>
      <ul>
        <li>
          <strong>Hızlı açılış:</strong> Misafir masada beklerken menü birkaç saniyede açılmalıdır. Ağır görseller ve uygulama indirme
          zorunluluğu kullanıcıyı kaybettirir.
        </li>
        <li>
          <strong>Okunaklı kategori yapısı:</strong> Başlangıçlar, ana yemekler, tatlılar, içecekler gibi net kategoriler ve arama
          kutusu.
        </li>
        <li>
          <strong>İçerik ve alerjen bilgisi:</strong> Gluten, süt, kabuklu yemiş gibi alerjenleri ve porsiyon başına kaloriyi gösterebilmek.
          Bu bilgiler giderek yasal bir beklenti hâline geliyor; ayrıntılar için{' '}
          <Link href="/blog/menude-kalori-ve-alerjen-bilgisi">menüde kalori ve alerjen bilgisi</Link> yazımıza bakın.
        </li>
        <li>
          <strong>Masa bazlı karekod:</strong> Her masaya ayrı karekod basabilmek, hangi masanın menüyü açtığını görmek için gerekir.
        </li>
        <li>
          <strong>Mevzuata uygunluk:</strong> Masadaki karekod fiyat listesi yerine geçebilir, ancak misafir isterse basılı liste
          verilmelidir. Konuyu <Link href="/blog/qr-menu-zorunlu-mu">QR menü zorunlu mu?</Link> yazısında anlattık.
        </li>
      </ul>

      <h2>QR menü sadece menü değildir</h2>
      <p>
        Karekodu okutan misafir aslında işletmenizin internetteki vitrinine gelir. Bu sayfada menünün yanında Wi-Fi şifresi, Instagram
        hesabınız, Google yorum bağlantınız, adresiniz ve çalışma saatleriniz de yer alabilir. QR Chef bu yüzden her işletmeye menü,
        etkinlikler, hakkımızda ve iletişim sayfalarından oluşan bir site açar: <strong>qr-chef.com.tr/isletmeniz</strong>. Aynı adres
        Google İşletme Profilinize ve sosyal medya hesaplarınıza da eklenebilir.
      </p>
      <p>
        Menünüzü nasıl hazırlayacağınızı adım adım görmek için <Link href="/blog/qr-menu-nasil-yapilir">QR menü nasıl yapılır?</Link>{' '}
        rehberine, işletme türünüze özel örnekler için <Link href="/qr-menu">QR menü çözümleri</Link> sayfasına göz atın.
      </p>
    </>
  )
}

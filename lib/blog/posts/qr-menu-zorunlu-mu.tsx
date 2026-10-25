import Link from 'next/link'

/** Yazı metni; başlık, tarih, SSS ve kaynaklar lib/blog/posts.ts'te */
export function Body() {
  return (
    <>
      <p>
        &quot;Restoranlarda QR menü zorunlu oldu&quot; cümlesini son bir yılda çok duydunuz. Gerçekte değişen, yiyecek-içecek
        işletmelerinin fiyat listesini nasıl göstereceğine dair kurallardır. Kısa cevap: yönetmelik masadaki fiyat listesinin
        karekodla gösterilmesine <strong>izin veriyor</strong>; giriş kapısındaki fiyat listesi ve misafirin istediğinde basılı liste
        alma hakkı ise devam ediyor.
      </p>

      <h2>Ne değişti? Fiyat Etiketi Yönetmeliği, 11 Ekim 2025</h2>
      <p>
        Ticaret Bakanlığı&apos;nın Fiyat Etiketi Yönetmeliği&apos;nde yaptığı değişiklik 11 Ekim 2025 tarihli ve 33044 sayılı
        Resmî Gazete&apos;de yayımlandı ve aynı gün yürürlüğe girdi. Yiyecek-içecek hizmeti veren işletmeleri ilgilendiren başlıca
        hükümler şunlar:
      </p>
      <ul>
        <li>
          <strong>Giriş kapısında liste:</strong> Tarife ve fiyat listeleri işyerinin giriş kapısının önüne, birden fazla kapı varsa her
          birine asılır.
        </li>
        <li>
          <strong>Masada liste:</strong> Fiyat listesi masaların üstüne de konur. Lokanta, restoran, kafe ve pastane gibi yerlerde
          masadaki fiyat listesi karekodla gösterilebilir.
        </li>
        <li>
          <strong>Basılı liste talep hakkı:</strong> Tüketici talep ederse fiyat listesinin basılı olarak ayrıca verilmesi zorunludur.
        </li>
        <li>
          <strong>Karekodun tanımı:</strong> Yönetmelik karekodu &quot;fiyat listesine erişimi sağlayan görsel&quot; olarak tanımlar.
        </li>
        <li>
          <strong>Tüm ürünler listede:</strong> Hizmete sunulan bütün ürünlerin fiyat listesinde yer alması gerekir; listede eksik ya
          da hatalı gösterilen her ürün ayrı aykırılık sayılır.
        </li>
        <li>
          <strong>Ek ücretler:</strong> Liste fiyatlarının dışında servis ücreti ya da başka bir adla ücret alınacaksa, bunun da fiyat
          listesinde gösterilmesi zorunludur.
        </li>
        <li>
          <strong>Veri aktarımı:</strong> İşletmeler fiyat listesi verilerini Bakanlığın kuracağı sisteme aktarmakla yükümlüdür; kriterler
          ilan edildikten sonra kapsamdaki işyerlerine üç ay süre tanınır.
        </li>
      </ul>

      <h2>Peki QR menü zorunlu mu?</h2>
      <p>
        Yönetmelik metni karekodu bir <strong>seçenek</strong> olarak düzenler: masadaki fiyat listesi basılı olabilir ya da karekodla
        gösterilebilir. Karekodu tercih eden işletme, misafir istediğinde basılı listeyi ayrıca vermek zorundadır. Bu nedenle pratikte
        en güvenli düzen şudur:
      </p>
      <ol>
        <li>Giriş kapısında okunaklı bir fiyat listesi,</li>
        <li>Her masada menüyü açan karekod,</li>
        <li>İsteyen misafir için kasada ya da serviste hazır bekleyen basılı bir liste.</li>
      </ol>
      <p>
        Karekod menünün işletmeye asıl kazancı, fiyat listesinin her zaman güncel olmasıdır. Yönetmelik listede eksik ya da hatalı
        gösterilen her ürünü ayrı aykırılık saydığı için fiyatı değişen ürünün menüde eski fiyatla kalması risk oluşturur. Dijital
        menüde fiyat panelden değiştirildiği anda karekodla açılan liste de güncellenir.
      </p>

      <h2>Menüde içerik ve kalori bilgisi ayrı bir konu</h2>
      <p>
        Fiyat listesi kuralları Ticaret Bakanlığı&apos;nın alanındadır. Menüde bileşen, alerjen ve kalori bilgisi ise Tarım ve Orman
        Bakanlığı&apos;nın gıda mevzuatıyla ilgilidir. Bakanlık, 1 Temmuz 2026 itibarıyla ulusal zincir işletmelerde içerik ve kalori
        bilgisinin sipariş öncesinde sunulmasını duyurdu ve bu bilgilerin masalardaki karekodlarla da sunulabileceğini belirtti. Ayrıntılar
        için <Link href="/blog/menude-kalori-ve-alerjen-bilgisi">menüde kalori ve alerjen bilgisi</Link> yazımıza bakın.
      </p>

      <h2>QR Chef ile uyumlu bir karekod menü</h2>
      <ul>
        <li>Menüdeki tüm ürünler fiyatlarıyla listelenir; fiyat değişikliği kaydedildiği anda yayındadır.</li>
        <li>Kapı için genel bir karekod ve her masa için ayrı karekod indirebilirsiniz.</li>
        <li>Fiyat planları ve saatli kampanyalarda misafir o an geçerli olan fiyatı görür.</li>
        <li>Her ürüne bileşen, alerjen ve kalori bilgisi eklenebilir.</li>
      </ul>
      <p>
        <em>
          Bu yazı bilgilendirme amaçlıdır ve hukuki danışmanlık yerine geçmez. Mevzuat değişebilir; güncel metin için Resmî
          Gazete&apos;yi ve ilgili Bakanlığın duyurularını takip edin.
        </em>
      </p>
    </>
  )
}

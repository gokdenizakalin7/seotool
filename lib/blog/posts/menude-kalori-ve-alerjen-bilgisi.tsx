import Link from 'next/link'

const ALLERGENS = [
  'Gluten içeren tahıllar (buğday, arpa, çavdar, yulaf vb.)',
  'Kabuklular (karides, yengeç, ıstakoz vb.)',
  'Yumurta',
  'Balık',
  'Yer fıstığı',
  'Soya',
  'Süt (laktoz dahil)',
  'Sert kabuklu meyveler (badem, fındık, ceviz, kaju, antep fıstığı vb.)',
  'Kereviz',
  'Hardal',
  'Susam',
  'Kükürt dioksit ve sülfitler',
  'Acı bakla (lupin)',
  'Yumuşakçalar (midye, kalamar, ahtapot vb.)',
]

/** Yazı metni; başlık, tarih, SSS ve kaynaklar lib/blog/posts.ts'te */
export function Body() {
  return (
    <>
      <p>
        Misafirlerin sipariş vermeden önce &quot;içinde ne var?&quot; sorusuna cevap bulabilmesi artık yalnızca iyi hizmet değil,
        mevzuatın da beklentisi. Bu yazıda menüde içerik, alerjen ve kalori bilgisiyle ilgili son düzenlemeyi ve bu bilgileri menünüze
        nasıl ekleyeceğinizi anlatıyoruz.
      </p>

      <h2>1 Temmuz 2026: zincir işletmelerde içerik ve kalori bilgisi</h2>
      <p>
        Tarım ve Orman Bakanlığı, 30 Haziran 2026&apos;daki duyurusunda 1 Temmuz 2026 itibarıyla ulusal zincir işletmelerde tüketicilerin
        sipariş öncesinde yiyecek ve içeceklerin içerik bilgilerini ve kalori miktarlarını görebileceğini açıkladı. Duyuruya göre bilgiler
        menüler, duvar panoları, dijital ekranlar ya da masalardaki karekodlar aracılığıyla sunulabilir. Ayrıntılı usul ve esaslar Türk
        Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği Kılavuzu&apos;nda yer alıyor.
      </p>
      <p>
        Zincir olmayan işletmeler için kapsam ve takvim konusunda Bakanlığın güncel duyurularını takip etmenizi öneririz. Kapsama
        girmeseniz bile bu bilgileri şimdiden menünüze eklemek, misafir güveni açısından fark yaratır.
      </p>

      <h2>Alerjen bildirimi: 14 alerjen</h2>
      <p>
        Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği, alerjen ya da intoleransa yol açan maddeleri
        yönetmeliğin ekinde sayar. Restoran ve kafelerde ambalajsız sunulan yiyecekler için de alerjen bilgisinin tüketiciye verilmesi
        beklenir. Menünüzde işaretlemeniz gereken 14 alerjen şunlardır:
      </p>
      <ol>
        {ALLERGENS.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ol>

      <h2>Menüye içerik ve alerjen nasıl yazılır?</h2>
      <ul>
        <li>
          <strong>Temel bileşenleri sıralayın:</strong> Bütün tarifi değil, misafirin karar vermesine yetecek ana bileşenleri yazın:
          &quot;Tavuk göğsü, mantar, krema, parmesan&quot;.
        </li>
        <li>
          <strong>Alerjenleri ayrıca işaretleyin:</strong> Bileşen listesinin içinde kaybolmasın. &quot;Süt, gluten&quot; gibi ayrı bir
          satır ya da rozet misafirin gözünden kaçmaz.
        </li>
        <li>
          <strong>Gizli alerjenlere dikkat:</strong> Soslar, kızartma yağı, garnitür ve süslemeler de alerjen içerebilir (ör. pesto
          sosunda çam fıstığı ve peynir, tatlı süslemesinde fındık).
        </li>
        <li>
          <strong>Tarif değişince güncelleyin:</strong> Tedarikçi ya da tarif değiştiğinde bileşen ve alerjen bilgisi de değişir.
          Dijital menüde bunu dakikalar içinde düzeltebilirsiniz.
        </li>
      </ul>

      <h2>Kalori bilgisi: porsiyon başına</h2>
      <p>
        Kalori, misafirin gördüğü porsiyon için yazılmalıdır. Tarifinizdeki her bileşenin gramajını biliyorsanız besin değeri
        tablolarıyla hesaplayabilirsiniz. QR Chef&apos;te ürün adı ve bileşenlerinden yapay zekâ ile yaklaşık bir kalori tahmini
        çıkarabilir, değeri kontrol edip onaylayabilir ya da kendi hesapladığınız değeri girebilirsiniz. Tahmin bir başlangıç
        noktasıdır; porsiyonunuz ve tarifinizle tutarlı olduğundan emin olun.
      </p>

      <h2>QR menüde bu bilgiler nerede görünür?</h2>
      <p>
        Her ürün kartında bileşenler, alerjen rozetleri ve kalori yer alır; ürüne dokunulduğunda ayrıntılar büyük görselle açılır.
        Basılı menüye sığmayan bu bilgiler dijital menüde yer sorunu yaratmaz ve masadaki karekodla açılan menü, Bakanlığın saydığı
        sunum yöntemlerinden biridir.
      </p>
      <p>
        Menünüzü dijitale taşımak için <Link href="/blog/qr-menu-nasil-yapilir">QR menü nasıl yapılır?</Link> rehberine göz atın ya da
        doğrudan <Link href="/signup">ücretsiz kaydolun</Link>.
      </p>
      <p>
        <em>
          Bu yazı bilgilendirme amaçlıdır ve hukuki danışmanlık yerine geçmez. Kapsam ve tarihler için Tarım ve Orman Bakanlığı&apos;nın
          güncel duyurularını esas alın.
        </em>
      </p>
    </>
  )
}

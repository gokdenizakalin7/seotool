/**
 * İşletme türüne göre QR menü açılış sayfaları (/qr-menu/<slug>). "kafe qr menü", "restoran qr menü" gibi
 * aramalara karşılık gelir. Her sayfanın metni türe özgüdür (kopya sayfa olmasın); örnek siteler
 * business_type ile veritabanından gelir.
 *
 * Metinler yalnızca üründe gerçekten olan özellikleri anlatır: fotoğraftan menü tarama, kalori tahmini, alerjen ve
 * bileşen, masa QR'ı, etkinlik, kampanya, fiyat planı, hakkımızda/iletişim, Wi-Fi kartı, 4 dilli arayüz.
 */

export interface BusinessPage {
  /** Adres: /qr-menu/<slug> */
  slug: string
  /** business_types kimliği (örnek işletme siteleri bu türden listelenir) */
  type: string
  /** Kısa ad: başlık ve bağlantı metinleri ("Bar ve pub") */
  name: string
  /** Çoğul: "QR Chef kullanan bar ve pub'lar" */
  plural: string
  /** <title> (" | QR Chef" eklenir; toplam ~60 karakteri geçmesin) */
  title: string
  h1: string
  description: string
  intro: string
  /** Bu türde tipik menü kategorileri */
  categories: string[]
  benefits: { title: string; text: string }[]
  faq: { q: string; a: string }[]
}

export const BUSINESS_PAGES: BusinessPage[] = [
  {
    slug: 'kafe',
    type: 'cafe',
    name: 'Kafe',
    plural: 'Kafeler',
    title: 'Kafe QR Menü: Kahve ve Kahvaltı Menünüz Dijitalde',
    h1: 'Kafeler için QR menü',
    description:
      'Kafeniz için QR menü: menünüzün fotoğrafından dijital menü, kalori ve alerjen bilgisi, Wi-Fi kartı, kampanya ve etkinlik sayfası. Ücretsiz başlayın.',
    intro:
      'Kafe menüleri sık değişir: mevsimlik içecekler, yeni tatlılar, kahvaltı saatleri, süt seçenekleri. Basılı menüyü her değişiklikte yeniden bastırmak yerine QR menüde fiyatı ya da ürünü panelden düzeltirsiniz; masadaki karekod aynı kalır, misafir güncel menüyü görür.',
    categories: ['Sıcak Kahveler', 'Soğuk Kahveler', 'Çaylar', 'Kahvaltı', 'Tatlılar', 'Sandviç ve Tostlar', 'Milkshake ve Smoothie'],
    benefits: [
      {
        title: 'Uzun kahve listesini fotoğraftan aktarın',
        text: 'Menünüzün fotoğrafını çekin; yapay zekâ ürün adlarını, fiyatları ve kategorileri okur. Latte, flat white, cold brew gibi onlarca satırı tek tek yazmanız gerekmez, yalnızca kontrol edip yayınlarsınız.',
      },
      {
        title: 'Kalori, içerik ve alerjen her üründe',
        text: 'Kalori tahminini yapay zekâ çıkarır, siz onaylarsınız. Süt, gluten, fındık gibi alerjenler ürün kartında rozet olarak görünür; laktoz hassasiyeti olan misafir sormadan seçim yapar.',
      },
      {
        title: 'Wi-Fi şifresi menünün en üstünde',
        text: 'Ağ adı ve şifre menü sayfasında kopyalama düğmesiyle durur. "Şifre neydi?" sorusu garsonu meşgul etmez.',
      },
      {
        title: 'Kahvaltı günü ve canlı müzik sitenizde',
        text: 'Hafta sonu kahvaltısı, akustik gece ya da workshop gibi etkinlikleri tarih ve saatiyle ekleyin. Haftalık tekrar eden etkinlik kendiliğinden yenilenir, geçmiş olanlar listeden düşer.',
      },
    ],
    faq: [
      {
        q: 'Mevsimlik içecekleri sadece belli dönemde nasıl gösteririm?',
        a: 'Mevsimlik ürünleri ayrı bir kategoride toplayın; kategoriyi panelden tek tıkla açıp kapatabilirsiniz. İndirimli ürün kampanyaları için gün ve saat takvimi de tanımlanabilir; süresi dolan kampanya müşteriye gösterilmez.',
      },
      {
        q: 'Turist misafirler menüyü okuyabilir mi?',
        a: 'Sitenin arayüzü Türkçe, İngilizce, Arapça ve Rusça seçilebilir. Ürün adları ve açıklamalar sizin yazdığınız gibi görünür; isterseniz açıklamalara İngilizce karşılıklarını da ekleyebilirsiniz.',
      },
      {
        q: 'Kafe QR menü için ücret ödemem gerekiyor mu?',
        a: 'QR Chef şu an ücretsiz sunulmaktadır. Kayıt olup menünüzü yükleyerek hemen kullanmaya başlayabilirsiniz.',
      },
    ],
  },
  {
    slug: 'restoran',
    type: 'restaurant',
    name: 'Restoran',
    plural: 'Restoranlar',
    title: 'Restoran QR Menü: Alerjen ve Kalori Bilgili Menü',
    h1: 'Restoranlar için QR menü',
    description:
      'Restoranınız için QR menü: ana yemek, ara sıcak ve tatlı menünüzü fotoğraftan aktarın; alerjen, bileşen ve kalori bilgisi, masa QR kodları ve işletme sitesi tek panelde.',
    intro:
      'Restoran menüsü onlarca üründen ve birçok kategoriden oluşur; fiyatlar ise enflasyonla birlikte sık güncellenir. QR menüde fiyat değişikliği saniyeler sürer, ürün tükendiğinde menüden kaldırırsınız ve misafir olmayan bir yemeği sipariş etmeye çalışmaz.',
    categories: ['Başlangıçlar', 'Çorbalar', 'Salatalar', 'Ara Sıcaklar', 'Ana Yemekler', 'Izgaralar', 'Tatlılar', 'İçecekler'],
    benefits: [
      {
        title: 'Bileşen ve alerjen bilgisi menüde',
        text: 'Her yemeğin temel bileşenlerini ve alerjenlerini ürün kartına ekleyin. Gluten, süt, yumurta, kabuklu yemiş gibi alerjenler rozetle görünür; misafir sipariş vermeden önce bilgiye ulaşır.',
      },
      {
        title: 'Masa bazlı QR kodlar',
        text: 'Her masaya ayrı QR kod basın. Hangi masadan kaç kez okutulduğunu panelde görürsünüz; masanın adı değişse bile basılı kod o masa için saymaya devam eder.',
      },
      {
        title: 'Fiyat planları: öğle ve akşam, yaz ve kış',
        text: 'Birden fazla fiyat listesi hazırlayıp takvime bağlayın ya da tek tıkla geçin. Menüyü ve QR kodu değiştirmeden fiyatlar o anki plana göre gösterilir.',
      },
      {
        title: 'Restoranınızın kendi sitesi',
        text: 'Menü, hakkımızda, iletişim ve etkinlik sayfalarıyla qr-chef.com.tr/restoraniniz adresinde bir siteniz olur. Adres, yol tarifi, telefon ve çalışma saatleri tek dokunuşla açılır.',
      },
    ],
    faq: [
      {
        q: 'Menüm çok uzun; hepsini tek tek girmem gerekir mi?',
        a: 'Hayır. Basılı menünüzün fotoğrafını yükleyin, yapay zekâ ürünleri, fiyatları ve kategorileri çıkarsın. Siz yalnızca kontrol edip düzeltirsiniz.',
      },
      {
        q: 'Ürün görselim yoksa ne olur?',
        a: 'Sık kullanılan ürünler için hazır katalog görselleri önerilir; dilerseniz kendi fotoğrafınızı yükleyebilirsiniz. Görsel eklemeden de menü yayınlanabilir.',
      },
      {
        q: 'Masadaki QR menü yasal olarak yeterli mi?',
        a: 'Fiyat Etiketi Yönetmeliği masadaki fiyat listesinin karekodla gösterilmesine izin verir; misafir isterse basılı liste ayrıca verilmelidir ve giriş kapısında fiyat listesi bulunmalıdır. Ayrıntılar için "QR menü zorunlu mu?" rehberimize bakın.',
      },
    ],
  },
  {
    slug: 'bar-pub',
    type: 'pub',
    name: 'Bar ve pub',
    plural: "Bar ve pub'lar",
    title: 'Bar ve Pub QR Menü: Kokteyl ve Happy Hour Fiyatları',
    h1: 'Bar ve pub için QR menü',
    description:
      'Bar ve pub için QR menü: kokteyl ve bira listeniz dijitalde, happy hour fiyat planları, saatli kampanyalar, maç ve canlı müzik etkinlikleri işletme sitenizde.',
    intro:
      'Barlarda fiyat günün saatine göre değişir: happy hour, maç gecesi, konser akşamı. QR menüde bu fiyatları önceden fiyat planı ya da saatli kampanya olarak hazırlarsınız; saat geldiğinde menü kendiliğinden güncellenir, kimse karton menünün üstünü karalamaz.',
    categories: ['Kokteyller', 'Biralar', 'Şaraplar', 'Viskiler', 'Shot', 'Alkolsüz Kokteyller', 'Atıştırmalıklar'],
    benefits: [
      {
        title: 'Saatli kampanyalar: "19:00\'a kadar bira 165 ₺"',
        text: 'Menünüzden ürünü seçin, kampanya fiyatını ve geçerli olduğu gün ile saatleri yazın. Kampanya süresince ürün kendi kategorisinde indirimli fiyatla görünür, süre dolunca normal fiyata döner.',
      },
      {
        title: 'Kombo menüler',
        text: '"1 bira + 1 patates" gibi paketleri kampanya olarak tanımlayın. Paket içeriği ve normal fiyata göre kazanç misafire otomatik gösterilir.',
      },
      {
        title: 'Maç gecesi ve canlı müzik takvimi',
        text: 'Etkinlikleri afişiyle ekleyin. Bugün bir etkinlik varsa menünün üstünde duyuru şeridi çıkar; haftalık tekrarlar kendiliğinden yenilenir.',
      },
      {
        title: 'Karanlık ortamda okunaklı',
        text: 'Müşteri sitesi telefonun koyu temasına uyar; loş ışıkta göz yormayan koyu menü kendiliğinden açılır.',
      },
    ],
    faq: [
      {
        q: 'Happy hour fiyatlarını her gün elle mi değiştirmeliyim?',
        a: 'Hayır. Saatli kampanya ya da takvimli fiyat planı tanımlarsınız; belirlediğiniz gün ve saatlerde fiyatlar kendiliğinden değişir.',
      },
      {
        q: 'Kokteyllerin içeriğini menüde gösterebilir miyim?',
        a: 'Evet. Her kokteylin bileşenlerini ve kısa açıklamasını ekleyin; bileşenler ürün kartında, ayrıntılar ürün detayında görünür. Menüdeki arama kutusu ürün adı ve açıklamasında arar.',
      },
      {
        q: 'Etkinlik sayfası Google\'da görünür mü?',
        a: 'Yaklaşan etkinliği olan işletmelerin etkinlik sayfası arama motorlarına açılır ve her etkinlik tarih, saat ve adres bilgisiyle yapısal veri olarak işaretlenir.',
      },
    ],
  },
  {
    slug: 'nargile-kafe',
    type: 'nargile',
    name: 'Nargile kafe',
    plural: 'Nargile kafeler',
    title: 'Nargile Kafe QR Menü: Aroma ve İçecek Listesi',
    h1: 'Nargile kafeler için QR menü',
    description:
      'Nargile kafeniz için QR menü: aroma listesi, çay ve içecek menüsü, maç gecesi etkinlikleri ve kampanyalar tek QR kodda. Fiyatları saniyeler içinde güncelleyin.',
    intro:
      'Nargile kafelerde menünün yarısı aroma listesidir ve stok sık değişir. QR menüde biten aromayı menüden kaldırır, yeni gelen karışımı fotoğrafıyla eklersiniz. Misafir masadan karekodu okutup aromaları, içecekleri ve atıştırmalıkları tek listede görür.',
    categories: ['Nargile Aromaları', 'Özel Karışımlar', 'Çaylar', 'Sıcak İçecekler', 'Soğuk İçecekler', 'Atıştırmalıklar'],
    benefits: [
      {
        title: 'Aroma stoğu anında güncel',
        text: 'Tükenen aromayı panelden kaldırın, yenisini ekleyin; değişiklik kaydettiğiniz anda menüde. Basılı listede "o bitti" demek zorunda kalmazsınız.',
      },
      {
        title: 'Uzun gecelerde kampanya',
        text: 'Gece yarısından sonra çay ikramı ya da hafta içi indirim gibi kampanyaları gün ve saat takvimiyle tanımlayın.',
      },
      {
        title: 'Maç yayınları etkinlik takviminde',
        text: 'Derbi ve maç gecelerini etkinlik olarak ekleyin; misafir hangi gün büyük ekran olduğunu sitenizden görür, menüde de duyuru çıkar.',
      },
      {
        title: 'Wi-Fi, Instagram ve Google yorumu tek sayfada',
        text: 'Menünün üstünde Wi-Fi şifresi, Instagram hesabınız ve Google yorum bağlantısı durur; memnun misafiri yorum bırakmaya yönlendirirsiniz.',
      },
    ],
    faq: [
      {
        q: 'Aromaları ayrı kategori olarak gösterebilir miyim?',
        a: 'Evet. Aromalar, karışımlar ve içecekler için ayrı kategoriler açabilir, sıralarını panelden değiştirebilirsiniz.',
      },
      {
        q: 'Fiyat değişikliği masadaki QR kodu bozar mı?',
        a: 'Hayır. QR kod sitenizin adresini açar; panelde yaptığınız her değişiklik aynı kodla anında görünür.',
      },
      {
        q: 'Birden fazla fiyat listesi tutabilir miyim?',
        a: 'Evet. Hafta içi ve hafta sonu gibi fiyat planları hazırlayıp takvime bağlayabilir ya da elle geçiş yapabilirsiniz.',
      },
    ],
  },
  {
    slug: 'pastane-firin',
    type: 'bakery',
    name: 'Pastane ve fırın',
    plural: 'Pastane ve fırınlar',
    title: 'Pastane ve Fırın QR Menü: Alerjen Bilgili Liste',
    h1: 'Pastane ve fırınlar için QR menü',
    description:
      'Pastane ve fırınlar için QR menü: pasta, börek ve tatlılarınız fotoğraflı dijital listede; gluten, süt, yumurta ve kuruyemiş alerjenleri her üründe. Ücretsiz başlayın.',
    intro:
      'Pastane ürünlerinde en çok sorulan soru "içinde ne var?" sorusudur: gluten, süt, yumurta, fındık, ceviz. QR menüde her ürünün bileşenleri ve alerjenleri kartında yazar; misafir vitrin önünde telefonundan bakıp güvenle seçer.',
    categories: ['Pastalar', 'Tatlılar', 'Börekler', 'Kurabiyeler', 'Ekmekler', 'Sıcak İçecekler', 'Kahvaltılıklar'],
    benefits: [
      {
        title: 'Alerjenler rozetle, bileşenler listeyle',
        text: 'Gluten, süt, yumurta, yer fıstığı ve sert kabuklu meyveler gibi alerjenler ürün kartında görünür. Bileşen listesi de ürün detayında yer alır.',
      },
      {
        title: 'Fotoğraflı ürün kartları',
        text: 'Kendi ürün fotoğraflarınızı yükleyin; görseller otomatik sıkıştırılır, menü telefonda hızlı açılır.',
      },
      {
        title: 'Günün ürünü öne çıksın',
        text: 'Taze çıkan ürünü "şefin tavsiyesi" olarak işaretleyin; kategorisinin en üstünde vurgulu görünür.',
      },
      {
        title: 'Özel gün kampanyaları',
        text: 'Anneler Günü pastası, bayram tatlıları gibi dönemsel kampanyaları başlangıç ve bitiş tarihiyle ekleyin; süre dolunca kendiliğinden kalkar.',
      },
    ],
    faq: [
      {
        q: 'Ürünlerin kalorisini nasıl hesaplarım?',
        a: 'Yapay zekâ ürün adı ve bileşenlerinden porsiyon başına yaklaşık kalori tahmini çıkarır; değeri kontrol edip onaylarsınız ya da kendi ölçtüğünüz değeri yazarsınız.',
      },
      {
        q: 'Paket servis müşterileri de menüyü görebilir mi?',
        a: 'Evet. Menünüz qr-chef.com.tr/isletmeniz adresinde herkese açıktır; bağlantıyı Instagram profilinize ya da WhatsApp\'a ekleyebilirsiniz.',
      },
      {
        q: 'Sezonluk ürünleri silmeden gizleyebilir miyim?',
        a: 'Evet. Sezonluk ürünleri ayrı bir kategoride toplayın; kategoriyi kapatıp dilediğiniz zaman yeniden açabilirsiniz.',
      },
    ],
  },
  {
    slug: 'kebapci-ocakbasi',
    type: 'kebab',
    name: 'Kebapçı ve ocakbaşı',
    plural: 'Kebapçı ve ocakbaşılar',
    title: 'Kebapçı ve Ocakbaşı QR Menü: Porsiyon ve Fiyatlar',
    h1: 'Kebapçı ve ocakbaşı için QR menü',
    description:
      'Kebapçı ve ocakbaşı için QR menü: kebap, pide, lahmacun ve meze menünüz dijitalde; porsiyon seçenekleri, güncel fiyatlar ve masa QR kodları. Menünüzü fotoğraftan aktarın.',
    intro:
      'Kebapçı menüsünde aynı ürünün birden fazla porsiyonu olur, et fiyatları da sık değişir. QR menüde fiyatları dakikalar içinde güncellersiniz; yarım ve tam porsiyon, acılı ve acısız seçenekleri ürün açıklamasında net gösterirsiniz.',
    categories: ['Kebaplar', 'Pide ve Lahmacun', 'Izgaralar', 'Mezeler', 'Çorbalar', 'Tatlılar', 'Ayran ve İçecekler'],
    benefits: [
      {
        title: 'Fiyat güncellemesi saniyeler içinde',
        text: 'Et fiyatı değiştiğinde menünün tamamını yeniden bastırmazsınız. Panelden fiyatı düzeltin, masadaki QR aynı kalsın.',
      },
      {
        title: 'Acı ve porsiyon bilgisi',
        text: 'Acı derecesini, gramajı ve porsiyonu ürün açıklamasına yazın; misafir siparişten önce ne geleceğini bilir.',
      },
      {
        title: 'Mezeleri fotoğrafla gösterin',
        text: 'Soğuk ve sıcak mezeleri fotoğraflı kartlarla sunun; menüde arama da olduğu için misafir aradığı ürünü hemen bulur.',
      },
      {
        title: 'Kalabalık masada herkes kendi telefonundan',
        text: 'Aile ve grup masalarında menü elden ele dolaşmaz; herkes karekodu okutup aynı anda inceler.',
      },
    ],
    faq: [
      {
        q: 'Basılı menümün fotoğrafından aktarım ne kadar sürer?',
        a: 'Fotoğrafı yükledikten sonra ürünler, fiyatlar ve kategoriler genellikle birkaç dakika içinde çıkar. Kontrol edip yayınladığınız anda menü sitenizde açılır.',
      },
      {
        q: 'Lahmacun ve pide gibi ürünlere görsel nereden bulurum?',
        a: 'Yaygın ürünler için hazır katalog görselleri önerilir. Kendi fotoğraflarınızı da yükleyebilirsiniz.',
      },
      {
        q: 'Gel-al müşterisi için menü bağlantısı paylaşabilir miyim?',
        a: 'Evet. Sitenizin adresini Google İşletme Profilinize, Instagram\'a ve WhatsApp mesajlarınıza ekleyebilirsiniz.',
      },
    ],
  },
  {
    slug: 'burger-fast-food',
    type: 'fastfood',
    name: 'Burger ve fast food',
    plural: 'Burger ve fast food işletmeleri',
    title: 'Burger ve Fast Food QR Menü: Menü ve Kampanyalar',
    h1: 'Burger ve fast food için QR menü',
    description:
      'Burger ve fast food işletmeleri için QR menü: menü kombinasyonları, saatli kampanyalar, kalori ve alerjen bilgisi, fotoğraflı ürün kartları. Ücretsiz QR menünüzü oluşturun.',
    intro:
      'Fast food menüsünü satan şey görsellerdir ve kombinasyonlardır. QR menüde her burgeri fotoğrafıyla gösterirsiniz; "burger + patates + içecek" paketlerini kampanya olarak tanımlarsınız ve misafir paketin ne kadar kazandırdığını görür.',
    categories: ['Burgerler', 'Menüler', 'Tavuk', 'Wrap ve Sandviç', 'Yan Ürünler', 'Soslar', 'İçecekler', 'Tatlılar'],
    benefits: [
      {
        title: 'Paket menüler kampanya olarak',
        text: 'Menünüzdeki ürünlerden paket oluşturun; içerik ve normal fiyata göre indirim oranı kartta görünür.',
      },
      {
        title: 'Kalori bilgisi her üründe',
        text: 'Burger ve yan ürünlerin porsiyon başına kalorisini yapay zekâ tahmin eder, siz onaylarsınız. Sağlıklı seçim yapmak isteyen misafir menüde görür.',
      },
      {
        title: 'Öğle saatine özel fiyat',
        text: 'Hafta içi öğle menüsü gibi kampanyaları gün ve saat aralığıyla tanımlayın; saat dışında kampanya gösterilmez.',
      },
      {
        title: 'Hızlı açılan menü',
        text: 'Görseller sıkıştırılır, sayfa sunucuda hazırlanır; misafir karekodu okuttuğu anda menü açılır, kuyruk beklemez.',
      },
    ],
    faq: [
      {
        q: 'Ekstra malzeme ve sos seçeneklerini nasıl gösteririm?',
        a: 'Soslar ve ekstralar için ayrı bir kategori açabilir ya da ürün açıklamasına seçenekleri yazabilirsiniz.',
      },
      {
        q: 'Kampanya bitince menüden kendim mi kaldırmalıyım?',
        a: 'Hayır. Kampanyanın bitiş tarihi ya da saat aralığı dolduğunda müşteriye gösterilmez.',
      },
      {
        q: 'Birden fazla şubem var, her biri için ayrı menü olur mu?',
        a: 'Her işletme kendi adresi, menüsü ve QR kodlarıyla ayrı site olarak açılır. Şubeleriniz için ayrı kayıt oluşturabilirsiniz.',
      },
    ],
  },
  {
    slug: 'meyhane',
    type: 'meyhane',
    name: 'Meyhane ve balık restoranı',
    plural: 'Meyhane ve balık restoranları',
    title: 'Meyhane ve Balık Restoranı QR Menü: Meze Listesi',
    h1: 'Meyhane ve balık restoranları için QR menü',
    description:
      'Meyhane ve balık restoranları için QR menü: günlük meze ve balık listesi, mevsimlik ürünler, fasıl ve canlı müzik geceleri işletme sitenizde. Fiyatları anında güncelleyin.',
    intro:
      'Meyhanede menü her gün biraz değişir: günün balığı, mevsim mezeleri, tezgâhta ne varsa. QR menüde o gün olmayan ürünü kaldırır, yeni geleni eklersiniz; misafir masaya oturduğunda güncel meze ve balık listesini görür.',
    categories: ['Soğuk Mezeler', 'Ara Sıcaklar', 'Günün Balıkları', 'Salatalar', 'Rakı', 'Şaraplar', 'Tatlılar'],
    benefits: [
      {
        title: 'Günün balığı her sabah güncel',
        text: 'Günün balıklarını ayrı kategoride tutun; ürünleri ve fiyatları o günkü tezgâha göre düzeltin. Basılı menüde "sorunuz" yazmak zorunda kalmazsınız.',
      },
      {
        title: 'Meze tepsisi yerine fotoğraflı liste',
        text: 'Mezeleri fotoğraflarıyla gösterin; misafir tepsiyi beklemeden ne istediğine karar verir.',
      },
      {
        title: 'Fasıl ve canlı müzik geceleri',
        text: 'Fasıl, canlı müzik ve özel geceleri etkinlik takviminize ekleyin; haftalık olanlar kendiliğinden tekrarlar, rezervasyon için telefon ve WhatsApp bir dokunuş uzaklıkta.',
      },
      {
        title: 'Alerjen bilgisi: balık ve kabuklular',
        text: 'Balık, kabuklu deniz ürünleri ve yumuşakçalar gibi alerjenleri ürün kartında işaretleyin; hassasiyeti olan misafir güvenle seçer.',
      },
    ],
    faq: [
      {
        q: 'Rakı ve şarap listesini ayrı gösterebilir miyim?',
        a: 'Evet. İçkiler için ayrı kategoriler açabilir, şişe ve kadeh fiyatlarını ürün adı ya da açıklamasıyla ayırabilirsiniz.',
      },
      {
        q: 'Turist misafirler için yabancı dil var mı?',
        a: 'Sitenin arayüzü Türkçe, İngilizce, Arapça ve Rusça seçilebilir. Ürün adları ve açıklamalar sizin yazdığınız gibi görünür.',
      },
      {
        q: 'Rezervasyon bilgisini nerede paylaşırım?',
        a: 'İletişim sayfanızda telefon ve WhatsApp düğmeleri, adres ve yol tarifi bulunur. Etkinlik açıklamalarına rezervasyon notu da ekleyebilirsiniz.',
      },
    ],
  },
]

export function getBusinessPage(slug: string): BusinessPage | undefined {
  return BUSINESS_PAGES.find((p) => p.slug === slug)
}

export const businessPagePath = (slug: string) => `/qr-menu/${slug}`

/**
 * Panel rehberi (tur) adım kataloğu: en fazla 15 adım, yalnızca kullanıcının iş yapmak için bilmesi gerekenler.
 *
 * Her adım isteğe bağlı bir sayfaya (page) ve hedefe (target = ilgili öğedeki `data-tour` değeri) bağlıdır.
 * Hedefi olmayan adımlar ekranın ortasında gösterilir; sayfası olmayan adımlar bulunulan sayfada kalır.
 * `optional` adımlar hedef sayfada yoksa sessizce atlanır (ör. menüsü olmayan işletmede editörün kategori bölümü).
 *
 * Sayfalar `data-tour-page="<page>" data-tour-ready="true|false"` ile hazır olduklarını bildirir; rehber bir adımı
 * göstermeden önce sayfanın verisinin yüklenmesini bekler.
 */

export type TourPage = 'menu-editor' | 'menus' | 'qr-codes' | 'settings' | 'campaigns' | 'price-plans' | 'events' | 'about'

export const TOUR_PAGE_ROUTES: Record<TourPage, string> = {
  'menu-editor': '/dashboard/menu-editor',
  menus: '/dashboard/menus',
  'qr-codes': '/dashboard/qr-codes',
  settings: '/dashboard/settings',
  campaigns: '/dashboard/campaigns',
  'price-plans': '/dashboard/price-plans',
  events: '/dashboard/events',
  about: '/dashboard/about',
}

/** genel: karşılama ve bitiş (yardım menüsünde ayrı bölüm olarak listelenmez) */
export type TourChapterId = 'genel' | 'editor' | 'menuler' | 'qr' | 'ayarlar' | 'site'

export interface TourChapter {
  id: TourChapterId
  title: string
  /** Yardım menüsünde görünen soru biçimindeki açıklama */
  question: string
}

/** Yardım menüsünden tek başına başlatılabilen bölümler */
export const TOUR_CHAPTERS: TourChapter[] = [
  { id: 'editor', title: 'Canlı Menü Editörü', question: 'Menümü nasıl oluşturur ve düzenlerim?' },
  { id: 'menuler', title: 'Menü Listesi', question: 'Menümü nasıl yayına alırım?' },
  { id: 'qr', title: 'QR Kodlar & Masalar', question: 'QR kodlarımı nasıl oluşturup basarım?' },
  { id: 'ayarlar', title: 'Restoran Ayarları', question: 'İşletme bilgilerimi nasıl düzenlerim?' },
  { id: 'site', title: 'Web Sitem', question: 'Kampanya, fiyat planı ve etkinlikleri nasıl yönetirim?' },
]

const CHAPTER_TITLES: Record<TourChapterId, string> = {
  genel: 'Panel Rehberi',
  ...Object.fromEntries(TOUR_CHAPTERS.map((c) => [c.id, c.title])),
} as Record<TourChapterId, string>

export function chapterTitle(id: TourChapterId): string {
  return CHAPTER_TITLES[id] || ''
}

export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  id: string
  chapter: TourChapterId
  /** Adımın gösterileceği sayfa; yoksa bulunulan sayfada kalınır */
  page?: TourPage
  /** Vurgulanacak öğenin `data-tour` değeri; yoksa adım ekranın ortasında gösterilir */
  target?: string
  /** Hedef sayfada yoksa adım atlanır */
  optional?: boolean
  /** Hedef kenar çubuğunda: dar ekranda çubuk açılır */
  sidebar?: boolean
  placement?: TourPlacement
  title: string
  body: string[]
  bullets?: string[]
  tip?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    chapter: 'genel',
    title: 'QR Chef paneline hoş geldiniz!',
    body: [
      'Bu kısa rehber, menünüzü nasıl oluşturup yayına alacağınızı, masalarınız için QR kod basmayı ve müşterilerinizin gördüğü işletme sitesini nereden yöneteceğinizi gösterir.',
      'Yaklaşık 2 dakika sürer. Her adımda ilgili alan ekranda vurgulanır; İleri düğmesi ya da klavyedeki → tuşuyla ilerleyin.',
    ],
    tip: 'Rehberi daha sonra sağ üstteki soru işareti (?) düğmesinden, istediğiniz bölümden başlayarak yeniden açabilirsiniz.',
  },

  /* ---------------- Canlı menü editörü ---------------- */
  {
    id: 'nav-menu-editor',
    chapter: 'editor',
    page: 'menu-editor',
    target: 'nav-menu-editor',
    sidebar: true,
    placement: 'right',
    title: 'Canlı Menü Editörü',
    body: [
      'Menünüzü oluşturduğunuz ve düzenlediğiniz asıl yer burasıdır: kategoriler, ürünler, fiyatlar ve görseller. Yaptığınız değişiklikleri müşterinin göreceği biçimde anında izlersiniz.',
    ],
  },
  {
    id: 'editor-templates',
    chapter: 'editor',
    page: 'menu-editor',
    target: 'editor-templates',
    placement: 'bottom',
    title: 'Hazır Menü Paketleri',
    body: [
      'En hızlı başlangıç: işletme türünüze göre hazırlanmış kategori ve ürün setlerinden birini tek tıkla yükleyin; sonra her ürünün adını, fiyatını ve görselini dilediğiniz gibi değiştirin.',
    ],
  },
  {
    id: 'editor-scan',
    chapter: 'editor',
    page: 'menu-editor',
    target: 'editor-scan',
    placement: 'bottom',
    title: 'Kendi Menünü Tara',
    body: [
      'Basılı menünüzün fotoğrafını çekin ya da yükleyin; yapay zeka kategorileri, ürünleri ve fiyatları okuyup dijital menüye çevirir. Kaydetmeden önce sonucu gözden geçirip düzeltebilirsiniz.',
    ],
    tip: 'Fotoğrafı iyi ışıkta, menüyü tam kadraja alarak çekerseniz tanıma çok daha isabetli olur.',
  },
  {
    id: 'editor-empty',
    chapter: 'editor',
    page: 'menu-editor',
    target: 'editor-empty',
    optional: true,
    title: 'Henüz menünüz yok',
    body: [
      'Menü oluşturana kadar editör bu başlangıç kartını gösterir. Üç yoldan birini seçin: hazır paket yükleyin, basılı menünüzü taratın ya da boş bir menüyle sıfırdan başlayın.',
      'Menü oluşunca burada kategori listesi ve canlı telefon önizlemesi belirir.',
    ],
  },
  {
    id: 'editor-categories',
    chapter: 'editor',
    page: 'menu-editor',
    target: 'editor-categories',
    optional: true,
    title: 'Kategoriler ve ürünler',
    body: [
      "Menünüz kategorilerden (Kahvaltı, Burgerler, Tatlılar…) ve içlerindeki ürünlerden oluşur. '+ Yeni Kategori' ile kategori ekler; her kategori kartındaki 'Ürün Ekle' ile ürünün adını, fiyatını, açıklamasını ve görselini girersiniz.",
      "Kategori kartındaki 'Menüde Açık / Gizli' düğmesi kategoriyi müşteriden gizler; soldaki oklar sırasını değiştirir.",
    ],
    tip: 'Üstteki Menü Başlığı kartındaki renk seçici markanızın rengini belirler; menüye ve sitenize uygulanır, otomatik kaydedilir.',
  },
  {
    id: 'editor-save',
    chapter: 'editor',
    page: 'menu-editor',
    target: 'editor-save',
    optional: true,
    placement: 'bottom',
    title: 'Kaydet',
    body: [
      "Değişiklikler kaydedene kadar yalnızca sizin ekranınızdadır. Kaydedilmemiş değişiklik olduğunda düğme turuncuya döner ve altta bir hatırlatma çubuğu belirir. Yanındaki 'Canlı Menü' bağlantısı yayındaki menüyü yeni sekmede açar.",
    ],
  },

  /* ---------------- Menü listesi ---------------- */
  {
    id: 'nav-menus',
    chapter: 'menuler',
    page: 'menus',
    target: 'nav-menus',
    sidebar: true,
    placement: 'right',
    title: 'Menü Listesi: yayına alma',
    body: [
      "Menünüzün müşteriye açık olup olmadığını buradan yönetirsiniz. Bir menü 'Yayında Değil' ise QR kodu okutan müşteri boş sayfa görür; menünüzü hazırladıktan sonra mutlaka yayına alın.",
    ],
  },
  {
    id: 'menu-card',
    chapter: 'menuler',
    page: 'menus',
    target: 'menu-card',
    optional: true,
    placement: 'right',
    title: 'Menü kartı',
    body: [
      'Kartın köşesindeki etiket yayın durumunu gösterir. Sağ üstteki ⋮ menüsünden menüyü yayına alır ya da kaldırır, editörde açar, müşteri gözüyle görürsünüz.',
    ],
    tip: 'Menüyü silmek kategorileri ve ürünleri de kalıcı olarak siler; silmek yerine yayından kaldırmayı tercih edin.',
  },

  /* ---------------- QR kodlar ---------------- */
  {
    id: 'nav-qr',
    chapter: 'qr',
    page: 'qr-codes',
    target: 'nav-qr',
    sidebar: true,
    placement: 'right',
    title: 'QR Kodlar & Masalar',
    body: [
      'Müşterilerinizin menüye ulaşmasını sağlayan QR kodları burada oluşturur ve yazdırırsınız: genel bir mekan QR kodu ve masa masa ayrı QR kodlar.',
    ],
  },
  {
    id: 'qr-general',
    chapter: 'qr',
    page: 'qr-codes',
    target: 'qr-general',
    title: 'Genel mekan QR kodu',
    body: [
      "Bu kod menünüzün ana adresini açar; sosyal medya profilinizde, broşürlerde ya da giriş kapısında kullanın. Bağlantıyı kopyalayabilir, 'Stand Olarak Yazdır' ile matbaaya hazır bir masa standı indirebilirsiniz.",
    ],
  },
  {
    id: 'qr-add-table',
    chapter: 'qr',
    page: 'qr-codes',
    target: 'qr-add-table',
    placement: 'bottom',
    title: 'Masalara özel QR kodlar',
    body: [
      "'Yeni Masa Ekle' ile her masa için ayrı QR kod üretin (Masa 1, Bahçe 3…); hangi masanın menüyü kaç kez açtığını görürsünüz. Eklediğiniz masalar aşağıdaki listede yer alır; satırdaki düğmelerle masa standını yazdırır, 'A4 QR Baskısı' ile tüm masaları tek sayfada basarsınız.",
    ],
    tip: 'Masa standına Wi-Fi adınızı ve şifrenizi de basabilirsiniz; bunun için Ayarlar → Wi-Fi bilgisini doldurun.',
  },

  /* ---------------- Restoran ayarları ---------------- */
  {
    id: 'nav-settings',
    chapter: 'ayarlar',
    page: 'settings',
    target: 'nav-settings',
    sidebar: true,
    placement: 'right',
    title: 'Restoran Ayarları',
    body: ['İşletmenizle ilgili her şey burada; bilgiler müşteri sitenizde ve masa standlarında kullanılır.'],
    bullets: [
      'İşletme & Adres: ad, işletme türü, telefon, adres, çalışma saatleri',
      'Sosyal & İletişim: Instagram, WhatsApp, Google yorum bağlantısı',
      'Wi-Fi & Misafir Bilgisi, Logo & Tema, Giriş Şifresi',
    ],
    tip: "Değişiklikler sayfanın altındaki 'Değişiklikleri Kaydet' düğmesine basana kadar kaydedilmez.",
  },

  /* ---------------- Web sitem ---------------- */
  {
    id: 'nav-site',
    chapter: 'site',
    page: 'campaigns',
    target: 'nav-site',
    sidebar: true,
    placement: 'right',
    title: 'Web Sitem: müşterinizin gördüğü site',
    body: ['QR kodu okutan müşteri yalnızca bir menü değil, işletmenize ait küçük bir web sitesi görür. Bu bölümler o siteyi doldurur:'],
    bullets: [
      'Kampanyalar: ürün paketleri (ör. Bira + Patates) ya da belli gün ve saatlerde indirimli ürünler (ör. 19:00\'a kadar Efes 165 ₺), menünün en üstünde öne çıkar',
      'Fiyat Planları: happy hour, maç günü gibi dönemlere özel fiyatlar; QR kod değişmez',
      'Etkinlikler: canlı müzik, maç yayını gibi duyurular',
      'Hakkımızda: sitenizdeki tanıtım metni (yapay zeka ile taslak oluşturabilirsiniz)',
    ],
    tip: "'Sitemi Gör' bağlantısı sitenizi müşteri gözüyle yeni sekmede açar.",
  },

  {
    id: 'finish',
    chapter: 'genel',
    target: 'header-help',
    placement: 'bottom',
    title: 'Hazırsınız!',
    body: [
      'Önerdiğimiz sıra: önce menünüzü oluşturup yayına alın, ardından masalarınız için QR kodları basın.',
      'Takıldığınız her noktada bu soru işareti düğmesinden rehberi bölüm bölüm yeniden açabilirsiniz.',
    ],
  },
]

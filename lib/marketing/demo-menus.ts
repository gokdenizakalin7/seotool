import type { Menu, MenuCategory, MenuItem } from '@/lib/types'
import type { SiteRestaurant } from '@/components/public/site/types'
import { catalogImageUrl } from '@/lib/image-url'
import catalogManifest from '@/scripts/catalog-images/manifest.json'

/**
 * /qr-menu/<tür> sayfalarındaki demo menüler. Tamamen kurgusal test verisidir: veritabanına, gerçek
 * işletmelere ya da dış adreslere bağlı değildir. Görseller repodaki statik katalogdan (/public/catalog).
 * Restoranın `id`'si bilerek yok: müşteri sayfası görüntülenme sayacı demo için hiç istek atmaz.
 */

export interface DemoMenu {
  restaurant: SiteRestaurant
  menu: Menu
}

type ItemSeed = [
  name: string,
  price: number,
  image: string,
  calories: number,
  allergens: string[],
  ingredients: string[],
  description: string,
  featured?: boolean,
]

interface DemoSeed {
  restaurant: SiteRestaurant
  categories: { name: string; description: string; items: ItemSeed[] }[]
}

// Katalogdaki gibi: hash önbelleği kırar, single=1 küçük (-s) varyantı olmayan görselleri işaretler
const CATALOG = (catalogManifest as unknown as { items: Record<string, { hash?: string; single?: boolean }> }).items
const img = (slug: string) => catalogImageUrl(slug, CATALOG[slug]?.hash, Boolean(CATALOG[slug]?.single))

const DEMO_WIFI = { wifi_name: 'QRChef-Demo', wifi_password: 'demo1234' }

function buildMenu(type: string, seed: DemoSeed): DemoMenu {
  let n = 0
  const categories: MenuCategory[] = seed.categories.map((cat, ci) => ({
    id: `demo-${type}-cat-${ci + 1}`,
    name: cat.name,
    description: cat.description,
    display_order: ci,
    is_active: true,
    items: cat.items.map(([name, price, image, calories, allergens, ingredients, description, featured], ii): MenuItem => ({
      id: `demo-${type}-${++n}`,
      name,
      description,
      price: `${price} ₺`,
      image_url: img(image),
      calories,
      calorie_source: 'auto',
      allergens,
      ingredients,
      display_order: ii,
      is_available: true,
      is_featured: Boolean(featured),
    })),
  }))
  return {
    restaurant: seed.restaurant,
    menu: {
      id: `demo-${type}`,
      name: `${seed.restaurant.name} Menüsü`,
      description: '',
      image_url: '',
      is_listed: true,
      available_days: [0, 1, 2, 3, 4, 5, 6],
      layout: 'grid',
      created_at: '',
      updated_at: '',
      categories,
    },
  }
}

const SEEDS: Record<string, DemoSeed> = {
  kafe: {
    restaurant: { name: 'Köşe Kahve', business_type: 'cafe', primary_color: '#b45309', currency: '₺', cover_url: img('flat-white'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Sıcak Kahveler',
        description: 'Günlük kavrulmuş çekirdeklerle',
        items: [
          ['Flat White', 145, 'flat-white', 120, ['Süt Ürünleri'], ['Espresso', 'Süt'], 'Çift shot espresso ve ipeksi süt köpüğü.', true],
          ['Caffè Latte', 140, 'caffe-latte', 150, ['Süt Ürünleri'], ['Espresso', 'Süt'], 'Yumuşak içimli, bol sütlü klasik latte.'],
          ['Türk Kahvesi', 95, 'turk-kahvesi', 15, [], ['Türk kahvesi', 'Su'], 'Közde pişirilmiş, lokum eşliğinde.'],
          ['Filtre Kahve', 110, 'filtre-kahve', 5, [], ['Filtre kahve', 'Su'], 'Günün tek kökenli çekirdeğiyle demlenir.'],
        ],
      },
      {
        name: 'Soğuk Kahveler',
        description: 'Buz gibi ferahlık',
        items: [
          ['Iced Latte', 150, 'iced-latte', 140, ['Süt Ürünleri'], ['Espresso', 'Süt', 'Buz'], 'Buz üzerine espresso ve soğuk süt.'],
          ['Cold Brew', 155, 'cold-brew', 5, [], ['Soğuk demleme kahve', 'Buz'], '16 saat soğuk demlenmiş, düşük asiditeli.', true],
          ['Iced Caramel Macchiato', 165, 'iced-caramel-macchiato', 230, ['Süt Ürünleri'], ['Espresso', 'Süt', 'Karamel sos', 'Vanilya şurubu'], 'Vanilyalı süt, espresso ve karamel sos.'],
          ['Frappe', 160, 'frappe', 260, ['Süt Ürünleri'], ['Kahve', 'Süt', 'Buz', 'Şeker'], 'Köpüklü, buzlu ve tatlı.'],
        ],
      },
      {
        name: 'Kahvaltı',
        description: 'Her gün 09:00–14:00',
        items: [
          ['Klasik Kahvaltı Tabağı', 420, 'klasik-kahvalti-tabagi', 720, ['Süt Ürünleri', 'Yumurta', 'Gluten'], ['Beyaz peynir', 'Kaşar', 'Zeytin', 'Domates', 'Salatalık', 'Haşlanmış yumurta', 'Reçel'], 'Peynirler, zeytin, söğüş, yumurta ve sıcak ekmek.', true],
          ['Menemen', 210, 'menemen', 340, ['Yumurta'], ['Yumurta', 'Domates', 'Biber', 'Tereyağı'], 'Bakır sahanda, köy yumurtasıyla.'],
          ['Avokado Tost', 260, 'avokado-tost', 410, ['Gluten', 'Yumurta'], ['Ekşi mayalı ekmek', 'Avokado', 'Poşe yumurta', 'Pul biber'], 'Ekşi mayalı ekmek, ezilmiş avokado ve poşe yumurta.'],
          ['Eggs Benedict', 290, 'eggs-benedict', 560, ['Gluten', 'Yumurta', 'Süt Ürünleri'], ['Brioche', 'Poşe yumurta', 'Hollandez sos', 'Hindi füme'], 'Hollandez soslu poşe yumurtalar.'],
        ],
      },
      {
        name: 'Sandviç ve Tostlar',
        description: 'Gün boyu sıcak servis',
        items: [
          ['Kaşarlı Tost', 150, 'kasarli-tost', 380, ['Gluten', 'Süt Ürünleri'], ['Tost ekmeği', 'Kaşar peyniri', 'Tereyağı'], 'Bol kaşarlı, çıtır klasik.'],
          ['Club Sandwich', 290, 'club-sandwich', 690, ['Gluten', 'Yumurta', 'Süt Ürünleri'], ['Tavuk göğsü', 'Hindi füme', 'Cheddar', 'Marul', 'Domates', 'Mayonez'], 'Üç kat, patates kızartmasıyla.'],
          ['Kaşar Domates Baget', 210, 'baget-sandvic-kasar-domates', 430, ['Gluten', 'Süt Ürünleri'], ['Baget', 'Kaşar', 'Domates', 'Roka'], 'Taze baget, kaşar ve domates.'],
          ['Kruvasan Sandviç', 240, 'kruvasan-sandvic-hindi-fume', 470, ['Gluten', 'Süt Ürünleri'], ['Kruvasan', 'Hindi füme', 'Cheddar', 'Marul'], 'Tereyağlı kruvasan, hindi füme ve cheddar.'],
        ],
      },
      {
        name: 'Tatlılar',
        description: 'Ev yapımı, her sabah taze',
        items: [
          ['San Sebastian Cheesecake', 230, 'san-sebastian-cheesecake', 510, ['Süt Ürünleri', 'Yumurta'], ['Krem peynir', 'Krema', 'Yumurta', 'Şeker'], 'Yanık yüzeyli, akışkan dokulu.', true],
          ['Brownie', 170, 'brownie', 450, ['Gluten', 'Süt Ürünleri', 'Yumurta', 'Ağaç Yemişi'], ['Bitter çikolata', 'Tereyağı', 'Ceviz'], 'Cevizli, sıcak servis.'],
          ['Tiramisu Latte', 175, 'tiramisu-latte', 260, ['Süt Ürünleri'], ['Espresso', 'Süt', 'Maskarpone aroması', 'Kakao'], 'Tatlı tadında bir latte.'],
          ['Tarçınlı Rulo', 150, 'cinnamon-roll', 420, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Maya hamuru', 'Tarçın', 'Esmer şeker', 'Krem peynir kreması'], 'Krem peynir kremalı, ılık.'],
        ],
      },
    ],
  },

  restoran: {
    restaurant: { name: 'Sofra Lokantası', business_type: 'restaurant', primary_color: '#b91c1c', currency: '₺', cover_url: img('kuzu-tandir'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Çorbalar',
        description: 'Günlük kazan çorbaları',
        items: [
          ['Mercimek Çorbası', 120, 'mercimek-corbasi', 210, ['Gluten'], ['Kırmızı mercimek', 'Soğan', 'Havuç', 'Tereyağı'], 'Limon ve kıtır ekmekle.', true],
          ['Ezogelin Çorbası', 120, 'ezogelin-corbasi', 230, ['Gluten'], ['Mercimek', 'Bulgur', 'Pirinç', 'Nane'], 'Naneli, hafif acılı.'],
          ['Kremalı Mantar Çorbası', 140, 'kremali-mantar-corbasi', 260, ['Süt Ürünleri', 'Gluten'], ['Kültür mantarı', 'Krema', 'Tereyağı'], 'İpeksi kıvamda.'],
          ['Domates Çorbası', 120, 'domates-corbasi', 190, ['Süt Ürünleri'], ['Domates', 'Kaşar rendesi', 'Fesleğen'], 'Kaşar rendesiyle.'],
        ],
      },
      {
        name: 'Başlangıçlar',
        description: 'Paylaşmalık lezzetler',
        items: [
          ['Humus', 160, 'humus', 280, ['Susam'], ['Nohut', 'Tahin', 'Limon', 'Zeytinyağı'], 'Tahinli, sıcak pide ile.'],
          ['Sigara Böreği', 170, 'sigara-boregi', 380, ['Gluten', 'Süt Ürünleri'], ['Yufka', 'Beyaz peynir', 'Maydanoz'], '6 adet, çıtır çıtır.'],
          ['Mücver', 180, 'mucver', 320, ['Gluten', 'Yumurta', 'Süt Ürünleri'], ['Kabak', 'Yumurta', 'Dereotu', 'Beyaz peynir'], 'Sarımsaklı yoğurt eşliğinde.'],
          ['Fırında Hellim', 220, 'firinda-hellim', 360, ['Süt Ürünleri'], ['Hellim peyniri', 'Kekik', 'Zeytinyağı'], 'Közde kızarmış hellim dilimleri.'],
        ],
      },
      {
        name: 'Ana Yemekler',
        description: 'Ev usulü tencere yemekleri',
        items: [
          ['Kuzu Tandır', 520, 'kuzu-tandir', 780, ['Süt Ürünleri'], ['Kuzu eti', 'Tereyağlı pilav', 'Közlenmiş biber'], 'Saatlerce pişen kuzu, pilav eşliğinde.', true],
          ['Hünkâr Beğendi', 480, 'hunkar-begendi', 740, ['Süt Ürünleri', 'Gluten'], ['Dana eti', 'Patlıcan', 'Beşamel', 'Kaşar'], 'Közlenmiş patlıcan beğendi üzerinde.'],
          ['Karnıyarık', 340, 'karniyarik', 520, [], ['Patlıcan', 'Kıyma', 'Domates', 'Biber'], 'Pilav ve cacıkla.'],
          ['Etli Kuru Fasulye', 290, 'etli-kuru-fasulye', 560, [], ['Kuru fasulye', 'Dana eti', 'Salça'], 'Tereyağlı pilavla.'],
        ],
      },
      {
        name: 'Izgaralar',
        description: 'Kömür ateşinde',
        items: [
          ['Izgara Köfte', 380, 'izgara-kofte', 640, ['Gluten'], ['Dana kıyma', 'Soğan', 'Ekmek içi', 'Baharat'], 'Piyaz ve közlenmiş biberle.'],
          ['Tavuk Şiş', 340, 'tavuk-sis', 520, ['Süt Ürünleri'], ['Tavuk göğsü', 'Yoğurt marine', 'Biber'], 'Yoğurtlu marine, bulgur pilavıyla.'],
          ['Kuzu Pirzola', 690, 'kuzu-pirzola', 720, [], ['Kuzu pirzola', 'Kekik', 'Közlenmiş domates'], '4 adet, közlenmiş sebzeyle.', true],
          ['Karışık Izgara', 620, 'karisik-izgara', 890, ['Gluten'], ['Köfte', 'Tavuk şiş', 'Kuzu şiş', 'Lavaş'], 'Tek kişilik karışık tabak.'],
        ],
      },
      {
        name: 'Tatlılar',
        description: 'Geleneksel tatlılar',
        items: [
          ['Fırın Sütlaç', 140, 'firin-sutlac', 320, ['Süt Ürünleri'], ['Süt', 'Pirinç', 'Şeker', 'Tarçın'], 'Üstü kızarmış, soğuk servis.'],
          ['Künefe', 230, 'kunefe', 560, ['Gluten', 'Süt Ürünleri', 'Antep Fıstığı'], ['Kadayıf', 'Künefe peyniri', 'Şerbet', 'Antep fıstığı'], 'Sıcak, fıstıklı.', true],
          ['Kazandibi', 150, 'kazandibi', 340, ['Süt Ürünleri'], ['Süt', 'Pirinç unu', 'Şeker'], 'Karamelize tabanlı.'],
          ['Ayva Tatlısı', 180, 'ayva-tatlisi', 380, ['Süt Ürünleri'], ['Ayva', 'Şeker', 'Karanfil', 'Kaymak'], 'Kaymak eşliğinde.'],
        ],
      },
    ],
  },

  'bar-pub': {
    restaurant: { name: 'Gece Kuşu Pub', business_type: 'pub', primary_color: '#7c3aed', currency: '₺', cover_url: img('negroni'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Kokteyller',
        description: 'Barmenin imza tarifleri',
        items: [
          ['Negroni', 420, 'negroni', 200, [], ['Cin', 'Campari', 'Vermut', 'Portakal kabuğu'], 'Acı-tatlı klasik.', true],
          ['Mojito', 380, 'mojito', 210, [], ['Beyaz rom', 'Taze nane', 'Lime', 'Soda'], 'Taze nane ve lime ile.'],
          ['Aperol Spritz', 390, 'aperol-spritz', 170, ['Kükürt Dioksit'], ['Aperol', 'Prosecco', 'Soda', 'Portakal'], 'Prosecco ve portakalla.'],
          ['Espresso Martini', 420, 'espresso-martini', 230, [], ['Votka', 'Kahve likörü', 'Espresso'], 'Taze espresso ile çalkalanır.'],
        ],
      },
      {
        name: 'Biralar',
        description: 'Fıçı ve şişe',
        items: [
          ['Fıçı Bira 50 cl', 210, 'fici-bira-50cl', 215, ['Gluten'], ['Arpa maltı', 'Şerbetçiotu'], 'Soğuk, köpüklü fıçı.', true],
          ['Guinness Draught 44 cl', 290, 'guinness-draught-44cl', 180, ['Gluten'], ['Kavrulmuş arpa', 'Şerbetçiotu'], 'Kremsi köpüklü stout.'],
          ['IPA 33 cl', 260, 'gara-guzu-ipa-33cl', 190, ['Gluten'], ['Arpa maltı', 'Şerbetçiotu'], 'Meyvemsi, belirgin acılık.'],
          ['Corona Extra', 250, 'corona-extra', 150, ['Gluten'], ['Arpa maltı', 'Mısır'], 'Lime dilimiyle.'],
        ],
      },
      {
        name: 'Viskiler',
        description: '4 cl servis',
        items: [
          ['Jameson', 330, 'jameson', 100, [], ['İrlanda viskisi'], 'Yumuşak İrlanda harmanı.'],
          ['Jack Daniel\'s', 350, 'jack-daniels', 100, [], ['Tennessee viskisi'], 'Vanilya ve karamel notaları.'],
          ['Glenfiddich 12', 480, 'glenfiddich-12', 100, [], ['Tek malt viski'], 'Armut ve meşe notaları.', true],
          ['Monkey Shoulder', 420, 'monkey-shoulder', 100, [], ['Harman malt viski'], 'Kokteyle de uygun yumuşak malt.'],
        ],
      },
      {
        name: 'Alkolsüz Kokteyller',
        description: 'Herkes için',
        items: [
          ['Virgin Mojito', 220, 'virgin-mojito', 110, [], ['Nane', 'Lime', 'Soda', 'Şeker'], 'Alkolsüz ferahlık.'],
          ['Virgin Piña Colada', 240, 'virgin-pina-colada', 260, ['Süt Ürünleri'], ['Ananas suyu', 'Hindistan cevizi kreması'], 'Tropik ve kremsi.'],
          ['Sunrise Mocktail', 220, 'sunrise-mocktail', 140, [], ['Portakal suyu', 'Nar şurubu', 'Soda'], 'Portakal ve nar katmanları.'],
          ['Ginger Lemon Fizz', 210, 'ginger-lemon-fizz', 90, [], ['Zencefil', 'Limon', 'Soda', 'Bal'], 'Zencefilli, limonlu.'],
        ],
      },
      {
        name: 'Atıştırmalıklar',
        description: 'Biranın yanına',
        items: [
          ['Buffalo Kanat', 320, 'buffalo-kanat', 690, ['Süt Ürünleri'], ['Tavuk kanat', 'Buffalo sos', 'Rokfor sos'], '8 adet, rokfor sosla.', true],
          ['Nachos', 290, 'nachos', 620, ['Süt Ürünleri'], ['Mısır cipsi', 'Cheddar sos', 'Jalapeño', 'Salsa'], 'Cheddar sos ve jalapeño.'],
          ['Mozzarella Sticks', 260, 'mozzarella-sticks', 480, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Mozzarella', 'Galeta unu', 'Marinara sos'], 'Marinara sos eşliğinde.'],
          ['Soğan Halkası', 210, 'sogan-halkasi', 420, ['Gluten'], ['Soğan', 'Bira hamuru'], 'Bira hamurlu, çıtır.'],
        ],
      },
    ],
  },

  'nargile-kafe': {
    restaurant: { name: 'Duman Lounge', business_type: 'nargile', primary_color: '#0f766e', currency: '₺', cover_url: img('nargile-ozel-karisim'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Nargile Aromaları',
        description: 'Tek aroma, taze köz',
        items: [
          ['Çift Elma', 450, 'nargile-cift-elma', 0, [], ['Tütün', 'Elma aroması'], 'Klasik, anason notalı.', true],
          ['Nane', 450, 'nargile-nane', 0, [], ['Tütün', 'Nane aroması'], 'Serin ve ferah.'],
          ['Karpuz', 450, 'nargile-karpuz', 0, [], ['Tütün', 'Karpuz aroması'], 'Tatlı ve sulu.'],
          ['Şeftali', 450, 'nargile-seftali', 0, [], ['Tütün', 'Şeftali aroması'], 'Yumuşak meyvemsi.'],
        ],
      },
      {
        name: 'Özel Karışımlar',
        description: 'Ustanın harmanları',
        items: [
          ['Lady Killer', 520, 'nargile-lady-killer', 0, [], ['Tütün', 'Kavun', 'Mango', 'Nane'], 'Kavun, mango ve nane.', true],
          ['Love 66', 520, 'nargile-love-66', 0, [], ['Tütün', 'Karpuz', 'Kavun', 'Nane'], 'Tropik ve serin.'],
          ['Blueberry Mint', 500, 'nargile-blueberry-mint', 0, [], ['Tütün', 'Yaban mersini', 'Nane'], 'Yaban mersini ve nane.'],
          ['Buz Başlık', 560, 'nargile-buz-baslik', 0, [], ['Tütün', 'Buzlu başlık'], 'Buzlu başlıkla daha serin içim.'],
        ],
      },
      {
        name: 'Çaylar',
        description: 'Demlik ve bitki çayları',
        items: [
          ['Demlik Çay', 160, 'demlik-cay', 5, [], ['Siyah çay'], '2 kişilik demlik.'],
          ['Kış Çayı', 140, 'kis-cayi', 60, [], ['Ihlamur', 'Tarçın', 'Karanfil', 'Portakal'], 'Tarçın ve karanfilli.', true],
          ['Nane Limon', 120, 'nane-limon', 20, [], ['Nane', 'Limon'], 'Boğazı yumuşatır.'],
          ['Kuşburnu Çayı', 120, 'kusburnu-cayi', 25, [], ['Kuşburnu'], 'C vitamini deposu.'],
        ],
      },
      {
        name: 'Soğuk İçecekler',
        description: 'Nargilenin yanına',
        items: [
          ['Ev Yapımı Limonata', 150, 'ev-yapimi-limonata', 140, [], ['Limon', 'Nane', 'Şeker'], 'Naneli, taze sıkım.'],
          ['Şeftalili Ice Tea', 120, 'ice-tea-seftali', 110, [], ['Siyah çay', 'Şeftali'], 'Buz gibi.'],
          ['Churchill', 110, 'churchill', 15, [], ['Soda', 'Limon', 'Tuz'], 'Tuzlu, limonlu soda.'],
          ['Red Bull', 180, 'red-bull', 110, [], ['Enerji içeceği'], '250 ml kutu.'],
        ],
      },
      {
        name: 'Atıştırmalıklar',
        description: 'Paylaşmalık',
        items: [
          ['Karışık Kuruyemiş', 260, 'karisik-kuruyemis', 610, ['Fıstık', 'Ağaç Yemişi'], ['Fındık', 'Badem', 'Kaju', 'Yer fıstığı'], 'Kavrulmuş karışık kase.'],
          ['Patates Kızartması', 170, 'patates-kizartmasi', 380, [], ['Patates', 'Tuz'], 'Ketçap ve mayonezle.', true],
          ['Çekirdek', 90, 'cekirdek', 290, [], ['Ay çekirdeği'], 'Tuzlu, kavrulmuş.'],
          ['Meyve Tabağı', 280, 'meyve-tabagi', 230, [], ['Mevsim meyveleri'], 'Mevsim meyveleri, 2 kişilik.'],
        ],
      },
    ],
  },

  'pastane-firin': {
    restaurant: { name: 'Un & Şeker Fırını', business_type: 'bakery', primary_color: '#db2777', currency: '₺', cover_url: img('fistikli-pasta'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Pastalar',
        description: 'Dilim pastalar',
        items: [
          ['Fıstıklı Pasta', 190, 'fistikli-pasta', 470, ['Gluten', 'Süt Ürünleri', 'Yumurta', 'Antep Fıstığı'], ['Pandispanya', 'Krema', 'Antep fıstığı'], 'Bol Antep fıstıklı dilim.', true],
          ['Çikolatalı Pasta', 170, 'cikolatali-pasta-dilim', 480, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Kakaolu pandispanya', 'Ganaj', 'Krema'], 'Yoğun çikolata ganajlı.'],
          ['Red Velvet', 180, 'red-velvet', 450, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Kırmızı kek', 'Krem peynir kreması'], 'Krem peynir kremasıyla.'],
          ['Meyveli Pasta', 170, 'meyveli-pasta-dilim', 380, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Pandispanya', 'Krema', 'Mevsim meyveleri'], 'Mevsim meyveli, hafif.'],
        ],
      },
      {
        name: 'Börekler',
        description: 'Sabah 07:00\'den itibaren sıcak',
        items: [
          ['Su Böreği', 140, 'kol-boregi', 390, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Yufka', 'Beyaz peynir', 'Tereyağı'], 'Tereyağlı, peynirli dilim.'],
          ['Ispanaklı Börek', 130, 'ispanakli-borek', 340, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Yufka', 'Ispanak', 'Beyaz peynir'], 'Ispanak ve peynirli.', true],
          ['Kıymalı Tepsi Böreği', 150, 'kiymali-tepsi-boregi', 420, ['Gluten', 'Yumurta'], ['Yufka', 'Dana kıyma', 'Soğan'], 'Kıymalı ve soğanlı.'],
          ['Patatesli Börek', 120, 'patatesli-borek', 330, ['Gluten', 'Yumurta'], ['Yufka', 'Patates', 'Soğan'], 'Baharatlı patates harcıyla.'],
        ],
      },
      {
        name: 'Kurabiyeler',
        description: 'Gramla ya da tek',
        items: [
          ['Damla Çikolatalı Cookie', 75, 'damla-cikolatali-cookie', 220, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Un', 'Tereyağı', 'Damla çikolata'], 'Yumuşak ortalı.', true],
          ['Fındıklı Kurabiye', 60, 'findikli-kurabiye', 180, ['Gluten', 'Süt Ürünleri', 'Fındık'], ['Un', 'Tereyağı', 'Fındık'], 'Ağızda dağılan.'],
          ['Acıbadem Kurabiyesi', 55, 'acibadem-kurabiyesi', 120, ['Yumurta', 'Ağaç Yemişi'], ['Badem', 'Yumurta akı', 'Şeker'], 'Bademli, glutensiz.'],
          ['Makaron', 45, 'makaron', 90, ['Yumurta', 'Ağaç Yemişi', 'Süt Ürünleri'], ['Badem unu', 'Yumurta akı', 'Ganaj'], 'Günün renkleriyle.'],
        ],
      },
      {
        name: 'Ekmekler',
        description: 'Ekşi mayalı, taş fırın',
        items: [
          ['Ekşi Mayalı Ekmek', 120, 'eksi-mayali-ekmek', 250, ['Gluten'], ['Un', 'Ekşi maya', 'Tuz'], '48 saat fermantasyon.', true],
          ['Çavdar Ekmeği', 110, 'cavdar-ekmegi', 230, ['Gluten'], ['Çavdar unu', 'Ekşi maya'], 'Yoğun ve lifli.'],
          ['Simit', 30, 'simit', 280, ['Gluten', 'Susam'], ['Un', 'Pekmez', 'Susam'], 'Çıtır susamlı.'],
          ['Sade Kruvasan', 85, 'sade-kruvasan', 290, ['Gluten', 'Süt Ürünleri'], ['Un', 'Tereyağı'], 'Kat kat tereyağlı.'],
        ],
      },
      {
        name: 'Sıcak İçecekler',
        description: 'Tatlının yanına',
        items: [
          ['Fincan Çay', 35, 'fincan-cay', 2, [], ['Siyah çay'], 'Taze demlenmiş.'],
          ['Türk Kahvesi', 90, 'turk-kahvesi', 15, [], ['Türk kahvesi'], 'Lokum eşliğinde.'],
          ['Sıcak Çikolata', 140, 'sicak-cikolata', 290, ['Süt Ürünleri'], ['Süt', 'Bitter çikolata'], 'Gerçek çikolatadan.', true],
          ['Salep', 120, 'salep', 220, ['Süt Ürünleri'], ['Süt', 'Salep', 'Tarçın'], 'Tarçınlı, kış klasiği.'],
        ],
      },
    ],
  },

  'kebapci-ocakbasi': {
    restaurant: { name: 'Közde Ocakbaşı', business_type: 'kebab', primary_color: '#c2410c', currency: '₺', cover_url: img('adana-kebap'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Kebaplar',
        description: 'Zırh kıyması, meşe kömüründe',
        items: [
          ['Adana Kebap', 480, 'adana-kebap', 720, ['Gluten'], ['Kuzu kıyma', 'Kuyruk yağı', 'Pul biber', 'Lavaş'], 'Acılı, közlenmiş domates ve biberle.', true],
          ['Beyti Kebap', 520, 'beyti-kebap', 840, ['Gluten', 'Süt Ürünleri'], ['Kıyma', 'Lavaş', 'Yoğurt', 'Tereyağlı sos'], 'Lavaşa sarılı, yoğurtlu.'],
          ['Fıstıklı Kebap', 540, 'fistikli-kebap', 760, ['Gluten', 'Antep Fıstığı'], ['Kuzu kıyma', 'Antep fıstığı', 'Lavaş'], 'Antep fıstıklı zırh kıyması.'],
          ['Patlıcan Kebabı', 500, 'patlican-kebabi', 700, ['Gluten'], ['Kıyma', 'Patlıcan', 'Domates'], 'Mevsiminde, patlıcanla dizilir.'],
        ],
      },
      {
        name: 'Pide ve Lahmacun',
        description: 'Taş fırından',
        items: [
          ['Lahmacun', 140, 'lahmacun', 280, ['Gluten'], ['İnce hamur', 'Kıyma', 'Domates', 'Biber'], 'İnce, çıtır; yeşillikle.', true],
          ['Kuşbaşılı Pide', 360, 'kusbasili-pide', 760, ['Gluten', 'Süt Ürünleri'], ['Pide hamuru', 'Dana kuşbaşı', 'Domates', 'Biber'], 'Tereyağlı, kuşbaşı etli.'],
          ['Kaşarlı Pide', 280, 'kasarli-pide', 690, ['Gluten', 'Süt Ürünleri'], ['Pide hamuru', 'Kaşar peyniri', 'Tereyağı'], 'Bol kaşarlı.'],
          ['Karışık Pide', 380, 'karisik-pide', 820, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Kıyma', 'Sucuk', 'Kaşar', 'Yumurta'], 'Kıyma, sucuk, kaşar ve yumurta.'],
        ],
      },
      {
        name: 'Mezeler',
        description: 'Kebabın yanına',
        items: [
          ['Acılı Ezme', 120, 'acili-ezme', 90, [], ['Domates', 'Biber', 'Soğan', 'Nar ekşisi'], 'Nar ekşili, ince kıyım.', true],
          ['Haydari', 130, 'haydari', 180, ['Süt Ürünleri'], ['Süzme yoğurt', 'Sarımsak', 'Dereotu'], 'Süzme yoğurt ve sarımsak.'],
          ['Babagannuş', 140, 'babagannus', 160, ['Susam'], ['Közlenmiş patlıcan', 'Tahin', 'Sarımsak'], 'Közlenmiş patlıcanla.'],
          ['Çiğ Köfte Porsiyon', 150, 'cig-kofte-porsiyon', 310, ['Gluten'], ['İnce bulgur', 'İsot', 'Salça'], 'Marul ve limonla.'],
        ],
      },
      {
        name: 'Çorbalar',
        description: 'Sabaha kadar',
        items: [
          ['Mercimek Çorbası', 110, 'mercimek-corbasi', 210, ['Gluten'], ['Kırmızı mercimek', 'Tereyağı'], 'Limon ve kıtır ekmekle.'],
          ['Beyran', 260, 'beyran-corbasi', 480, [], ['Kuzu eti', 'Pirinç', 'Sarımsak', 'Pul biber'], 'Gaziantep usulü, acılı.', true],
          ['İşkembe Çorbası', 180, 'iskembe-corbasi', 320, ['Süt Ürünleri', 'Yumurta'], ['İşkembe', 'Terbiye', 'Sarımsak'], 'Sirke ve sarımsakla.'],
          ['Ezogelin', 110, 'ezogelin-corbasi', 230, ['Gluten'], ['Mercimek', 'Bulgur', 'Nane'], 'Naneli.'],
        ],
      },
      {
        name: 'Tatlılar ve İçecekler',
        description: 'Kapanış',
        items: [
          ['Künefe', 220, 'kunefe', 560, ['Gluten', 'Süt Ürünleri', 'Antep Fıstığı'], ['Kadayıf', 'Künefe peyniri', 'Şerbet'], 'Sıcak, fıstıklı.', true],
          ['Katmer', 260, 'katmer', 640, ['Gluten', 'Süt Ürünleri', 'Antep Fıstığı'], ['Yufka', 'Kaymak', 'Antep fıstığı', 'Şeker'], 'Kaymaklı, fıstıklı.'],
          ['Yayık Ayranı', 60, 'yayik-ayrani', 90, ['Süt Ürünleri'], ['Yoğurt', 'Su', 'Tuz'], 'Bakır taste, köpüklü.'],
          ['Şalgam Suyu', 50, 'salgam-suyu', 25, [], ['Siyah havuç', 'Bulgur', 'Tuz'], 'Acılı ya da acısız.'],
        ],
      },
    ],
  },

  'burger-fast-food': {
    restaurant: { name: 'Smash Burger Co.', business_type: 'fastfood', primary_color: '#ea580c', currency: '₺', cover_url: img('smash-burger'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Burgerler',
        description: '%100 dana, günlük çekilmiş',
        items: [
          ['Smash Burger', 340, 'smash-burger', 780, ['Gluten', 'Süt Ürünleri', 'Hardal'], ['2×90 g dana köfte', 'Cheddar', 'Karamelize soğan', 'Özel sos', 'Brioche'], 'Çift ezme köfte, eriyen cheddar.', true],
          ['Klasik Burger', 290, 'klasik-burger', 650, ['Gluten', 'Yumurta'], ['150 g dana köfte', 'Marul', 'Domates', 'Turşu', 'Mayonez'], 'Sade ve doyurucu.'],
          ['BBQ Burger', 340, 'bbq-burger', 820, ['Gluten', 'Süt Ürünleri'], ['Dana köfte', 'BBQ sos', 'Soğan halkası', 'Cheddar'], 'Barbekü sos ve soğan halkası.'],
          ['Truffle Burger', 390, 'truffle-burger', 860, ['Gluten', 'Süt Ürünleri', 'Yumurta'], ['Dana köfte', 'Trüf mayonez', 'Mantar', 'İsviçre peyniri'], 'Trüf mayonezli, mantarlı.'],
        ],
      },
      {
        name: 'Menüler',
        description: 'Patates ve içecekle',
        items: [
          ['Cheeseburger Menü', 390, 'cheeseburger-menu', 1150, ['Gluten', 'Süt Ürünleri'], ['Cheeseburger', 'Patates kızartması', 'İçecek'], 'Cheeseburger, patates ve 33 cl içecek.', true],
          ['Burger Menü', 370, 'burger-menu', 1080, ['Gluten', 'Yumurta'], ['Klasik burger', 'Patates kızartması', 'İçecek'], 'Klasik burger, patates ve içecek.'],
          ['Nugget Menü', 320, 'nugget-menu', 920, ['Gluten', 'Yumurta'], ['9 adet nugget', 'Patates', 'İçecek'], '9 nugget, patates ve içecek.'],
          ['Çocuk Menü', 260, 'cocuk-menu', 640, ['Gluten', 'Süt Ürünleri'], ['Mini burger', 'Patates', 'Meyve suyu'], 'Mini burger, patates ve meyve suyu.'],
        ],
      },
      {
        name: 'Tavuk',
        description: 'Çıtır ya da ızgara',
        items: [
          ['Çıtır Tavuk Burger', 290, 'citir-tavuk-burger', 690, ['Gluten', 'Yumurta'], ['Pane tavuk göğsü', 'Coleslaw', 'Ballı hardal'], 'Coleslaw ve ballı hardal.', true],
          ['Chicken Strips', 260, 'chicken-strips', 540, ['Gluten', 'Yumurta'], ['Tavuk fileto', 'Galeta unu'], '5 adet, iki sosla.'],
          ['Buffalo Kanat', 280, 'buffalo-kanat', 640, ['Süt Ürünleri'], ['Tavuk kanat', 'Buffalo sos'], '8 adet, acılı.'],
          ['Izgara Tavuk Wrap', 250, 'izgara-tavuk-wrap', 520, ['Gluten', 'Süt Ürünleri'], ['Tortilla', 'Izgara tavuk', 'Marul', 'Yoğurtlu sos'], 'Yoğurtlu sosla.'],
        ],
      },
      {
        name: 'Yan Ürünler',
        description: 'Paylaşmalık',
        items: [
          ['Patates Kızartması', 120, 'patates-kizartmasi', 380, [], ['Patates', 'Tuz'], 'Çıtır, ince kesim.'],
          ['Cheddar Soslu Patates', 170, 'cheddar-soslu-patates', 520, ['Süt Ürünleri'], ['Patates', 'Cheddar sos', 'Jalapeño'], 'Cheddar sos ve jalapeño.', true],
          ['Soğan Halkası', 140, 'sogan-halkasi', 410, ['Gluten'], ['Soğan', 'Bira hamuru'], '8 adet, çıtır.'],
          ['Jalapeño Poppers', 180, 'jalapeno-poppers', 360, ['Gluten', 'Süt Ürünleri'], ['Jalapeño', 'Krem peynir', 'Galeta unu'], 'Krem peynir dolgulu.'],
        ],
      },
      {
        name: 'İçecekler ve Tatlılar',
        description: 'Serinlemek için',
        items: [
          ['Kola 33 cl', 70, 'kola', 140, [], ['Kola'], 'Buzlu servis.'],
          ['Ev Yapımı Limonata', 110, 'ev-yapimi-limonata', 140, [], ['Limon', 'Nane', 'Şeker'], 'Taze sıkım.'],
          ['Oreo Milkshake', 190, 'oreo-milkshake', 620, ['Gluten', 'Süt Ürünleri', 'Soya'], ['Vanilyalı dondurma', 'Süt', 'Oreo'], 'Bol kremalı.', true],
          ['Brownie', 150, 'brownie', 450, ['Gluten', 'Süt Ürünleri', 'Yumurta', 'Ağaç Yemişi'], ['Bitter çikolata', 'Tereyağı', 'Ceviz'], 'Sıcak servis.'],
        ],
      },
    ],
  },

  meyhane: {
    restaurant: { name: 'Rakı & Balık Meyhanesi', business_type: 'meyhane', primary_color: '#1d4ed8', currency: '₺', cover_url: img('karisik-soguk-meze-tabagi'), ...DEMO_WIFI },
    categories: [
      {
        name: 'Soğuk Mezeler',
        description: 'Günlük, zeytinyağlı',
        items: [
          ['Haydari', 130, 'haydari', 180, ['Süt Ürünleri'], ['Süzme yoğurt', 'Sarımsak', 'Dereotu'], 'Süzme yoğurt ve dereotu.'],
          ['Girit Ezmesi', 170, 'girit-ezmesi', 260, ['Süt Ürünleri', 'Ağaç Yemişi'], ['Beyaz peynir', 'Ceviz', 'Fesleğen', 'Zeytinyağı'], 'Cevizli, fesleğenli.', true],
          ['Muhammara', 150, 'muhammara', 240, ['Gluten', 'Ağaç Yemişi'], ['Közlenmiş biber', 'Ceviz', 'Nar ekşisi'], 'Cevizli, nar ekşili.'],
          ['Lakerda', 260, 'lakerda', 210, ['Balık'], ['Palamut', 'Tuz', 'Kırmızı soğan'], 'Kırmızı soğanla.'],
        ],
      },
      {
        name: 'Ara Sıcaklar',
        description: 'Sıcak servis',
        items: [
          ['Kalamar Tava', 340, 'kalamar-tava', 480, ['Gluten', 'Kabuklu Deniz Ürünü'], ['Kalamar', 'Un', 'Tarator sos'], 'Tarator sosla.', true],
          ['Midye Tava', 290, 'midye-tava', 430, ['Gluten', 'Kabuklu Deniz Ürünü', 'Ağaç Yemişi'], ['Midye', 'Bira hamuru', 'Tarator'], 'Çıtır, taratorlu.'],
          ['Paçanga Böreği', 240, 'pacanga-boregi', 420, ['Gluten', 'Süt Ürünleri'], ['Yufka', 'Pastırma', 'Kaşar'], 'Pastırma ve kaşarlı.'],
          ['Fırın Kaşarlı Karides', 380, 'firin-kasarli-karides', 450, ['Kabuklu Deniz Ürünü', 'Süt Ürünleri'], ['Karides', 'Kaşar', 'Domates', 'Biber'], 'Güveçte, kaşarlı.'],
        ],
      },
      {
        name: 'Günün Balıkları',
        description: 'Tezgâha göre değişir',
        items: [
          ['Levrek Izgara', 560, 'levrek-izgara', 420, ['Balık'], ['Levrek', 'Roka', 'Kırmızı soğan'], 'Roka ve soğan salatasıyla.', true],
          ['Çipura Izgara', 540, 'cipura-izgara', 400, ['Balık'], ['Çipura', 'Limon', 'Roka'], 'Limonlu, ızgara.'],
          ['Hamsi Tava', 320, 'hamsi-tava', 520, ['Balık', 'Gluten'], ['Hamsi', 'Mısır unu'], 'Mevsiminde, mısır unlu.'],
          ['Somon Izgara', 620, 'somon-izgara', 560, ['Balık'], ['Somon fileto', 'Sebze garnitür'], 'Sebze garnitürüyle.'],
        ],
      },
      {
        name: 'Salatalar',
        description: 'Masaya ferahlık',
        items: [
          ['Çoban Salata', 150, 'coban-salata', 120, [], ['Domates', 'Salatalık', 'Biber', 'Soğan'], 'Klasik.'],
          ['Roka Salatası', 170, 'roka-salatasi', 140, ['Süt Ürünleri'], ['Roka', 'Parmesan', 'Nar ekşisi'], 'Parmesanlı.'],
          ['Ahtapot Salatası', 390, 'ahtapot-salatasi', 280, ['Kabuklu Deniz Ürünü'], ['Ahtapot', 'Yeşillik', 'Limon', 'Zeytinyağı'], 'Limonlu, zeytinyağlı.', true],
          ['Beyaz Peynir Kavun', 280, 'beyaz-peynir-kavun', 320, ['Süt Ürünleri'], ['Beyaz peynir', 'Kavun'], 'Rakının vazgeçilmezi.'],
        ],
      },
      {
        name: 'Rakı ve Şarap',
        description: 'Kadeh ve şişe',
        items: [
          ['Tek Rakı', 260, 'tek-raki-kadeh', 110, [], ['Anason', 'Üzüm'], '4 cl, buz ve su ile.', true],
          ['Duble Rakı', 420, 'duble-raki-kadeh', 220, [], ['Anason', 'Üzüm'], '8 cl.'],
          ['Kadeh Beyaz Şarap', 320, 'kadeh-beyaz-sarap', 120, ['Kükürt Dioksit'], ['Üzüm'], '15 cl, soğuk servis.'],
          ['Kadeh Kırmızı Şarap', 320, 'kadeh-kirmizi-sarap', 125, ['Kükürt Dioksit'], ['Üzüm'], '15 cl.'],
        ],
      },
    ],
  },
}

export const DEMO_MENUS: Record<string, DemoMenu> = Object.fromEntries(
  Object.entries(SEEDS).map(([slug, seed]) => [slug, buildMenu(slug, seed)])
)

export function getDemoMenu(slug: string): DemoMenu | undefined {
  return DEMO_MENUS[slug]
}

export const demoMenuPath = (slug: string) => `/qr-menu/${slug}/demo`

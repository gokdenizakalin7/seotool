import { Restaurant, Menu, MenuCategory } from './types'

export const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: 'rest-1',
    subdomain: 'lezzet-ocakbasi',
    name: "Tarihi Lezzet Ocakbaşı & Anadolu Et Mutfağı",
    ownerName: "Mehmet Usta",
    role: 'restaurant',
    currency: '₺',
    status: 'active',
    businessInfo: {
      owner_name: "Mehmet Usta",
      email: 'mehmet@lezzetocakbasi.com',
      phone: '0 (212) 555 12 34',
      address: 'İstiklal Caddesi No: 42, Beyoğlu',
      city: 'İstanbul',
      wifi_name: 'LezzetOcakbasi_Misafir',
      wifi_password: 'kebaplezzeti2024',
      instagramHandle: 'lezzetocakbasi_ist',
      whatsappNumber: '905551234567',
      googleMapsUrl: 'https://maps.google.com/?q=Beyoglu+Istanbul',
      googleReviewUrl: 'https://search.google.com/local/writereview',
      workingHours: 'Hergün: 11:00 - 01:00'
    },
    branding: {
      primaryColor: '#e11d48',
      logoUrl: '',
      bannerUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop'
    }
  },
  {
    id: 'rest-2',
    subdomain: 'moda-cafe',
    name: "All-Day Dining Kafe & Modern Bistro",
    ownerName: "Zeynep Kaya",
    role: 'restaurant',
    currency: '₺',
    status: 'active',
    businessInfo: {
      owner_name: "Zeynep Kaya",
      email: 'zeynep@modacafe.com',
      phone: '0 (216) 333 44 55',
      address: 'Moda Caddesi No: 78, Kadıköy',
      city: 'İstanbul',
      wifi_name: 'ModaCafe_Guest',
      wifi_password: 'kahvekeyfi2024',
      instagramHandle: 'modacafe_official',
      whatsappNumber: '905553334455',
      googleMapsUrl: 'https://maps.google.com/?q=Moda+Kadikoy',
      googleReviewUrl: 'https://search.google.com/local/writereview',
      workingHours: 'Hergün: 08:30 - 23:30'
    },
    branding: {
      primaryColor: '#d97706',
      logoUrl: '',
      bannerUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=400&fit=crop'
    }
  }
]

// Demo menüleri: şablon içerikleri artık veritabanındaki katalogdan gelir (menu_templates).
const ocakbasiTmpl = {
  name: 'Kebapçı & Ocakbaşı Menüsü',
  tagline: 'Mangal ateşinde Adana, Urfa ve karışık ızgara',
  coverImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop',
  categories: [] as MenuCategory[],
}
const cafeTmpl = {
  name: 'Kafe & Bistro Menüsü',
  tagline: 'Gün boyu kahve, kahvaltı ve tatlı',
  coverImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=400&fit=crop',
  categories: [] as MenuCategory[],
}

export const mockMenusByRestaurant: Record<string, Menu[]> = {
  'lezzet-ocakbasi': [
    {
      id: 'menu-1',
      name: ocakbasiTmpl.name,
      description: ocakbasiTmpl.tagline,
      image_url: ocakbasiTmpl.coverImage,
      is_listed: true,
      available_days: [1, 2, 3, 4, 5, 6, 7],
      layout: 'grid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      categories: JSON.parse(JSON.stringify(ocakbasiTmpl.categories))
    }
  ],
  'moda-cafe': [
    {
      id: 'menu-2',
      name: cafeTmpl.name,
      description: cafeTmpl.tagline,
      image_url: cafeTmpl.coverImage,
      is_listed: true,
      available_days: [1, 2, 3, 4, 5, 6, 7],
      layout: 'grid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      categories: JSON.parse(JSON.stringify(cafeTmpl.categories))
    }
  ]
}

export const getStoredMenus = (subdomain: string): Menu[] => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(`menus_${subdomain}`)
    if (raw !== null) {
      try {
        return JSON.parse(raw)
      } catch (e) {
        console.error('Error parsing stored menus:', e)
      }
    }
  }
  return mockMenusByRestaurant[subdomain] || []
}

export const setStoredMenus = (subdomain: string, menus: Menu[]): void => {
  mockMenusByRestaurant[subdomain] = menus
  if (typeof window !== 'undefined') {
    localStorage.setItem(`menus_${subdomain}`, JSON.stringify(menus))
  }
}

export const getDeviceData = () => [
  { name: 'Mobil Telefon', value: 86 },
  { name: 'Tablet', value: 10 },
  { name: 'Masaüstü', value: 4 }
]

export const getChartData = () => [
  { name: 'Pzt', views: 420 },
  { name: 'Sal', views: 380 },
  { name: 'Çar', views: 510 },
  { name: 'Per', views: 620 },
  { name: 'Cum', views: 890 },
  { name: 'Cmt', views: 1450 },
  { name: 'Paz', views: 1620 }
]

export const getMostViewedItems = (timeRange?: string) => [
  { name: 'Adana Kebap (Porsiyon)', views: 1240, totalTime: '142 sa' },
  { name: 'Kuzu Şiş & Izgara', views: 980, totalTime: '115 sa' },
  { name: 'Antep Fıstıklı Künefe', views: 850, totalTime: '88 sa' },
  { name: 'Gavurdağı Salatası', views: 720, totalTime: '64 sa' },
  { name: 'Fındık Lahmacun (3 Adet)', views: 690, totalTime: '58 sa' }
]


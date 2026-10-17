'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/** Müşteri sitesinin arayüz metinleri (TR, EN, AR, RU). Menü içeriği çevrilmez; işletmenin yazdığı gibi görünür. */
export const TRANSLATIONS = {
  tr: {
    searchPlaceholder: 'Yemek, içecek veya tatlı arayın...',
    all: 'Tümü',
    wifiTitle: 'Ücretsiz Wi-Fi',
    copyWifi: 'Şifreyi Kopyala',
    copied: 'Kopyalandı',
    googleReviewBtn: 'Google\'da Yorum Yaz ⭐',
    allergens: 'Alerjenler',
    ingredients: 'Bileşenler',
    chefChoice: 'Şefin Tavsiyesi',
    table: 'Masa',
    noItemsFound: 'Aramanıza uygun ürün bulunamadı.',
    menuSoon: 'Menü çok yakında.',
    hours: 'Çalışma Saatleri',
    instagramShort: 'Instagram',
    googleReviewShort: 'Yorum Yap',
    close: 'Kapat',
    categoriesTitle: 'Ne arzu edersiniz?',
    itemsCount: 'ürün',
    calories: 'Kalori',
    aiEstimate: 'AI Tahmini',
    stock: 'Stok Durumu',
    available: 'Mevcut',
    soldOut: 'Tükendi',
    // Site
    navMenu: 'Menü',
    navEvents: 'Etkinlikler',
    navAbout: 'Hakkımızda',
    navContact: 'İletişim',
    campaigns: 'Kampanyalı Ürünler',
    bundleContents: 'Kampanya içeriği',
    insteadOf: 'yerine',
    savings: 'avantaj',
    today: 'Bugün',
    liveNow: 'Şu an',
    thisWeek: 'Bu Hafta',
    upcoming: 'Yaklaşan',
    weekly: 'Her hafta',
    noEvents: 'Şu an planlanmış bir etkinlik yok. Takipte kalın!',
    seeEvents: 'Etkinlikleri gör',
    call: 'Ara',
    whatsapp: 'WhatsApp',
    email: 'E-posta',
    website: 'Web sitesi',
    address: 'Adres',
    directions: 'Yol tarifi al',
    followUs: 'Bizi takip edin',
    reviewUs: 'Bizi Google\'da değerlendirin',
    reviewDesc: 'Memnun kaldıysanız birkaç saniyenizi ayırıp yorum bırakabilirsiniz.',
    contactEmpty: 'İletişim bilgileri yakında eklenecek.',
    terms: 'Kullanım Koşulları',
    privacy: 'Gizlilik Politikası',
    imageCredits: 'Görsel kaynakları',
  },
  en: {
    searchPlaceholder: 'Search dishes, drinks or desserts...',
    all: 'All',
    wifiTitle: 'Free Wi-Fi',
    copyWifi: 'Copy Password',
    copied: 'Copied',
    googleReviewBtn: 'Write a Review on Google ⭐',
    allergens: 'Allergens',
    ingredients: 'Ingredients',
    chefChoice: 'Chef\'s Choice',
    table: 'Table',
    noItemsFound: 'No items found matching your search.',
    menuSoon: 'Menu coming soon.',
    hours: 'Opening Hours',
    instagramShort: 'Instagram',
    googleReviewShort: 'Write a Review',
    close: 'Close',
    categoriesTitle: 'What would you like?',
    itemsCount: 'items',
    calories: 'Calories',
    aiEstimate: 'AI estimate',
    stock: 'Availability',
    available: 'Available',
    soldOut: 'Sold out',
    navMenu: 'Menu',
    navEvents: 'Events',
    navAbout: 'About',
    navContact: 'Contact',
    campaigns: 'Special Deals',
    bundleContents: 'Deal includes',
    insteadOf: 'instead of',
    savings: 'off',
    today: 'Today',
    liveNow: 'Now',
    thisWeek: 'This Week',
    upcoming: 'Upcoming',
    weekly: 'Every week',
    noEvents: 'No events scheduled right now. Stay tuned!',
    seeEvents: 'See events',
    call: 'Call',
    whatsapp: 'WhatsApp',
    email: 'Email',
    website: 'Website',
    address: 'Address',
    directions: 'Get directions',
    followUs: 'Follow us',
    reviewUs: 'Review us on Google',
    reviewDesc: 'Enjoyed your visit? A quick review means a lot to us.',
    contactEmpty: 'Contact details coming soon.',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    imageCredits: 'Image credits',
  },
  ar: {
    searchPlaceholder: 'ابحث عن أطباق، مشروبات أو حلويات...',
    all: 'الكل',
    wifiTitle: 'واي فاي مجاني',
    copyWifi: 'نسخ كلمة المرور',
    copied: 'تم النسخ',
    googleReviewBtn: 'اكتب تقييماً على جوجل ⭐',
    allergens: 'مسببات الحساسية',
    ingredients: 'المكونات',
    chefChoice: 'اختيار الشيف',
    table: 'طاولة',
    noItemsFound: 'لم يتم العثور على أطباق مطابقة.',
    menuSoon: 'القائمة قريباً.',
    hours: 'ساعات العمل',
    instagramShort: 'انستغرام',
    googleReviewShort: 'اكتب تقييماً',
    close: 'إغلاق',
    categoriesTitle: 'ماذا تود أن تطلب؟',
    itemsCount: 'منتجات',
    calories: 'السعرات',
    aiEstimate: 'تقدير الذكاء الاصطناعي',
    stock: 'التوفر',
    available: 'متوفر',
    soldOut: 'نفد',
    navMenu: 'القائمة',
    navEvents: 'الفعاليات',
    navAbout: 'من نحن',
    navContact: 'اتصل بنا',
    campaigns: 'العروض',
    bundleContents: 'يشمل العرض',
    insteadOf: 'بدلاً من',
    savings: 'توفير',
    today: 'اليوم',
    liveNow: 'الآن',
    thisWeek: 'هذا الأسبوع',
    upcoming: 'القادمة',
    weekly: 'كل أسبوع',
    noEvents: 'لا توجد فعاليات مجدولة حالياً.',
    seeEvents: 'عرض الفعاليات',
    call: 'اتصال',
    whatsapp: 'واتساب',
    email: 'البريد الإلكتروني',
    website: 'الموقع',
    address: 'العنوان',
    directions: 'الاتجاهات',
    followUs: 'تابعونا',
    reviewUs: 'قيّمنا على جوجل',
    reviewDesc: 'إذا استمتعت بزيارتك، يسعدنا تقييمك.',
    contactEmpty: 'ستتم إضافة معلومات الاتصال قريباً.',
    terms: 'شروط الاستخدام',
    privacy: 'سياسة الخصوصية',
    imageCredits: 'مصادر الصور',
  },
  ru: {
    searchPlaceholder: 'Поиск блюд, напитков или десертов...',
    all: 'Все',
    wifiTitle: 'Бесплатный Wi-Fi',
    copyWifi: 'Скопировать пароль',
    copied: 'Скопировано',
    googleReviewBtn: 'Оставить отзыв в Google ⭐',
    allergens: 'Аллергены',
    ingredients: 'Состав',
    chefChoice: 'Выбор шефа',
    table: 'Стол',
    noItemsFound: 'Блюда не найдены.',
    menuSoon: 'Меню скоро появится.',
    hours: 'Часы работы',
    instagramShort: 'Instagram',
    googleReviewShort: 'Оставить отзыв',
    close: 'Закрыть',
    categoriesTitle: 'Что желаете?',
    itemsCount: 'позиций',
    calories: 'Калории',
    aiEstimate: 'Оценка ИИ',
    stock: 'Наличие',
    available: 'В наличии',
    soldOut: 'Нет в наличии',
    navMenu: 'Меню',
    navEvents: 'События',
    navAbout: 'О нас',
    navContact: 'Контакты',
    campaigns: 'Акции',
    bundleContents: 'В акцию входит',
    insteadOf: 'вместо',
    savings: 'выгода',
    today: 'Сегодня',
    liveNow: 'Сейчас',
    thisWeek: 'На этой неделе',
    upcoming: 'Скоро',
    weekly: 'Каждую неделю',
    noEvents: 'Сейчас нет запланированных событий.',
    seeEvents: 'Смотреть события',
    call: 'Позвонить',
    whatsapp: 'WhatsApp',
    email: 'Эл. почта',
    website: 'Сайт',
    address: 'Адрес',
    directions: 'Проложить маршрут',
    followUs: 'Мы в соцсетях',
    reviewUs: 'Оцените нас в Google',
    reviewDesc: 'Если вам понравилось, оставьте, пожалуйста, отзыв.',
    contactEmpty: 'Контактная информация скоро появится.',
    terms: 'Условия использования',
    privacy: 'Политика конфиденциальности',
    imageCredits: 'Источники изображений',
  },
}

export type SiteLang = keyof typeof TRANSLATIONS
export type SiteTexts = (typeof TRANSLATIONS)['tr']
export const SITE_LANGS: SiteLang[] = ['tr', 'en', 'ar', 'ru']

const STORAGE_KEY = 'qr-site-lang'

interface LangContextValue {
  lang: SiteLang
  setLang: (lang: SiteLang) => void
  t: SiteTexts
}

// Sağlayıcı yoksa (ör. bağımsız bileşen) Türkçe
const LangContext = createContext<LangContextValue>({ lang: 'tr', setLang: () => {}, t: TRANSLATIONS.tr })

/** Dil seçimi site sayfaları arasında korunur (layout kalıcı) ve tarayıcıda hatırlanır. */
export function SiteLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SiteLang>('tr')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SiteLang | null
      if (stored && stored in TRANSLATIONS) setLangState(stored)
    } catch {
      // depolama kapalı
    }
  }, [])

  const setLang = useCallback((next: SiteLang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // depolama kapalı
    }
  }, [])

  const value = useMemo(() => ({ lang, setLang, t: TRANSLATIONS[lang] }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useSiteLang(): LangContextValue {
  return useContext(LangContext)
}

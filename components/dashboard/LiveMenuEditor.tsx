'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { authFetch } from '@/lib/api-client'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Smartphone, 
  Flame, 
  Wifi, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Utensils, 
  ExternalLink, 
  Save, 
  Star, 
  Check, 
  Upload, 
  Image as ImageIcon, 
  X,
  Coffee,
  Wine,
  Sparkles,
  Layers,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Camera,
  Loader2
} from 'lucide-react'
import { Menu, MenuCategory, MenuItem, Restaurant } from '@/lib/types'
import { getStoredMenus, setStoredMenus } from '@/lib/mock-data'
import { useCatalogTemplates } from '@/lib/use-catalog-templates'
import type { CatalogTemplateSummary } from '@/lib/catalog-templates'
import { sanitizeText, sanitizeMultilineText, sanitizePrice } from '@/lib/sanitizer'
import { ScanMenuModal } from '@/components/modals/ScanMenuModal'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { usePublicMenuPreview } from '@/lib/use-public-menu-preview'
import { useBusinessTypes } from '@/lib/use-business-types'
import { setScrollNavGuard } from '@/components/dashboard/ScrollNavigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { compressImageFile, IMAGE_PRESETS, formatFileSize } from '@/lib/image-compression'
import { safeJsonParse } from '@/lib/utils'
import { catalogThumbUrl } from '@/lib/image-url'
import { generateItemImage } from '@/lib/image-generation-client'
import { CatalogPickerPopover } from '@/components/modals/scan-editor/CatalogPickerPopover'

// KURUMSAL & SEO UYUMLU ANA KATEGORİ REHBERİ
export const ORDERED_CATEGORY_GROUPS = [
  {
    groupTitle: '☕ Kafe, Kahvaltı & İçecekler',
    icon: Coffee,
    categories: [
      { name: 'Kahvaltı, Sahanda Lezzetler & Omletler', defaultDescription: 'Serpme kahvaltı tabakları, bakır sahanda köy yumurtaları ve taze sıcak omlet çeşitleri' },
      { name: 'Artizan Tostlar & Gurme Sandviçler', defaultDescription: 'Taze ekşi maya ve bazlama ekmeklerinde sıcak tostlar, soğuk baget sandviçler' },
      { name: 'Nitelikli Sıcak Kahveler & Demleme Çaylar', defaultDescription: '%100 Arabica çekirdek harmanları, taze demlenmiş Rize çayı ve aromatik bitki çayları' },
      { name: 'Artizan Soğuk Kahveler & Ferahlatıcı İçecekler', defaultDescription: 'Buzlu espresso harmanları, ev yapımı taze naneli limonata ve soğuk meşrubatlar' },
      { name: 'İmza Tatlılar & Fırın Pastaları', defaultDescription: 'San Sebastian cheesecake, sıcak akışkan sufle, trileçe, brownie ve günlük fırın pastaları' },
    ]
  },
  {
    groupTitle: '🍽️ Restoran, Yemekler & Doyumluklar',
    icon: Utensils,
    categories: [
      { name: 'Şefin İmzası Burgerler & Wrapler', defaultDescription: 'Dinlendirilmiş el yapımı dana burgerler, ızgara kasap köfte ve sıcak tortilla dürümler' },
      { name: 'Özel Soslu Şef Tavuk Tabakları', defaultDescription: 'Makarna ve Akdeniz yeşillikleri salatası eşliğinde servis edilen özel soslu tavuk yemekleri' },
      { name: 'Taze Makarnalar & Kayseri Mantısı', defaultDescription: 'Özel soslu İtalyan makarnaları ve tereyağlı geleneksel Kayseri mantısı' },
      { name: 'Bahçe Yeşillikleri & Gurme Salatalar', defaultDescription: 'Taze Akdeniz yeşillikleri ve özel soslarla hazırlanan hafif ve besleyici kase salatalar' },
      { name: 'Çıtır Atıştırmalıklar & Paylaşımlıklar', defaultDescription: 'Sıcak sepetler, özel baharatlı patates kızartmaları ve parmak lezzetler' },
      { name: 'Ocakbaşı Kebapları & Kömürde Izgaralar', defaultDescription: 'Meşe kömürü ateşinde dinlendirilmiş zırh kıyması et ve tavuk lezzetleri' },
      { name: 'Taş Fırın Çıtır Lahmacun & Pideler', defaultDescription: 'Odun ateşinde taş tabanda pişen incecik çıtır lahmacun ve tereyağlı pideler' },
      { name: 'Geleneksel Başlangıç Çorbaları', defaultDescription: 'Günün taze kaynayan şifalı kazan çorbaları ve fırından sıcak tırnak pide' },
      { name: 'Toprak Güveç & Tencere Yemekleri', defaultDescription: 'Geleneksel güveçte İspir kuru fasulyesi, etli tencere yemekleri ve tereyağlı pirinç pilavı' },
      { name: 'Zeytinyağlı Ege Otları & Soğuk Mezeler', defaultDescription: 'Günlük meze dolabımızdan taze zeytinyağlı mezeler, ezmeler ve yöresel salatalar' },
      { name: 'Sıcak Deniz Mahsulleri & Günlük Balıklar', defaultDescription: 'Mevsimine göre ızgara taze balıklar, tereyağlı karides güveç ve çıtır kalamar tava' },
    ]
  },
  {
    groupTitle: '🍸 Bar, Pub & Alkollü İçecekler',
    icon: Wine,
    categories: [
      { name: 'Miksoloji İmza & Klasik Kokteyller', defaultDescription: 'Barmenimizin taze meyve püreleri ve kaliteli içkilerle hazırladığı kokteyl koleksiyonu' },
      { name: 'Fıçı & Şişe Dünya Biraları', defaultDescription: 'Buz gibi yerli, buğday ve ithal craft soğuk biralar' },
      { name: 'Geleneksel Rakı & Şarap Seçkisi', defaultDescription: 'Tek, duble ve şişe rakı seçenekleri, kırmızı/beyaz/roze şaraplar' },
      { name: 'Paylaşımlı Sıcak Pub Sepetleri', defaultDescription: 'Biranın yanına en çok yakışan sıcak parmak lezzetler ve karışık çerezler' },
    ]
  }
]

// KATEGORİYE ÖZEL KAPSAMLI VE NOKTA ATIŞI HAZIR ÜRÜN REHBERİ
export const PREDEFINED_CATALOG: Record<string, Array<{
  name: string;
  defaultDescription: string;
  defaultCalories?: number;
  defaultAllergens?: string[];
  defaultImage: string;
}>> = {
  'Kahvaltı, Sahanda Lezzetler & Omletler': [
    { name: 'Gurme Serpme Kahvaltı Tabağı', defaultDescription: 'Ezine beyaz peynir, taze kaşar, zeytin seçkisi, salkım domates, çıtır salatalık, serbest gezen tavuk yumurtası, petek bal-kaymak, organik reçel, dana salam, sigara böreği, baharatlı patates kızartması ve demleme çay.', defaultCalories: 780, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400' },
    { name: 'Hızlı & Dengeli Kahvaltı Tabağı', defaultDescription: 'Olgunlaştırılmış Ezine peyniri, eski kaşar, Gemlik zeytini, domates, salatalık, haşlanmış köy yumurtası, süzme bal, tereyağı ve çıtır simit.', defaultCalories: 490, defaultAllergens: ['Süt Ürünleri', 'Yumurta', 'Gluten'], defaultImage: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400' },
    { name: 'Bakır Sahanda Kaşarlı Menemen', defaultDescription: 'Köy yumurtası, Çanakkale tarla domatesi, tatlı sivri biber ve bol erimiş taze kaşar peyniri.', defaultCalories: 340, defaultAllergens: ['Yumurta', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    { name: 'Kasap Sucuklu Menemen', defaultDescription: 'Özel baharatlı dana kasap sucuğu, sote domates, biber ve sahanda köy yumurtası.', defaultCalories: 410, defaultAllergens: ['Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    { name: 'Rize Kavurmalı Menemen', defaultDescription: 'Taş fırında dinlendirilmiş dana kavurma, yayık tereyağı, domates ve yumurtanın geleneksel uyumu.', defaultCalories: 460, defaultAllergens: ['Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    { name: 'Taze Kaşarlı Sıcak Omlet', defaultDescription: '3 adet çırpılmış köy yumurtası, bol taze kaşar dolgusu ve çıtır patates garnitürü.', defaultCalories: 320, defaultAllergens: ['Yumurta', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    { name: 'Kasap Sucuklu Omlet', defaultDescription: 'Izgara dana sucuk parçacıkları, taze yeşillikler ve süzme yoğurt sos ile.', defaultCalories: 390, defaultAllergens: ['Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    { name: 'Dana Kavurmalı Spesiyal Omlet', defaultDescription: 'Özel lezzetli Rize dana kavurması, tereyağı ve mevsim yeşillikleri.', defaultCalories: 440, defaultAllergens: ['Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    { name: 'Bakır Sahanda Kasap Sucuklu Yumurta', defaultDescription: 'Hakiki fermente dana sucuk ve yayık tereyağında pişmiş çift göz köy yumurtası.', defaultCalories: 420, defaultAllergens: ['Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
  ],
  'Artizan Tostlar & Gurme Sandviçler': [
    { name: 'Eski Kaşarlı Klasik Tost', defaultDescription: 'Tost ekmeğinde bol taze kaşar peyniri, domates dilimleri ve patates cipsi.', defaultCalories: 340, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
    { name: 'Kasap Sucuklu & Kaşarlı Karışık Tost', defaultDescription: 'Hakiki dana sucuk, bol kaşar peyniri, ev yapımı domates salçası sosu ve çıtır patates.', defaultCalories: 420, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
    { name: 'Rize Kavurmalı & Kaşarlı Bazlama Tost', defaultDescription: 'Közde ısıtılmış sıcak bazlama ekmeğinde dana kavurma, erimiş kaşar ve kekikli tereyağı.', defaultCalories: 520, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
    { name: 'Bistro Spesiyal Füme Tost', defaultDescription: 'Ekşi maya ekmeğinde dana füme kaburga, cheddar peyniri, karamelize soğan ve trüflü mayonez.', defaultCalories: 580, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
    { name: 'Ton Balıklı Akdeniz Baget Sandviç', defaultDescription: 'Çıtır Fransız bagetinde lezzetli ton balığı, tatlı mısır, kornişon turşu, kıvırcık marul ve dereotlu mayonez.', defaultCalories: 380, defaultAllergens: ['Gluten', 'Balık', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
    { name: 'Ezine Peynirli & Avokadolu Sandviç', defaultDescription: 'Ezine beyaz peynir, taze avokado püresi, salkım domates, kekikli zeytinyağı ve taze baget.', defaultCalories: 330, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
  ],
  'Şefin İmzası Burgerler & Wrapler': [
    { name: 'Klasik Cheddar Cheeseburger & Patates', defaultDescription: '150g dinlendirilmiş dana köfte, eritilmiş İngiliz cheddar peyniri, karamelize soğan, marul, ev yapımı burger sosu ve baharatlı patates.', defaultCalories: 690, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400' },
    { name: 'Double Smash Gurme Burger', defaultDescription: '2x100g smash dana köfte, duble cheddar peyniri, tütsülenmiş dana füme et, karamelize soğan ve trüf mayonez.', defaultCalories: 840, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400' },
    { name: 'Trüflü & Mantarlı Bistro Burger', defaultDescription: 'Dana köfte, sote istiridye ve kültür mantarı, trüflü aioli sos, füme peynir ve çıtır patates.', defaultCalories: 760, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400' },
    { name: 'Porsiyon Izgara Kasap Köfte', defaultDescription: '6 adet kömürde pişmiş ızgara köfte, baharatlı patates kızartması, köz domates-biber, tereyağlı pilav ve tırnak pide.', defaultCalories: 640, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400' },
    { name: 'Çıtır Tavuk Wrap & Patates', defaultDescription: 'Tortilla lavaşında sotelenmiş jülyen tavuk parçaları, renkli biberler, eritilmiş kaşar ve ballı hardal sos.', defaultCalories: 520, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' },
    { name: 'Izgara Köfte Wrap & Patates', defaultDescription: 'Lavaş içerisine ızgara kasap köfteleri, salkım domates, sumaklı soğan, kaşar peyniri ve patates kızartması.', defaultCalories: 580, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' },
  ],
  'Özel Soslu Şef Tavuk Tabakları': [
    { name: 'Kremalı Köri Soslu Tavuk', defaultDescription: 'Kremalı köri sosunda sotelenmiş taze tavuk göğsü dilimleri, kültür mantarı, penne makarna ve mevsim salatası.', defaultCalories: 680, defaultAllergens: ['Süt Ürünleri', 'Gluten'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
    { name: 'Meksika Soslu Tavuk (Hafif Acılı)', defaultDescription: 'Acılı salsa Meksika sosu, jalapeno biber, mısır, kırmızı fasulye, penne makarna ve salata.', defaultCalories: 640, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
    { name: 'Tütsülenmiş Barbekü (BBQ) Soslu Tavuk', defaultDescription: 'Barbekü soslu marine tavuk göğsü, karamelize soğan, penne makarna ve Akdeniz yeşillikleri.', defaultCalories: 660, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
    { name: 'Dağ Kekikli Kremalı Tavuk', defaultDescription: 'Taze dağ kekiği, hafif krema sos, mantar dilimleri, penne makarna ve zeytinyağlı salata.', defaultCalories: 690, defaultAllergens: ['Süt Ürünleri', 'Gluten'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
    { name: 'Sweet Chili Tatlı Ekşi Soslu Tavuk', defaultDescription: 'Uzak Doğu tatlı acı sosu ile karamelize edilmiş tavuk lokumları, kavrulmuş susam, makarna ve salata.', defaultCalories: 630, defaultAllergens: ['Gluten', 'Susam'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
  ],
  'Taze Makarnalar & Kayseri Mantısı': [
    { name: 'Tavuklu & Mantarlı Fettuccine Alfredo', defaultDescription: 'Jülyen tavuk dilimleri, taze kültür mantarı, ipeksi krema sos ve rendelenmiş parmesan peyniri.', defaultCalories: 640, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400' },
    { name: 'Penne all Arrabbiata (Acılı)', defaultDescription: 'Acılı İtalyan domates sosu, dilim siyah zeytin, sarımsak, taze fesleğen yaprakları ve parmesan.', defaultCalories: 480, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400' },
    { name: 'Köri Soslu Tavuklu Penne', defaultDescription: 'Kremalı köri sosu, sotelenmiş tavuk parçaları, mantar ve kaşar rendesi.', defaultCalories: 590, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400' },
    { name: 'Geleneksel El Açması Kayseri Mantısı', defaultDescription: 'Sarımsaklı tava yoğurdu, kızgın tereyağlı pul biber sosu ve nane ile servis edilir.', defaultCalories: 560, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
  ],
  'Bahçe Yeşillikleri & Gurme Salatalar': [
    { name: 'Çıtır Tavuklu Sezar Salata', defaultDescription: 'Taze marul yaprakları, çıtır pane tavuk lokumları, sarımsaklı kruton ekmek, parmesan ve orijinal Sezar sos.', defaultCalories: 460, defaultAllergens: ['Gluten', 'Yumurta', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
    { name: 'Izgara Tavuklu Akdeniz Salata', defaultDescription: 'Akdeniz yeşillikleri, marine ızgara tavuk dilimleri, çeri domates, salatalık, mısır ve ballı hardal sos.', defaultCalories: 420, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
    { name: 'Ton Balıklı Ege Salatası', defaultDescription: 'Roka, marul, tatlı mısır, zeytin dilimleri, salatalık ve sızma zeytinyağlı limon sosu.', defaultCalories: 360, defaultAllergens: ['Balık'], defaultImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
    { name: 'Antep Cevizli Gavurdağı Salatası', defaultDescription: 'İnce kıyılmış tarla domatesi, çıtır salatalık, taze soğan, bol Antep cevizi ve hakiki nar ekşisi.', defaultCalories: 240, defaultAllergens: ['Ceviz'], defaultImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
  ],
  'Çıtır Atıştırmalıklar & Paylaşımlıklar': [
    { name: 'Büyük Combo Atıştırmalık Sepeti', defaultDescription: 'Baharatlı parmak patates, çıtır soğan halkaları, sosis, çıtır sigara böreği, tavuk nugget ve 2 özel dip sos.', defaultCalories: 780, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400' },
    { name: 'Baharatlı Parmak Patates Kızartması', defaultDescription: 'Cajun baharat karışımı, ev yapımı sarımsaklı mayonez ve ketçap ile.', defaultCalories: 380, defaultImage: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400' },
    { name: 'Kekikli Fırın Elma Dilim Patates', defaultDescription: 'Dağ kekiği ve toz kırmızı biber aromalı çıtır fırın patates.', defaultCalories: 360, defaultImage: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400' },
    { name: 'Lüks Kavrulmuş Karışık Çerez', defaultDescription: 'Kavrulmuş kaju, Antep fıstığı, badem ve fındık harmanı.', defaultCalories: 320, defaultAllergens: ['Fındık', 'Fıstık'], defaultImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  ],
  'İmza Tatlılar & Fırın Pastaları': [
    { name: 'Orijinal San Sebastian Cheesecake', defaultDescription: 'Kremamsı akışkan iç doku, kızarmış üst kabuk ve yanında sıcak eritilmiş Belçika sütlü çikolatası ile.', defaultCalories: 510, defaultAllergens: ['Süt Ürünleri', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400' },
    { name: 'Sıcak Akışkan Çikolatalı Sufle', defaultDescription: '%70 bitter Belçika çikolatası, pudra şekeri ve vanilyalı Maraş dondurması eşliğinde.', defaultCalories: 460, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400' },
    { name: 'Karamelli Üç Sütlü Trileçe', defaultDescription: 'Geleneksel Balkan keki, manda ve keçi sütü şerbeti, ipeksi karamel sosu.', defaultCalories: 340, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Yumurta'], defaultImage: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400' },
    { name: 'Sıcak Cevizli Çikolatalı Brownie', defaultDescription: 'Yoğun çikolata dokusu, kavrulmuş ceviz parçaları ve kesme dondurma ile.', defaultCalories: 440, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Ceviz'], defaultImage: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400' },
    { name: 'Fırınlanmış Yanık Köy Sütlacı', defaultDescription: 'Hakiki yağlı köy sütü, pirinç ve fırında karamelize edilmiş üst kabuk, bol fındık ile.', defaultCalories: 290, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=400' },
    { name: 'Hatay Usulü Sıcak Peynirli Künefe', defaultDescription: 'Özel tuzsuz künefe peyniri, sıcak şerbet, bol Antep fıstığı ve manda kaymağı.', defaultCalories: 620, defaultAllergens: ['Gluten', 'Süt Ürünleri', 'Antep Fıstığı'], defaultImage: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=400' },
  ],
  'Nitelikli Sıcak Kahveler & Demleme Çaylar': [
    { name: 'Geleneksel Demleme Türk Çayı (İnce Belli)', defaultDescription: 'Rize yaylalarının taze sürgün yapraklarından demlenmiş berrak tavşan kanı çay.', defaultCalories: 2, defaultImage: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400' },
    { name: 'Közde Pişmiş Türk Kahvesi', defaultDescription: 'Taze çekilmiş çekirdeklerden bol köpüklü, su ve Antep fıstıklı lokum ile servis edilir.', defaultCalories: 25, defaultImage: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400' },
    { name: 'Double Shot Türk Kahvesi', defaultDescription: 'Büyük porsiyon kupa fincanda yoğun aromalı Türk kahvesi.', defaultCalories: 40, defaultImage: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400' },
    { name: 'Taze Çekilmiş Filtre Kahve', defaultDescription: 'Orta kavrum Arabica harmanı, taze demlenmiş (Sade veya Sıcak Sütlü).', defaultCalories: 10, defaultImage: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400' },
    { name: 'Caffè Latte', defaultDescription: 'Tek shot espresso üzerine ipeksi mikro köpüklü taze sıcak süt.', defaultCalories: 140, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400' },
    { name: 'Karamel Macchiato', defaultDescription: 'Vanilya aroması, sıcak süt köpüğü, double shot espresso ve karamel sos katmanları.', defaultCalories: 210, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400' },
    { name: 'Atom Şifa Kış Çayı (French Press)', defaultDescription: 'Taze zencefil, çubuk tarçın, karanfil, elma dilimleri, kuşburnu ve yayla balı ile.', defaultCalories: 25, defaultImage: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400' },
    { name: 'Ihlamur & Çiçek Balı (French Press)', defaultDescription: 'Doğal kurutulmuş yaprak ıhlamur ve taze limon dilimi.', defaultCalories: 10, defaultImage: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400' },
    { name: 'Sütlü Belçika Sıcak Çikolatası', defaultDescription: 'Eritilmiş hakiki çikolata ve kremsi sıcak sütün yoğun kış lezzeti.', defaultCalories: 260, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400' },
  ],
  'Artizan Soğuk Kahveler & Ferahlatıcı İçecekler': [
    { name: 'Ev Yapımı Naneli Taze Limonata', defaultDescription: 'Taze sıkılmış limon suyu, ezilmiş nane yaprakları ve buz ile ferahlatıcı lezzet.', defaultCalories: 110, defaultImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { name: 'Klasik Churchill', defaultDescription: 'Doğal maden suyu, taze sıkılmış limon suyu ve kadeh kenarında kaya tuzu.', defaultCalories: 15, defaultImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { name: 'Iced Americano', defaultDescription: 'Buz, filtrelenmiş soğuk su ve double shot taze espresso.', defaultCalories: 10, defaultImage: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400' },
    { name: 'Iced Caffè Latte', defaultDescription: 'Buz küpleri, soğuk süt ve üzerine dökülen taze çekilmiş espresso shot.', defaultCalories: 130, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400' },
    { name: 'Iced Karamel Latte', defaultDescription: 'Karamel şurubu, buz, soğuk süt, espresso ve karamel sos ızgarası.', defaultCalories: 190, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400' },
    { name: 'Affogato al Caffè', defaultDescription: '1 top İtalyan vanilyalı dondurma üzerine dökülen sıcak taze espresso.', defaultCalories: 170, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400' },
    { name: 'Kutu Meşrubatlar (330ml)', defaultDescription: 'Coca-Cola, Coca-Cola Zero, Fanta, Sprite, Fuse Tea Şeftali/Limon.', defaultCalories: 140, defaultImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { name: 'Köpüklü Köy Yayık Ayranı', defaultDescription: 'Hakiki tava yoğurdundan geleneksel usulde çalkalanmış soğuk ayran.', defaultCalories: 75, defaultAllergens: ['Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  ],
  'Ocakbaşı Kebapları & Kömürde Izgaralar': [
    { name: 'Zırh Kıyması Adana Kebap', defaultDescription: 'Erkek kuzu boşluğu ve kuyruk yağı, köz domates-biber, sumaklı soğan ve sıcak lavaş.', defaultCalories: 710, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' },
    { name: 'Otantik Urfa Kebap (Acısız)', defaultDescription: 'Özel marine kuzu kıyma kebabı, köz sebzeler, bulgur pilavı ve tırnak pide.', defaultCalories: 700, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' },
    { name: 'Marine Kuzu Çöp Şiş (8 Şiş)', defaultDescription: 'Zeytinyağı ve kekikle dinlendirilmiş lokum kuzu eti, köz sarımsak ve pide ile.', defaultCalories: 680, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400' },
    { name: 'Özel Soslu Beyti Sarma', defaultDescription: 'İnce lavaşa sarılmış kebap dilimleri, tava yoğurdu ve eritilmiş köpüklü tereyağı sosu.', defaultCalories: 840, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400' },
    { name: 'Geleneksel Kasap Izgara Köfte', defaultDescription: '6 adet ızgara köfte, piyaz, patates kızartması ve köz biber eşliğinde.', defaultCalories: 590, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400' },
  ],
  'Taş Fırın Çıtır Lahmacun & Pideler': [
    { name: 'Çıtır Antep Lahmacun', defaultDescription: 'Zırh kıyması, sarımsak, maydanoz, domates ve çıtır incecik hamur.', defaultCalories: 250, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
    { name: 'Kuşbaşılı & Kaşarlı Taş Fırın Pide', defaultDescription: 'Marine dana kuşbaşı et, salkım domates, biber ve bol erimiş kaşar peyniri.', defaultCalories: 720, defaultAllergens: ['Gluten', 'Süt Ürünleri'], defaultImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
  ],
  'Geleneksel Başlangıç Çorbaları': [
    { name: 'Geleneksel Süzme Mercimek Çorbası', defaultDescription: 'Kıtır pide küpleri, tereyağlı pul biber sos ve taze limon dilimi ile.', defaultCalories: 180, defaultAllergens: ['Gluten'], defaultImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400' },
    { name: 'Gaziantep Usulü Hakiki Beyran', defaultDescription: 'Ağır ateşte pişen lif lif kuzu gerdan eti, pirinç, sarımsak ve bol acılı kemik suyu.', defaultCalories: 390, defaultImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400' },
  ]
}

export const DEFAULT_CATALOG_FALLBACK = [
  { name: 'Şefin Özel Menü Lezzeti', defaultDescription: 'Taze mevsim malzemeleriyle günlük hazırlanan özel şef tabağı.', defaultCalories: 350, defaultImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' }
]

export function LiveMenuEditor() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const menuIdParam = searchParams.get('menu')

  const { restaurant: currentRestaurant } = useRestaurant()

  const subdomain = currentRestaurant?.subdomain || ''
  const [isLoading, setIsLoading] = useState(true)

  const [menu, setMenu] = useState<Menu | null>(() => {
    const list = getStoredMenus(subdomain)
    if (list.length === 0) return null
    if (menuIdParam) {
      const found = list.find(m => m.id === menuIdParam)
      if (found) return found
    }
    return list[0]
  })

  // Veritabanındaki son kayıtlı sürümün JSON'u (null = henüz yüklenmedi)
  const [lastSavedJson, setLastSavedJson] = useState<string | null>(null)

  // SUPABASE'TEN YÜKLEME
  useEffect(() => {
    async function loadFromSupabase() {
      setIsLoading(true)
      try {
        const res = await authFetch(`/api/menus/load?subdomain=${subdomain}`)
        if (res.ok) {
          const data = await res.json()
          if (data.menus && data.menus.length > 0) {
            const loaded: Menu = (menuIdParam && data.menus.find((m: Menu) => m.id === menuIdParam)) || data.menus[0]
            setMenu(loaded)
            setLastSavedJson(JSON.stringify(loaded))
            setStoredMenus(subdomain, data.menus)
          } else {
            setLastSavedJson(prev => prev ?? '__none__')
            // Veritabanında menü yoksa boş state'i göster; ancak kullanıcının bu sırada
            // oluşturduğu (henüz geçici kimlikli) menüyü geç gelen boş yanıtla ezme.
            setMenu(prev => (prev && prev.id.startsWith('menu-') ? prev : null))
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    loadFromSupabase()
  }, [subdomain, menuIdParam])

  const [primaryColor, setPrimaryColor] = useState(currentRestaurant?.branding?.primaryColor || '#e11d48')

  useEffect(() => {
    const c = currentRestaurant?.branding?.primaryColor
    if (c) setPrimaryColor(c)
  }, [currentRestaurant?.branding?.primaryColor])

  // Canlı Önizleme State'i
  const [previewCategory, setPreviewCategory] = useState<string>('all')
  const [previewSearch, setPreviewSearch] = useState<string>('')
  const [previewSelectedItem, setPreviewSelectedItem] = useState<MenuItem | null>(null)
  const [wifiCopied, setWifiCopied] = useState(false)

  // Müşterinin gördüğü gerçek menü sayfasını iframe içinde gösterir; düzenlemeler postMessage ile aktarılır
  const previewIframeRef = usePublicMenuPreview({ menu, restaurant: currentRestaurant, primaryColor })
  const [savedSuccess, setSavedSuccess] = useState(false)

  // HAZIR MENÜ ŞABLONU MODALI STATE'İ
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  // MENÜ TARAMA MODALI STATE'İ
  const [isScanMenuModalOpen, setIsScanMenuModalOpen] = useState(false)

  // Kategori Modalı State'i
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [selectedCategoryName, setSelectedCategoryName] = useState('Kahvaltı, Sahanda Lezzetler & Omletler')
  const [categoryDescription, setCategoryDescription] = useState('Serpme kahvaltı tabakları, bakır sahanda köy yumurtaları ve taze sıcak omlet çeşitleri')

  // ÜRÜN MODALI STATE'İ
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [targetCatId, setTargetCatId] = useState<string | null>(null)
  const [targetCategoryObj, setTargetCategoryObj] = useState<MenuCategory | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  
  const [presetDropdownVal, setPresetDropdownVal] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemCalories, setItemCalories] = useState('')
  const [itemAllergens, setItemAllergens] = useState('')
  const [itemProtein, setItemProtein] = useState('')
  const [itemCarbs, setItemCarbs] = useState('')
  const [itemFat, setItemFat] = useState('')
  const [itemImage, setItemImage] = useState('')
  // Kataloğa bağlantı (şablon/eşleştirme/katalogdan seç ile gelir)
  const [itemCatalogId, setItemCatalogId] = useState<string | null>(null)
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [itemIsFeatured, setItemIsFeatured] = useState(false)
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false)
  const [compressedPhotoInfo, setCompressedPhotoInfo] = useState<string | null>(null)

  // AI KALORİ TAHMİNİ STATE'LERİ
  const [isEstimatingCalories, setIsEstimatingCalories] = useState(false)
  const [calorieSource, setCalorieSource] = useState<'auto' | 'manual' | 'detailed'>('manual')
  const [showDetailedCalorie, setShowDetailedCalorie] = useState(false)
  const [ingredientText, setIngredientText] = useState('')
  const [isDetailedEstimating, setIsDetailedEstimating] = useState(false)
  const [calorieNote, setCalorieNote] = useState('')
  const [calorieError, setCalorieError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ÖNEMLİ-1: Debounce localStorage writes to prevent main thread blocking on every keystroke
  useEffect(() => {
    if (!menu) return
    const timeoutId = setTimeout(() => {
      setStoredMenus(subdomain, [menu])
    }, 400)
    return () => clearTimeout(timeoutId)
  }, [menu, subdomain])

  // Sunucunun verdiği gerçek menü kimliğini uygula (geçici "menu-..." kimliği kopya menü üretmesin)
  const adoptServerIds = async (res: Response, savedMenu?: Menu): Promise<Record<string, string>> => {
    let idMap: Record<string, string> = {}
    try {
      const data = await res.clone().json()
      idMap = data?.idMap || {}
    } catch {
      // yanıt JSON değilse yok say
    }
    if (Object.keys(idMap).length > 0) {
      setMenu(prev => (prev && idMap[prev.id] ? { ...prev, id: idMap[prev.id] } : prev))
    }
    // Başarıyla kaydedilen sürümü "temiz" olarak işaretle
    if (savedMenu) {
      const finalMenu = idMap[savedMenu.id] ? { ...savedMenu, id: idMap[savedMenu.id] } : savedMenu
      setLastSavedJson(JSON.stringify(finalMenu))
    }
    return idMap
  }

  // Sayfadan ayrılma uyarısı (site içi pencere) için bekleyen hedef
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false)

  // KAYDEDİLMEMİŞ DEĞİŞİKLİK TAKİBİ
  const isDirty = useMemo(() => {
    if (isLoading || !menu || lastSavedJson === null) return false
    return JSON.stringify(menu) !== lastSavedJson
  }, [menu, lastSavedJson, isLoading])

  // Sekmeyi kapatma / sayfayı yenileme uyarısı
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // Uygulama içi sayfa geçişi (sol menü vb.) uyarısı
  useEffect(() => {
    if (!isDirty) return
    const onClickCapture = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) return
      if (href === window.location.pathname + window.location.search) return
      // Tarayıcı penceresi yerine site içi uyarı göster
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(href)
    }
    document.addEventListener('click', onClickCapture, true)
    setScrollNavGuard((to) => {
      setPendingHref(to)
      return true
    })
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      setScrollNavGuard(null)
    }
  }, [isDirty])

  // Onboarding'den gelen ?start=scan|template|blank yönlendirmesi (bir kez çalışır)
  const startHandledRef = useRef(false)
  useEffect(() => {
    const start = searchParams.get('start')
    if (!start || isLoading || !subdomain || startHandledRef.current) return
    startHandledRef.current = true
    const templateId = searchParams.get('template')
    navigate('/dashboard/menu-editor', { replace: true })
    if (menu) return
    if (start === 'scan') setIsScanMenuModalOpen(true)
    else if (start === 'blank') handleCreateBlankMenu()
    else if (start === 'template') {
      if (templateId) handleApplyTemplate({ slug: templateId })
      else setIsTemplateModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, subdomain, searchParams, menu])

  // Şablonlar menu_templates tablosundan gelir; işletme tipine uyanlar ve önerilen en başta
  const { templates: allTemplates, isLoading: templatesLoading } = useCatalogTemplates(null)
  const [showAllTemplates, setShowAllTemplates] = useState(false)
  const businessTypeId = currentRestaurant?.businessType
  const { get: getBusinessType } = useBusinessTypes()
  const orderedTemplates = useMemo(() => {
    const recommendedSlug = getBusinessType(businessTypeId)?.templateId
    const rank = (t: CatalogTemplateSummary) =>
      t.slug === recommendedSlug ? 2 : t.businessType === businessTypeId ? 1 : 0
    return [...allTemplates].sort((a, b) => rank(b) - rank(a))
  }, [allTemplates, businessTypeId, getBusinessType])
  const hasTypeMatches = orderedTemplates.some((t) => t.businessType === businessTypeId)
  const visibleTemplates = useMemo(
    () =>
      showAllTemplates || !hasTypeMatches
        ? orderedTemplates
        : orderedTemplates.filter((t) => t.businessType === businessTypeId),
    [orderedTemplates, showAllTemplates, hasTypeMatches, businessTypeId]
  )

  // HAZIR MENÜ ŞABLONUNU YÜKLE (katalogdan kopyalama sunucuda apply_catalog_template RPC'siyle yapılır)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const handleApplyTemplate = async (tmpl: Pick<CatalogTemplateSummary, 'slug'> & Partial<CatalogTemplateSummary>) => {
    if (isApplyingTemplate) return
    if (menu && menu.categories && menu.categories.length > 0) {
      const confirmReplace = window.confirm(
        `"${tmpl.name ?? 'Bu'}" şablonunu yüklemek istediğinize emin misiniz? Mevcut menü kategorileriniz bu şablonla değiştirilecektir (Daha sonra dilediğiniz gibi düzenleyebilirsiniz).`
      )
      if (!confirmReplace) return
    }

    setIsApplyingTemplate(true)
    try {
      const applyRes = await authFetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain,
          templateSlug: tmpl.slug,
          menuId: menu && !menu.id.startsWith('menu-') ? menu.id : null,
        }),
      })
      const applied = await applyRes.json().catch(() => ({}))
      if (!applyRes.ok) {
        toast.error(`Şablon uygulanamadı: ${applied.error || 'Bilinmeyen hata'}`)
        return
      }

      const loadRes = await authFetch(`/api/menus/load?subdomain=${subdomain}`)
      if (!loadRes.ok) throw new Error('Menü yeniden yüklenemedi')
      const { menus: loadedMenus } = await loadRes.json()
      const newMenu: Menu | undefined =
        (loadedMenus || []).find((m: Menu) => m.id === applied.menu_id) || loadedMenus?.[0]
      if (!newMenu) throw new Error('Menü bulunamadı')

      setMenu(newMenu)
      setLastSavedJson(JSON.stringify(newMenu))
      setStoredMenus(subdomain, loadedMenus)
      const color = tmpl.color ?? allTemplates.find((t) => t.slug === tmpl.slug)?.color
      if (color) setPrimaryColor(color)
      setIsTemplateModalOpen(false)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
      toast.success('Şablon başarıyla uygulandı ve kaydedildi.')
    } catch (e: any) {
      console.error('Failed to apply template:', e)
      toast.error(`Bağlantı hatası: ${e.message}`)
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  // SIFIRDAN BOŞ MENÜ OLUŞTUR
  const handleCreateBlankMenu = () => {
    const blankMenu: Menu = {
      id: `menu-${Date.now()}`,
      name: `${currentRestaurant?.name || 'Restoran'} Menüsü`,
      description: 'Özenle hazırlanan lezzetli yemek ve içeceklerimiz',
      image_url: currentRestaurant?.branding?.bannerUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop',
      is_listed: true,
      available_days: [1, 2, 3, 4, 5, 6, 7],
      layout: 'grid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      categories: [
        {
          id: `cat-${Date.now()}`,
          name: 'Başlangıçlar & Ana Yemekler',
          description: 'Günün öne çıkan lezzetleri',
          display_order: 1,
          is_active: true,
          items: []
        }
      ]
    }
    setMenu(blankMenu)
    setStoredMenus(subdomain, [blankMenu])
    
    // Asenkron olarak veritabanına kaydet
    authFetch('/api/menus/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, menus: [blankMenu] })
    }).then(async res => {
      if (res.ok) {
        await adoptServerIds(res, blankMenu)
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
        toast.success('Boş menü başarıyla oluşturuldu.')
      } else {
        const err = await res.json()
        toast.error(`Menü oluşturma hatası: ${err.error || 'Bilinmeyen hata'}`)
      }
    }).catch(e => {
      console.error('Failed to sync blank menu to Supabase:', e)
      toast.error(`Bağlantı hatası: ${e.message}`)
    })
  }

  // Fotoğraf Yükleme (Otomatik Akıllı Sıkıştırma: WebP/JPEG, Max 800px, %80 Kalite)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        setIsCompressingPhoto(true)
        const result = await compressImageFile(file, IMAGE_PRESETS.PRODUCT)
        setItemImage(result.dataUrl)
        setCompressedPhotoInfo(
          `%${result.reductionPercent} sıkıştırıldı (${formatFileSize(result.originalSizeKB)} ➔ ${formatFileSize(result.compressedSizeKB)})`
        )
      } catch (err) {
        console.error('Fotoğraf sıkıştırma hatası:', err)
        const reader = new FileReader()
        reader.onloadend = () => {
          setItemImage(reader.result as string)
        }
        reader.readAsDataURL(file)
      } finally {
        setIsCompressingPhoto(false)
        if (e.target) e.target.value = ''
      }
    }
  }

  // AI KALORİ TAHMİN FONKSİYONLARI
  const handleEstimateCalories = async () => {
    if (!itemName || itemName.trim().length < 2) return
    setIsEstimatingCalories(true)
    setCalorieError('')
    try {
      const res = await authFetch('/api/estimate-calories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'quick',
          itemName: itemName.trim(),
          categoryHint: targetCategoryObj?.name || ''
        })
      })
      const data = await res.json()
      if (data.success && data.calories) {
        setItemCalories(String(data.calories))
        setCalorieSource('auto')
        setCalorieNote(data.note || '')
      } else {
        setCalorieError(data.error || 'Kalori hesaplanamadı.')
      }
    } catch {
      setCalorieError('Bağlantı hatası. Lütfen tekrar deneyin.')
    }
    setIsEstimatingCalories(false)
  }

  const handleDetailedEstimate = async () => {
    if (!itemName || !ingredientText.trim()) return
    setIsDetailedEstimating(true)
    setCalorieError('')
    try {
      const res = await authFetch('/api/estimate-calories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'detailed',
          itemName: itemName.trim(),
          ingredients: ingredientText.trim(),
          categoryHint: targetCategoryObj?.name || ''
        })
      })
      const data = await res.json()
      if (data.success && data.calories) {
        setItemCalories(String(data.calories))
        setCalorieSource('detailed')
        setCalorieNote(data.note || '')
        setShowDetailedCalorie(false)
      } else {
        setCalorieError(data.error || 'Detaylı kalori hesaplanamadı.')
      }
    } catch {
      setCalorieError('Bağlantı hatası. Lütfen tekrar deneyin.')
    }
    setIsDetailedEstimating(false)
  }

  // Hızlı önerilerden seçim yapıldığında veya boş seçildiğinde
  const handlePresetSelectChange = (val: string) => {
    setPresetDropdownVal(val)
    
    if (!val || val === 'CUSTOM') {
      setItemName('')
      setItemDesc('')
      setItemCalories('')
      setItemAllergens('')
      setItemProtein('')
      setItemCarbs('')
      setItemFat('')
      setCalorieSource('manual')
      setCalorieNote('')
      setCalorieError('')
      setShowDetailedCalorie(false)
      setIngredientText('')
      setItemImage('')
      return
    }

    const catName = targetCategoryObj?.name || ''
    const catItems = PREDEFINED_CATALOG[catName] || DEFAULT_CATALOG_FALLBACK
    const match = catItems.find(i => i.name === val)
    if (match) {
      setItemName(match.name)
      setItemDesc(match.defaultDescription)
      setItemCalories(match.defaultCalories ? match.defaultCalories.toString() : '')
      setItemAllergens(match.defaultAllergens ? match.defaultAllergens.join(', ') : '')
      setItemImage(match.defaultImage)
    }
  }

  // Kategori Seçildiğinde Açıklamayı Otomatik Ayarla
  const handleCategoryCardClick = (catName: string, defaultDesc: string) => {
    setSelectedCategoryName(catName)
    setCategoryDescription(defaultDesc)
  }

  // AI ile ürün görseli üret (Cloudflare ücretsiz havuzu, günlük kota sunucuda)
  const handleGenerateImage = async () => {
    if (!subdomain || !itemName.trim()) return
    setIsGeneratingImage(true)
    try {
      const r = await generateItemImage({
        subdomain,
        name: itemName.trim(),
        description: itemDesc,
        category: targetCategoryObj?.name || null,
      })
      setItemImage(r.url)
      setCompressedPhotoInfo(null)
      toast.success('AI görsel eklendi', { description: `Bugün kalan: ${Math.min(r.orgRemaining, r.globalRemaining)}` })
    } catch (e: any) {
      toast.error(e?.message || 'Görsel üretilemedi')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  // Ürün Ekle Modalı Aç
  const openAddItemModal = (catId: string, item?: MenuItem) => {
    setTargetCatId(catId)
    const cat = menu ? (menu.categories.find(c => c.id === catId) || null) : null
    setTargetCategoryObj(cat)
    setCatalogPickerOpen(false)
    setItemCatalogId(item?.catalog_item_id ?? null)

    if (item) {
      setEditingItem(item)
      setPresetDropdownVal('')
      setItemName(item.name)
      setItemPrice(item.price || '')
      setItemDesc(item.description || '')
      setItemCalories(item.calories ? item.calories.toString() : '')
      setItemAllergens(item.allergens ? item.allergens.join(', ') : '')
      setItemProtein(item.macros?.protein ? item.macros.protein.toString() : '')
      setItemCarbs(item.macros?.carbs ? item.macros.carbs.toString() : '')
      setItemFat(item.macros?.fat ? item.macros.fat.toString() : '')
      setItemImage(item.image_url || '')
      setItemIsFeatured(item.is_featured || false)
      setCalorieSource(item.calorie_source || 'manual')
      setCalorieNote('')
      setCalorieError('')
      setShowDetailedCalorie(false)
      setIngredientText('')
    } else {
      setEditingItem(null)
      setPresetDropdownVal('')
      setItemName('')
      setItemPrice('')
      setItemDesc('')
      setItemCalories('')
      setItemAllergens('')
      setItemProtein('')
      setItemCarbs('')
      setItemFat('')
      setItemImage('')
      setItemIsFeatured(false)
      setCalorieSource('manual')
      setCalorieNote('')
      setCalorieError('')
      setShowDetailedCalorie(false)
      setIngredientText('')
    }
    setCompressedPhotoInfo(null)
    setIsAddItemModalOpen(true)
  }

  // Ürün Kaydet
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName || !targetCatId) return

    const cleanName = sanitizeText(itemName, 100)
    const cleanDesc = sanitizeMultilineText(itemDesc, 500)
    const trimmedPrice = itemPrice.trim()
    const rawFormattedPrice = trimmedPrice
      ? (trimmedPrice.includes('₺') || trimmedPrice.includes('$') || trimmedPrice.includes('€') ? trimmedPrice : `${trimmedPrice} ₺`)
      : ''
    const formattedPrice = sanitizePrice(rawFormattedPrice, 20)
    const cleanCalories = itemCalories ? parseInt(sanitizeText(itemCalories, 6)) : undefined
    const cleanAllergens = itemAllergens ? itemAllergens.split(',').map(s => sanitizeText(s.trim(), 40)).filter(Boolean) : []
    const macros = (itemProtein || itemCarbs || itemFat) ? {
      protein: itemProtein ? parseInt(sanitizeText(itemProtein, 6)) || 0 : 0,
      carbs: itemCarbs ? parseInt(sanitizeText(itemCarbs, 6)) || 0 : 0,
      fat: itemFat ? parseInt(sanitizeText(itemFat, 6)) || 0 : 0,
    } : undefined

    if (editingItem) {
      setMenu(prev => prev ? ({
        ...prev,
        categories: prev.categories.map(cat => {
          if (cat.id === targetCatId) {
            return {
              ...cat,
              items: cat.items.map(item => 
                item.id === editingItem.id ? {
                  ...item,
                  name: cleanName,
                  description: cleanDesc,
                  price: formattedPrice,
                  calories: cleanCalories,
                  allergens: cleanAllergens,
                  macros: macros,
                  image_url: itemImage || '',
                  catalog_item_id: itemCatalogId ?? null,
                  is_featured: itemIsFeatured,
                  calorie_source: calorieSource
                } : item
              )
            }
          }
          return cat
        })
      }) : null)
    } else {
      const newItem: MenuItem = {
        id: `item-${Date.now()}`,
        name: cleanName,
        description: cleanDesc,
        price: formattedPrice,
        image_url: itemImage || '',
        catalog_item_id: itemCatalogId ?? null,
        calories: cleanCalories,
        allergens: cleanAllergens,
        macros: macros,
        display_order: 1,
        is_available: true,
        is_featured: itemIsFeatured,
        calorie_source: calorieSource
      }

      setMenu(prev => prev ? ({
        ...prev,
        categories: prev.categories.map(cat => 
          cat.id === targetCatId ? { ...cat, items: [...cat.items, newItem] } : cat
        )
      }) : null)
    }

    setIsAddItemModalOpen(false)
    setEditingItem(null)
    setTargetCatId(null)
  }

  const handleDeleteItem = (catId: string, itemId: string) => {
    setMenu(prev => prev ? ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === catId ? { ...cat, items: cat.items.filter(i => i.id !== itemId) } : cat
      )
    }) : null)
  }

  const toggleItemAvailability = (catId: string, itemId: string) => {
    // Deprecated: Stok yönetimi yerine alerjen yönetimi getirildi
  }

  const handleInlineUpdate = (catId: string, itemId: string, field: 'price' | 'calories' | 'allergens', value: any) => {
    setMenu(prev => prev ? ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === catId ? {
          ...cat,
          items: cat.items.map(item => 
            item.id === itemId ? { ...item, [field]: value } : item
          )
        } : cat
      )
    }) : null)
  }

  // Kategori Kaydet
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategoryName) return

    const cleanCatName = sanitizeText(selectedCategoryName, 100)
    const cleanCatDesc = sanitizeMultilineText(categoryDescription, 300)

    if (editingCategory) {
      setMenu(prev => prev ? ({
        ...prev,
        categories: prev.categories.map(cat => 
          cat.id === editingCategory.id ? { ...cat, name: cleanCatName, description: cleanCatDesc } : cat
        )
      }) : null)
    } else {
      const newCat: MenuCategory = {
        id: `cat-${Date.now()}`,
        name: cleanCatName,
        description: cleanCatDesc,
        is_active: true,
        display_order: (menu?.categories.length || 0) + 1,
        items: []
      }
      setMenu(prev => prev ? ({ ...prev, categories: [...prev.categories, newCat] }) : null)
    }

    setIsAddCatModalOpen(false)
    setEditingCategory(null)
    setCategorySearchQuery('')
  }

  const toggleCategoryActive = (catId: string) => {
    setMenu(prev => prev ? ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === catId ? { ...cat, is_active: !cat.is_active } : cat
      )
    }) : null)
  }

  const handleDeleteCategory = (catId: string) => {
    if (confirm('Bu kategoriyi ve içindeki ürünleri silmek istediğinize emin misiniz?')) {
      setMenu(prev => prev ? ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== catId)
      }) : null)
    }
  }

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (!menu) return
    const newCats = [...menu.categories]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newCats.length) return
    const temp = newCats[index]
    newCats[index] = newCats[targetIndex]
    newCats[targetIndex] = temp
    setMenu(prev => prev ? ({ ...prev, categories: newCats }) : null)
  }

  const handleSaveAll = async (): Promise<boolean> => {
    if (!menu) return false
    
    // Draft as backup
    setStoredMenus(subdomain, [menu])
    
    try {
      const res = await authFetch('/api/menus/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, menus: [menu] })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save to Supabase')
      }

      await adoptServerIds(res, menu)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
      toast.success('Menü başarıyla kaydedildi.')
      return true
    } catch (e: any) {
      console.error(e)
      toast.error(`Menü kaydedilirken hata oluştu: ${e.message}`)
      return false
    }
  }

  const handleSaveAndLeave = async () => {
    if (!pendingHref) return
    setIsSavingBeforeLeave(true)
    const ok = await handleSaveAll()
    setIsSavingBeforeLeave(false)
    if (ok) {
      const target = pendingHref
      setPendingHref(null)
      navigate(target)
    }
  }

  const handleLeaveWithoutSaving = () => {
    if (!pendingHref) return
    const target = pendingHref
    setPendingHref(null)
    navigate(target)
  }

  // Ctrl/Cmd + S ile kaydet
  const saveAllRef = useRef(handleSaveAll)
  saveAllRef.current = handleSaveAll
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveAllRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const activeCategoriesForPreview = menu ? menu.categories.filter(c => c.is_active) : []
  const filteredPreviewCategories = activeCategoriesForPreview.map(cat => {
    const items = cat.items.filter(item => 
      item.name.toLowerCase().includes(previewSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(previewSearch.toLowerCase())
    )
    return { ...cat, items }
  }).filter(cat => previewCategory === 'all' || cat.id === previewCategory).filter(cat => cat.items.length > 0)

  // Kategori Modalı İçin Filtrelenmiş Gruplar
  const filteredCategoryGroups = ORDERED_CATEGORY_GROUPS.map(grp => {
    const filtered = grp.categories.filter(c => 
      c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
      c.defaultDescription.toLowerCase().includes(categorySearchQuery.toLowerCase())
    )
    return { ...grp, categories: filtered }
  }).filter(grp => grp.categories.length > 0)

  const currentCategoryCatalog = targetCategoryObj 
    ? (PREDEFINED_CATALOG[targetCategoryObj.name] || DEFAULT_CATALOG_FALLBACK)
    : DEFAULT_CATALOG_FALLBACK

  return (
    <div className="space-y-6">
      {/* Üst Bar */}
      <div className="glass-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Utensils className="mr-2 h-6 w-6 text-primary" /> Canlı Menü ve Kategori Editörü
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Kurumsal gastronomi standartlarında ana kategorilerle menünüzü yapılandırabilir veya hazır şablonları yükleyebilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsTemplateModalOpen(true)}
            className="border-primary/40 text-primary hover:bg-primary/5 font-semibold"
          >
            <Sparkles className="h-4 w-4 mr-1.5 text-primary" /> Hazır Menü Paketleri
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsScanMenuModalOpen(true)}
            className="scan-attention border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 hover:text-violet-800 dark:border-violet-400/40 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/20 dark:hover:text-violet-100 font-semibold"
          >
            <Camera className="h-4 w-4 mr-1.5" /> Kendi Menünü Tara
          </Button>
          {menu ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={`/menu/${subdomain}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Canlı Menü
                </a>
              </Button>
              <Button
                onClick={handleSaveAll}
                className={isDirty ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse' : 'bg-primary text-white'}
              >
                {savedSuccess ? <Check className="h-4 w-4 mr-1.5 text-green-300" /> : <Save className="h-4 w-4 mr-1.5" />}
                {savedSuccess ? 'Kaydedildi!' : isDirty ? 'Kaydet (değişiklik var)' : 'Kaydet'}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/menus')}>
              <ArrowRight className="h-4 w-4 mr-1.5" /> Menü Listesine Git
            </Button>
          )}
        </div>
      </div>

      {/* Sayfadan ayrılırken kaydedilmemiş değişiklik uyarısı (site içi) */}
      <Dialog open={pendingHref !== null} onOpenChange={(open) => { if (!open) setPendingHref(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" /> Kaydedilmemiş değişiklikler var
            </DialogTitle>
            <DialogDescription>
              Menüde yaptığınız değişiklikleri henüz kaydetmediniz. Kaydetmeden çıkarsanız bu değişiklikler kaybolacak.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPendingHref(null)} disabled={isSavingBeforeLeave} className="w-full sm:w-auto">
              Düzenlemeye Devam Et
            </Button>
            <Button variant="outline" onClick={handleLeaveWithoutSaving} disabled={isSavingBeforeLeave} className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50">
              Kaydetmeden Çık
            </Button>
            <Button onClick={handleSaveAndLeave} disabled={isSavingBeforeLeave} className="w-full sm:w-auto bg-primary text-white">
              <Save className="h-4 w-4 mr-1.5" /> {isSavingBeforeLeave ? 'Kaydediliyor...' : 'Kaydet ve Çık'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kaydedilmemiş değişiklik çubuğu (her zaman görünür) */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-2xl">
          <div className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-900 leading-tight">
              Kaydedilmemiş değişiklikleriniz var
            </span>
          </div>
          <Button size="sm" onClick={handleSaveAll} className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold">
            <Save className="h-4 w-4 mr-1.5" /> Şimdi Kaydet
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="glass-card flex flex-col items-center justify-center py-24 mt-6">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Menü verileri yükleniyor...</p>
        </div>
      ) : !menu ? (
        /* Uyarı & Menü Yükleme Kartı */
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-dashed border-amber-300 p-8 sm:p-12 text-center shadow-sm max-w-4xl mx-auto space-y-6"
        >
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-inner">
            <AlertCircle className="h-9 w-9" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Kayıtlı Menü Bulunamadı
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Lütfen Önce Menünüzü Yükleyin
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Canlı menü editörünü ve akıllı telefon simülatörünü kullanabilmek için işletmenize ait aktif bir menü bulunmalıdır. Aşağıdaki seçeneklerden birini kullanarak hemen başlayabilirsiniz:
            </p>
          </div>

          {/* Aksiyon Butonları */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button 
              size="lg" 
              onClick={() => setIsTemplateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-6 text-base shadow-md w-full sm:w-auto"
            >
              <Sparkles className="h-5 w-5 mr-2" /> Hazır Menü Paketi Yükle
            </Button>

            <Button 
              size="lg" 
              onClick={() => setIsScanMenuModalOpen(true)}
              className="scan-attention bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-6 py-6 text-base shadow-md w-full sm:w-auto"
            >
              <Camera className="h-5 w-5 mr-2" /> Kendi Menünü Tara
            </Button>

            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleCreateBlankMenu}
              className="border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold px-6 py-6 text-base w-full sm:w-auto"
            >
              <Plus className="h-5 w-5 mr-2 text-primary" /> Sıfırdan Boş Menü Başlat
            </Button>
          </div>

          {/* Hızlı Seçim Şablon Önizlemeleri */}
          <div className="pt-6 border-t text-left">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 text-center">
              Tek Tıkla Yükleyebileceğiniz Popüler Hazır Menü Paketleri:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleTemplates.slice(0, 4).map((tmpl) => (
                <div 
                  key={tmpl.slug}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-4 rounded-xl border border-gray-200 hover:border-primary hover:shadow-md transition-all cursor-pointer bg-gray-50/50 hover:bg-white flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl p-2 bg-white rounded-lg border shadow-xs">{tmpl.icon}</span>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 group-hover:text-primary transition-colors">
                        {tmpl.name}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1">{tmpl.tagline}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-primary font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                    Yükle
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        /* Split View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SOL BÖLÜM: KATEGORİ & ÜRÜN YÖNETİMİ */}
        <div className="lg:col-span-7 min-w-0 space-y-6">
          
          {/* Menü Başlığı & Renk */}
          <Card>
            <CardHeader className="py-3 px-4 bg-gray-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">Menü Başlığı & Tema Rengi</CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-medium">Tema Rengi:</span>
                <input 
                  type="color" 
                  value={primaryColor} 
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-7 h-7 rounded border cursor-pointer p-0.5"
                  title="Menü rengini canlı değiştirin"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="m-name" className="text-xs">Menü Adı</Label>
                  <Input 
                    id="m-name" 
                    value={menu.name} 
                    onChange={(e) => setMenu(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="m-desc" className="text-xs">Açıklama / Karşılama Notu</Label>
                  <Input 
                    id="m-desc" 
                    value={menu.description} 
                    onChange={(e) => setMenu(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kategoriler Listesi */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">Menü Kategorileri</h2>
                <p className="text-xs text-gray-500">Kategorileri açıp kapatabilir, sıralayabilir ve ürün ekleyebilirsiniz.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsTemplateModalOpen(true)}>
                  <BookOpen className="h-3.5 w-3.5 mr-1 text-primary" /> Şablon Yükle
                </Button>
                <Button size="sm" onClick={() => setIsAddCatModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> + Yeni Kategori
                </Button>
              </div>
            </div>

            {menu.categories.length === 0 && (
              <Card className="p-8 text-center border-dashed">
                <Utensils className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="font-semibold text-gray-700">Henüz kategori eklenmemiş</p>
                <p className="text-xs text-gray-400 mb-4">Sıfırdan kategori ekleyebilir veya hazır profesyonel bir şablon yükleyebilirsiniz.</p>
                <div className="flex justify-center gap-3">
                  <Button size="sm" variant="outline" onClick={() => setIsTemplateModalOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Hazır Şablon Seç
                  </Button>
                  <Button size="sm" onClick={() => setIsAddCatModalOpen(true)}>Kategori Ekle</Button>
                </div>
              </Card>
            )}

            {menu.categories.map((category, index) => (
              <Card 
                key={category.id} 
                className={`transition-all border ${
                  category.is_active 
                    ? 'shadow-sm'
                    : 'border-dashed opacity-75'
                }`}
              >
                {/* Kategori Başlık ve Kontrol Barı */}
                <div className="p-3.5 bg-muted/60 text-foreground border-b border-border flex flex-wrap items-center justify-between gap-2 rounded-t-2xl">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex flex-col">
                      <button 
                        onClick={() => moveCategory(index, 'up')} 
                        disabled={index === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => moveCategory(index, 'down')} 
                        disabled={index === menu.categories.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-foreground text-sm">{category.name}</span>
                        <span className="text-[11px] text-muted-foreground">({category.items.length} Ürün)</span>
                      </div>
                      {category.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{category.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Kategori Butonları */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => toggleCategoryActive(category.id)}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                        category.is_active
                          ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500/90 dark:text-white dark:hover:bg-green-500'
                          : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-foreground'
                      }`}
                      title={category.is_active ? 'Kategoriyi gizle (Pasif)' : 'Kategoriyi göster (Aktif)'}
                    >
                      {category.is_active ? (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Menüde Açık
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Menüde Gizli
                        </>
                      )}
                    </button>

                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs bg-background text-foreground border-border hover:bg-accent"
                      onClick={() => openAddItemModal(category.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Ürün Ekle
                    </Button>

                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => {
                        setEditingCategory(category)
                        setSelectedCategoryName(category.name)
                        setCategoryDescription(category.description || '')
                        setIsAddCatModalOpen(true)
                      }}
                      title="Açıklamayı Düzenle"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>

                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => handleDeleteCategory(category.id)}
                      title="Kategoriyi Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Kategori Ürünleri */}
                <CardContent className="p-0 sm:p-3 overflow-x-auto">
                  {category.items.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400 italic">
                      Bu kategoride henüz ürün yok. "Ürün Ekle" butonuna basarak ilk lezzetinizi ekleyin.
                    </div>
                  ) : (
                    <div className="flex flex-col min-w-[560px]">
                      {/* KOLON BAŞLIKLARI */}
                      <div className="grid grid-cols-[8fr_3fr_2fr_4fr_2fr] gap-2 px-3 py-2 bg-muted/40 border-y border-border text-[10px] font-bold text-muted-foreground uppercase">
                        <div>Ürün</div>
                        <div className="text-center">Fiyat</div>
                        <div className="text-center">Kalori</div>
                        <div className="text-center">Alerjenler</div>
                        <div className="text-right">İşlemler</div>
                      </div>
                      
                      <div className="divide-y divide-border">
                        {category.items.map((item) => (
                          <div key={item.id} className="grid grid-cols-[8fr_3fr_2fr_4fr_2fr] items-center gap-2 p-3 hover:bg-accent/50 transition-colors">
                            {/* 1. ÜRÜN BİLGİSİ */}
                            <div className="flex items-center space-x-3 overflow-hidden">
                              {item.image_url ? (
                                <img 
                                  src={catalogThumbUrl(item.image_url)}
                                  loading="lazy"
                                  decoding="async" 
                                  alt={item.name} 
                                  className="w-10 h-10 rounded-lg object-cover border bg-gray-100 shrink-0" 
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 border flex items-center justify-center text-gray-400 shrink-0">
                                  <Utensils className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-semibold text-xs text-foreground truncate">{item.name}</span>
                                  {item.is_featured && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded flex items-center shrink-0">
                                      <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</p>
                              </div>
                            </div>

                            {/* 2. FİYAT (INPUT) */}
                            <div className="flex justify-center">
                              <div className="relative w-full max-w-[80px]">
                                <Input 
                                  defaultValue={item.price ? item.price.replace(' ₺', '').replace('₺', '') : ''}
                                  placeholder="120"
                                  onBlur={(e) => {
                                    const val = e.target.value.trim()
                                    // Sadece sayı girildiyse TL formatında kaydet, aksi halde aynen kaydet
                                    const formattedPrice = val ? (/^\d+(\.\d+)?(,\d+)?$/.test(val) ? `${val} ₺` : val) : ''
                                    if (formattedPrice !== item.price) {
                                      handleInlineUpdate(category.id, item.id, 'price', formattedPrice)
                                    }
                                  }}
                                  className="h-8 text-xs text-center font-bold px-1 pr-4 w-full"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold pointer-events-none select-none">
                                  ₺
                                </span>
                              </div>
                            </div>

                            {/* 3. KALORİ (INPUT) */}
                            <div className="flex justify-center">
                              <div className="relative w-full max-w-[80px]">
                                <Input 
                                  defaultValue={item.calories || ''}
                                  type="number"
                                  placeholder="450"
                                  onBlur={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined
                                    if (val !== item.calories) {
                                      handleInlineUpdate(category.id, item.id, 'calories', val)
                                    }
                                  }}
                                  className="h-8 text-xs text-center font-bold pl-1 pr-6 w-full"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-medium pointer-events-none select-none">
                                  kcal
                                </span>
                              </div>
                            </div>

                            {/* 4. ALERJENLER (INPUT) */}
                            <div className="flex justify-center">
                              <Input 
                                defaultValue={item.allergens ? item.allergens.join(', ') : ''}
                                placeholder="Ör: Süt, Fıstık"
                                onBlur={(e) => {
                                  const val = e.target.value.trim()
                                  const allergensArr = val ? val.split(',').map(a => a.trim()).filter(Boolean) : []
                                  const oldVal = (item.allergens || []).join(', ')
                                  const newVal = allergensArr.join(', ')
                                  if (oldVal !== newVal) {
                                    handleInlineUpdate(category.id, item.id, 'allergens', allergensArr.length > 0 ? allergensArr : undefined)
                                  }
                                }}
                                className="h-8 text-[11px] text-center px-1 w-full max-w-[120px]"
                              />
                            </div>

                            {/* 5. İŞLEMLER */}
                            <div className="flex items-center justify-end space-x-1 shrink-0">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                                onClick={() => openAddItemModal(category.id, item)}
                                title="Detaylı Düzenle"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-gray-400 hover:text-red-500"
                                onClick={() => handleDeleteItem(category.id, item.id)}
                                title="Ürünü Sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* SAĞ BÖLÜM: CANLI TELEFON SİMÜLATÖRÜ */}
        <div className="lg:col-span-5 sticky top-20 flex flex-col items-center">
          <div className="flex items-center justify-between w-full max-w-[360px] mb-2 px-1">
            <div className="flex items-center space-x-1 text-xs font-bold text-gray-700">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>Canlı Müşteri Önizlemesi</span>
            </div>
            <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse mr-1"></span> Canlı Senkronize
            </span>
          </div>

          {/* TELEFON ÇERÇEVESİ */}
          <div className="keep-light w-full max-w-[360px] h-[720px] bg-black rounded-[48px] p-3.5 shadow-2xl border-4 border-gray-800 relative flex flex-col justify-between overflow-hidden">
            
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-gray-900 rounded-full mr-2"></div>
              <div className="w-2 h-2 bg-blue-950 rounded-full"></div>
            </div>

            <iframe
              ref={previewIframeRef}
              title="Canlı Müşteri Önizlemesi"
              src={`/menu/${subdomain}?preview=1`}
              className="w-full h-full bg-white rounded-[38px] border-0"
            />
          </div>
        </div>
      </div>
      )}

      {/* HAZIR MENÜ ŞABLONLARI MODALI */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="sm:max-w-[840px] max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    Hazır Menü Paketleri & Şablonlar
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500 mt-0.5">
                    İşletme türünüze en uygun kurumsal gastronomi menü setini seçin. Yüklendikten sonra her ürünü ve fiyatı düzenleyebilirsiniz.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Şablon Kartları Grid */}
          <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-4 max-h-[520px] scrollbar-thin">
            {templatesLoading && (
              <p className="text-sm text-gray-500 text-center py-8">Şablonlar yükleniyor…</p>
            )}
            {!templatesLoading && visibleTemplates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">Şu an kullanılabilir şablon yok.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleTemplates.map((tmpl) => {
                const totalItemCount = tmpl.itemCount
                return (
                  <div
                    key={tmpl.slug}
                    className="bg-white rounded-2xl border-2 border-gray-200 hover:border-primary hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3 group"
                  >
                    <div className="space-y-2.5">
                      {/* Üst Başlık & İkon */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-2xl p-2 bg-gray-50 rounded-xl border">{tmpl.icon}</span>
                          <div>
                            <h3 className="font-extrabold text-sm text-gray-900 group-hover:text-primary transition-colors">
                              {tmpl.name}
                            </h3>
                            <span className="text-[11px] font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                              {tmpl.venueType}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg shrink-0">
                          {totalItemCount} Seçkin Ürün
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed">{tmpl.description}</p>

                      {/* Kategoriler Özeti */}
                      <div className="pt-2 border-t space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kategori Setleri:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tmpl.categories.map((c) => (
                            <span key={c.name} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                              {c.name} <strong className="text-primary font-bold">({c.itemCount})</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleApplyTemplate(tmpl)}
                      disabled={isApplyingTemplate}
                      className="w-full text-xs h-9 bg-gray-900 hover:bg-primary text-white font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Bu Şablonu Menüye Yükle
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-3 border-t flex items-center justify-between text-xs text-gray-500">
            <span>💡 İpucu: Şablon yüklendikten sonra ürün ekleyebilir, fiyatları değiştirebilir veya istemediğiniz kategorileri tek tıkla gizleyebilirsiniz.</span>
            {hasTypeMatches && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllTemplates((v) => !v)}>
                {showAllTemplates ? 'Yalnızca işletme türüme uyanlar' : 'Tüm şablonları göster'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MENÜ TARAMA MODALI */}
      <ScanMenuModal
        isOpen={isScanMenuModalOpen}
        onClose={() => setIsScanMenuModalOpen(false)}
        onMenuCreated={async (scannedMenu) => {
          const newMenu: Menu = {
            id: menu?.id || `menu-${Date.now()}`,
            name: scannedMenu.name || `${currentRestaurant?.name || 'Restoran'} Menüsü`,
            description: scannedMenu.description || 'Fotoğraftan taranarak oluşturulan menü',
            image_url: scannedMenu.image_url || currentRestaurant?.branding?.bannerUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop',
            is_listed: true,
            available_days: [1, 2, 3, 4, 5, 6, 7],
            layout: 'grid',
            created_at: menu?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            categories: scannedMenu.categories || []
          }
          setMenu(newMenu)
          setStoredMenus(subdomain, [newMenu])
          
          try {
            const res = await authFetch('/api/menus/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subdomain, menus: [newMenu] })
            })
            if (!res.ok) {
              const err = await res.json()
              throw new Error(err.error || 'Bilinmeyen hata')
            }
            await adoptServerIds(res, newMenu)
            setSavedSuccess(true)
            setTimeout(() => setSavedSuccess(false), 3000)
            toast.success('Taranan menü başarıyla kaydedildi.')
          } catch (e: any) {
            console.error('Failed to sync scanned menu to Supabase:', e)
            toast.error(`Senkronizasyon hatası: ${e.message}`)
          }
        }}
      />

      {/* KATEGORİ MODALI */}
      <Dialog open={isAddCatModalOpen} onOpenChange={setIsAddCatModalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col p-5">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-bold flex items-center">
              <Layers className="h-5 w-5 mr-2 text-primary" />
              {editingCategory ? 'Kategori Açıklamasını Düzenle' : 'Menüye Kategori Ekle'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingCategory 
                ? `"${editingCategory.name}" kategorisi için açıklama metnini güncelleyin.` 
                : 'Kafe, Bar veya Restoran ana kategorilerinden dilediğinizi aratarak seçin.'}
            </DialogDescription>
          </DialogHeader>

          {editingCategory ? (
            <form onSubmit={handleSaveCategory} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="font-bold text-gray-900">Kategori Adı</Label>
                <div className="p-2.5 bg-gray-100 rounded-lg border font-bold text-sm text-gray-800">
                  {editingCategory.name}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cat-desc">Kategori Açıklaması</Label>
                <Textarea
                  id="cat-desc"
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setIsAddCatModalOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit">
                  Açıklamayı Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden space-y-3">
              
              {/* ARAMA ÇUBUĞU */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Kategori ara (örn: kahvaltı, burger, makarna, tatlı, kahve)..."
                  className="pl-9 h-9 text-xs"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* GRUPLANDIRILMIŞ KATEGORİLER */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin max-h-[340px]">
                {filteredCategoryGroups.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">
                    "{categorySearchQuery}" aramasına uygun kategori bulunamadı.
                  </div>
                ) : (
                  filteredCategoryGroups.map((group) => {
                    const GroupIcon = group.icon
                    return (
                      <div key={group.groupTitle} className="space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs font-extrabold text-gray-700 bg-gray-100 p-1.5 rounded-md px-2.5 sticky top-0 z-10">
                          <GroupIcon className="h-3.5 w-3.5 text-primary" />
                          <span>{group.groupTitle}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.categories.map((cat) => {
                            const isSelected = selectedCategoryName === cat.name
                            return (
                              <div
                                key={cat.name}
                                onClick={() => handleCategoryCardClick(cat.name, cat.defaultDescription)}
                                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs' 
                                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold">{cat.name}</span>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                </div>
                                <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{cat.defaultDescription}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* SEÇİLEN KATEGORİ AÇIKLAMASI */}
              <form onSubmit={handleSaveCategory} className="pt-2 border-t space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label htmlFor="cat-desc-add" className="font-semibold text-gray-700">
                      Seçilen: <strong className="text-primary">{selectedCategoryName}</strong> Açıklaması:
                    </Label>
                  </div>
                  <Input
                    id="cat-desc-add"
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Kategori açıklamasını düzenleyin..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsAddCatModalOpen(false)}>
                    Vazgeç
                  </Button>
                  <Button size="sm" type="submit" className="bg-primary text-white">
                    <Plus className="h-4 w-4 mr-1" /> Bu Kategoriyi Ekle
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* YENİ ÜRÜN MODALI */}
      <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{editingItem ? 'Ürünü Düzenle' : `Yeni Ürün Ekle (${targetCategoryObj?.name})`}</DialogTitle>
              {!editingItem && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-gray-500 hover:text-gray-900"
                  onClick={() => handlePresetSelectChange('')}
                  title="Tüm alanları ve resmi temizle"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Temizle
                </Button>
              )}
            </div>
            <DialogDescription>
              Hazır lezzet önerilerinden seçebilir veya kendi özel ürününüzü tanımlayabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="space-y-3.5 py-2">
            
            {/* 1. HAZIR ÜRÜN ÖNERİLERİ SEÇİCİ */}
            {!editingItem && currentCategoryCatalog.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="preset-select" className="text-xs text-gray-500 flex items-center">
                  <Sparkles className="h-3 w-3 mr-1 text-primary" /> Hazır Önerilerden Hızlı Doldur:
                </Label>
                <select
                  id="preset-select"
                  value={presetDropdownVal}
                  onChange={(e) => handlePresetSelectChange(e.target.value)}
                  className="w-full h-8 px-2.5 py-1 text-xs bg-gray-50 border border-gray-300 rounded-md shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary text-gray-700 cursor-pointer"
                >
                  <option value="">-- Hazır bir lezzet seçin (otomatik doldurur) --</option>
                  {currentCategoryCatalog.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.defaultCalories || 300} kcal)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. ÜRÜN ADI (SERBEST METİN GİRİŞİ) */}
            <div className="space-y-1">
              <Label htmlFor="i-name" className="font-bold text-gray-900">Ürün / Yemek Adı</Label>
              <Input
                id="i-name"
                placeholder="Örn: Şefin Özel Soslu Bonfilesi veya Zırh Adana"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                className="text-sm font-semibold"
              />
              <p className="text-[11px] text-gray-400">Menünüzde görünecek ürün adıdır.</p>
            </div>

            {/* 3. FİYAT */}
            <div className="space-y-1">
              <Label htmlFor="i-price" className="font-bold text-gray-900 flex items-center justify-between">
                <span>Satış Fiyatı</span>
                <span className="text-[11px] text-gray-400 font-normal">(İsteğe Bağlı)</span>
              </Label>
              <Input
                id="i-price"
                placeholder="240 ₺ (Boş bırakılabilir)"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="font-bold text-primary text-sm"
              />
            </div>

            {/* 4. AI KALORİ HESAPLAMA */}
            <div className="space-y-2 p-3 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50/80 to-amber-50/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="i-cal" className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Kalori (kcal)
                  <span className="text-[10px] text-red-500 font-bold">*</span>
                </Label>
                {!isEstimatingCalories && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!itemName || itemName.trim().length < 2 || isEstimatingCalories}
                    onClick={handleEstimateCalories}
                    className="h-7 text-[11px] font-bold border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800 gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI ile Hesapla
                  </Button>
                )}
              </div>

              <div className="relative">
                <Input
                  id="i-cal"
                  type="number"
                  placeholder={isEstimatingCalories ? 'Hesaplanıyor...' : 'Kalori değeri'}
                  value={itemCalories}
                  onChange={(e) => {
                    setItemCalories(e.target.value)
                    setCalorieSource('manual')
                    setCalorieNote('')
                  }}
                  className={`font-bold text-sm pr-10 ${
                    isEstimatingCalories ? 'opacity-60' : ''
                  } ${!itemCalories ? 'border-red-300 bg-red-50/30' : 'border-orange-200'}`}
                  disabled={isEstimatingCalories}
                />
                {isEstimatingCalories && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  </div>
                )}
              </div>

              {/* AI Tahmini Bilgi Notu */}
              {calorieSource === 'auto' && itemCalories && (
                <div className="flex items-start gap-1.5 text-[11px] text-orange-700/90">
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-orange-500" />
                  <div>
                    <span className="font-semibold">AI Tahmini</span> — Ortalama gerçeğe en yakın kalori hesabıdır. 
                    <button
                      type="button"
                      onClick={() => setShowDetailedCalorie(true)}
                      className="underline font-bold hover:text-orange-900 ml-0.5"
                    >
                      Daha net hesaplama için detaylı hesaplama yaptırabilirsiniz.
                    </button>
                  </div>
                </div>
              )}

              {calorieSource === 'detailed' && itemCalories && (
                <div className="flex items-start gap-1.5 text-[11px] text-emerald-700/90">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                  <div>
                    <span className="font-semibold">Detaylı Hesaplama</span>
                    {calorieNote && <span> — {calorieNote}</span>}
                  </div>
                </div>
              )}

              {!itemCalories && !isEstimatingCalories && (
                <p className="text-[11px] text-red-500/80 font-medium">
                  Kalori bilgisi zorunludur. "AI ile Hesapla" butonunu kullanabilir veya elle girebilirsiniz.
                </p>
              )}

              {calorieError && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-600">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{calorieError}</span>
                </div>
              )}

              {/* Detaylı Hesaplama Butonu (AI tahmini yokken) */}
              {calorieSource !== 'auto' && !showDetailedCalorie && (
                <button
                  type="button"
                  onClick={() => setShowDetailedCalorie(true)}
                  className="text-[11px] text-orange-600 hover:text-orange-800 font-semibold underline underline-offset-2"
                >
                  📝 Malzeme ve gramaj girerek detaylı hesaplama yap
                </button>
              )}

              {/* Detaylı Hesaplama Paneli */}
              {showDetailedCalorie && (
                <div className="space-y-2 pt-2 border-t border-orange-200/70">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                      📝 Detaylı Kalori Hesaplama
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDetailedCalorie(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Malzemeleri ve gramajlarını yazın, AI hassas kalori hesaplasın.
                  </p>
                  <Textarea
                    placeholder="Örn: 150g dana kıyma, 60g cheddar peyniri, 1 adet hamburger ekmeği (80g), 100g patates kızartması, 30g marul-domates"
                    value={ingredientText}
                    onChange={(e) => setIngredientText(e.target.value)}
                    rows={3}
                    className="text-xs bg-white border-orange-200 focus-visible:ring-orange-300"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!ingredientText.trim() || !itemName || isDetailedEstimating}
                    onClick={handleDetailedEstimate}
                    className="w-full h-8 text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm"
                  >
                    {isDetailedEstimating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Hesaplanıyor...
                      </>
                    ) : (
                      <>
                        🧮 Detaylı Hesapla
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>


            {/* 4. AÇIKLAMA */}
            <div className="space-y-1">
              <Label htmlFor="i-desc">Açıklama & İçindekiler</Label>
              <Textarea
                id="i-desc"
                placeholder="Porsiyon detayı, soslar, yan garnitürler..."
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            {/* 5. DOĞRUDAN DOSYA / FOTOĞRAF YÜKLEME */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-gray-900">Ürün Fotoğrafı</Label>
                {itemImage && (
                  <button 
                    type="button" 
                    onClick={() => setItemImage('')} 
                    className="text-[11px] text-red-600 hover:underline flex items-center"
                  >
                    <X className="h-3 w-3 mr-0.5" /> Fotoğrafı Kaldır
                  </button>
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                className="hidden" 
              />

              <div className="flex items-center gap-3">
                {itemImage ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border shadow-xs shrink-0 group">
                    <img src={catalogThumbUrl(itemImage)} alt="Seçilen Ürün" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setItemImage('')} 
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                      title="Fotoğrafı Kaldır"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 shrink-0">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}

                <div className="flex-1 space-y-1.5">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    disabled={isCompressingPhoto}
                    className="w-full text-xs font-semibold"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isCompressingPhoto ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-primary" />
                        Görsel Sıkıştırılıyor...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5 mr-1.5 text-primary" />
                        {itemImage ? 'Fotoğrafı Değiştir' : 'Cihazdan Fotoğraf Yükle'}
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-gray-400">
                    {itemImage ? 'Seçilen görsel menüde kullanılacak.' : 'Fotoğraf yüklemezseniz varsayılan sade ikon gösterilir.'}
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs font-semibold"
                      onClick={() => setCatalogPickerOpen(v => !v)}
                      title="Hazır katalog görseli seç (ücretsiz)"
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      Katalogdan seç
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isGeneratingImage || !itemName.trim() || !subdomain}
                      className="flex-1 text-xs font-semibold"
                      onClick={handleGenerateImage}
                      title="Yapay zeka ile ürün görseli üret (günlük ücretsiz kota)"
                    >
                      {isGeneratingImage ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-violet-500" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
                      )}
                      AI ile görsel üret
                    </Button>
                  </div>
                  {itemCatalogId && (
                    <p className="text-[11px] text-emerald-600">
                      Katalog ürününe bağlı ·{' '}
                      <button type="button" onClick={() => setItemCatalogId(null)} className="underline hover:text-emerald-800">
                        bağlantıyı kaldır
                      </button>
                    </p>
                  )}
                </div>
              </div>
              <CatalogPickerPopover
                inline
                open={catalogPickerOpen}
                onClose={() => setCatalogPickerOpen(false)}
                initialQuery={itemName}
                onSelect={(m) => {
                  if (m.image_url) setItemImage(m.image_url)
                  setItemCatalogId(m.item_id)
                  if (!itemName.trim()) setItemName(m.name)
                  setCompressedPhotoInfo(null)
                  setCatalogPickerOpen(false)
                }}
              />
            </div>

            {/* 6. ALERJENLER */}
            <div className="space-y-1">
              <Label htmlFor="i-allergens" className="text-xs">Alerjenler (İsteğe Bağlı)</Label>
              <Input
                id="i-allergens"
                placeholder="Gluten, Süt Ürünleri, Fıstık"
                value={itemAllergens}
                onChange={(e) => setItemAllergens(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* 7. ŞEFİN TAVSİYESİ */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="i-featured"
                checked={itemIsFeatured}
                onChange={(e) => setItemIsFeatured(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <Label htmlFor="i-featured" className="text-xs cursor-pointer font-semibold flex items-center">
                <Star className="h-3.5 w-3.5 text-amber-500 mr-1 fill-amber-500" /> Şefin Tavsiyesi / Öne Çıkarılan Ürün Olarak İşaretle
              </Label>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <Button variant="outline" type="button" onClick={() => setIsAddItemModalOpen(false)}>
                Vazgeç
              </Button>
              <Button 
                type="submit" 
                disabled={!itemCalories || isEstimatingCalories || isDetailedEstimating}
                className={!itemCalories ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {editingItem ? 'Güncellemeyi Kaydet' : 'Ürünü Menüye Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

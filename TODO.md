# QR Menü Projesi: Yapılacaklar Listesi

Bu liste kod review'u, API testleri ve Playwright ile yapılan gerçek panel testlerinin sonuçlarından üretildi.
Son güncelleme: 6 Ekim 2026. Son commit: `e338711`.

**Öncelik:** `P0` canlıya çıkmayı engeller, `P1` kısa vadede yapılmalı, `P2` iyileştirme, `P3` isteğe bağlı.
**Durum:** `Bitti`, `Açık`, `Karar gerekli`.

## 0. Özet ve sıra

| # | Madde | Durum | Öncelik | Kim yapacak |
|---|---|---|---|---|
| 1 | Sunucu tarafı kimlik doğrulama ve sahiplik kontrolü | Bitti | P0 | Tamamlandı, test edildi |
| 1b | Panel akışı hataları (CSP, QR masa, kopya menü, yarış durumu) | Bitti | P0 | Tamamlandı, test edildi |
| 2 | Veritabanı güvenliği (RLS) ve şema uyumu | Açık | P0 | Agent SQL hazırlar, sen Supabase'de çalıştırırsın |
| 3 | Herkese açık menü sayfası ve mock veri temizliği | Açık | P0 | Agent |
| 4 | Admin paneli ve hesap aktivasyonu (localStorage'dan Supabase'e) | Açık | P0 | Agent (büyük iş, önce karar gerekli) |
| 5 | OTP ve giriş güvenliği | Açık | P1 | Agent, e-posta servisi seçimi sende |
| 6 | Dayanıklılık, doğrulama, CSP ve rate limit | Açık | P1 | Agent |
| 7 | Temizlik, yapılandırma ve test altyapısı | Açık | P2 | Agent |
| 8 | Eksik ürün özellikleri (sektör bakışı) | Açık | P2-P3 | Önceliklendirme sende |

---

## 1. Tamamlananlar (referans)

| Konu | Yapılan | Dosyalar | Doğrulama |
|---|---|---|---|
| Sahte oturum | Çerez, base64 ve `admin_secret_token` ile giriş kaldırıldı. Kimlik yalnızca Supabase JWT ile doğrulanıyor. | [lib/auth-middleware.ts](lib/auth-middleware.ts) | Sahte token, çerez ve statik token 401 döndü |
| Sahiplik (IDOR) | Menü, masa ve organizasyon yazan route'lara üyelik kontrolü eklendi. Otomatik organizasyon oluşturma kaldırıldı. | `app/api/menus/sync`, `menus/delete`, `tables/sync`, `organizations/update` | Başka organizasyona yazma, silme ve menü kimliği değiştirme 403 döndü |
| Yapay zekâ uçları | `scan-menu` ve `estimate-calories` için oturum şartı | `app/api/scan-menu`, `app/api/estimate-calories` | Oturumsuz 401 |
| İstemci token | `authFetch` yardımcısı eklendi | [lib/api-client.ts](lib/api-client.ts) | Panel akışı çalıştı |
| CSP ve Supabase | `connect-src` ve `img-src` içine `*.supabase.co` eklendi. Tarayıcı girişi bundan önce tamamen engelliydi. | [middleware.ts](middleware.ts) | Playwright ile giriş yapıldı |
| QR masa kaydı | Canlı tabloda olmayan `updated_at` sütunu kaldırıldı. Hatalar artık istemciye bildiriliyor. | [app/api/tables/sync/route.ts](app/api/tables/sync/route.ts) | Masa DB'ye yazıldı, yenilemede göründü |
| Kopya menü | `menus/sync` gerçek kimlikleri (`idMap`) döndürüyor, editör bunları uyguluyor | `app/api/menus/sync/route.ts`, [components/dashboard/LiveMenuEditor.tsx](components/dashboard/LiveMenuEditor.tsx) | İki "Kaydet" sonrası tam 1 menü |
| Yarış durumu | Geç gelen boş yükleme yanıtı yeni oluşturulan menüyü ezmiyor | `LiveMenuEditor.tsx` | Test geçti |

---

## 2. Veritabanı güvenliği (RLS) ve şema uyumu (P0)

SQL'i agent hazırlar, **Supabase SQL Editor'de senin çalıştırman gerekir**. Her değişiklikten sonra `/tmp/pw` içindeki testleri tekrar çalıştırırız.

| # | Dosya / tablo | Sorun | Yapılacak | Öncelik |
|---|---|---|---|---|
| 2.1 | [supabase-mvp.sql](supabase-mvp.sql) `organizations`, politika `org_public_select using (true)` | Anon anahtarıyla (tarayıcıda zaten görünür) tüm restoranların tüm sütunları okunabiliyor: `wifi_password`, `business_phone`, adres | Politikayı kaldır. Herkese açık okumayı yalnızca sunucu API'sine (madde 3) veya yalnızca güvenli sütunları içeren bir view'a ver | P0 |
| 2.2 | `qr_tables` | RLS açık değil. Anon anahtarıyla herkes masaları okuyup değiştirebilir ve silebilir | `enable row level security`, üyelere select, insert, update, delete politikaları. Herkese açık okuma gerekiyorsa yalnızca `id, name` | P0 |
| 2.3 | `menu_views` politika `views_insert with check (true)` | Herkes sınırsız kayıt ekleyebilir, istatistik şişirilir | Insert'i yalnızca `is_listed = true` menüler için sınırla veya sayımı rate limit'li bir API'ye taşı | P1 |
| 2.4 | `handle_new_user` tetikleyicisi | Aynı işletme adıyla kayıtta `subdomain` çakışır ve kayıt akışı hata verir. Boş ad durumunda tahmin edilebilir değer üretir | Alt çizgi/tire normalizasyonu, çakışmada benzersiz sonek ekle, `exception` yönetimi | P1 |
| 2.5 | [SQL.sql](SQL.sql) politika `Users can create organizations with check (true)` | Herkes organizasyon oluşturabilir | Gerekmiyorsa kaldır, gerekiyorsa `auth.uid()` şartı ekle | P1 |
| 2.6 | `SQL.sql` ile `supabase-mvp.sql` | İki dosya birbirinden farklı. Canlı veritabanı ikisinden de farklı (`qr_tables.updated_at` yok) | Canlı şemayı dışa aktar, tek kaynağa indir. `supabase/migrations/` klasörü oluştur, her değişikliği numaralı migration olarak tut | P1 |
| 2.7 | `organization_members.role` | Serbest metin. Uygulama `owner`, `admin`, `staff` ayrımı yapmıyor | `check (role in ('owner','admin','staff'))` ekle ve rol bazlı yetkiyi sunucuda uygula (madde 8 ekip rolleri) | P2 |
| 2.8 | Storage `menu-images` bucket | SQL dosyasında sadece yorum var, politika yok | Bucket politikaları: yalnızca üye kendi organizasyon klasörüne yükler, herkes okur. MIME ve 5 MB sınırı | P1 |
| 2.9 | Tüm tablolar | `items` ve `categories` için `is_active`/`is_available` herkese açık okumada filtrelenmiyor | Herkese açık select politikalarına `is_active`/`is_available` şartı ekle | P2 |

---

## 3. Herkese açık menü sayfası ve mock veri temizliği (P0)

Müşterinin gördüğü sayfa. Playwright testi gerçek restoran için **demo restoranın adını ve adresini** gösterdiğini doğruladı.

| # | Dosya / konum | Sorun | Yapılacak | Öncelik |
|---|---|---|---|---|
| 3.1 | [components/public/PublicMenuView.tsx](components/public/PublicMenuView.tsx) satır 149 | Restoran bulunamayınca `MOCK_RESTAURANTS[0]` kullanılıyor. Gerçek restoranlarda başlık ve alt bilgi demo restoranın adı ve adresi (`Tarihi Lezzet Ocakbaşı`, `İstiklal Caddesi No: 42`) | Restoran bilgisini veritabanından çek. Bulunamazsa 404 sayfası göster | P0 |
| 3.2 | Yeni: `app/api/public/restaurant/route.ts` | Herkese açık restoran bilgisi için uç yok | `subdomain` ile yalnızca güvenli alanları döndür: ad, logo, kapak, renk, para birimi, adres, şehir, telefon. WiFi bilgisi yalnızca işletme açıkça paylaşıyorsa | P0 |
| 3.3 | `PublicMenuView.tsx` satır 219-222 | API hatasında veya menü yokken başka restoranın mock menüsü gösteriliyor | Mock yedeğini kaldır. Boş menü için "Menü yakında" ekranı, hata için yeniden dene ekranı | P0 |
| 3.4 | [app/api/menus/load/route.ts](app/api/menus/load/route.ts) | `is_listed = false` menüler ve `select('*')` ile tüm sütunlar dönüyor. Yönetim paneli de bu uçtan okuyor | Herkese açık için ayrı uç (`is_listed`, `is_active`, `is_available` filtreli, sütun listeli). Panel için oturumlu uç | P0 |
| 3.5 | [app/api/tables/load/route.ts](app/api/tables/load/route.ts) | Kimlik şartı yok, `views` dahil dönüyor | Panel için oturumlu yap | P1 |
| 3.6 | [components/dashboard/Header.tsx](components/dashboard/Header.tsx), [Sidebar.tsx](components/dashboard/Sidebar.tsx) | Başlıkta `yonetici@restoran.com` ve "Restoranım" sabit değer | Oturumdaki gerçek e-posta ve restoran adını göster | P1 |
| 3.7 | [components/dashboard/EditMenuContent.tsx](components/dashboard/EditMenuContent.tsx) | Tamamen `mockMenusByRestaurant` kullanıyor, Supabase'e bağlı değil | Gerçek veriye bağla veya `LiveMenuEditor` ile birleştirip kaldır | P1 |
| 3.8 | `MenusContent`, `QRCodesContent`, `SettingsContent` | `MOCK_RESTAURANTS` içe aktarıyor. `SettingsContent` içinde `lezzet-ocakbasi` özel durumu var | Mock bağımlılığını kaldır, demo hesap gerekiyorsa ayrı bir demo moduna al | P1 |
| 3.9 | [lib/mock-data.ts](lib/mock-data.ts) | Üretim kodunda kullanılıyor | Tüm kullanım temizlenince dosyayı sil (demo için gerekiyorsa `lib/demo/` altına taşı) | P2 |
| 3.10 | `PublicMenuView.tsx` | Değerlendirme (yıldız) ve Google yorum alanı yalnızca istemcide, kaydedilmiyor | Geri bildirimi bir tabloya yaz (spam korumalı) veya özelliği sadeleştir | P3 |

---

## 4. Admin paneli ve hesap aktivasyonu (P0, büyük iş)

> **Durum (2026-10-12):** K1 = tam panel. 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8 yapıldı (`feat/admin-panel`).
> Admin paneli gerçek veriye bağlı (`/api/admin/*`, migration 11). Aktivasyon linki yerine şifreyi admin belirler,
> isteğe bağlı olarak ilk girişte değiştirme zorunlu. Kalan: 4.3 (çerez temizliği), 4.9 (şifremi unuttum).
> **Supabase ayarı (yapılmalı):** Authentication → Sign In / Providers → "Allow new users to sign up" kapatılmalı.
> Uygulama tüm hesapları `admin.createUser` ile açar (bu ayardan etkilenmez); açık kalırsa anon key ile doğrudan
> `/auth/v1/signup` çağrısı panelden kapatılan kaydı (`signup_enabled=false`) atlayabilir.

Şu an admin yetkisi ve tüm kullanıcı/restoran yönetimi tarayıcıda `localStorage` üzerinde. **Önce karar gerekli** (aşağıdaki "Kararlar" bölümü).

| # | Dosya / konum | Sorun | Yapılacak | Öncelik |
|---|---|---|---|---|
| 4.1 | [components/auth/RouteGuards.tsx](components/auth/RouteGuards.tsx) `AdminGuard` | Yetki `localStorage.user_role`, `is_admin` ile belirleniyor. Konsoldan `localStorage.setItem('user_role','superadmin')` yazan admin paneline girer | Yetkiyi sunucudan al: yeni `GET /api/auth/me` (JWT'den rol ve organizasyon döndürür). Guard bu yanıta bakar | P0 |
| 4.2 | [components/auth/Login.tsx](components/auth/Login.tsx) satır 18, 60-65 | Süper admin e-postası istemci kodunda sabit, rol istemcide belirleniyor | Kaldır, rolü `/api/auth/me` yanıtından kullan. `SUPER_ADMIN_EMAIL` yalnızca sunucuda | P0 |
| 4.3 | [lib/session.ts](lib/session.ts), [components/ClientApp.tsx](components/ClientApp.tsx) | `user_role`, `restaurant_id`, `user_id` çerezlerini istemci yazıyor. Sunucu artık güvenmiyor, çerezler anlamsız | Çerez yazmayı kaldır, oturumu yalnızca Supabase oturumundan türet | P1 |
| 4.4 | [components/admin/AdminDashboard.tsx](components/admin/AdminDashboard.tsx) | Restoranlar ve kullanıcılar `localStorage` (`all_restaurants`, `system_users`). Gerçek veriyle ilgisi yok | Sunucu uçları: `GET/POST /api/admin/organizations`, `PATCH .../status`, `POST .../users` (hepsi `requireSuperAdmin`). Liste, oluşturma, aktif/pasif, silme | P0 |
| 4.5 | `AdminDashboard.tsx` satır 246-248 | "Restoran olarak görüntüle" (impersonation) yalnızca `localStorage` yazıyor | Sunucuda süper admin yetkisiyle gerçek organizasyona erişim zaten var. İstemcide yalnızca seçili organizasyonu tut | P1 |
| 4.6 | [components/auth/AccountActivation.tsx](components/auth/AccountActivation.tsx) | Şifre düz metin olarak `localStorage`'a yazılıyor ve gerçek hesaba bağlanmıyor. Token yoksa ilk bekleyen restoranı otomatik aktive eden "demo" kodu var | Supabase davet akışı (`inviteUserByEmail`) veya "şifre belirleme" bağlantısı kullan. Demo kodunu sil. Düz metin şifre saklamayı tamamen kaldır | P0 |
| 4.7 | [lib/types.ts](lib/types.ts) `Restaurant.credentials`, `activationToken` | Tipler şifreyi modelin parçası olarak tanımlıyor | Alanları kaldır, tipleri veritabanı şemasıyla hizala | P1 |
| 4.8 | `lib/auth-middleware.ts` | `requireAdmin` yardımcısı yok (eski sürüm vardı, kaldırıldı) | `requireSuperAdmin(req)` ekle ve admin uçlarında kullan | P0 |
| 4.9 | [components/auth/ForgotPasswordModal.tsx](components/auth/ForgotPasswordModal.tsx) | Kullanımı doğrulanmadı | Supabase `resetPasswordForEmail` akışına bağla | P1 |

---

## 5. OTP ve giriş güvenliği (P1)

| # | Dosya | Sorun | Yapılacak | Öncelik |
|---|---|---|---|---|
| 5.1 | [app/api/auth/send-otp/route.ts](app/api/auth/send-otp/route.ts) | Kod `Math.random()` ile üretiliyor | `crypto.randomInt(100000, 1000000)` | P1 |
| 5.2 | `send-otp/route.ts` | Kod bellekte (`global.__otpStore`) tutuluyor. Serverless ortamda istekler arası kaybolur | Veritabanı tablosu (`otp_codes`: e-posta, kod özeti, son kullanma, deneme) veya Supabase yerel OTP (`signInWithOtp`) | P1 |
| 5.3 | `send-otp/route.ts` | Üretimde e-posta gönderen kod yorum satırı. Kod kullanıcıya hiç gitmiyor | E-posta servisi entegre et (Resend, SendGrid, SES) | P1 |
| 5.4 | `send-otp/route.ts` | Geliştirme modunda kod yanıtta dönüyor (`devOnly`). `NODE_ENV` yanlış ayarlanırsa sızar | Yanıttan kaldır, yalnızca sunucu logunda göster | P1 |
| 5.5 | [app/api/auth/verify-otp/route.ts](app/api/auth/verify-otp/route.ts) | Başarılı doğrulama bir oturum veya tek kullanımlık token üretmiyor, yalnızca `verified: true` dönüyor | Doğrulamayı gerçek bir işleme bağla (örn. şifre sıfırlama) | P1 |
| 5.6 | `send-otp`, `verify-otp` | Yalnızca e-posta bazlı limit var, IP limiti yok | IP ve e-posta için ayrı limit | P1 |
| 5.7 | [app/api/auth/login/route.ts](app/api/auth/login/route.ts) | `RATE_LIMITS.AUTH_LOGIN` tanımlı ama kullanılmıyor, şifre denemesine limit yok. Supabase'in ham hata mesajını döndürüyor | `AUTH_LOGIN` limitini uygula (IP + e-posta), genel hata mesajı döndür, `AUTH_LOGIN_SUCCESS/FAILURE` olaylarını logla | P1 |
| 5.8 | [lib/supabase.ts](lib/supabase.ts), `login/route.ts` | Supabase URL ve anahtar kod içine gömülü | `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ortam değişkenlerinden oku | P1 |

---

## 6. Dayanıklılık, doğrulama, CSP ve rate limit (P1)

| # | Dosya / konum | Sorun | Yapılacak | Öncelik |
|---|---|---|---|---|
| 6.1 | [components/dashboard/LiveMenuEditor.tsx](components/dashboard/LiveMenuEditor.tsx) şablon ve boş menü akışları | Sunucu hatası kullanıcıya gösterilmiyor, yalnızca başarıda "kaydedildi" görünüyor | `res.ok` değilse hata bildirimi (toast) göster, yerel taslağı koru | P1 |
| 6.2 | [components/dashboard/MenusContent.tsx](components/dashboard/MenusContent.tsx), [QRCodesContent.tsx](components/dashboard/QRCodesContent.tsx) | `syncWithSupabase` hatayı yalnızca konsola yazıyor, yanıt durumuna bakmıyor | Hata göster, başarısızsa yerel durumu geri al | P1 |
| 6.3 | Tüm sync akışları | 401 gelirse (oturum süresi dolması) kullanıcı bilgilendirilmiyor | `authFetch` içinde 401'de oturumu yenile veya giriş sayfasına yönlendir | P1 |
| 6.4 | [app/api/menus/sync/route.ts](app/api/menus/sync/route.ts) | Kategoriler silinip yeniden ekleniyor, işlem transaction içinde değil. Araya hata girerse menü boş kalır. Kategori ve ürün ekleme hataları yutuluyor | Postgres fonksiyonu (RPC) ile tek transaction, hata durumunda geri al ve 500 dön | P1 |
| 6.5 | `menus/sync`, `tables/sync`, `organizations/update` | Girdi doğrulanmıyor (tip, uzunluk, sayı). [lib/sanitizer.ts](lib/sanitizer.ts) yalnızca AI çıktısında kullanılıyor | Şema doğrulama (zod). Ad, açıklama, fiyat, URL alanlarında sanitizer. Menü, kategori ve ürün sayısı üst sınırı | P1 |
| 6.6 | `tables/sync` | Boş dizi gönderilirse tüm masalar siliniyor | Silme için açık bir bayrak veya ayrı silme ucu | P1 |
| 6.7 | `menus/sync` | Menüde `available_days`, `layout` gibi alanlar doğrulanmıyor. İstemcideki bazı alanlar (protein, karbonhidrat, yağ) veritabanına yazılmıyor olabilir | İstemci tipleri ile tablo sütunlarını karşılaştır, eksikleri migration ile ekle | P2 |
| 6.8 | [lib/file-validator.ts](lib/file-validator.ts) | Yalnızca ilk 64 base64 karakter kontrol ediliyor. Gemini'ye giden `mimeType` doğrulanan türden değil istemciden alınıyor | Tespit edilen MIME'ı kullan. Toplam istek boyutunu sınırla (`req.json()` her şeyi belleğe alıyor) | P1 |
| 6.9 | [components/modals/ScanMenuModal.tsx](components/modals/ScanMenuModal.tsx) satır 98, 252 | Günlük tarama kotası `localStorage`'da. Silinerek aşılır | Kotayı sunucuda tut (`scan_usage` tablosu: kullanıcı, tarih, sayı) ve `scan-menu` içinde uygula | P1 |
| 6.10 | [app/api/scan-menu/route.ts](app/api/scan-menu/route.ts) | Hata mesajı doğrudan istemciye dönüyor, modelleri sırayla deniyor (en fazla 5 istek). API anahtarı URL'de | Genel hata mesajı, anahtarı `x-goog-api-key` başlığında gönder, model denemesini sınırla | P2 |
| 6.11 | [app/api/estimate-calories/route.ts](app/api/estimate-calories/route.ts) | Kullanıcı girdisi doğrudan prompt'a gömülüyor | Girdiyi sınırla ve çıktıyı sayısal aralıkta doğrula | P2 |
| 6.12 | [middleware.ts](middleware.ts) CSP | `script-src` içinde `'unsafe-inline' 'unsafe-eval' https:` XSS korumasını büyük ölçüde etkisizleştiriyor | Nonce tabanlı CSP, `unsafe-eval` ve geniş `https:` kaldır. Önce raporlama modunda (`Content-Security-Policy-Report-Only`) dene | P1 |
| 6.13 | `middleware.ts` CORS | `origin.endsWith('.qolay.com')` yeterince katı değil | `new URL(origin).hostname` ile tam eşleşme veya `endsWith('.qolay.com')` ve nokta kontrolü | P2 |
| 6.14 | `middleware.ts` `img-src` | Yalnızca Unsplash, Google ve Supabase görselleri izinli. Kullanıcı başka bir adresten görsel girerse engellenir | Görselleri yalnızca Supabase Storage'a yükletmek (madde 8) | P2 |
| 6.15 | [lib/rate-limiter.ts](lib/rate-limiter.ts) | Bellek içi ve instance başına. Serverless'ta etkisi zayıf. `getClientIp` sahte `x-forwarded-for` başlığına güveniyor | Dağıtık depo (Upstash Redis veya Supabase). Yalnızca güvenilir proxy başlığını kullan | P1 |
| 6.16 | [lib/csrf.ts](lib/csrf.ts) | Hiçbir yerde çağrılmıyor. Ayrıca `Bearer` başlığı varsa kontrolü atlıyor | İstekler Bearer token ile gittiği için CSRF riski düşük. Ya kaldır ya da çerez tabanlı akış eklenirse uygula | P3 |
| 6.17 | Tüm API'ler | Yapılandırılmış hata izleme yok | Sentry veya benzeri entegre et, `console.error` yerine yapılandırılmış log | P2 |

---

## 7. Temizlik, yapılandırma ve test altyapısı (P2)

| # | Dosya / konum | Sorun | Yapılacak | Öncelik |
|---|---|---|---|---|
| 7.1 | [Dockerfile](Dockerfile) | `node:18-alpine` (Next.js 16 için Node 20+ gerekir, Node 18 desteği bitti). `deps` aşaması hiç kullanılmıyor. Ortam değişkenleri tanımlı değil | `node:22-alpine`, kullanılmayan aşamayı kaldır, çalışma zamanı değişkenlerini belgele | P1 |
| 7.2 | [package.json](package.json) | Paket adı `my-app`. `shadcn`, `chart.js`+`react-chartjs-2`, `recharts`, `react-apexcharts`, `tesseract.js` ve diğerlerinin kullanımı doğrulanmadı | Kullanılmayan bağımlılıkları tespit et (`depcheck`) ve kaldır, adı `qolay-menu` yap | P2 |
| 7.3 | `test-crash.mjs` | Repoda duruyor, `puppeteer` kullanıyor ama bağımlılıkta yok | Sil | P2 |
| 7.4 | `.env.local` | `SUPER_ADMIN_PASSWORD` ve `NORMAL_USER_PASSWORD` test için eklendi, uygulama kullanmıyor | Testler bitince sil | P1 |
| 7.5 | Yeni: `.env.example` | Hangi değişkenlerin gerektiği yalnızca konuşmada | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `SUPER_ADMIN_EMAIL` içeren örnek dosya ekle | P2 |
| 7.6 | [middleware.ts](middleware.ts) | Next.js 16'da `middleware` dosya adı kullanımdan kalkıyor, `proxy` isteniyor | `npx @next/codemod@canary middleware-to-proxy .` | P2 |
| 7.7 | [next.config.ts](next.config.ts) | `turbopack.root` ayarlanmamış, `/Users/gokdeniz` içindeki başıboş `package-lock.json` uyarısı çıkıyor | `turbopack.root` ayarla veya başıboş dosyayı sil | P3 |
| 7.8 | `package.json` `lint` betiği | `next lint` Next.js 16'da kaldırılmış olabilir | ESLint CLI'a geçir (`eslint .`) | P2 |
| 7.9 | Marka tutarlılığı | "QR Chef" (arayüz), "qolay" (CORS ve alan adı), "my-app" (paket) karışık | Tek marka adı belirle ve her yerde uygula | P3 |
| 7.10 | [components/dashboard/LiveMenuEditor.tsx](components/dashboard/LiveMenuEditor.tsx) (2068 satır) | Tek dosyada her şey: durum, kaydetme, modallar, önizleme | Bölümlere ayır: `MenuEditorHeader`, `CategoryList`, `ItemModal`, `LivePreview`, `useMenuSync` kancası | P2 |
| 7.11 | [lib/menu-templates.ts](lib/menu-templates.ts) (1214 satır) | Büyük statik veri, paket boyutunu artırıyor | Dinamik içe aktar (`import()`) veya JSON'a taşı | P3 |
| 7.12 | `git stash list` | "local package-lock before pull" adlı eski bir stash duruyor | `git stash drop` | P3 |
| 7.13 | Test altyapısı | Playwright betikleri geçici `/tmp/pw` klasöründe, kayboluyor. Projede otomatik test yok | `e2e/` klasörü ve `@playwright/test` ekle. Giriş, menü, ürün, ayarlar, QR, silme, sahiplik (403) testlerini taşı. Test kullanıcıları için ayrı Supabase projesi | P1 |
| 7.14 | CI | Yok | GitHub Actions: `tsc --noEmit`, lint, e2e. Dependabot PR'ları için otomatik kontrol | P2 |
| 7.15 | [README.md](README.md), [PLAN.md](PLAN.md) | Güncel mimariyle uyumu doğrulanmadı | Kurulum, ortam değişkenleri, test ve dağıtım bölümlerini güncelle | P3 |

---

## 8. Eksik ürün özellikleri (restoran, kafe ve bar sektörü)

### 8.1 Müşteri tarafı

| Özellik | Neden gerekli | Not | Öncelik |
|---|---|---|---|
| Dil seçimi (TR, EN, AR, RU) | Turizm bölgelerinde şart | Arayüzde dil düğmesi var ama içerik çevirisi yok. SQL'de çeviri tablosu mevcut, uygulamaya bağlı değil | P1 |
| Alerjen ve diyet filtreleri | Güvenlik ve talep | Veri var (`allergens`, `tags`). Arama var, filtre arayüzü kısıtlı | P2 |
| Ürün varyantları ve ekstralar | Boy, ekstra malzeme, fiyat farkı | Veri modelinde yok | P2 |
| SEO | Google'da bulunma | `generateMetadata`, `sitemap.xml`, `robots.txt`, paylaşım görseli yok | P2 |
| PWA / manifest | Ana ekrana ekleme | Yok | P3 |
| Garson çağır ve masa bazlı sipariş notu | Hizmet kalitesi | Masa QR'ı var, akış yok | P3 |
| "Şu an açık" ve çalışma saatleri | Temel bilgi | Ayarlarda "Çalışma Saatleri Notu" serbest metin, yapısal veri yok | P2 |
| Sosyal medya ve harita bağlantıları | Erişim | Ayarlar sayfasında alan var, veritabanı sütunu yok (kodda not düşülmüş) | P2 |

### 8.2 İşletme paneli

| Özellik | Neden gerekli | Not | Öncelik |
|---|---|---|---|
| Ürün fotoğrafı yükleme (Supabase Storage) | Şu an URL yazılıyor veya hazır görsel | Bucket ve politikalar (madde 2.8) | P1 |
| Zamanlı menü ve fiyat | Kahvaltı, akşam, happy hour | Menüde `available_days` alanı var, saat aralığı yok | P2 |
| "Tükendi" hızlı anahtarı | Günlük operasyon | `is_available` var, panelde hızlı erişim yok | P2 |
| Ekip rolleri (sahip, yönetici, personel) | Birden çok çalışan | `organization_members` var, arayüz ve yetki ayrımı yok | P2 |
| Çok şubeli işletme | Zincirler | Veri modeli tek organizasyon, tek menü akışı | P3 |
| Gerçek analitik | QR okuma, ürün görüntüleme, saat dağılımı | `menu_views` tablosu var ama sayım yazılmıyor, `qr_tables.views` yalnızca sayaç | P2 |
| Menü sürümü ve geri alma | Hata durumunda kurtarma | Yok | P3 |
| Ürün sıralama (sürükle bırak) | Kullanım kolaylığı | Yukarı/aşağı düğmeleri var | P3 |

### 8.3 Platform ve iş modeli

| Özellik | Neden gerekli | Not | Öncelik |
|---|---|---|---|
| Abonelik ve ödeme | Gelir modeli | SQL'de menü limiti politikası var, ödeme yok | P2 |
| E-posta altyapısı | OTP, aktivasyon, şifre sıfırlama | Madde 5 ile ortak | P1 |
| Hata izleme | Üretimde sorun görünürlüğü | Madde 6.17 | P2 |
| Yedekleme | Veri güvenliği | Supabase otomatik yedek planını doğrula | P2 |
| KVKK / GDPR veri silme ve dışa aktarma | Yasal | Hesap silme akışı yok. Hukuki modallar var | P1 |

---

## 9. Kararlar (senden gerekenler)

| # | Soru | Seçenekler | Etkilediği madde |
|---|---|---|---|
| K1 | Admin paneli gerçek veriye mi bağlanacak, yoksa şimdilik süper admin'in elle Supabase'de hesap açması mı yeterli? | A) Tam panel (madde 4, büyük iş). B) Şimdilik kaldır/gizle, süper admin Supabase panelinden yönetsin | 4 |
| K2 | WiFi bilgisi müşteriye gösterilsin mi? | A) Evet, işletme açıkça açarsa. B) Hayır | 2.1, 3.2 |
| K3 | E-posta servisi | Resend, SendGrid, AWS SES veya Supabase yerel e-posta | 5, 4.6 |
| K4 | OTP yerine Supabase yerel akışı kullanılsın mı? | Evet (önerilen, daha az kod) veya özel OTP | 5 |
| K5 | Dağıtım ortamı | Vercel (serverless) veya Docker/VPS. Rate limit ve OTP depolama kararı buna bağlı | 5, 6.15, 7.1 |
| K6 | Demo hesap korunacak mı? | A) Evet, ayrı demo modu. B) Hayır, mock verileri sil | 3.8, 3.9 |
| K7 | Test için ayrı Supabase projesi açılsın mı? | Evet (önerilen) veya mevcut veritabanında test kullanıcısı | 7.13 |

---

## 10. Önerilen uygulama sırası

| Sıra | Madde | Gerekçe | Ön koşul |
|---|---|---|---|
| 1 | 2. RLS ve şema | Anon anahtarıyla veri sızıntısı ve masa değiştirme açığı en acil. Sunucu kimliği tamam olduğu için ilerleyebiliriz | SQL'i senin çalıştırman |
| 2 | 3. Herkese açık sayfa | Müşteri bugün yanlış restoran bilgisi görüyor. Madde 2.1 ile birlikte yapılmalı | 2.1 |
| 3 | 5.7, 5.8, 7.4 | Küçük ve hızlı güvenlik iyileştirmeleri | Yok |
| 4 | 6.1-6.6 | Veri kaybı ve kullanıcıya hata göstermeme sorunları | Yok |
| 5 | 4. Admin ve aktivasyon | En büyük iş, karar K1 gerekli | K1 |
| 6 | 5. OTP | E-posta servisi gerekli | K3, K4 |
| 7 | 6.8-6.17 | Sıkılaştırma | K5 |
| 8 | 7. Temizlik ve test | 7.13 (repo içi e2e) en erken yapılabilir | K7 |
| 9 | 8. Özellikler | Önceliklendirme sende | Yok |

## 11. Doğrulama (her aşamadan sonra)

| Kontrol | Nasıl |
|---|---|
| Tip kontrolü | `npx tsc --noEmit` |
| Kimlik ve sahiplik | Süper admin ve normal kullanıcı ile 401/403/404 testleri (madde 7.13'te repo içine taşınacak) |
| Gerçek panel akışı | Playwright: giriş, menü, ürün, ayarlar, QR masa, silme |
| Herkese açık sayfa | `/menu/<subdomain>` doğru restoran adı, adres ve ürünleri göstermeli, demo veri görünmemeli |
| Veritabanı | Anon anahtarıyla `organizations`, `qr_tables`, `menu_views` erişimi denenmeli (RLS sonrası okunamamalı) |

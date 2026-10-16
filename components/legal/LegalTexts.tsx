import React from 'react'
import { LEGAL_COMPANY as C, LEGAL_UPDATED_AT, LEGAL_VERSION } from '@/lib/legal'

/**
 * Hukuki metinler: Kullanım Koşulları (platform hizmet sözleşmesi) ve Gizlilik Politikası / KVKK Aydınlatma Metni.
 * Kayıt formu, açılış sayfası alt bilgisi ve /kosullar, /gizlilik sayfaları aynı içeriği gösterir.
 * Köşeli parantezli alanlar lib/legal.ts içinden doldurulur. Metin hukuki danışmanlık yerine geçmez; yayına
 * almadan önce şirket avukatının gözden geçirmesi önerilir.
 */

const h = 'text-base font-bold text-gray-900 mt-6 first:mt-0'
const p = 'text-sm leading-relaxed text-gray-700'
const ul = 'list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700'

export function LegalMeta() {
  return (
    <p className="text-xs text-gray-500">
      Son güncelleme: {LEGAL_UPDATED_AT} · Sürüm {LEGAL_VERSION}
    </p>
  )
}

function CompanyBlock() {
  return (
    <ul className={ul}>
      <li>Unvan: {C.name} ({C.brand})</li>
      <li>Adres: {C.address}</li>
      <li>MERSİS: {C.mersis} · Vergi: {C.taxOffice}</li>
      <li>KEP: {C.kep}</li>
      <li>E-posta: {C.email} · Telefon: {C.phone}</li>
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Kullanım Koşulları                                                  */
/* ------------------------------------------------------------------ */

export function TermsOfServiceText() {
  return (
    <div className="space-y-3">
      <h3 className={h}>1. Taraflar ve Kapsam</h3>
      <p className={p}>
        Bu Kullanım Koşulları (&quot;Sözleşme&quot;), {C.name} (&quot;{C.brand}&quot; veya &quot;Platform&quot;) ile {C.brand}&apos;e
        kaydolan işletme (&quot;İşletme&quot; veya &quot;Siz&quot;) arasında; dijital menü, masa QR kodları, işletme sitesi ve bunlara
        bağlı özelliklerin (&quot;Hizmet&quot;) kullanımını düzenler.
      </p>
      <p className={p}>
        Hizmet yalnızca ticari veya mesleki faaliyet yürüten işletmelere (restoran, kafe, bar, pastane vb.) sunulur. Kaydolarak
        18 yaşını doldurduğunuzu, işletme adına sözleşme yapmaya yetkili olduğunuzu ve tüketici sıfatıyla değil tacir ya da esnaf
        sıfatıyla hareket ettiğinizi beyan edersiniz. Bu nedenle 6502 sayılı Tüketicinin Korunması Hakkında Kanun&apos;un tüketici
        işlemlerine ilişkin hükümleri bu Sözleşme&apos;ye uygulanmaz.
      </p>
      <p className={p}>
        Sözleşme, kayıt formundaki onay kutusunu işaretleyip başvuruyu göndermenizle elektronik ortamda kurulur. Kabul ettiğiniz
        sürüm, kabul zamanı ve IP adresi ispat amacıyla hesabınızla birlikte saklanır. 6098 sayılı Türk Borçlar Kanunu&apos;nun genel
        işlem koşullarına ilişkin hükümleri saklıdır; Sözleşme&apos;deki sorumluluk sınırlamaları ve fesih hükümleri bu amaçla açıkça
        bilginize sunulmuştur.
      </p>

      <h3 className={h}>2. Başvuru, Hesap ve Onay</h3>
      <ul className={ul}>
        <li>
          Kayıt bir <b>başvurudur</b>. Hesabınız hemen açılır ve kurulum sihirbazıyla menünüzü hazırlayabilirsiniz; ancak işletme
          siteniz ve QR menünüz, {C.brand} başvurunuzu inceleyip onaylayana kadar herkese açık yayınlanmaz.
        </li>
        <li>
          {C.brand}, başvuruyu makul bir süre içinde değerlendirir; işletmenin gerçekliğini veya yetkinizi doğrulamak için ek bilgi
          ya da belge isteyebilir ve başvuruyu gerekçe göstermeksizin reddedebilir. Reddedilen başvuruda gerekçe panelde gösterilir;
          veriler Gizlilik Politikası&apos;ndaki süreler içinde silinir.
        </li>
        <li>
          Kayıtta verdiğiniz bilgiler doğru, güncel ve eksiksiz olmalıdır. Hesap bilgilerinizi ve şifrenizi gizli tutmak ve
          hesabınız altında yapılan tüm işlemler sizin sorumluluğunuzdadır; yetkisiz kullanım şüphesinde bize derhal bildirin.
        </li>
        <li>Hesaba eklediğiniz diğer kullanıcılardan (yönetici, personel) İşletme sorumludur.</li>
      </ul>

      <h3 className={h}>3. Hizmetin Kapsamı</h3>
      <p className={p}>
        Hizmet; dijital menü oluşturma ve yayınlama, masa QR kodları ve baskı şablonları, işletme sitesi (menü, hakkımızda,
        iletişim, etkinlikler, kampanyalar, fiyat planları), hazır menü şablonları ve katalog görselleri, menü fotoğrafından yapay
        zekâ ile menü çıkarma ve kalori tahmini, yapay zekâ ile ürün görseli üretimi ve görüntülenme istatistiklerini kapsar.
      </p>
      <ul className={ul}>
        <li>
          Yapay zekâ destekli özellikler otomatik tahmine dayanır; sonuçlar hatalı veya eksik olabilir. Alerjen, içerik, kalori ve
          fiyat bilgilerini yayınlamadan önce doğrulamak İşletme&apos;nin sorumluluğundadır.
        </li>
        <li>
          {C.brand}, Hizmet&apos;in kapsamını ve arayüzünü geliştirme amacıyla değiştirebilir; mevcut kullanımı önemli ölçüde
          kısıtlayan değişiklikleri makul bir süre önce panelden veya e-posta ile duyurur.
        </li>
      </ul>

      <h3 className={h}>4. Ücretler</h3>
      <ul className={ul}>
        <li>
          Hizmet&apos;in mevcut sürümü ücretsiz sunulmaktadır. {C.brand} ileride ücretli planlar sunabilir; ücretli bir plana geçiş
          yalnızca İşletme&apos;nin ayrıca ve açıkça onayıyla olur, mevcut ücretsiz kullanım tek taraflı olarak ücretli hâle
          getirilmez.
        </li>
        <li>
          Ücretli plan sunulduğunda fiyat, kapsam, faturalama ve iade koşulları ayrı bir sipariş formu veya ek sözleşmeyle belirlenir;
          bu Sözleşme&apos;nin diğer hükümleri uygulanmaya devam eder.
        </li>
      </ul>

      <h3 className={h}>5. İşletme İçeriği ve Yasal Yükümlülükler</h3>
      <ul className={ul}>
        <li>
          Menü, ürün adı ve açıklaması, fiyat, görsel, logo, kampanya, etkinlik, iletişim bilgileri ve yüklediğiniz her türlü
          içerik (&quot;İçerik&quot;) İşletme&apos;ye aittir ve İşletme&apos;nin sorumluluğundadır.
        </li>
        <li>
          İşletme, İçerik&apos;in hukuka, üçüncü kişilerin fikrî ve sınaî haklarına ile kişilik haklarına uygun olduğunu ve
          görsellerde yer alan kişilerin rızasını aldığını taahhüt eder.
        </li>
        <li>
          Fiyat ve ürün bilgilerinde 6502 sayılı Kanun ve Fiyat Etiketi Yönetmeliği&apos;ne; gıda bilgilendirmesinde Türk Gıda
          Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği&apos;ne (alerjen beyanı dâhil) ve servis ücreti gibi
          konularda ilgili mevzuata uymak İşletme&apos;nin yükümlülüğüdür. {C.brand} bu bilgileri denetlemez.
        </li>
        <li>
          Katalog ve şablonlardaki hazır görseller, &quot;Görsel Kaynakları&quot; sayfasında belirtilen lisanslarla sunulur ve
          yalnızca Hizmet içinde kullanılabilir.
        </li>
        <li>
          İşletme, İçerik üzerinde {C.brand}&apos;e Hizmet&apos;i sunmak için gereken ölçüde (barındırma, çoğaltma, yeniden
          boyutlandırma, görüntüleme, önizleme) dünya çapında, bedelsiz ve altyapı sağlayıcıları için alt lisanslanabilir bir
          kullanım hakkı verir. Bu hak, İçerik silindiğinde veya hesap kapandığında sona erer; yedeklerdeki kopyalar makul sürede
          silinir.
        </li>
      </ul>

      <h3 className={h}>6. Yasaklı Kullanım</h3>
      <p className={p}>
        Hukuka aykırı, yanıltıcı, hakaret içeren veya üçüncü kişi haklarını ihlal eden içerik yayınlamak; zararlı yazılım yaymak;
        Hizmet&apos;i tersine mühendislik, otomatik veri çekme (scraping) veya aşırı yük oluşturacak biçimde kullanmak; başkasının
        hesabına erişmeye çalışmak; Hizmet&apos;i rakip bir ürün geliştirmek için kullanmak ve toplu istenmeyen ileti göndermek
        yasaktır.
      </p>

      <h3 className={h}>7. Yer Sağlayıcı Statüsü</h3>
      <p className={p}>
        {C.brand}, 5651 sayılı Kanun kapsamında yer sağlayıcıdır; İşletme&apos;nin yayınladığı içeriği önceden denetleme yükümlülüğü
        yoktur. Hukuka aykırı olduğu bildirilen içerik, kanunda öngörülen usul çerçevesinde erişime kapatılabilir. Yer sağlayıcı
        trafik bilgileri mevzuatta öngörülen süreyle saklanır.
      </p>

      <h3 className={h}>8. Askıya Alma, Fesih ve Verilerin Akıbeti</h3>
      <ul className={ul}>
        <li>
          {C.brand}; Sözleşme&apos;nin ihlali, hukuka aykırı içerik, güvenlik riski, yetkili makam talebi veya uzun süreli
          hareketsizlik hâlinde hesabı askıya alabilir ya da feshedebilir. Sebep panelde gösterilir; askı süresince site
          &quot;hizmet dışı&quot; görünür ve panel salt okunur olur.
        </li>
        <li>
          İşletme, dilediği zaman {C.email} adresine yazarak hesabının kapatılmasını isteyebilir; hesap ve İçerik makul süre
          içinde silinir, yasal saklama süreleri saklıdır.
        </li>
        <li>
          İşletme, hesap kapatılmadan önce İçerik&apos;inin (menü, ürün, görsel) bir kopyasını talep edebilir; {C.brand} bunu makul
          süre içinde yaygın bir biçimde sağlar.
        </li>
      </ul>

      <h3 className={h}>9. Fikrî Mülkiyet</h3>
      <p className={p}>
        Platform&apos;un yazılımı, tasarımı, markası, logoları, şablon yapısı ve katalog veri tabanı {C.brand}&apos;e aittir;
        Sözleşme İşletme&apos;ye yalnızca Hizmet&apos;i kullanma hakkı verir. İşletme&apos;nin kendi markası ve İçerik&apos;i
        İşletme&apos;ye ait kalır.
      </p>

      <h3 className={h}>10. Garanti Reddi ve Sorumluluğun Sınırlandırılması</h3>
      <ul className={ul}>
        <li>
          Hizmet &quot;olduğu gibi&quot; sunulur. {C.brand} kesintisiz, hatasız veya belirli bir amaca uygun hizmet garanti etmez;
          planlı bakım ve üçüncü taraf altyapı kesintileri yaşanabilir.
        </li>
        <li>
          Hizmet&apos;in ücretsiz sunulduğu dikkate alınarak {C.brand}&apos;in bir takvim yılındaki toplam sorumluluğu, İşletme&apos;nin
          son 12 ayda {C.brand}&apos;e ödediği ücretle; ücret ödenmemişse 1.000 TL ile sınırlıdır. Kâr kaybı, itibar kaybı ve veri
          kaybı gibi dolaylı zararlardan sorumluluk kabul edilmez.
        </li>
        <li>
          Bu sınırlamalar, {C.brand}&apos;in kastından veya ağır ihmalinden kaynaklanan zararlar ile kanunen sınırlanamayan
          sorumluluklar için uygulanmaz (TBK m. 115).
        </li>
        <li>
          İşletme, İçerik&apos;inden veya Hizmet&apos;i hukuka aykırı kullanmasından doğan üçüncü kişi taleplerine karşı
          {C.brand}&apos;i tazmin eder.
        </li>
      </ul>

      <h3 className={h}>11. Değişiklikler</h3>
      <p className={p}>
        {C.brand} bu Sözleşme&apos;yi değiştirebilir. Önemli değişiklikler yürürlüğe girmeden en az 15 gün önce panelde ve/veya
        kayıtlı e-posta adresinize bildirilir; bu süre sonunda Hizmet&apos;i kullanmaya devam etmeniz değişiklikleri kabul ettiğiniz
        anlamına gelir. Kabul etmiyorsanız hesabınızı kapatabilirsiniz.
      </p>

      <h3 className={h}>12. Bildirimler ve Ticari İletişim</h3>
      <p className={p}>
        Bildirimler kayıtlı e-posta adresinize veya panel içi bildirimle yapılır. 6563 sayılı Kanun kapsamında ticari elektronik
        ileti (kampanya, tanıtım), yalnızca ayrıca onay vermeniz hâlinde ve İleti Yönetim Sistemi (İYS) üzerinden gönderilir.
        Hizmet&apos;in işleyişine ilişkin zorunlu bildirimler (başvuru sonucu, güvenlik, hizmet değişikliği) bu kapsamda değildir.
      </p>

      <h3 className={h}>13. Uygulanacak Hukuk ve Yetkili Mahkeme</h3>
      <p className={p}>
        Bu Sözleşme Türk hukukuna tabidir. Uyuşmazlıklarda {C.court} mahkemeleri ve icra daireleri yetkilidir.
      </p>

      <h3 className={h}>14. Çeşitli Hükümler</h3>
      <p className={p}>
        Hükümlerden birinin geçersiz sayılması diğerlerini etkilemez. İşletme, Sözleşme&apos;den doğan haklarını {C.brand}&apos;in
        yazılı onayı olmadan devredemez; {C.brand}, Hizmet&apos;in devri hâlinde Sözleşme&apos;yi devralana devredebilir. Bir hakkın
        kullanılmaması feragat sayılmaz. Bu Sözleşme, Gizlilik Politikası ve KVKK Aydınlatma Metni ile birlikte tarafların tam
        anlaşmasını oluşturur.
      </p>

      <h3 className={h}>15. İletişim</h3>
      <CompanyBlock />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Gizlilik Politikası ve KVKK Aydınlatma Metni                         */
/* ------------------------------------------------------------------ */

export function PrivacyPolicyText() {
  return (
    <div className="space-y-3">
      <h3 className={h}>1. Veri Sorumlusu</h3>
      <p className={p}>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla
        {' '}{C.name} (&quot;{C.brand}&quot;) tarafından aşağıda açıklanan kapsamda işlenir. Bu metin KVKK m. 10 ve Aydınlatma
        Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ&apos;e göre hazırlanmıştır.
      </p>
      <CompanyBlock />
      <p className={p}>KVKK başvuruları için e-posta: {C.privacyEmail}</p>

      <h3 className={h}>2. Kimlerin Verisini İşliyoruz</h3>
      <ul className={ul}>
        <li>
          <b>İşletme hesabı kullanıcıları:</b> işletme sahibi, yöneticiler ve personel (bu metnin ana muhatabı).
        </li>
        <li>
          <b>Site ziyaretçileri:</b> bir işletmenin QR menüsünü veya sitesini görüntüleyen son kullanıcılar (bkz. 9. bölüm).
        </li>
        <li>
          <b>İletişim kuranlar:</b> iletişim formu veya e-posta ile bize ulaşanlar.
        </li>
      </ul>

      <h3 className={h}>3. İşlenen Kişisel Veriler</h3>
      <ul className={ul}>
        <li>
          <b>Kimlik:</b> ad ve soyad.
        </li>
        <li>
          <b>İletişim:</b> e-posta adresi, telefon numarası, işletme adresi ve şehri.
        </li>
        <li>
          <b>Hesap ve işlem güvenliği:</b> şifre (yalnızca geri döndürülemez özet olarak), giriş zamanları, IP adresi, tarayıcı ve
          cihaz bilgisi, oturum kayıtları, sözleşme kabul sürümü, zamanı ve IP&apos;si, güvenlik olay kayıtları.
        </li>
        <li>
          <b>İşletme bilgileri:</b> işletme adı, türü, çalışma saatleri, harita ve yorum bağlantıları, sosyal medya hesapları,
          misafir Wi-Fi adı ve şifresi (sitede yayınlamayı seçerseniz), hakkımızda metni, menü, ürün, fiyat, kampanya ve etkinlik
          bilgileri. Bunlar çoğunlukla işletme verisidir; şahıs işletmelerinde kişisel veri niteliği taşıyabilir.
        </li>
        <li>
          <b>Görsel:</b> yüklediğiniz logo, kapak ve ürün görselleri ile yapay zekâ ile okunmak üzere yüklediğiniz menü
          fotoğrafları. Kişi içeren görsel yüklememenizi öneririz.
        </li>
        <li>
          <b>Destek ve denetim kayıtları:</b> hesabınızla ilgili sistem yöneticisi notları ve işlem geçmişi.
        </li>
      </ul>

      <h3 className={h}>4. Toplama Yöntemi ve Hukuki Sebepler</h3>
      <p className={p}>
        Kişisel verileriniz kayıt ve kurulum formları, yönetim paneli, uygulama arayüzleri (API), sunucu günlükleri ve zorunlu
        çerezler/yerel depolama aracılığıyla, elektronik ortamda ve kısmen otomatik yollarla toplanır. KVKK m. 5 kapsamındaki
        hukuki sebepler şunlardır:
      </p>
      <ul className={ul}>
        <li>
          <b>Sözleşmenin kurulması ve ifası (m. 5/2-c):</b> hesap açılması, başvurunun değerlendirilmesi, hizmetin sunulması,
          sizinle iletişim.
        </li>
        <li>
          <b>Hukuki yükümlülük (m. 5/2-ç):</b> 5651 sayılı Kanun kapsamındaki kayıtlar, mali ve ticari mevzuat, yetkili makam
          talepleri.
        </li>
        <li>
          <b>Bir hakkın tesisi, kullanılması veya korunması (m. 5/2-e):</b> sözleşme kabul kayıtlarının ve işlem geçmişinin
          uyuşmazlık hâlinde kullanılmak üzere saklanması.
        </li>
        <li>
          <b>Meşru menfaat (m. 5/2-f):</b> hesap güvenliği, dolandırıcılık ve kötüye kullanımın önlenmesi, hata ayıklama, hizmetin
          iyileştirilmesi ve anonim istatistik.
        </li>
        <li>
          <b>Açık rıza (m. 5/1):</b> yalnızca ticari elektronik ileti gönderimi ve bu metinde açık rızaya dayandığı belirtilen
          yurt dışı aktarımlar için. Rızanızı dilediğiniz zaman geri alabilirsiniz; geri alma, önceki işlemelerin hukuka
          uygunluğunu etkilemez.
        </li>
      </ul>

      <h3 className={h}>5. İşleme Amaçları</h3>
      <ul className={ul}>
        <li>Hesabın oluşturulması, başvurunun incelenmesi ve sonucun bildirilmesi; telefon veya e-posta ile sizinle iletişim.</li>
        <li>Dijital menü, QR kod ve işletme sitesi hizmetlerinin sunulması ve sürdürülmesi.</li>
        <li>Menü tarama, kalori tahmini ve görsel üretimi gibi yapay zekâ destekli özelliklerin çalıştırılması.</li>
        <li>Hesap ve sistem güvenliğinin sağlanması, kötüye kullanımın tespiti.</li>
        <li>Destek taleplerinin karşılanması ve yasal yükümlülüklerin yerine getirilmesi.</li>
        <li>Hizmetin geliştirilmesi ve anonimleştirilmiş kullanım istatistikleri.</li>
      </ul>

      <h3 className={h}>6. Kişisel Verilerin Aktarılması</h3>
      <p className={p}>
        Kişisel verileriniz, hizmetin gerektirdiği ölçüde ve veri işleyen sıfatıyla hareket eden aşağıdaki hizmet sağlayıcılarına
        aktarılır (KVKK m. 8 ve m. 9):
      </p>
      <ul className={ul}>
        <li>
          <b>Supabase, Inc.</b> — veritabanı, kimlik doğrulama ve dosya depolama (sunucu bölgesi: [AB/ABD]).
        </li>
        <li>
          <b>Vercel, Inc.</b> — uygulamanın barındırılması ve dağıtımı (ABD ve küresel uç sunucular).
        </li>
        <li>
          <b>Cloudflare, Inc.</b> — yapay zekâ ile ürün görseli üretimi ve ağ/güvenlik hizmetleri.
        </li>
        <li>
          <b>Google LLC (Gemini API)</b> — yalnızca bu özellikleri kullandığınızda: menü fotoğrafının yapay zekâ ile okunması, kalori
          tahmini ve katalog eşleştirme. Yüklediğiniz menü fotoğrafı ve ürün adları Google&apos;a iletilir.
        </li>
        <li>
          <b>Resend, Inc.</b> — işlem e-postalarının gönderilmesi (e-posta bildirimi gönderildiğinde).
        </li>
        <li>
          <b>Yetkili kamu kurum ve kuruluşları</b> (hukuki yükümlülük) ile <b>hukuk ve mali müşavirler</b> (hakkın korunması).
        </li>
      </ul>
      <p className={p}>
        Bu sağlayıcıların sunucuları yurt dışında bulunabilir. Yurt dışına aktarımlar; 7499 sayılı Kanun ile değişik KVKK m. 9
        uyarınca Kişisel Verileri Koruma Kurulu&apos;nun yeterlilik kararı bulunan ülkelere, yeterlilik kararı bulunmayan ülkelere
        ise Kurul tarafından ilan edilen standart sözleşme hükümlerinin imzalanması ve Kurul&apos;a bildirilmesi şartıyla ya da
        KVKK m. 9/6&apos;daki istisnalar (ör. sözleşmenin ifası için zorunlu olması) kapsamında yapılır. [Yayına almadan önce: her
        yurt dışı sağlayıcıyla standart sözleşme imzalanmalı ve 5 iş günü içinde Kurul&apos;a bildirilmelidir.]
      </p>

      <h3 className={h}>7. Saklama Süreleri</h3>
      <ul className={ul}>
        <li>Hesap ve profil verileri: hesap açık olduğu sürece; hesap kapatıldıktan sonra 90 gün içinde silinir.</li>
        <li>Reddedilen başvurular: red tarihinden itibaren 6 ay (itiraz ve kötüye kullanım kontrolü), ardından silinir.</li>
        <li>Sözleşme kabul kayıtları ve işlem geçmişi: genel zamanaşımı süresi olan 10 yıl (TBK m. 146).</li>
        <li>5651 sayılı Kanun kapsamındaki trafik bilgileri: 2 yıl.</li>
        <li>Sunucu ve güvenlik günlükleri: 1 yıl.</li>
        <li>Ziyaretçi istatistikleri: kişisel veri içermeyen toplu sayımlar olarak süresiz.</li>
      </ul>
      <p className={p}>Yasal saklama süresi dolan veriler silinir, yok edilir veya anonim hâle getirilir.</p>

      <h3 className={h}>8. Haklarınız ve Başvuru</h3>
      <p className={p}>KVKK m. 11 uyarınca;</p>
      <ul className={ul}>
        <li>kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme,</li>
        <li>işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>KVKK m. 7 şartları çerçevesinde silinmesini veya yok edilmesini isteme,</li>
        <li>düzeltme, silme ve yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
        <li>münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
        <li>kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
      </ul>
      <p className={p}>
        haklarına sahipsiniz. Başvurularınızı Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ&apos;e uygun olarak yazılı
        şekilde {C.address} adresine, {C.kep} KEP adresine ya da sistemimizde kayıtlı e-posta adresinizden {C.privacyEmail}
        adresine iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır (Kurul tarifesindeki ücretler saklıdır).
        Başvurunuzun reddedilmesi veya yanıtsız kalması hâlinde Kişisel Verileri Koruma Kurulu&apos;na şikâyette bulunabilirsiniz
        (KVKK m. 14).
      </p>

      <h3 className={h}>9. Site Ziyaretçileri (İşletmenin Müşterileri)</h3>
      <p className={p}>
        Bir işletmenin QR menüsünü veya sitesini görüntülemek için hesap açılmaz. Bu kullanımda yalnızca görüntülenme sayısı, QR
        koddaki masa numarası, cihaz türü (mobil/masaüstü) ve tarih tutulur; garson veya hesap çağrısı yapılırsa masa numarası ve
        yazılan not işletmeye iletilir. IP adresi yalnızca sunucu güvenlik günlüklerinde geçici olarak yer alır; reklam veya takip
        çerezi kullanılmaz.
      </p>
      <p className={p}>
        Bu verilerin veri sorumlusu, menüyü yayınlayan işletmedir; {C.brand} işletme adına veri işleyen olarak hareket eder ve
        işletme ile ilişkisi Kullanım Koşulları ile düzenlenir. İşletmeler, kendi müşterilerine karşı aydınlatma yükümlülüğünü
        yerine getirmekle sorumludur.
      </p>

      <h3 className={h}>10. Çerezler ve Yerel Depolama</h3>
      <p className={p}>
        Yalnızca hizmetin çalışması için zorunlu çerezler ve tarayıcı yerel depolaması kullanılır: oturum belirteci, tema tercihi,
        kurulum listesi ve sihirbaz adımı gibi arayüz tercihleri. Üçüncü taraf reklam, analitik veya takip çerezi kullanılmaz.
        Zorunlu çerezler için Kişisel Verileri Koruma Kurulu&apos;nun Çerez Uygulamaları Rehberi uyarınca açık rıza aranmaz. Çerezleri
        tarayıcı ayarlarınızdan silebilirsiniz; silindiğinde oturumunuz kapanır.
      </p>

      <h3 className={h}>11. Veri Güvenliği</h3>
      <p className={p}>
        Veriler aktarımda TLS ile şifrelenir; satır düzeyinde erişim kontrolü, rol tabanlı yetkilendirme, şifrelerin geri
        döndürülemez biçimde özetlenmesi ve erişim kayıtları uygulanır; verilere yalnızca görevi gerektiren sınırlı personel erişir.
        Veri ihlali hâlinde KVKK m. 12 uyarınca en kısa sürede ve en geç 72 saat içinde Kurul&apos;a ve etkilenen kişilere bildirim
        yapılır.
      </p>

      <h3 className={h}>12. Çocuklar</h3>
      <p className={p}>Hizmet 18 yaşından küçüklere yönelik değildir; bilerek 18 yaş altından kişisel veri toplanmaz.</p>

      <h3 className={h}>13. Değişiklikler</h3>
      <p className={p}>
        Bu metin mevzuat veya hizmet değişikliklerine göre güncellenebilir. Güncel sürüm ve tarih metnin başında yer alır; önemli
        değişiklikler panelde duyurulur.
      </p>
    </div>
  )
}

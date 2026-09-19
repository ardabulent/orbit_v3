# DECISION_LOG.md — ORBIT

> Mini-ADR formatında karar kaydı. Her kayıt: **Durum · Tarih · Onaylayan · Bağlam · Karar · Gerekçe · Alternatifler.**
>
> Geçmiş kayıtlar silinmez. Bir karar değiştiğinde eskisi yerinde kalır, üzerine tarihli düzeltme notu eklenir — bkz. "Hafıza kayıtları ileriye doğru düzeltilir, geri alınmaz".
>
> **Not:** 2026-08-25 öncesi kayıtlarda geçen `PROJECT_ARCHITECT.md` ve `WORK_LOG.md` atıfları **tarihseldir**; iki dosya da o tarihte emekliye ayrıldı ve git geçmişinde durur. Bu kayıtlar geriye dönük düzeltilmez — bkz. son kayıt, "Belge sayısı değil bakım borcu".

## İçindekiler

> **İndeks 2026-09-16'da gövdeden yeniden üretildi.** Ölçüldü: gövdede **117** karar vardı, indekste **68** satır — yani **49 karar bu listede hiç görünmüyordu** ve indeks 2026-09-11 civarında donmuştu. `AGENTS.md` bunu adıyla uyarıyor (_"indekse satır eklemeyi unutma"_) ve bu dosyanın kendi başlığı da giriş noktası olarak indeksi gösteriyor — yani eksik indeks, kaydın **%42'sini görünmez** kılmıştı (**K-08**). Bundan sonra eklenen her karar buraya da yazılır.

- Repo görünürlüğü — Private
- MoneyFlow kalıntılarının temizlenmesi ve ORBIT Eğitim Çekirdeğinin kurulması
- MVP Faz 1 Kapsamı — Saha Doğrulaması & Müşteri Görüşmesi Odaklı Mimari
- EducationPlatform Bileşen Bölünmesi, Mock Veri İzolasyonu ve ESLint Kalite Kapısı
- Sistemik Graph-First Düşünme, Blast Radius ve 6 Boyutlu Risk Protokolü
- ORBİT Vercel Ekibi + Mevcut Supabase Projesiyle Güvenli Platform Bağlantısı
- v1.1 Membership Tabanlı Auth, Tenant RLS ve Ortam Ayrımı
- Hafıza kayıtları ileriye doğru düzeltilir, geri alınmaz
- İlk production tenant'ı bir defalık istisnadır; panel hazır olunca silinip mekanizma üzerinden yeniden kurulacaktır
- Platform operatörü ayrı bir eksendir; panel `/platform` altında yaşar ve kurum içeriğine erişmez
- Stabilizasyon sırası — hafıza, güvenlik, şifre akışı, panel
- Supabase auto-deploy açık kalır; branch protection açığı tetikleyiciyle kayda geçer
- Repo görünürlüğü Public'e alındı (2026-08-17 kararını değiştirir)
- Stabilizasyon fazında tek kişilik merge'e sınırlı izin
- Kimlik ve Giriş Bilgisi Mimarisi
- Hesaplar davet e-postasıyla değil, doğrudan geçici şifreyle açılır
- Platform operatörü girişte panele düşer, dershane paneline değil
- Öğrenci ve veli ekranları mobil-öncelikli tasarlanır
- Taşınabilirlik sınırı — yetkilendirme veritabanında, veri erişimi servis katmanında
- Bir giriş hesabı tek kuruma aittir
- Sentetik adresten gerçek adrese geçiş
- Auth e-postası hiç değişmez; kurtarma linkini biz üretir, biz göndeririz
- Şifre değiştirme ile sıfırlama ayrı akışlardır; kurtarma kanalı isteğe bağlıdır ama görünürdür
- Operatör desteği üç katmanlıdır — teşhis, izinli oturum, acil erişim
- Rol, atama ve bağlantı üç ayrı kavramdır
- Belge sayısı değil bakım borcu — tek giriş noktası kuruldu, iki dosya emekliye ayrıldı
- Kilit bayrağı üç durumludur — "okunamadı" ile "değiştirmelisin" aynı ekran değildir
- `service_role` taşıyan sınır SQL'de durur, TypeScript'te değil
- Silme koruması korunacakları değil, korunmayacakları sayar
- Kimlik jeton değişince tazelenir, kullanıcı değişince değil
- Demo modu derleme zamanı sabitidir
- ORBIT tüm rollere "siz" diye hitap eder
- İş verisi RLS ile yazılır, kimlik işlemleri Edge Function'da kalır
- Zorunlu şifre değişimi kilidi iş tablolarında baştan sunucuda durur
- İş tabloları asgari kişisel veriyle açılır
- Sistem taşınabilir kurulur; sağlayıcı bir tercih, bağımlılık değildir
- Sınıf bir öğretim yılına aittir; dönem tablosu yerine arşivleme
- Veli yalnızca okur ve yalnızca kendi bağını görür
- Öğretmenin yazma yetkisi rolünden değil atamasından gelir
- Sütun maskeleme RLS'in işi değildir; sıralama bir fonksiyondan gelir
- Ödeme kurum ile aile arasındadır; öğretmen ve öğrenci görmez
- Dersin planlanması kurumun, yürütülmesi öğretmenin işidir
- Kişisel çalışma alanı kurumun değil kişinindir
- Kapsam istemcide değil veritabanında çözülür
- Kilit kullanmayı durdurur, tanıtmayı değil
- İstemci veri katmanı React Query üzerine kurulur
- Hafta yedi gündür — istemci tipi veritabanına uyar
- Staging ortamı v1.5'e ertelenir
- Yetki RLS'te, bütünlük şemada durur
- Kendi verisine erişim arşivlenmez; devredilen erişim arşivlenir
- Ders, sınıfa bağlanmaz — çünkü sınıfın ders listesi diye bir model yok
- Cache anahtarı kurumu taşır; sayfalama imleçlidir; sessiz kesme yoktur
- Servis ve sorgu hook'ları alan klasöründe, bileşenler `components/` altında
- Veli adı ve ders veren öğretmenin adı kurum içinde görülebilir bilgidir
- Devam yüzdesinde izinli ders hiç sayılmaz; geç kalma devamdır
- Katılımcı sayısı sınavın sayısıdır, okuyanın gördüğü satırların değil
- Ödeme durumu iki değerlidir; planı olmayan "Güncel" değildir
- Denetim kaydının imleci saat değil sıra numarasıdır
- Realtime tetikleyiciyle yayınlanır; kanalın adı kapsamdır
- Akademik kayıt ile giriş hesabı ayrı bir adımda bağlanır
- Kaynağı olmayan alan tek turda değil, sahibi olan dilimde karara bağlanır
- Preview'da doğrulanamayan yüzeyler açık kalır; tetikleyici v1.4 kapanışıdır
- Realtime yayını Supabase'e özgüdür ve bilerek kabul edildi
- Bağlama bir RPC'dir; Edge Function sınırı kimlik **yaratan** işlemleri tutar
- Bağlanacak üyeliğin rolü katıdır; öğretmen-veli durumu bilinen bedeldir
- Çağrı defteri özeti kimlik belirteci taşımaz
- Öğrenci numarası kurumun defterinden gelir; sunucu üretmez
- CRUD'un denetim izi tetikleyiciyle düşer
- Kontenjan sınıfın, derslik programın özelliğidir
- Denetim defterini tek bir fonksiyon yazar
- Yoklama tek nefeste kaydedilir
- Denetim kapsamı hacme göre kesilir — yoklamada ilk giriş iz bırakmaz
- Puanın tavanı vardır, tabanı yoktur
- Sınav denetimi tam tutulur — yoklamanın kesmesi buraya taşınmaz
- Kuralı olmayan kart, kural yazılarak değil kaldırılarak kapandı
- Ödev teslim takibi kendi dilimidir; ama takip edilmeyen şey bugün iddia edilmez
- Ödevin metni de denetlenir — izlenmeyen alan iz bırakmaz
- Velinin telefonu kaydın kendisinde durur, giriş hesabında değil
- Öğrenci kendi velilerini görür
- Bağ koparmak erişimi bitirir; bağ satırının görünmesi ayrı bir şeydir
- Yanlış girilmiş taksit arşivlenir — kalıptan bilinçli ayrılış
- Rapor ekranı kendi dilimidir; #239 ödeme takibini engellemiyor
- Kurumdan çıkarma role göre iki farklı iş yapar
- Üyelik yazma yolu RLS değil Edge Function'dır — ve bu ölçülerek doğrulandı
- Erişilemez bir koruma, koruma değildir — K-23 kendi kodumuzda ateşlendi
- Kurum birden fazla yönetici taşıyabilir; "devir" ayrı bir işlem değildir
- Son yönetici koruması bir SAYIMDIR, bir yasak değil (`ORB06`)
- Gereksiz ama görünür bir koşul, görünmez bir sıra bağımlılığından iyidir
- Ara denetim bir dilim değil, kapanmış dilimlerin yeniden ölçülmesidir
- Elle üç kez yapılan kontrol kapıya taşınır — çağıranı olmayan servis kalamaz
- Arşivlemenin geri alınması, arşiv ekranı değil işlemin kendisidir
- PostgREST hata gövdesinde alanın adı `details` — ve bunu yalnız ölçüm söyler
- Hatayı servis çevirir, ekran yalnız taşır
- Depoda barrel dosyası yok
- Bir kuralın değeri neyi saydığında değil, neyi saymadığındadır
- Ders yönetimi ayrı bir dilim değil, atamanın önkoşulu
- Derslik çakışması engellenmiyor — serbest metin katı kural taşımaz
- Öğretmen ataması değişmez; kaldırılır ve yeniden açılır
- Yazarın adı bir RPC'den gelir — çünkü RLS onu kimseye vermiyor
- Kişisel kayıt iz bırakmaz ve yayılmaz — deseni uygulamamak da bir karardır
- K-23'ün istediği şey testin kırmızıya dönmesi kadar ne söylediğidir
- İş kuralı şemada, biçim doğrulaması sınırda, servis yalnız çevirir
- `details` hata sınıfına göre farklı şey demek — ve asla ham basılmaz
- Bir satırın yokluğu tek anlama gelmeli — "bitirdim" bir sinyaldir
- Payda ile pay aynı kümeden gelir; gelmiyorsa oran yayımlanmaz
- Sıfır bir ölçümdür, yokluk değildir — ve ikisini kaynak ayırır
- Rapor kartlarının kapsamı okuyanın kendisidir; kurum ortalaması öğretmene açılmaz
- Sınav eğilimi yüzdedir ve sınav türü iddia edilmez
- Hesapları kişinin kendisi bağlar — iki taraflı kanıtla
- Kişi kaydı kurum-üstüdür
- Pilot onayı beklenirken altyapı yürür; pilotun kapsamı onay gününe kadar yazılmaz
- Pilot bir PWA olarak koşulur; native app'in bedeli pilotun kazancından büyük
- Supabase'de kalınır; Hetzner'e geçişin tetikleyicisi bildirim işidir
- Hesap bağını kişinin kendisi koparır
- Online tahsilat doğrudan pazaryeri olarak kurulur; kurum-başına-hesap aşaması atlanır
- Otomasyon sekmesi gizlenmez, kaldırılır
- Şirketleşme pilot sonrasına bırakılır — ve üç işi birden erteler
- Derslik bir varlıktır; çakışma serbest metinle değil kimlikle engellenir
- Deneme sınavı ders bazında kırılım taşır — tek net puan dershanenin sorusunu cevaplamıyor
- Optik okumaya girilmez — kurum okur, biz sonucu alırız
- Bağ koparma grubu dağıtmaz, ama son hesapta bağ tamamen çözülür
- CSP kapısı `VERCEL_ENV`'e bağlanır, CI'ın körlüğü kabul edilir
- Migration anahtarları saat yakalayana kadar önde kalır
- Ortaklık sona erdi; üç platform da tek sahibe döndü ve Supabase temiz kurulumla yeniden açıldı
- Arayüz dondurma kararı sona erdi; yenileme uzun ömürlü dalda yapılır, kopya klasörde değil

---

### Karar: Repo görünürlüğü — Private

**Durum:** Alındı
**Tarih:** 2026-08-17
**Kararı Onaylayan(lar):** Arda Bülent (repo sahibi)

**Bağlam:** `ardabulent/orbit_v2` reposu public olarak oluşturulmuştu; repo gerçek bir dershane/CRM ürününün iş mantığını, veri modellerini ve ticari fikirleri içeriyor.
**Karar:** Repo GitHub üzerinde Private'a çevrildi.
**Gerekçe:** Ticari/finansal iş mantığı ve müşteri veri modelleri üçüncü tarafların erişimine kapalı tutulmalı.

**Bu karar 2026-08-23 tarihinde değiştirildi — bkz. aşağıdaki "Repo görünürlüğü Public'e alındı" kaydı.**

---

### Karar: MoneyFlow kalıntılarının temizlenmesi ve ORBIT Eğitim Çekirdeğinin kurulması

**Durum:** Alındı
**Tarih:** 2026-08-17
**Kararı Onaylayan(lar):** Arda Bülent (repo sahibi)

**Bağlam:** Repoda eski MoneyFlow döneminden kalma 15+ adet ölü bileşen, kullanılmayan 1438 satırlık vitrin ve 83 KB'lık eski tarihçe birikmişti.
**Karar:** Tüm ölü dosyalar silindi, `Home.tsx` ve stiller temizlendi. Repo saf ORBIT Eğitim Platformu haline getirildi.
**Gerekçe:** Repoyu sıfırdan başlayan net, tip güvenli ve yeni geliştiricinin anında anlayabileceği bir eğitim CRM platformuna dönüştürmek.

---

### Karar: MVP Faz 1 Kapsamı — Saha Doğrulaması & Müşteri Görüşmesi Odaklı Mimari

**Durum:** Alındı
**Tarih:** 2026-08-17
**Kararı Onaylayan(lar):** Arda Bülent & Hamza Bayrak

**Bağlam:** Hedef kitle devlet kısıtlılıklarına tabi olmayan özel kurslar (LGS/YKS kursları, butik etüt merkezleri, dil kursları). İlk hedef, birkaç gün içinde çalışan bir MVP çıkarıp potansiyel müşterilere sahada göstererek geri bildirim toplamak.
**Karar:**

1. **MVP Çekirdeği:** Sınıf & Grup Yönetimi + Öğrenci Yönetimi (Ad, No, Sınıf, Tel, Veli Ad/Tel) + 4 Rol Arayüzü (Admin, Öğretmen, Öğrenci, Veli).
2. **Auth & 3. Parti Entegrasyonlar:** Saha görüşmelerinde sürtünmeyi sıfıra indirmek amacıyla karmaşık Auth ve harici SMS/ödeme API'leri MVP sonrasına bırakıldı; tek tıkla rol değiştirilebilen interaktif demo modu benimsendi.
3. **Mock Veri İzolasyonu:** Kurumun dolu görünmesini sağlayan örnek veriler `isMock: true` bayrağı ile işaretlenecek ve istendiğinde tek tıkla temizlenebilecek.
4. **Dağıtım & Bütçe:** GitHub + Vercel entegrasyonu ile 0₺ bütçeli anlık canlıya alma.

**Gerekçe:** Hız, sıfır maliyet ve müşteriyle doğrudan temas kurarak gerçek ihtiyaçları en kısa sürede öğrenmek.

---

### Karar: EducationPlatform Bileşen Bölünmesi, Mock Veri İzolasyonu ve ESLint Kalite Kapısı

**Durum:** Alındı
**Tarih:** 2026-08-18
**Kararı Onaylayan(lar):** Arda Bülent (repo sahibi)

**Bağlam:** `EducationPlatform.tsx` 2659 satıra ulaşmış tek dosyalık bir bileşendi; `.ai/` dokümantasyonu MVP kapsamında `isMock`/localStorage/reset butonu tanımlıyordu ama kodda hiçbiri yoktu; repoda hiçbir ESLint kurulumu bulunmuyordu.

**Karar:**

1. `EducationPlatform.tsx`, rol/sayfa bazlı ayrı dosyalara bölündü (`components/education/`), gelecekteki `feat/*-profile` dallarındaki merge çakışmalarını azaltmak amacıyla.
2. Sadece gerçekten mutasyona uğrayan iki veri kümesi (`attendances`, `automations`) için `lib/demoStorage.ts` ile localStorage kalıcılığı ve sıfırlama aksiyonu eklendi; `students`/`classes`/`schedule`/`paymentRows` yalnızca `isMock: true` bayrağı ile işaretlendi (henüz mutasyon yolu olmadığı için kalıcılık eklenmedi).
3. ESLint 9 flat config + typescript-eslint + eslint-plugin-react-hooks, tip kontrollü (type-checked) kural setleri olmadan eklendi; `eslint-plugin-react-hooks` bilinçli olarak v5'e sabitlendi (v7'nin React Compiler odaklı yeni kuralları ilk kalite kapısı için gereksiz sürtünme yaratacaktı).

**Gerekçe:** Sürdürülebilirlik (dosya bölünmesi), demo sunumlarının sayfa yenilemeye dayanıklı olması (persistence), ve ekip büyürken kod kalitesinin otomatik denetlenmesi (ESLint). RLS, tam CRUD ve gerçek Auth bu kapsamın dışında bırakıldı — bunlar Aşama 3'te ele alınacak.

---

### Karar: Sistemik Graph-First Düşünme, Blast Radius ve 6 Boyutlu Risk Protokolü

**Durum:** Alındı
**Tarih:** 2026-08-18
**Kararı Onaylayan(lar):** Arda Bülent & Hamza Bayrak

**Bağlam:** Vibe-coding yapan ekiplerde YZ ajanlarının körü körüne koda atlayarak yan etkileri (blast radius), ticari maliyetleri, KVKK açıklarını ve pik yük darboğazlarını göz ardı etme riski bulunmaktadır.
**Karar:** `PROJECT_ARCHITECT.md` §00 Kural 8 ve Bölüm 08 ile `CONTRIBUTING.md` ve `.github/PULL_REQUEST_TEMPLATE.md` içine "Graph-First Düşünme Protokolü" eklendi. Tüm YZ ajanları ve geliştiriciler değişiklik öncesinde:

1. Netleştirici sorular sormak,
2. Problemi 6 Boyutlu Graf Haritası (Teknik Kod/Tipler, Ticari Bütçe, Hata/Fallback, KVKK/Gizlilik, Pik Yük, Güvenlik) olarak modellemek,
3. Risk durumunda proaktif itiraz (pushback) yaparak güvenli alternatifi sunmakla yükümlü kılınmıştır.

**Gerekçe:** Mimari bozulmaları, beklenmedik maliyet patlamalarını ve regülasyon ihlallerini daha ilk satır kod yazılmadan graf seviyesinde önlemek.

---

### Karar: ORBİT Vercel Ekibi + Mevcut Supabase Projesiyle Güvenli Platform Bağlantısı

**Durum:** Alındı
**Tarih:** 2026-08-21
**Kararı Onaylayan(lar):** Hamza Bayrak

**Bağlam:** `orbit_v3` için ayrı bir Vercel deployment'ı ve Supabase bağlantısı gerekiyordu. Supabase hesabında iki aktif ücretsiz proje bulunduğu için üçüncü proje maliyet/limit riski taşıyordu. Mevcut `orbit-dershane` projesinde belge tablosu ve storage bucket için anonim okuma, ekleme ve silme politikaları tespit edildi.

**Karar:**

1. Vercel projesi iki kişilik erişime uygun `ORBİT` ekibi altında `orbit-v3` adıyla oluşturuldu ve `Hamzabyrk/orbit_v3` GitHub reposuna otomatik deployment için bağlandı.
2. Yeni ve potansiyel olarak ücretli Supabase projesi yerine mevcut `orbit-dershane` projesi yeniden kullanıldı.
3. `VITE_SUPABASE_URL` ve yalnızca public `VITE_SUPABASE_ANON_KEY`, Vercel Production/Preview/Development ortamlarına eklendi; `service_role` anahtarı aktarılmadı.
4. Belge tablosundaki ve storage bucket'taki tüm public/anon politikalar kaldırıldı, bucket private yapıldı. Auth ve tenant sahipliği gelene kadar erişim deny-by-default kalacak.

**Gerekçe:** Ücretsiz katmanı korurken iki kişilik ekip erişimini sağlamak; public Vite anahtarının yetkisiz veri okuma/yükleme/silme aracına dönüşmesini engellemek; gerçek veri ve Auth kapsamını yol haritasındaki Aşama 3'e bırakmak.

---

### Karar: v1.1 Membership Tabanlı Auth, Tenant RLS ve Ortam Ayrımı

**Durum:** Alındı
**Tarih:** 2026-08-21
**Kararı Onaylayan(lar):** Hamza Bayrak

**Bağlam:** v1.0 demosunda login ve sağ üst rol geçişi tamamen istemci state'iyle çalışıyordu. Bu davranış production'da herhangi bir ziyaretçinin admin görünümüne geçmesine izin verdiği için gerçek kullanıcı/veri aşamasına güvenli bir temel oluşturmuyordu.

**Karar:**

1. Production kimliği Supabase Auth e-posta/şifre oturumundan, rol ve tenant kapsamı `organization_memberships` kaydından gelir; rol hiçbir zaman form veya localStorage değerinden yetki olarak kabul edilmez.
2. Local geliştirme ve Vercel Preview demo rol geçişini korur; Vercel Production derlemesi demo davranışını fail-closed biçimde kapatır.
3. Bir org-wide admin üyeliği tüm kurum şubelerini kapsar; şube üyelikleri yalnızca kendi şubesini kapsar. İlk aktif ekran bağlamı varsayılan şubedir.
4. İlk kurum/admin kurulumu public onboarding ile değil, `platform_admin` app metadata kontrolü yapan Edge Function ve yalnızca `service_role` rolüne açık atomik SQL fonksiyonuyla yürür.
5. Audit kayıtları yalnızca yetkili sunucu işlemlerinden yazılır; kişisel veri metadata'ya eklenmez. İstemci audit olayı üretemez.

**Gerekçe:** Demo hızını kaybetmeden production yetki atlatmasını kapatmak; iki kurum arasında IDOR/veri sızıntısını RLS katmanında önlemek; Supabase `auth.users` şemasını uygulama rol alanlarıyla kirletmemek.

**Alternatifler:** Rolü JWT user metadata veya frontend state'inde tutmak daha az tablo gerektirirdi; ancak çoklu kurum/şube ve rol değişikliklerinde eski token/istemci verisine güvenme riski nedeniyle reddedildi.

---

### Karar: Hafıza kayıtları ileriye doğru düzeltilir, geri alınmaz

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** PR #11'de `.ai/` dosyalarına üç doküman commit'i eklendi, ardından üçü de aynı branch içinde revert edilip PR öyle merge edildi. Commit'lerden biri kişisel veri içeriyordu ve onun temizlenmesi doğru bir refleksti; ancak tek satır düzeltmek yerine tüm zincir geri alındı. Sonuç: doğru bilgi silindi, yerine yanlış olan geri geldi ve `WORK_LOG.md` ile `PROJECT_STATE.md` birbiriyle çelişir hale geldi. `PROJECT_ARCHITECT.md` §01'in tek doğruluk kaynağı ilkesi kırıldı.

**Karar:**

1. `.ai/WORK_LOG.md` ve `.ai/DECISION_LOG.md` içindeki geçmiş girdiler silinmez, revert edilmez ve yeniden yazılmaz. Bu dosyalar bir denetim izidir.
2. Bir kayıt sonradan yanlış çıkarsa, ilgili girdinin altına `**Sonradan düzeltme (tarih, Issue #):**` bloğu eklenir; güncel durum en üstteki girdide anlatılır.
3. Kişisel veri yanlışlıkla kayda girerse yalnızca o veri maskelenir; kaydın kendisi korunur.
4. `PROJECT_STATE.md` ve `ROADMAP.md` mevcut durumu anlattığı için yerinde güncellenebilir; ancak kapanmamış bir release gate "tamamlandı" olarak işaretlenemez.

**Gerekçe:** Bir hafıza sisteminin değeri, geçmişte neyin yanlış bilindiğini de saklayabilmesinde. Revert, hatayı değil hatanın kaydını siler; aynı hataya ikinci kez düşmeyi kolaylaştırır. Farklı YZ ajanlarının sırayla çalıştığı bir projede bu maliyet katlanır.

**Alternatifler:** Yanlış satırı doğrudan düzeltmek dosyayı daha kısa tutardı; ancak "bu bilgi ne zamandan beri yanlıştı ve kim neye göre karar verdi" sorusunu cevapsız bırakacağı için reddedildi.

---

### Karar: İlk production tenant'ı bir defalık istisnadır; panel hazır olunca silinip mekanizma üzerinden yeniden kurulacaktır

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `orbitdershane` kurumu, tasarlanan `bootstrap-organization` Edge Function akışıyla değil, yetkili kontrol düzleminden doğrudan `internal_bootstrap_organization` RPC'si çağrılarak kuruldu. O anda hiçbir hesapta `platform_admin` bayrağı yoktu; bugün de yok. Dolayısıyla onboarding mekanizmasının çalıştığı hiç doğrulanmadı. Kurumda öğrenci, belge ve Storage nesnesi bulunmuyor.

**Karar:**

1. Mevcut `orbitdershane` kaydı bir **test verisi** olarak kabul edilir, referans kurulum olarak kabul edilmez.
2. Platform paneli çalışır duruma geldikten sonra (Faz F) bu kurum silinir ve ilk kurum panel üzerinden yeniden kurulur. Ekip üyelerinin kurum içi hesapları da aynı yoldan açılır.
3. Silme işlemi panelin uçtan uca doğrulanmasından **sonra** yapılır. Aksi halde mevcut tek erişim yolu da kaybedilir.
4. Bu tarihten sonra hiçbir kurum, kullanıcı veya üyelik kaydı SQL editöründen veya kontrol düzleminden elle oluşturulmaz. Tek istisna, aşağıdaki "Stabilizasyon sırası" kararında tanımlanan ilk platform operatörü hesabıdır.

**Gerekçe:** Bir mekanizmanın çalıştığının tek kanıtı onu çalıştırmaktır. Elle kurulan kayıtların üstüne inşa edersek, `bootstrap-organization`'daki bir hatayı ilk gerçek müşterinin önünde keşfederiz. Kurumda veri olmadığı için silme maliyeti bugün sıfır.

**Alternatifler:** Kaydı korumak daha hızlıydı; ancak onboarding akışını ilk müşteride test etmek anlamına geldiği için reddedildi. Kaydı "test kurumu" diye işaretleyip bırakmak da değerlendirildi, veritabanında kalıcı çöp bırakacağı için tercih edilmedi.

---

### Karar: Platform operatörü ayrı bir eksendir; panel `/platform` altında yaşar ve kurum içeriğine erişmez

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Geliştirme ekibinin yeni kurum ve kurum yöneticisi oluşturabileceği bir yönetim yüzeyi yok. Bu eksiklik nedeniyle ilk kurum elle kuruldu ve ikinci ekip üyesinin hiç hesabı olmadı. `app_role` enum'u (`admin`, `teacher`, `student`, `parent`) kurum içi rolleri tanımlar ve her zaman bir kuruma bağlıdır; platform operatörü ise hiçbir kuruma ait değildir.

**Karar:**

1. Platform operatörlüğü `app_role` enum'una **eklenmez**. Ayrı bir `platform_operators` tablosu ve `current_user_is_platform_operator()` security-definer yardımcısı ile modellenir — mevcut `current_user_has_membership()` deseninin kardeşi.
2. `auth.users.app_metadata.platform_admin` bayrağı **kullanılmaz**; tek doğruluk kaynağı tablodur. Bayrak + tablo ikilisi tutmak, aynı bilgiyi iki düzlemde saklamak demektir ve bu projede halihazırda üç kez sorun çıkarmış olan drift kalıbının aynısıdır. `bootstrap-organization` Edge Function'ı tabloyu sorgulayacak biçimde güncellenir.
3. Panel `/platform` rotası altında, `client/src/platform/` içinde kendi bileşen ağacıyla yaşar. Dershane ekranlarına (`components/education/`) dokunulmaz. Giriş formu bileşeni paylaşılabilir; ayrışma girişten sonraki kimlik çözümlemesinde olur.
4. **Rota yetkilendirme değildir.** Her platform işlemi, operatör kontrolünü sunucuda yapan bir Edge Function üzerinden yürür. İstemcideki rota koruması yalnızca kullanıcı deneyimi içindir.
5. Platform operatörü yalnızca **kabı** yönetir: kurum, şube, kurum yöneticisi hesabı, operatör listesi. Öğrenci, not, yoklama, ödev ve ödeme verisine erişimi **yoktur**. Bu, mevcut RLS politikalarının doğal sonucudur; "platform operatörü her şeyi okur" türünde bir policy eklenmeyecektir.
6. İleride destek amaçlı içerik erişimi gerekirse, kurum yöneticisinin onayladığı, süreli ve her okuması denetlenen ayrı bir mekanizma olarak tasarlanır.
7. `audit_events.organization_id` NOT NULL olduğu için kuruma bağlı olmayan platform işlemleri ayrı bir `platform_audit_events` tablosuna yazılır.
8. `/platform` giriş hatası, kurum girişiyle aynı ayrım yapmayan mesajı döner; "bu hesap platform operatörü değil" gibi bir yanıt operatör listesini sızdıracağı için verilmez.

**Gerekçe:** Kap ile içeriği ayırmak KVKK açısından savunulabilir tek konum — özellikle çocuk verisi işlendiği için. Ayrıca "yazılımcılar öğrencilerimin verisini göremiyor" cümlesi kuruma satış yaparken teknik bir dayanağa sahip olur. Tek Supabase projesi ve tek auth sistemi kullanmak, iki kişilik ekip için ikinci bir projenin getireceği çift migration hattı ve projeler arası kullanıcı oluşturma köprüsünden daha ucuzdur.

**Alternatifler:** Platform paneli için ayrı bir Supabase projesi maksimum izolasyon sağlardı; iki auth sistemi ve kullanıcı oluşturmada projeler arası köprü gerektirdiği için reddedildi. Beşinci bir `app_role` değeri en az kod gerektirirdi; sahte bir "platform kurumu" kaydı yaratmayı zorunlu kıldığı ve tenant modelini bozduğu için reddedildi.

---

### Karar: Stabilizasyon sırası — hafıza, güvenlik, şifre akışı, panel

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Denetimde on bir açık bulgu tespit edildi. Bunların yalnızca ikisi platform panelinin yokluğundan kaynaklanıyor; kalanı bağımsız. Ayrıca kurucu yöneticinin şifre girişi çalışmıyor, erişim süresi dolmayan tek bir davet oturumuna bağlı ve UI'da şifre belirleme ekranı yok.

**Karar:**

1. Sıra: **A** hafıza düzeltmesi → **B** güvenlik yamaları (fonksiyon grant'ları, production Auth ayarları, config drift kontrol listesi, CI sıkılaştırması) → **C1** şifre belirleme/sıfırlama akışı → **C2** `platform_operators` şeması → **D** panel → **F** test kurumunun panelden yeniden kurulması.
2. Panel, güvenlik yamalarından **sonra** gelir. Panelin yapacağı iş kurum ve kullanıcı oluşturmaktır ve bu, şu an `anon` rolüne açık olan RPC'nin üstüne kurulacaktır; yamayı sonraya bırakmak açığın yüzeyini büyütür.
3. Şifre akışı panelden **önce** gelir. Panelden davet edilen kullanıcı şifresini kuramıyorsa panel işlevsizdir; ayrıca mevcut tek erişim noktası riski bu adımla kalkar.
4. JWT secret ve `service_role` anahtarı rotasyonu, şifre akışı çalışır hale gelene kadar **yapılmaz**. Rotasyon mevcut oturumu düşürür ve sistemde erişilebilir hesap kalmaz.
5. İlk platform operatörü hesapları, panel kendi kendini oluşturamayacağı için bir defaya mahsus kontrollü biçimde eklenir. Bu, yukarıdaki "elle kayıt oluşturulmaz" kuralının tek tanımlı istisnasıdır ve ADR olarak burada kayıtlıdır.
6. v1.2 iş tabloları bu listenin tamamı bitmeden başlamaz (`PROJECT_ARCHITECT.md` §00 kural 6).

**Gerekçe:** Bulguların çoğu bugün ucuz çünkü gerçek kullanıcı, gerçek veri ve müşteri yok. Aynı liste altı ay sonra pahalı olurdu. Sıralama, her adımın bir sonrakinin ön koşulu olmasına göre kuruldu.

**Alternatifler:** Paneli önce yapmak, ekibin en çok hissettiği sorunu (giriş yapamama) daha erken çözerdi; açık RPC'nin üstüne inşa etmek anlamına geldiği için reddedildi.

---

### Karar: Supabase auto-deploy açık kalır; branch protection açığı tetikleyiciyle kayda geçer

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Supabase GitHub entegrasyonu açık: `main`e merge edilen her migration production veritabanına otomatik uygulanıyor. Buna karşılık GitHub Free planında private repo için branch protection ve ruleset **uygulanmıyor** — ruleset ekranı "GitHub Team organization account'a geçene kadar kurallar zorlanmaz" uyarısı veriyor. `CODEOWNERS` ve `CONTRIBUTING.md` zorunlu review tanımlıyor ancak PR #11, #13 ve #15 review'suz merge edildi ve sorun çıkaran commit'ler tam olarak bunlardı.

**Karar:**

1. Supabase auto-deploy **açık kalır**. Bugüne kadarki üç sorunun üçü de repo ile production'ın ayrışmasından çıktı; auto-deploy bu ayrışmayı ortadan kaldıran mekanizmadır.
2. Uygulanmayan bir ruleset **oluşturulmaz**. Çalışmayan bir koruma, korumasızlıktan daha kötüdür çünkü yanlış güven üretir.
3. `CODEOWNERS` ve `CONTRIBUTING.md` madde 3 yeniden işletilir: `main`e giden hiçbir PR karşı tarafın onayı olmadan merge edilmez. Kural araçla değil disiplinle uygulanır ve her PR'da açıkça kontrol edilir.
4. CI'a yıkıcı migration guard'ı eklenir: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM` içeren bir migration, açık bir işaretleyici olmadan kalite kapısını düşürür.
5. **Tetikleyici:** İlk gerçek müşteri verisi sisteme girmeden önce ya GitHub Team planına geçilir ve branch protection açılır, ya da Supabase auto-deploy kapatılıp migration'lar bilinçli bir adımla uygulanır. Bu karar o noktada yeniden ele alınacaktır.

**Gerekçe:** Auto-deploy'un kapatılması repo-production ayrışmasını geri getirir ki asıl sorunumuz odur. Şu an veri ve müşteri olmadığı için yanlış bir migration'ın etki alanı düşük; ilk müşteriyle birlikte bu denge tersine döner, o yüzden karar tarihsiz bırakılmayıp tetikleyiciye bağlandı.

**Alternatifler:** Auto-deploy'u şimdi kapatmak insan kapısını geri getirirdi; migration'ların elle uygulanması repo ile production'ın yeniden ayrışmasına kapı açtığı için reddedildi. GitHub Team planı (kullanıcı başı aylık ücret) sıfır bütçe hedefiyle çeliştiği için bu aşamada alınmadı.

---

### Karar: Repo görünürlüğü Public'e alındı (2026-08-17 kararını değiştirir)

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent (repo sahibi)

**Bağlam:** Vercel, Hobby planında **private** repolarda yalnızca Vercel projesine erişimi olan commit author'ların deployment tetiklemesine izin veriyor. Arda, Hamza'nın `ORBİT` Vercel takımının üyesi olmadığı için (üyelik ücretli) Arda'nın authored ettiği her PR'da Vercel check'i başarısız oluyor ve preview deployment üretilmiyordu. Vercel'in kendi dokümantasyonunda bu durum için önerilen çözümlerden biri repoyu public yapmak veya Pro plana geçmektir.

**Karar:** `Hamzabyrk/orbit_v3` reposu Public'e alındı. Bu, 2026-08-17 tarihli "Repo görünürlüğü — Private" kararını geçersiz kılar.

**Gerekçe:** Sıfır bütçe hedefi korunarak build/preview akışının açılması. Ürün geliştirme aşamasında, gerçek kullanıcısı ve müşteri verisi olmayan bir sistem için erişilebilir bir CI/preview hattının değeri, mimarinin gizliliğinden yüksek görüldü.

**Kabul edilen riskler:**

1. Repo, çok kiracılı şema tasarımını, RLS mimarisini, Edge Function mantığını ve `.ai/` altındaki yol haritası ile karar kaydını üçüncü taraflara açar. Bu ticari bir maliyettir ve bilerek kabul edilmiştir.
2. **Karar geri alınamaz.** Public yapıldıktan sonra repo klonlanabilir, GitHub araması indeksler ve üçüncü taraf arşivler kopyasını saklar. Tekrar Private'a çevirmek, yayınlanmış içeriği geri almaz.
3. `.ai/WORK_LOG.md`, kararın alındığı anda **kapatılmamış** bir güvenlik zincirini (açık `anon` RPC yetkisi + açık production signup) ayrıntısıyla anlatıyordu. Bu nedenle Issue #18 (fonksiyon yetkileri) ve production Auth ayarlarının kapatılması, planlanan sıradaki yerlerinden alınıp **zaman kritik** işler haline getirilmiştir.

**Alternatifler:** Vercel Pro planı sıfır bütçe hedefiyle çeliştiği için alınmadı. Vercel Deploy Hooks ile takım üyeliği olmadan deployment tetiklemek değerlendirildi; kurulum maliyeti nedeniyle şimdilik ertelendi, gerekirse yeniden ele alınacaktır. Preview olmadan yalnızca yerelde doğrulama yapmak da mümkündü; UI değişikliği içeren fazlarda (v1.1.2) yetersiz kalacağı için tercih edilmedi.

---

### Karar: Stabilizasyon fazında tek kişilik merge'e sınırlı izin

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `CONTRIBUTING.md` madde 3 ve yukarıdaki auto-deploy kararı, `main`e giden her PR için karşı tarafın onayını zorunlu kılıyor. Ancak GitHub Free planında private/public repo ayrımından bağımsız olarak bu kural araçla zorlanamıyor; yalnızca disiplinle uygulanıyor. Stabilizasyon çalışması sırasında ekip üyelerinden biri saatlerce müsait olmayabiliyor ve açık bir güvenlik bulgusunun kapatılması onay beklemek yüzünden gecikiyor.

Kuralı sessizce çiğnemek, bu projede tedavi edilen asıl hastalığın (belgenin bir şey, gerçeğin başka şey söylemesi) tekrarı olurdu. Bu nedenle kural çiğnenmek yerine gerçeğe uyduruldu.

**Karar:**

1. Stabilizasyon fazı boyunca (v1.1.1 ve v1.1.2 kapanana kadar), diğer ekip üyesi müsait değilken, aşağıdaki koşulların **tamamını** sağlayan bir PR tek kişi tarafından merge edilebilir:
   - Tüm CI kontrolleri yeşil (`quality-gate`, ve `supabase/**` değiştiyse `Supabase Database Tests`)
   - Mevcut production verisini silmiyor veya geri döndürülemez biçimde değiştirmiyor
   - Merge gerekçesi ve tek kişilik merge'in sebebi PR açıklamasına yazılmış
2. Tek kişilik merge edilen her PR, karşı ekip üyesi müsait olduğunda **geriye dönük olarak** gözden geçirilir; itiraz olursa düzeltme yeni bir PR ile yapılır, merge geri alınmaz.
3. Bu izin v1.1.2 kapandığında sona erer ve `CONTRIBUTING.md` madde 3'e dönülür. İzin süresizleştirilmek istenirse yeni bir ADR gerekir.
4. Veri silen, şema düşüren veya production Auth/altyapı ayarlarını değiştiren PR'lar bu iznin **dışındadır**; onlar her durumda iki kişilik onay gerektirir.

**Gerekçe:** İki kişilik bir ekipte, uygulanamayan bir kuralın kâğıt üzerinde durması onu zamanla tümüyle işlevsiz kılar. Sınırlı, tarihli ve koşullu bir izin, kuralın kalan kısmını korur. 4. maddedeki istisna, iznin gerçekten tehlikeli olabileceği tek alanı dışarıda bırakır.

**Alternatifler:** Kuralı olduğu gibi bırakıp fiilen uymamak değerlendirildi ve reddedildi; belge ile davranışın ayrışması bu projenin tekrar eden hata kalıbıdır. Kuralı tamamen kaldırmak da reddedildi; PR #11, #13 ve #15'in review'suz merge edilmesi ile sonrasında ortaya çıkan tutarsızlıklar arasındaki bağ göz önüne alındığında, onay mekanizmasının değeri kanıtlanmıştır.

---

### Karar: Kimlik ve Giriş Bilgisi Mimarisi

**Durum:** Alındı
**Tarih:** 2026-08-23
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Ürünün hedef kitlesinde herkesin e-postası yok. Kurum yöneticileri ve çoğu öğretmen e-posta kullanıyor; öğrencilerin özellikle küçük yaş grubunda çoğunun yok, velilerin ise neredeyse tamamında telefon var ama e-posta değişken. Supabase Auth ise giriş için e-posta veya telefon istiyor, kullanıcı adı desteklemiyor.

T.C. Kimlik numarası KVKK gerekçesiyle kimlik belirteci olarak kullanılmayacaktır. e-Okul'un T.C. Kimlik + okul numarası ile şifresiz giriş modeli örnek alınmamıştır; düşük güvenlikli bir tasarımdır.

Sorun üç ayrı parçadan oluşur ve genelde birbirine karıştırılır: kimlik belirteci, kimlik kanıtı ve ilk kimlik bilgisinin teslimi. Asıl zor olan üçüncüsüdür.

**Karar:**

**1. Giriş belirteci: e-posta veya 8 haneli kişi numarası.**

Giriş formu tek bir alan sorar. İstemci girdiyi şöyle yorumlar:

- `@` içeriyorsa e-posta adresidir, olduğu gibi kullanılır
- 8 haneli sayıysa `<numara>@orbit.invalid` sentetik adresine çevrilir

Numara `<kurum:4 hane><kişi:4 hane>` biçimindedir ve **global olarak benzersizdir**; bu nedenle giriş ekranında ayrıca kurum kodu sorulmaz.

- Her iki bölüm de **1000'den başlar**. Baştaki sıfır hiç oluşmaz; kullanıcı `0042`'yi `42` diye yazıp giriş yapamaz duruma düşmez.
- Kapasite: 9000 kurum × 9000 kişi.
- Numara **rol kodlamaz.** Roller değişebilir (öğrenci ileride asistan olabilir) ve rolü kimliğe gömmek, rol değişiminde kimlik değiştirmeyi gerektirirdi. Rol `organization_memberships` kaydında durur.
- Numara "öğrenci numarası" değil **kişi numarasıdır**; e-postası olmayan öğrenci, veli ve öğretmen aynı şemayı kullanır.
- Kurumun kendi iç öğrenci numarası ayrı bir alanda saklanır. İkisini birleştirmek, kuruma numaralandırma sistemini değiştirtmek anlamına gelirdi.

**2. Sentetik adresler istemcide deterministik olarak üretilir.**

Yaygın alternatif, her girişte kullanıcı adını e-postaya çeviren `service_role` yetkili bir Edge Function kullanmaktır. Bu yaklaşım **reddedilmiştir**: kullanıcı şifresi bizim sunucu kodumuzdan geçerdi ve giriş yoluna ayrıcalıklı bir bileşen eklenirdi.

Numara global olarak benzersiz olduğu için istemci sentetik adresi kendisi kurabilir ve doğrudan `signInWithPassword` çağırabilir. Giriş yolunda ayrıcalıklı hiçbir bileşen yoktur; şifre tarayıcıdan doğrudan Supabase'e gider.

`.invalid` uzantısı RFC 2606 gereği hiçbir zaman çözümlenemez; bu adreslere kimse posta gönderemez ve gerçek bir adresle çakışamaz. `.local` **kullanılmaz**; o uzantı mDNS için ayrılmıştır ve yerel ağlarda çözümleme sorunlarına yol açar.

**3. İlk şifre geçicidir, bir kez gösterilir ve asla saklanmaz.**

- Kullanıcı oluşturulurken kişiye özel, rastgele bir geçici şifre üretilir. Herkese aynı standart şifre verilmez.
- Şifre **yalnızca oluşturma anında ekranda gösterilir**; veritabanına düz metin olarak yazılmaz. Kaybolursa yönetici yenisini üretir.
- Kullanıcı ilk girişte şifresini değiştirmek **zorundadır**; değiştirmeden başka hiçbir ekrana gidemez.
- Geçici şifrenin ömrü sınırlıdır. Dağıtılıp hiç kullanılmayan kâğıtlardaki şifreler süresiz geçerli kalmaz.
- Şifre kâğıttan okunabilir olmalıdır. Onaltılık dizeler (`9b2d4a6f7c`) bu amaçla kullanılmaz.

**4. Pilot aşamada teslim yöntemi: yazdırılabilir liste ve varsa e-posta.**

Panel, oluşturma anında yazdırılabilir bir liste üretir. E-postası olan kullanıcılara ayrıca gönderilir. SMS ve WhatsApp bu aşamada kurulmaz; `profiles.phone` alanı doldurulur ama kullanılmaz, böylece ileride bir otomasyon eklendiğinde veri hazır olur.

**5. E-postası olmayan kullanıcı için sıfırlama kanalı kurum yöneticisidir.**

Bu kişiler kendi başlarına şifre sıfırlayamaz. Panelde kullanıcı başına "şifre sıfırla" işlemi bulunmak zorundadır; aksi halde kurum her unutulan şifrede geliştirme ekibine başvurur. Bunun sonucu olarak kurum yöneticisi hesabı yüksek değerli bir hedeftir ve gerçek e-posta ile korunur.

**Gerekçe:** Tek alanlı giriş, iki alanlı girişe göre sahada belirgin biçimde daha az hata üretir; hedef kitlenin bir kısmı ilkokul çağında ve kâğıttan okuyarak giriş yapacaktır. Sentetik adresin istemcide üretilebilmesi, giriş yolundan ayrıcalıklı bir bileşeni tamamen kaldırır. Geçici şifrenin bir kez gösterilip saklanmaması, düz metin şifre saklama gereğini ortadan kaldırır ve KVKK açısından savunulabilir tek konumdur.

Numarada isim taşınmaması bilinçlidir: K-12 kimlik yönetimi rehberleri, kimlik belirtecinin opak, değişmez ve kişisel veri içermeyen bir değer olmasını önerir. `ahmet.yilmaz@...` biçimi ismi belirtece gömerdi; ayrıca aynı isimli iki kişide çakışır ve isim değişikliğinde kimliğin değişmesini gerektirirdi.

**Alternatifler:**

- **Telefon numarasıyla giriş (Supabase phone auth):** Velilerin neredeyse tamamında telefon var. Reddedildi; operatörler numaraları geri dönüşüme sokuyor ve geri dönüştürülmüş bir numarayı alan kişi önceki kullanıcının hesabına erişebiliyor. Supabase de bu yöntemi bu nedenle önermiyor. Ayrıca SMS maliyeti sıfır bütçe hedefiyle çelişiyor.
- **UUID tabanlı kullanıcı adı (`user_123e4567@...`):** Benzersizliği garanti eder ancak kâğıttan okunup yazılamaz. Kimlik hem benzersiz hem kullanılabilir olmak zorundadır.
- **İsim tabanlı kullanıcı adı:** Hatırlaması kolaydır ancak belirtece kişisel veri gömer, çakışır ve isim değişikliğinde kırılır.
- **Kurum kodu + kullanıcı adı iki ayrı alan:** İlk tasarımdı. Numaraya kurum kodunun gömülmesiyle gereksiz hale geldi.
- **Kontrol hanesi (Luhn) eklemek:** Yazım hatalarını yakalar ve daha iyi hata mesajı verir. Numarayı dokuz haneye çıkardığı için tercih edilmedi; kâğıttan okunabilirlik daha değerli görüldü.

**Uygulama sırası notu:** Bu karar bugün alınmıştır ancak tamamı bugün uygulanmayacaktır. Kurum yöneticileri gerçek e-posta adresine sahip olacağı için, platform paneli onları mevcut davet ve şifre belirleme akışıyla oluşturabilir; sentetik adres ve geçici şifre makinesi ilk kez kurum yöneticisi kendi öğretmen ve öğrencilerini eklerken gerekecektir. Karar erken sabitlenmiştir çünkü kimlik şemasını sonradan değiştirmek, oluşturulmuş her hesabı etkiler.

**Ek karar (2026-08-23): Platform operatörleri için ayrı giriş ekranı yapılmayacaktır.**

Daha önceki "Platform operatörü ayrı bir eksendir" kararında `/platform` altında ayrı bir giriş ekranı öngörülmüştü. Gerekçeleri iki taneydi ve ikisi de yukarıdaki kimlik kararıyla birlikte geçersiz kaldı:

1. _"Kurum girişi kurum kodu soracağı için operatörlerde karşılığı olmaz."_ Numaraya kurum kodu gömüldüğü için giriş ekranı artık tek alan soruyor ve o alan e-postayı da kabul ediyor. Operatörler gerçek e-posta kullanır; aynı ekran ikisine de hizmet eder.
2. _"Kurum girişi ileride kuruma özel markalanabilir."_ Giriş anında hangi kurumun kullanıcısı olduğunu bilmiyoruz — kimlik ancak doğrulamadan sonra çözülüyor. Dolayısıyla giriş ekranı zaten kuruma göre markalanamaz.

**Karar:** Tek giriş ekranı, girişten sonra dallanma. Kimlik çözümlendiğinde kullanıcı `platform_operators` kaydına sahipse `/platform` paneline, kurum üyeliğine sahipse dershane paneline yönlendirilir. Panellerin kendisi ayrı kalmaya devam eder; ayrışan şey giriş değil, girişten sonraki hedeftir.

**Uygulama notu:** `authService.loadAuthenticatedIdentity` şu anda aktif bir kurum üyeliği bulamazsa hata fırlatıyor ve `AuthProvider` kullanıcıyı oturumdan atıyor. Platform operatörünün tasarım gereği hiçbir kurum üyeliği yoktur; bu nedenle kimlik çözümlemesi, üyelik bulunamadığında `platform_operators` kaydına da bakacak biçimde genişletilmelidir. Aksi halde operatör giriş yapar yapmaz sistemden atılır.

---

### Karar: Hesaplar davet e-postasıyla değil, doğrudan geçici şifreyle açılır

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** "Kimlik ve Giriş Bilgisi Mimarisi" kararının uygulama sırası notu, kurum yöneticilerinin gerçek e-postası olduğu gerekçesiyle onları mevcut davet akışıyla açmayı öngörüyordu. Sentetik adres ve geçici şifre makinesi yalnızca öğretmen/öğrenci/veli için kurulacaktı.

Bu ayrım iki sorun üretti:

1. **Davet akışı çalışmıyor.** `bootstrap-organization`, yöneticiyi `inviteUserByEmail` ile yani şifresiz yaratıyor. Davet bağlantısı `type=invite` ile dönüyor; istemci yalnızca `type=recovery` biliyor (`supabaseClient.ts`) ve yalnızca `PASSWORD_RECOVERY` olayını ayrıştırıyor (`AuthProvider.tsx`). Davetle gelen kullanıcı `SIGNED_IN` üretiyor, üyeliği olduğu için doğrudan panele düşüyor ve **şifresini hiç belirlemiyor**. O oturum kapandığında bir daha giremez. Panel bugün "çalışıyor" görünüp ilk gerçek kurumda kilitlenirdi.
2. **İki mekanizma bakılıyor.** Yönetici için davet, diğerleri için geçici şifre. Aynı işin iki yolu, iki hata yüzeyi.

**Karar:** Tüm hesaplar aynı yolla açılır — **giriş numarası + kişiye özel geçici şifre**. Davet yolu kaldırılır; `inviteUserByEmail` yerine `admin.createUser` kullanılır. Kurum yöneticisi de dahil hiç kimseye oluşturma anında e-posta sorulmaz.

- Geçici şifre yalnızca oluşturma anında bir kez gösterilir, veritabanına düz metin yazılmaz.
- Geçici şifrenin ömrü **7 gündür**.
- İlk girişte şifre değiştirmek zorunludur; değiştirilmeden hiçbir ekrana gidilemez.

**E-posta kritik yoldan çıkar ama kurtarma yolundan çıkmaz.** Bu ayrım kararın özüdür:

- **Giriş** e-postaya hiç bağlı değildir; numara ve şifreyle yapılır.
- **Kurtarma** doğrulanmış bir e-posta gerektirir. Adres doğrulanana kadar "şifremi unuttum" o adrese çalışmaz.
- **Kurum yöneticisi için e-posta eklemek ve doğrulamak ilk girişte zorunludur.** Öğretmen, öğrenci ve veli için isteğe bağlıdır.

Zorunluluğun gerekçesi: kurum yöneticisi, kendi kurumundaki herkesin şifre kurtarma kanalıdır. Kendini kilitlerse tüm kurumun sıfırlama zinciri kopar ve iş geliştirme ekibine gelir. Ayarlarda isteğe bağlı bırakılırsa çoğu yönetici hiç eklemez.

**Kurtarma zinciri:** öğretmen/öğrenci/veli → kurum yöneticisi → doğrulanmış e-postası → platform operatörü.

**Gerekçe:** Kendi kaydımız (`PLATFORM_SETTINGS.md` bölüm 5) Supabase'in paylaşımlı SMTP'sini "production için uygun değil, spam'e düşmesi olağan" diye işaretliyor. Kurum kurulumunu teslimat garantisi olmayan bir kanala bağlamak kırılgandır. Doğrudan oluşturma, kırık `type=invite` yolunu onarmak yerine tamamen siler; daha az kod ve daha az durum bırakır.

**Neyi kaybediyoruz:** Davet, adresin sahipliğini kanıtlıyordu. Doğrudan oluşturmada adres doğrulanmadan kabul edilir; yanlış yazılmış bir adres kurtarma postasını bir yabancıya gönderebilir. Telafisi yukarıdaki "doğrulanana kadar kurtarma çalışmaz" kuralıdır.

**Açık bilinmez ÖLÇÜLDÜ (2026-08-24, Faz E0).** Şüphe doğru çıktı: **"Secure email change" açıkken sentetik adresten gerçek adrese geçiş imkânsız.** Ölçüm, production ile birebir aynı GoTrue sürümüyle (v2.195.0) yapıldı; betikler ve tam tablo `supabase/tests/auth/email_change_spike/`.

- Ayar **açıkken** GoTrue iki onay maili gönderiyor: yeni adrese **ve** `@orbit.invalid` adresine. **Tek onay yetmiyor** — yeni adresin bağlantısı tıklandığında `verify` başarılı dönüyor ama adres değişmiyor. Production'da `.invalid` kutusuna posta ulaşamayacağı için değişim kalıcı olarak kilitli kalır.
- Ayar **kapalıyken** yalnızca yeni adrese tek bir onay maili gidiyor; tıklanınca adres değişiyor ve eski sentetik adres artık giriş kabul etmiyor.
- **`admin.updateUserById` bir doğrulama yolu değildir.** `email_confirm` ister `true` ister `false` olsun adres anında değişiyor ve **hiçbir doğrulama maili gitmiyor**. "Adresi admin API ile yazalım, doğrulamayı GoTrue yapsın" seçeneği yoktur; bu yol kullanılırsa adres doğrulanmadan kabul edilmiş olur — kararın "doğrulanana kadar kurtarma çalışmaz" ilkesiyle çelişir.

Sonuç: doğrulamalı tek yol ayarın kapatılmasıdır. Bunun güvenlik bedeli ve telafisi ayrı bir kararda ele alınmıştır: **"Sentetik adresten gerçek adrese geçiş"**.

**Alternatifler:**

- **Davet akışını onarmak (`type=invite` desteği eklemek):** Mümkündü ama e-posta bağımlılığını kritik yolda bırakırdı ve iki mekanizmayı korurdu.
- **Herkese aynı standart şifre:** Reddedildi; bir kişinin şifresi sızdığında herkesinki sızar.

---

### Karar: Platform operatörü girişte panele düşer, dershane paneline değil

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Kimlik iki bağımsız eksen taşıyor ve `Home` bugün üyeliği önceliyor: kurum üyeliği olan kullanıcı dershane paneline düşüyor. Hamza Bayrak hem test kurumunun yöneticisi hem platform operatörü olduğu için girişte dashboard'a düştü ve panelin var olduğunu göremedi.

Öncelik kuralı koymamak bilinçliydi ve gerekçesi **test kurumunun varlığıydı**: kurucu ekip üyeleri iki ekseni de taşıdığı için hangisini önceleseydik diğerine ulaşamayacaklardı.

**Karar:** Platform operatörü girişte `/platform` paneline düşer. Test kurumu kaldırılıp kurucu ekibin kurum üyeliği sonlandırıldığı için öncelik kuralının eski sakıncası ortadan kalkmıştır.

- Kimliğin iki eksenli modeli **korunur**; değişen yalnızca varsayılan hedeftir.
- Hem operatör hem kurum üyesi olan biri dershane paneline menüdeki bağlantıyla ulaşır.
- Platform operatörlerinin kurum üyeliği olmaz. Kurum içeriğine erişimleri yoktur ve bu, "operatör kapları yönetir, içeriği görmez" taahhüdünün doğal sonucudur.

**Terim kuralı:** Arayüzde ve yazışmada **"admin" kelimesi kullanılmaz.** `app_role` enum'unun bir değeri zaten `admin`'dir ve **kurum yöneticisi** anlamına gelir; aynı kelimeyi platform operatörü için de kullanmak bu projenin yedi kez tökezlediği isim çakışması kalıbını yeniden kurar. Doğru terimler: **platform operatörü** ve **kurum yöneticisi**.

---

### Karar: Öğrenci ve veli ekranları mobil-öncelikli tasarlanır

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Ürünü öğrenciler ve veliler ezici çoğunlukla telefondan kullanacak; öğretmenler tablet, kurum yöneticileri masaüstü ağırlıklı. Bugünkü arayüz responsive sınıflar içeriyor ve sol menü mobilde çekmece olarak çalışıyor, ancak **hiçbir gerçek cihaz testi kaydı yok** ve kırılım noktası dağılımı dengesiz.

Kararın zamanlaması bilinçlidir: öğrenci ve veli ekranlarının gerçek hâlleri **henüz yazılmadı**, hepsi mock veriyle besleniyor. Kural, o ekranlar yazılmadan önce konursa bedelsizdir; sonra konursa yeniden yazım gerektirir.

**Karar:**

- **Öğrenci ve veli ekranları mobil-öncelikli tasarlanır.** Önce dar ekran çalışır hâle getirilir, masaüstü genişletme olarak ele alınır.
- **Öğretmen ekranları tablet ve masaüstünde**, kurum yöneticisi ve platform paneli **masaüstünde** birincil kabul edilir; hepsi telefonda kullanılabilir kalır ama tasarım önceliği burada değildir.
- Yatay kaydırma gerektiren tablolar öğrenci/veli akışlarında **birincil gösterim olamaz**; kart düzeni tercih edilir.
- Her yeni ekran, dar ekranda gözden geçirilmeden teslim edilmiş sayılmaz.

**Gerekçe:** Hedef kitlenin bir bölümü ilkokul çağında ve tek cihazı ailedeki telefon. Masaüstü için tasarlanıp sonra sıkıştırılan bir arayüz, bu kullanıcılar için ürünün tamamıdır.

**Kapsam dışı:** Yerel mobil uygulama. Mimari buna uygundur — backend'in tamamı (RLS, Edge Function, giriş numarası mantığı) aynen kullanılır, yalnızca arayüz yeniden yazılır — ancak bugün planlanmamıştır.

---

### Karar: Taşınabilirlik sınırı — yetkilendirme veritabanında, veri erişimi servis katmanında

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** ORBIT ayrı bir geleneksel backend sunucusu yerine BaaS (Supabase) üzerine kuruldu (`ROADMAP.md` bölüm 1). Bu, tesisatı — HTTP sunucusu, oturum yönetimi, şifre saklama, e-posta gönderimi — kiralamak demektir. İş büyürse veya sağlayıcı kısıtları engel olursa kendi sunucumuza geçme ihtimali gerçektir; Pro plan gerektiren özellikler (sızmış şifre koruması, oturum zaman aşımı) bu kısıtın ilk örnekleridir.

Ölçüm (2026-08-24): Supabase'e özgü veritabanı yüzeyi yalnızca `auth.uid()` çağrısıdır ve **8 yerde** geçer. `client/src/components` ve `client/src/pages` altında doğrudan Supabase çağrısı **sıfırdır**; tüm erişim dört servis modülünden geçer.

**Karar:** Taşınabilirlik bir hedef değil, **korunacak bir sınırdır**. İki kural:

1. **Yetkilendirme veritabanında yaşar, uygulama kodunda değil.** Kim neyi görebilir sorusunun cevabı RLS politikalarında durur ve pgTAP ile test edilir. Edge Function'lara veya istemciye taşınmaz.
2. **Ekran bileşenleri veri katmanını doğrudan çağırmaz.** Tüm Supabase erişimi servis modüllerinden geçer (`auth/`, `platform/`, `lib/`, ileride `data/`).

İkinci kural **ESLint ile zorlanır** (`eslint.config.js`, `no-restricted-imports`). Yazılı kural unutulur; kapı sessizce kapanır ve kapandığı fark edilmez. Kuralı susturmak çözüm değildir — doğru hamle erişimi bir servis modülüne taşımaktır.

**Gerekçe:** Kendi sunucumuza geçiş, bu iki kural korunduğu sürece **dört dosyanın içini değiştirmek** demektir; 15.000 satırlık arayüz ve 640 satırlık şema olduğu gibi kalır. Yetkilendirme Edge Function'lara serpilseydi taşıma, güvenliğin sıfırdan yazılması anlamına gelirdi.

**Taşınırken yine de yeniden yazılacaklar — dürüst liste:**

- Kimlik doğrulama servisi (GoTrue). İyi haber: şifreler bcrypt ile saklanıyor ve bcrypt hash'leri çoğu sisteme taşınabilir.
- `auth.uid()` — standart Postgres'te oturum değişkeninden kimliği okuyan bir sarmalayıcıyla karşılanır. 8 çağrı.
- Realtime abonelikleri (v1.3) ve Storage (v1.6). Bunlar sağlayıcı servisleridir; alternatifleri vardır ama yeniden yazım gerektirir.

**Lock-in'i büyüten şeyler — bilinçli izlenecek:** her yeni Realtime aboneliği, her Storage yolu ve servis katmanını atlayan her sorgu.

**Alternatifler:**

- **Baştan kendi backend'imizi yazmak:** İki kişilik, sıfır bütçeli bir ekip için aylarca tesisat yazmak demekti; ürünün kendisine hiç sıra gelmezdi.
- **Taşınabilirliği tamamen yok saymak:** Daha hızlı ilerletirdi ama Pro plan kısıtları şimdiden hissediliyorken kapıyı bilerek kapatmak olurdu.

---

### Karar: Bir giriş hesabı tek kuruma aittir

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `ROADMAP.md` Soru 2'nin onaylı cevabı şöyleydi: _"Bir kullanıcı farklı kurum veya şubelerde farklı rollere sahip olabilecek; aktif üyelik oturum bağlamında seçilecek."_ Şema buna göre kuruldu — `organization_memberships` bir kullanıcıya birden fazla satır verebiliyor.

Kimlik mimarisi kararı bu vaadi farkında olmadan geçersiz kıldı. Giriş numarası `<kurum:4><kişi:4>` biçiminde ve **auth kimliğinin kendisi**: `10421000@orbit.invalid`. Bir kişinin tek auth hesabı, tek numarası, dolayısıyla numarasına gömülü tek kurumu olur. İki dershanede ders veren bir öğretmen bu şemaya sığmıyor.

Çelişki, Faz E1 `person_code` kolonunu yazmadan **önce** yakalandı. Sonradan fark edilseydi açılmış her hesabı etkilerdi.

**Karar:** Bir giriş hesabı tek kuruma aittir. İki kurumda yer alan kişi, her kurumda **ayrı bir hesap ve ayrı bir giriş numarası** alır.

- `organization_memberships` şeması değişmez; çoklu satır teknik olarak mümkün kalır ancak **giriş hesabı açılan** üyelik kurum başına birdir.
- Kimliğin iki eksenli modeli etkilenmez; platform operatörlüğü zaten kurumdan bağımsızdır.
- Kurum yöneticisi başka bir kurumun kullanıcısını göremez ve arayamaz; hesaplar birbirini tanımaz.

**Gerekçe:** Tek hesapla çoklu üyelik, giriş anında kurum seçtirmeyi gerektirir ve kimlik çözümlemesini "hangi kurum bağlamındayım" durumuna bağlar. Bu durum RLS politikalarının tamamına sızar: her politika artık yalnızca "bu kullanıcı üye mi" değil, "şu anda hangi kurum bağlamında" sorusunu da sormak zorunda kalır. Oturum bağlamı istemciden geldiği için bu, yetkilendirmeye istemci kaynaklı bir girdi eklemek demektir — bugünkü en güçlü güvenlik özelliğimizi zayıflatır.

Ayrı hesap ise izolasyonu güçlendirir: iki kurum arasında hiçbir teknik köprü kalmaz.

**Bedeli — açıkça kabul ediliyor:** İki kurumda çalışan kişi iki numara taşır ve iki kez giriş yapar. Hedef kitlede bu durum nadirdir; küçük dershanelerde öğretmenlerin çoğu tek kurumda çalışır. Nadir bir kolaylık için, yetkilendirmenin tamamını karmaşıklaştırmak doğru takas değildir.

**Soru 2'ye etkisi:** Cevabın "bir kullanıcı farklı kurumlarda rollere sahip olabilecek" kısmı, **giriş hesabı düzeyinde geçersizdir**. "Farklı şubelerde farklı roller" kısmı geçerliliğini korur — şube kurumun içindedir ve numarayı etkilemez.

**Yeniden değerlendirme tetikleyicisi:** Aynı kişinin iki kurumda hesap istemesi sahada gerçekten sorun olursa. O noktada seçenek, tek hesaba çoklu üyelik değil, **hesaplar arası geçiş** olabilir: kullanıcı yine ayrı kimliklerle var olur, yalnızca arayüz aralarında geçiş sunar. Yetkilendirme sınırı bozulmaz.

**Alternatifler:**

- **Tek hesap, girişte kurum seçimi:** Soru 2'ye sadık kalırdı. Reddedildi; yetkilendirmeye istemci kaynaklı bağlam girdisi ekliyor.
- **Numaradan kurum kodunu çıkarmak (yalnızca kişi numarası):** Numarayı kurumdan bağımsız kılardı ama global benzersizliği kaybederdi; o zaman girişte kurum kodu ayrıca sorulurdu ve tek alanlı giriş kararı çökerdi.

---

### Karar: Sentetik adresten gerçek adrese geçiş

**Durum:** ⛔ **REDDEDİLDİ** — yerine "Auth e-postası hiç değişmez" kararı alındı (aşağıda)
**Tarih:** 2026-08-24
**Ölçüm:** Faz E0 spike, `supabase/tests/auth/email_change_spike/`

> **Neden reddedildi:** Bu öneri `Secure email change` ayarının kapatılmasını savunuyordu. Arda Bülent, e-postanın hesabın kimliği olmak zorunda olmadığını sorunca ölçüm verisine yeniden bakıldı ve **raporlanmamış bir sonuç** fark edildi: e-posta değiştikten sonra sentetik adresle giriş **HTTP 400** dönüyor — yani **kişinin giriş numarası ölüyor.**
>
> Sonucu ağır: e-postasını ekleyen bir öğretmenin kâğıda yazılıp verilmiş numarası geçersizleşir. Öneri, kurum yöneticisini kurtarırken numara sisteminin tamamını bozuyordu.
>
> Kayıt silinmiyor çünkü değeri gerekçesinde: bu, ölçümü yapmış olmama rağmen **verinin bir satırını yeterince önemsememiş olduğumu** gösteriyor. Aşağıdaki karar bu yanlıştan çıktı.

**Bağlam:** Kimlik kararı gereği herkes `<numara>@orbit.invalid` sentetik adresiyle açılıyor. Kurum yöneticisinin ilk girişte gerçek bir e-posta ekleyip doğrulaması **zorunlu**; kurtarma zincirinin tamamı buna dayanıyor.

E0 ölçümü, bunun bugünkü production ayarlarıyla **mümkün olmadığını** gösterdi. Ölçümün tamamı README'de; özeti:

| Yol                        | `Secure email change` | Sonuç                                                              |
| -------------------------- | --------------------- | ------------------------------------------------------------------ |
| Kullanıcı kendi oturumuyla | **AÇIK** (bugünkü)    | İki onay maili; biri `@orbit.invalid`'e. **Değişim tamamlanmıyor** |
| Kullanıcı kendi oturumuyla | **KAPALI**            | Tek onay maili, yalnızca yeni adrese. **Çalışıyor**                |
| `admin.updateUserById`     | fark etmiyor          | Anında değişiyor, **hiç doğrulama yok**                            |

**Öneri:** Production'da **`Secure email change` kapatılsın** ve e-posta değişimi kullanıcının kendi oturumu üzerinden yapılsın.

`admin.updateUserById` yolu reddediliyor: adresi doğrulamadan kabul etmek, "doğrulanana kadar kurtarma çalışmaz" ilkesini fiilen ortadan kaldırır — kullanıcı yanlış yazdığı adresi doğrulanmış sanır ve şifresini unuttuğunda kurtarma bir yabancıya gider.

**Neyi kaybediyoruz — dürüst hâli:** Ayar açıkken, oturumu ele geçirilmiş bir kullanıcının e-postasını değiştirmek için saldırganın **eski posta kutusuna da** erişmesi gerekiyordu. Kapatınca yalnızca yeni adresteki onay yeterli hâle gelir; saldırgan hesabı kalıcı olarak devralabilir.

Bu kaybın gerçek büyüklüğü sanıldığından küçüktür:

- **Sentetik adresli kullanıcılar için ayar zaten sıfır koruma sağlıyordu.** Eski kutu `@orbit.invalid`; kimse oraya erişemez. Ayar onları korumuyor, yalnızca engelliyordu.
- Koruma yalnızca **gerçek e-postasını çoktan doğrulamış** kullanıcılar için anlamlıydı; onlar da bugün sistemde yok.

**Telafiler — bizim elimizde olanlar:**

1. **E-posta değişiminden önce şifre yeniden istenir.** Açık bırakılmış bir tarayıcı başına oturan kişiye karşı etkilidir. Sınırı dürüstçe: jetonu çalmış bir saldırgan istemci kodunu yok sayabilir; bu bir yavaşlatmadır, sınır değil.
2. **Her e-posta değişimi denetim kaydı üretir** ve kurum yöneticisi hesaplarında ilgili kişiye bildirilir.
3. **Eski adrese bildirim gider** — gerçek bir adresten gerçek bir adrese geçişte kullanıcı durumdan haberdar olur.

**Yeniden değerlendirme tetikleyicisi:** Kendi alan adımız ve işlemsel e-posta sağlayıcımız olduğunda. O noktada sentetik adresler `@orbit.invalid` yerine gerçek bir alt alan adı alabilir (`users.orbit.app`); adresler teslim edilebilir hâle gelir ve `Secure email change` yeniden açılabilir. Bu ihtimal kimlik kararında zaten öngörülmüştü.

**Alternatifler:**

- **`admin.updateUserById` ile yazmak:** Ölçüldü, çalışıyor, ama doğrulama üretmiyor. Reddedildi.
- **Auth e-postasını hiç değiştirmemek, iletişim adresini yalnızca `profiles`'ta tutmak:** Supabase'in şifre sıfırlaması auth e-postasına gider; sentetik adres kalırsa sıfırlama hiç çalışmaz. Kendi sıfırlama akışımızı yazmak ise kendi SMTP'mizi gerektirir — bugün yok.
- **Ayarı açık bırakıp e-posta doğrulamasını zorunlu olmaktan çıkarmak:** Kurum yöneticisini kurtarma kanalsız bırakır; kendini kilitlediğinde tüm kurumun sıfırlama zinciri kopar.

---

### Karar: Auth e-postası hiç değişmez; kurtarma linkini biz üretir, biz göndeririz

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent
**Ölçüm:** Faz E0 spike, `supabase/tests/auth/email_change_spike/`

**Bağlam:** Herkes `<numara>@orbit.invalid` sentetik adresiyle açılıyor. Kurum yöneticisinin gerçek bir e-posta ekleyip doğrulaması zorunlu, çünkü kurtarma zinciri buna dayanıyor. İlk plan, kullanıcının auth e-postasını sentetikten gerçeğe **değiştirmekti**.

E0 ölçümü bu planın iki ayrı sebeple yanlış olduğunu gösterdi:

1. **`Secure email change` açıkken geçiş imkânsız** — eski adres olan `@orbit.invalid` kutusuna da onay maili gidiyor ve tek onay yetmiyor.
2. **Ayar kapatılsa bile geçiş yıkıcı** — e-posta değiştikten sonra sentetik adresle giriş `HTTP 400` dönüyor. Yani kişinin **giriş numarası ölüyor.** Kâğıda yazılıp dağıtılmış numara geçersizleşir.

İkinci madde birinciden ağırdır ve ayarı kapatma seçeneğini tamamen geçersiz kılar.

**Karar:** Auth e-postası **hiçbir zaman değişmez**. `<numara>@orbit.invalid` kişinin kalıcı kimliğidir.

- **Giriş her zaman numarayladır.** Kullanıcı e-posta eklese de numarası çalışmaya devam eder.
- **Gerçek e-posta `profiles` içinde iletişim bilgisidir**, kimlik değildir.
- **`Secure email change` production'da AÇIK kalır.** Hiçbir güvenlik ayarı zayıflatılmıyor; e-posta değiştirmediğimiz için o ayar bizim yolumuza hiç girmiyor.
- **Kurtarma linkini biz üretir, biz göndeririz.** Edge Function `service_role` ile `POST /auth/v1/admin/generate_link` çağırır ve linki `profiles`'taki doğrulanmış adrese gönderir.

**Ölçüldü, varsayılmadı** (GoTrue v2.195.0, production ile aynı sürüm):

| Ölçüm                                 | Sonuç                                                   |
| ------------------------------------- | ------------------------------------------------------- |
| `generate_link` posta gönderiyor mu   | **Hayır — 0 mesaj.** Link ve kod bize dönüyor           |
| Dönen alanlar                         | `action_link`, `hashed_token`, **`email_otp`** (6 hane) |
| Üretilen jeton gerçekten çalışıyor mu | Evet — kurtarma oturumu alındı, şifre güncellendi       |
| Sonrasında yeni şifreyle giriş        | HTTP 200                                                |
| Sonrasında eski şifreyle giriş        | HTTP 400                                                |
| Tüm akış boyunca giden posta          | **0**                                                   |

`email_otp` alanı beklenmedik bir kazanç: 6 haneli kod, kâğıttan okunabilir ve ileride SMS'e taşınabilir. Link tıklanamayan durumlarda (yazdırılmış liste, telefonla iletme) kullanılabilir.

**Gerekçe:** Kimlik kararının ilkesi "numara opak, değişmez ve kalıcı bir belirteçtir" idi. E-posta eklendiğinde kimliğin değişmesi bu ilkeyle baştan çelişiyordu; ölçüm bunu somut bir arızaya çevirdi. Bu tasarımda kimlik hiç oynamıyor, e-posta yalnızca bir iletişim kanalı olarak ekleniyor — rolü neyse o.

Yan fayda: kurtarma akışı **bizim** kontrolümüzde. Hangi adrese gittiğini, kaç kez denendiğini, ne zaman süresinin dolduğunu biz belirleriz ve denetim kaydına yazarız. Supabase'in hazır akışında bunların hiçbiri elimizde değildi.

**Bedeli — açıkça kabul ediliyor:** Kendi e-posta gönderim sağlayıcımız gerekiyor. Supabase'in paylaşımlı SMTP'si yalnızca GoTrue'nun kendi akışlarını tetikliyor; biz link üretip gönderdiğimizde araya girmiyor.

Bu bir ek yük değil, **zaten planlı olan işin öne çekilmesi**: `PLATFORM_SETTINGS.md` bölüm 5, paylaşımlı SMTP'yi "production için uygun değil, spam'e düşmesi olağan" diye kaydediyor ve pilot kuruma açılmadan önce değiştirilmesini şart koşuyor. Seçenekler bölüm 7'de listeli.

**Bağlayıcı sonuç:** E-posta gönderim sağlayıcısı kurulmadan **kurtarma çalışmaz**. Bu nedenle Faz E4'ün ön koşuludur ve gerçek bir kuruma hesap açılmadan önce tamamlanmalıdır.

**E-posta doğrulaması da aynı mekanizmayla:** Kullanıcı adresini girer, `profiles.pending_email` alanına yazılır, ürettiğimiz kodu o adrese göndeririz. Kod geri girilirse adres doğrulanmıştır. Ayrı bir sistem gerekmez ve GoTrue'nun e-posta değiştirme akışına hiç dokunulmaz.

**Alternatifler:**

- **`Secure email change`'i kapatıp auth e-postasını değiştirmek:** Ölçüldü ve reddedildi — numara ölüyor. Yukarıdaki reddedilmiş karara bakın.
- **`admin.updateUserById` ile adresi doğrudan yazmak:** Ölçüldü; çalışıyor ama hiçbir doğrulama üretmiyor ve yine numarayı öldürüyor.
- **Kurtarmayı tamamen kurum yöneticisine bırakmak:** Öğretmen/öğrenci/veli için zaten böyle. Ancak kurum yöneticisinin kendisi için bir üst basamak gerekiyor; aksi halde her unutulan yönetici şifresi geliştirme ekibine geliyor.

**Durum notu (2026-08-28) — karar değişmiyor, aradaki boşluk kayda geçiyor.** E7 canlı koşusunda kurtarma denendi ve çalışmadı; sebebi araştırılınca kararla kod arasında dört açık olduğu görüldü:

1. **`profiles.pending_email` sütunu yok.** Kararın doğrulama mekanizması ("adresini girer, `profiles.pending_email` alanına yazılır") hiç oluşturulmamış bir sütuna dayanıyor. `20260825210000_recovery_contact.sql` yalnızca `phone` ve `recovery_email` ekledi — E4'ün şema yarısı tam değil.
2. ~~**Migration'ın vaat ettiği uyarı arayüzde yok.**~~ — **kapandı (2026-08-29).** Kurtarma kanalı durumu kimliğe taşındı (`recoveryChannel`, `passwordLock` ile aynı üçlü kalıp) ve Ayarlar → Güvenlik'te gösteriliyor; "Bağlantı gönderildi" yalanı da kalktı. Kalan üç madde duruyor. Eski metin: `recovery_contact` migration'ı "bugün sütun her hesapta NULL'dır ve **arayüz bunu 'kurtarma yöntemin yok' uyarısıyla gösterir**" diyor. Göstermiyor. Bunun yerine "Şifremi unuttum" ekranı gönderilmemiş bir bağlantı için **"Bağlantı gönderildi"** diyor (#118). `current_user_has_recovery_channel()` fonksiyonu var ama hiçbir yerden çağrılmıyor.
3. **Ön koşulun sırası fiilen ters döndü.** Karar, e-posta sağlayıcısını "Faz E4'ün ön koşulu, gerçek bir kuruma hesap açılmadan önce tamamlanmalı" diye bağlamıştı. E6 hesap açmayı getirdi ve E7 canlıda koştu; sağlayıcı hâlâ yok. Bugün ihlal değil — açılan hesapların hepsi test kurumunda. **Gerçek bir pilot kuruma geçmeden önce kapatılması gereken şart olarak duruyor.**
4. **Supabase'in SMTP ayarını doldurmak yetmez.** Kararın kendisi söylüyor: paylaşımlı SMTP yalnızca GoTrue'nun kendi akışlarını tetikliyor, biz `generate_link` ile linki kendimiz ürettiğimizde araya girmiyor. Gereken şey, **Edge Function'dan çağrılabilen bir gönderim sağlayıcısıdır**; Supabase panelindeki SMTP alanı yalnızca operatör hesaplarının GoTrue akışını kurtarır, kararın tasarladığı yolu kurtarmaz.

Dördü de kararın **uygulanmamış olmasından** kaynaklanıyor; kararın kendisinde değişen bir şey yok.

---

### Karar: Şifre değiştirme ile sıfırlama ayrı akışlardır; kurtarma kanalı isteğe bağlıdır ama görünürdür

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Toplu kurulumda bir dershaneye 200 öğrenci açılacak. "Herkese hem ilk şifresini hem şifre yenileme kodunu elden vermek süreci uzatır" endişesi doğdu.

Endişe, iki farklı işlemin karıştırılmasından kaynaklanıyordu ve bu ayrım kayda geçmemişti:

| İşlem          | Ne zaman                    | Ne gerektirir                                           |
| -------------- | --------------------------- | ------------------------------------------------------- |
| **Değiştirme** | Mevcut şifreyi biliyorum    | Hiçbir şey — eski şifrenin kendisi kanıt                |
| **Sıfırlama**  | Unuttum, hesaba giremiyorum | Dışarıdan bir kanal: e-posta, SMS veya kurum yöneticisi |

**Karar:**

**1. İlk giriş bir "değiştirme"dir, "sıfırlama" değil.** Kullanıcı geçici şifresiyle girer, `must_change_password` kilidi devreye girer, yeni şifresini belirler. **İletişim bilgisi gerekmez ve ikinci bir kod dağıtılmaz.** Toplu kurulumda kişi başına tek bir fiş vardır.

**2. İletişim bilgisi ilk girişte sorulur ama zorunlu değildir** — kurum yöneticisi hariç; onun için zorunludur (bkz. "Hesaplar davet e-postasıyla değil, doğrudan geçici şifreyle açılır").

Zorunlu yapılamaz: e-postası olmayan öğrenci sisteme hiç giremez hâle gelirdi. Ancak yalnızca "atla" seçeneği sunulursa çoğu kullanıcı atlar ve kurtarma sorunu geri gelir.

**Çözüm: atlanabilir ama kalıcı olarak görünür.** Kurtarma yöntemi olmayan hesap, ayarlar ekranında ve profil alanında sürekli bir uyarı taşır: _"Kurtarma yöntemin yok — şifreni unutursan kurum yöneticine başvurman gerekir."_

**3. Doğrulanmamış adres, kurtarma kanalı sayılmaz.** `ahmet@gmial.com` yazan bir kullanıcının sıfırlama postası bir yabancıya gider. Adres doğrulanana kadar hesap "kurtarma yöntemi yok" kabul edilir ve yukarıdaki uyarı görünmeye devam eder.

**4. Sıfırlama akışı kanal varlığına göre dallanır:**

- Doğrulanmış iletişim bilgisi **varsa** → linki ve 6 haneli kodu biz üretip o adrese göndeririz.
- **Yoksa** → kullanıcı kurum yöneticisine yönlendirilir; yönetici panelden yeni geçici şifre üretir.

**Gerekçe:** Toplu dağıtım tek seferliktir ve zaten kaçınılmazdır — ilk kimlik bilgisi kişiye bir şekilde ulaşmak zorunda. İkinci bir dağıtım turu hiç var olmadığı için asıl endişe ortadan kalkıyor. Sıfırlama ise bireysel ve seyrek bir olaydır; toplu bir yük oluşturmaz.

Kurtarma kanalını zorunlu yapmamak, KVKK'daki veri minimizasyonu ilkesiyle de uyumludur: giriş yapacak her çocuk için e-posta toplamak, ihtiyaç duyulmayan kişisel veri işlemek olurdu.

**Ertelenen fikir — veli üzerinden kurtarma:** Öğrencinin iletişim bilgisi yoksa, bağlı velisinin doğrulanmış adresine gönderilmesi önerildi. Fikir yöneticinin yükünü azaltır ancak iki koşul olmadan uygulanamaz:

1. **Yaş sınırı.** Küçük bir öğrencinin kurtarmasını velisine göndermek doğrudur; veli yasal temsilcidir. **Yetişkin bir kursiyerinkini göndermek değildir.** Zincir ya yaşa bağlanmalı ya da öğrencinin açık onayına dayanmalıdır.
2. **Bağlantının doğrulanmış olması.** Veri girişinde yanlış veli bağlanmışsa kimlik bilgisi yanlış kişiye gider.

`student_guardians` tablosu v1.2'de geldiği için bu karar o sürüme ertelenmiştir.

---

### Karar: Operatör desteği üç katmanlıdır — teşhis, izinli oturum, acil erişim

**Durum:** Alındı
**Tarih:** 2026-08-24
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Platform operatörü kurum içeriğini göremiyor ve bu bilinçli. Ancak geliştirme ekibi biziz: kurumda bir sorun çıktığında bize gelecekler. Hiçbir görüş olmadan sorun çözmek imkânsız veya çok yavaş olur.

**Gözlem — sorunların çoğu kişisel veri görmeyi gerektirmez.** "Öğrenci listesi yüklenmiyor" sorununu teşhis etmek için isimleri görmek gerekmez; kayıt sayıları, hata kayıtları ve ilişki bütünlüğü yeter.

**Karar:** Destek erişimi tek bir anahtar değil, üç katmandır.

**Katman 1 — Teşhis ekranı (kişisel veri yok).** Platform panelinde kurum başına yapısal görünüm: kayıt sayıları, son işlem zamanı, hata kayıtları, şema tutarsızlıkları. Hiçbir kişi adı, notu, yoklaması veya ödemesi görünmez. KVKK sınırına dokunmaz, izin gerektirmez, her zaman açıktır.

**Katman 2 — Destek oturumu (kurumun izniyle).** Kurum yöneticisi kendi panelinden "geliştirme ekibine erişim ver" der. Oturum **süre sınırlıdır** ve kendiliğinden kapanır; her okuma denetim kaydına yazılır; yönetici ne yapıldığını görebilir.

Erişim **salt okunurdur.** Sorunların neredeyse tamamı okumayla teşhis edilir; yazma yetkisi riski katlar ve "verimizi siz mi sildiniz" tartışmasına kapı açar. Düzeltme gerekiyorsa ya kurum yöneticisi uygular ya da ayrı bir migration ile yapılır.

**Katman 3 — Acil erişim.** Kurum yöneticisi kilitlendiyse izin verecek kimse kalmaz. Operatör bu durumda erişimi kendisi açabilir, ancak:

- **Gerekçe yazmak zorunludur** ve gerekçe denetim kaydına girer.
- Süre kısadır ve uzatılamaz; uzatma yeni bir kayıt üretir.
- Kurumdaki **tüm yöneticilere bildirim gider.**

**Gerekçe:** KVKK çerçevesinde kurum veri sorumlusu, ORBIT veri işleyendir. Veri işleyenin, sorumlunun talimatıyla erişmesi beklenen ve meşru olandır — Katman 2 tam olarak budur. Katman 3 ise inkâr edilen bir yetki değil, **görünür kılınmış** bir yetkidir; gizli bir arka kapıdan çok daha güvenlidir.

Bu karar, `PROJECT_STATE.md` bölüm 10'daki düzeltilmiş taahhüdün somut hâlidir: _"operatör ürün üzerinden içerik okuyamaz; yetki yükseltebilir, her yükseltme kayda geçer ve bildirilir."_

**Sıra:** Katman 1 Faz E4'te yapılabilir; kişisel veriye dokunmadığı için iş tablolarını beklemez. Katman 2 ve 3, RLS koşulları iş tablolarına yazılacağı için **v1.2 sonrasına** aittir.

**Alternatifler:**

- **Operatöre kalıcı okuma yetkisi vermek:** En kolayı. Reddedildi; "operatör kapları yönetir, içeriği görmez" taahhüdünü tamamen ortadan kaldırır ve kuruma satış yaparken savunulamaz.
- **Hiçbir erişim vermemek:** Bugünkü durum. İşlemez; her sorun için kurumdan ekran görüntüsü istemek zorunda kalırız.
- **Destek oturumunda yazma yetkisi de vermek:** Reddedildi; teşhis için gereksiz, sorumluluk açısından risklidir.

---

### Karar: Rol, atama ve bağlantı üç ayrı kavramdır

**Durum:** Alındı
**Tarih:** 2026-08-25
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** "Bir kişinin bir kurumda tek üyeliği olur" kısıtı konduktan sonra doğal soru geldi: **peki bir kişinin aynı kurumda iki yetkisi olursa ne olacak?**

Soru gerçek durumlara dayanıyor ve üçü de sahada yaygın:

1. Küçük bir dershanenin sahibi hem yönetiyor hem ders veriyor.
2. Çocuğu aynı dershanede okuyan bir öğretmen.
3. Alt sınıflara ders veren 12. sınıf öğrencisi.

İnceleme, bugünkü `app_role` enum'unun (`admin`/`teacher`/`student`/`parent`) **üç farklı kavramı tek kutuya koyduğunu** gösterdi.

**Karar:** Üç kavram ayrılır ve karıştırılmaz.

| Kavram       | Ne belirtir                    | Nerede yaşar                                     |
| ------------ | ------------------------------ | ------------------------------------------------ |
| **Rol**      | Kişinin kurumdaki temel işlevi | `organization_memberships.role`                  |
| **Atama**    | Hangi sınıf/ders/şube onun     | Ayrı atama tabloları (v1.2)                      |
| **Bağlantı** | Kime bağlı olduğu              | `student_guardians` gibi ilişki tabloları (v1.2) |

Bu ayrımın üç somut sonucu var:

**1. Ders vermek bir atama, rol değil.** Yönetici aynı zamanda ders verebilir; rolü `admin` kalır, hangi sınıfların onun olduğu atama kaydından gelir. `admin` yetkileri `teacher` yetkilerini zaten kapsar. İkinci bir üyelik gerekmez.

**2. `parent` bir rol OLARAK KALIR, ama kapsamı bağlantıdan gelir.** Rol hangi panelin açılacağını belirler; hangi öğrencinin görüleceğini `student_guardians` bağlantısı belirler.

> **Sonradan düzeltme (2026-08-25):** Bu madde ilk yazımında _"`parent` rol olmaktan çıkarılır"_ diyordu. Gerekçe, öğretmen-veli durumunun tek hesapla ifade edilememesiydi.
>
> Arda Bülent daha basit bir çözüm gösterdi: **birden fazla rolü olan kişi için ikinci bir hesap.** O zaman `parent`'ın rol olarak kalmasında hiçbir sakınca yok ve v1.2'den bir şema değişikliği eksiliyor. Enum'dan çıkarma önerisi, ikinci hesabın daha basit çözdüğü bir soruna karşı fazladan karmaşıklıktı.

> ⚠️ **Yönetici-veli durumunda çıkar çatışması vardır.** Yönetici hem notu/yoklamayı düzenleyebilen kişi hem de o öğrencinin velisidir; kendi çocuğunun kaydını değiştirebilir. Bu **teknik bir açık değildir** — yönetici zaten her öğrencinin kaydını değiştirebilir — ancak sonucu ağırdır ve fark edilmesi güçtür.
>
> Karşılığı erişimi kısıtlamak değil, **izlenebilirlik**tir: not, yoklama ve ödeme değişiklikleri kurumun kendi denetim kaydına yazılmalı ve kaydın kim tarafından yapıldığı görünmelidir. v1.4'te CRUD akışları yazılırken bu kayıtlar atlanamaz.
>
> Erişimi kısıtlamak — "yönetici kendi çocuğunun notunu düzenleyemesin" — bilinçli olarak reddedilmiştir: tek yöneticili küçük bir kurumda o öğrencinin notunu girecek başka kimse olmayabilir ve sistem kullanılamaz hâle gelir.

**3. Birden fazla rol gerektiren HER durumda kurum ikinci hesap açar.** Öğretmen-veli, yönetici-veli, öğrenci-asistan — hepsinde aynı yol.

Her hesabın kendi rolü ve kendi yetkisi vardır. Veli hesabı gerçekten velidir; tüm öğrencileri göremez, çünkü yetkisi yoktur. Yönetici hesabı ayrıdır. Yeni bir yetki mantığı gerekmez — her rolün paneli zaten var.

**Gerekçe:** İlk iki durum **rol sorunu değildi**; öyle görünmelerinin sebebi enum'un üç kavramı birleştirmesiydi. Doğru modellendiklerinde tek hesapla çözülüyorlar ve ikinci hesaba hiç gerek kalmıyor.

Üçüncü durum gerçekten iki roldür ve nadirdir. Nadir bir durum için rol kümesi, rol hiyerarşisi veya çoklu üyelik gibi kalıcı bir karmaşıklık taşımak, her RLS politikasını ve her kimlik çözümlemesini etkiler — bedeli faydasından büyüktür. İkinci hesap, kararı kuruma bırakır ve sistemde hiçbir iz bırakmaz.

**İkinci hesabın bedeli — açıkça kabul ediliyor:**

- Kişi iki giriş numarası taşır ve hangisinin ne olduğunu hatırlamak zorundadır.
- Verisi bölünür; iki hesap arasında hiçbir bağ yoktur.
- **KVKK:** aynı veri sahibinin iki kaydı olur. "Verilerimi sil" talebinde tüm hesapların bulunması gerekir; eksik silme riski doğar. Silme akışı yazılırken (v2.0) bu ihtimal hesaba katılmalıdır.

Bu bedel, **yalnızca üçüncü durum için** kabul ediliyor. İlk iki durumda ikinci hesap açmak yanlış olur: öğretmen-veli iki hesapla günde birkaç kez çıkış-giriş yapmak zorunda kalır ve pratikte veli hesabını hiç kullanmaz.

**Hesaplar arası geçiş düğmesi.**

Birden fazla rolü olan kişi, rolü kadar hesaba sahiptir. Her giriş-çıkışta şifre yazmak günlük kullanımda katlanılabilir değil; bu yüzden sağ üstte hesaplar arası geçiş düğmeleri bulunur.

**Hangi düğmelerin görüneceği kişinin gerçekten sahip olduğu hesaplardan türetilir.** Sabit bir liste veya sabit bir sayı yoktur. Örnekler — tamamı değil:

| Kişi                       | Görünen düğmeler                         |
| -------------------------- | ---------------------------------------- |
| Yalnızca öğretmen          | **Hiçbiri** — bileşen hiç render edilmez |
| Yönetici + veli            | `Yönetici` · `Veli` — öğretmen görünmez  |
| Öğretmen + veli            | `Öğretmen` · `Veli`                      |
| Yönetici + öğretmen + veli | Üçü birden                               |

**Bu bir şablon değil, bir sistemdir.** İki tasarım kuralı bağlayıcıdır:

1. **Hesap sayısı sınırsızdır.** İkili geçiş (toggle) olarak yazılmaz; N hesap üzerinden döner. Bugün en fazla üç rol var, yarın dört olabilir.
2. **Roller kodda sabitlenmez.** Düğme, kişinin hesaplarında hangi rol varsa onu gösterir; rol isimlerini kendisi bilmez. İleride `muhasebeci` gibi yeni bir rol eklendiğinde — ve o kişi aynı zamanda veli olduğunda — geçiş bileşenine **tek satır** dokunulmaz.

İkinci kural, roller büyüdükçe her yeni rolde aynı bileşeni düzenlemek zorunda kalmamak içindir. Rol listesini bileşene gömmek, bugün üç satırlık bir kolaylık, altı ay sonra unutulacak bir bakım borcudur.

**Bu düğme yeni bir yetki mantığı getirmez.** Her hesabın rolü ve yetkisi zaten kendindedir; veli hesabı tüm öğrencileri göremez çünkü yetkisi yoktur. Düğme yalnızca çıkış-giriş zahmetini kaldırır. Rollerin panelleri de zaten mevcuttur.

**Geçiş şifre sormaz.** Sorması daha güvenli olurdu ancak günde birkaç kez şifre yazmak kimsenin katlanacağı şey değildir; pratikte düğme kullanılmaz ve kişi tek hesapta kalır. Ortak bilgisayar riskini hareketsizlik sayacı karşılıyor.

**Bağlayıcı sonuç — sayaç tüm oturumları birden kapatır.** Şifresiz geçiş, iki oturumun aynı anda saklanması demektir. Hareketsizlik sayacı yalnızca aktif oturumu kapatırsa diğeri açık kalır ve sayacın var olma sebebi ortadan kalkar.

> **Zemin değişti (2026-08-29) — karar geçerli, dayandığı varsayım değil.**
>
> Yukarıdaki iki paragraf, oturumun `localStorage`'da saklandığı bir dünyada yazıldı. O gün "iki oturum aynı anda saklanır" demek, **tarayıcı genelinde** iki oturum demekti; "sayaç tüm oturumları kapatır" da tek bir depoyu temizlemek anlamına geliyordu.
>
> E7.2-A (#132) oturumu `sessionStorage`'a taşıdı: artık **her sekme kendi oturumunu** taşıyor ve sekme kapanınca oturum bitiyor. Sebebi ayrıydı ve çoklu hesapla ilgisi yoktu — paylaşılan dershane bilgisayarında ikinci sekme açan herkes öncekinin oturumuna düşüyordu.
>
> Kararın kendisi ayakta: geçiş şifre sormaz, sayaç tüm oturumları kapatır, hesaplar kişi kaydına bağlanır. Değişen, bunların **nasıl uygulanacağı**:
>
> - "İki oturumu aynı anda saklamak" artık sekme başına bir sorundur. `sessionStorage` sekmeler arasında paylaşılmadığı için, A sekmesinde yönetici B sekmesinde veli olmak **kendiliğinden** mümkün — ama aynı sekmede iki oturumu tutmak için jetonların uygulama tarafından yönetilmesi gerekir.
> - "Sayacın tüm oturumları kapatması" tek bir anahtarı silmekle olmaz. Sekme başına ayrılmış oturumlarda bu, sekmeler arası bir sinyal (`BroadcastChannel` ya da `storage` olayı) gerektirir.
> - `orbit:last-activity` de `sessionStorage`'a taşındı; sayaç artık sekme başına işliyor.
>
> **v1.3 tasarlanırken bu paragraf başlangıç noktasıdır**, yukarıdaki iki paragraf değil. Not, kararı geçersiz kılmak için değil, altı ay sonra "neden çalışmıyor" sorusunun cevabının kayıp olmaması için düşülmüştür (**K-06**).

**Hesaplar bir kişi kaydına bağlanır — ikili bağ olarak DEĞİL.** "Bu kişinin diğer hesapları hangileri" sorusunun cevabı bir yerde durmak zorunda; düğmenin çalışması için zaten gerekli.

Modelleme biçimi önemli: hesaptan hesaba işaret eden bir alan (`linked_account_id`) iki hesapta çalışır, **üçte kırılır** — üç hesabın hangi ikisinin bağlanacağı belirsizdir ve zincir kopabilir. Doğrusu **hesapların ait olduğu bir kişi kaydı**: N hesap aynı kişiye bağlanır, kaç tane olduğu fark etmez.

Aynı kayıt KVKK açısından da gerekli: aksi halde bir insanın birden fazla kaydı olur, aralarında hiçbir bağ bulunmaz ve "verilerimi sil" talebinde biri gözden kaçabilir.

**Uygulama sırası:**

- **Bugün geçerli:** bir kişi, bir kurumda, bir üyelik, bir kod, bir numara (Issue #65 ile şemada zorlanıyor).
- **v1.2:** `student_guardians` bağlantısı ve öğretmen-sınıf/ders atamaları. `parent` enum değeri **kalır**; kaldırılması gerekmiyor (yukarıdaki düzeltmeye bakın).
- **v1.3:** Hesaplar arası geçiş düğmesi ve kişi kaydı. Hareketsizlik sayacının tüm oturumları kapatacak biçimde genişletilmesi aynı işin parçasıdır.
- **v2.0:** hesap silme/anonimleştirme akışında çoklu hesap ihtimali.

**Alternatifler:**

- **Rol kümesi (`role[]`) veya rol hiyerarşisi:** Her RLS politikası "bu kişinin rollerinden herhangi biri" sorusunu sormak zorunda kalırdı. Politikaların tamamını karmaşıklaştırır ve bugün gerçek karşılığı olmayan bir esneklik için ödenir.
- **Kişi başına çoklu üyelik:** Denendi ve geri alındı (Issue #65). `person_code` üyelikte durduğu için iki üyelik iki giriş numarası üretiyor, ancak auth hesabı tek olduğundan numaralardan biri hiçbir hesaba karşılık gelmiyordu.
- **Her durumda ikinci hesap:** Kullanıcının önerisinin genel hâli. Reddedildi: öğretmen-veli günlük bir durum ve iki hesapla kullanılamaz hâle gelir.

---

### Karar: Belge sayısı değil bakım borcu — tek giriş noktası kuruldu, iki dosya emekliye ayrıldı

**Durum:** Alındı
**Tarih:** 2026-08-25
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Belge denetimi (Issue #77) beş sorun buldu. `PROJECT_ARCHITECT.md` §00'da "Zorunlu Davranış" başlıklı bir aktivasyon protokolü taşıyordu ve dosyayı okuyan her YZ ajanına keşif mülakatı başlatmasını söylüyordu — proje v1.1.2'deyken. Aynı dosya §01 ve §05'te `AGENT_WORKFLOW.md` ile doğrudan çelişen bir akış tarif ediyordu (ajan branch açar, commit atar, `.ai/` yazar). `WORK_LOG.md` 28 commit boyunca hiç güncellenmemişti. `ROADMAP.md` §0 — çalışma düzeninin tek bağlam çıpası olarak gösterdiği tablo — Faz E'yi "başlanmadı" gösteriyordu, oysa E0–E3 production'daydı. Klasör ağacı iki dosyada ayrı ayrı yaşıyor ve README'deki kopya `auth/` ile `platform/` dizinlerini hiç bilmiyordu. Git kuralları üç yerde yazılıydı ve ikisi çelişiyordu.

**Karar:**

1. `PROJECT_ARCHITECT.md` ve `.ai/WORK_LOG.md` repodan kaldırıldı. Yaşayan kuralları hedef dosyalara taşındı; geçmişleri git'te duruyor.
2. Kökte tek giriş noktası olarak `AGENTS.md` kuruldu. İçeriği **yönlendirmedir**: hangi soru için hangi dosya okunur.
3. Yinelenen içerik tek kaynağa indirildi. Klasör ağacı yalnızca `PROJECT_STATE.md` §5'te, git kuralları yalnızca `CONTRIBUTING.md`'de yaşar.
4. Belge güncellemesi `AGENT_WORKFLOW.md`'deki döngünün kapanış adımına bağlandı.

**Gerekçe:** Sorun belge sayısı değildi. Beş `.ai/` dosyasının her birinin ayrı bir sorusu var ve hepsini tek dosyada birleştirmek 2100 satırlık bir belge üretirdi — o zaman her ajan her soru için hepsini yüklemek zorunda kalırdı. Eksik olan şey daha az dosya değil, **tek bir kapıydı**; repoda `AGENTS.md` da `CLAUDE.md` de yoktu, dolayısıyla hiçbir ajan nereden başlayacağını bilmiyordu ve kökteki en büyük harfli dosya onları yanlış yere çağırıyordu.

Asıl kök neden bakım borcuydu: **hiçbir dosyayı güncellemek iş akışının bir adımı değildi.** Döngü commit, PR ve production ile bitiyordu; belge güncellemesi kimsenin adımı olmadığı için herkesin iyi niyetine kalıyor ve ilk düşen, en çok yazı isteyip en az karar taşıyan dosya oluyordu. Bu yüzden düzeltmenin kalıcı olan kısmı silinen dosyalar değil, kapanış adımına eklenen güncelleme yükümlülüğüdür.

**Neden `AGENTS.md`:** Codex bu adı kendiliğinden okur ve aktivasyon tuzağına düşme riski en yüksek ajan odur. `CLAUDE.md` ikinci bir kopya olurdu; ikinci kopya, bu kararın kapatmaya çalıştığı kaymanın ta kendisidir.

**Alternatifler:**

- **Her şeyi tek bir büyük dosyada birleştirmek:** Reddedildi. Seçmeli okumayı yok eder; en ucuz sorunun bedelini en pahalı hâle getirir.
- **`PROJECT_ARCHITECT.md`'yi yerinde bırakıp başına "uygulanmaz" notu koymak:** Reddedildi. §04'teki eskimiş `ci.yml` kopyası ve çelişen akış tarifi dosyada kalmaya devam ederdi; bir ajanın notu okuyup gerisini yok sayacağına güvenmek, bu projede zaten bir kez başarısız olmuş bir bahistir.
- **`WORK_LOG.md`'yi kısaltıp canlandırmak:** Reddedildi. Taşıdığı bilgi zaten `git log`, `DECISION_LOG.md` ve `PLATFORM_SETTINGS.md`'de yaşıyor; kaldırmadan önce tek tek doğrulandı (`ALLOW-DESTRUCTIVE` kaçış yolu workflow'un içinde, KVKK "kap/içerik" sınırı bu dosyada, lodash override'ı `package.json`'da). Uyulmayan bir kuralı üçüncü kez yazmak onu kural yapmaz.

---

### Karar: Kilit bayrağı üç durumludur — "okunamadı" ile "değiştirmelisin" aynı ekran değildir

**Durum:** Alındı
**Tarih:** 2026-08-26
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Production denemesinde (Issue #102) bir operatör, veritabanında `must_change_password = false` olmasına rağmen şifre değiştirme ekranıyla karşılaştı ve şifresini gereksiz yere değiştirmeye yönlendirildi. Kök neden `authService.ts`'te bilinçli olarak bırakılmış bir satırdı:

```ts
mustChangePassword: profileResult.data ? profileResult.data.must_change_password : true,
```

Karar doğruydu — bilinmeyen bir güvenlik durumunda kilitli tarafta kalmak K-04'tür. Yanlış olan sunumdu. Profil okuması geçici olarak başarısız olduğunda (ağ dalgalanması, soğuk başlangıç) istemci kilidi varsayıyor, kullanıcı da ekranda "şifrenizi değiştirmelisiniz" cümlesini okuyordu. Aynı anda panel verisi de yüklenemediği için tek bir geçici hata iki ayrı belirti üretiyordu ve kullanıcı hangisinin sebep hangisinin sonuç olduğunu göremiyordu.

Boolean alan üç ayrı olguyu tek kutuya topluyordu: **kilit var** · **okuma hata verdi** · **profil satırı yok**.

**Karar:**

1. `AuthIdentity.mustChangePassword: boolean` kaldırıldı; yerine `passwordLock: "required" | "clear" | "unresolved"` geçti.
2. `unresolved` durumu **panele girdirmez** — K-04 aynen korunur. Değişen tek şey, `required` ile aynı ekranı ve aynı metni paylaşmamasıdır.
3. `unresolved` kendi ekranına sahiptir: `ProfileUnavailableScreen` — "Bilgileriniz okunamadı", bir **tekrar dene** düğmesi ve çıkış bağlantısı. Şifreden hiç söz etmez.
4. Profil okuması hata alırsa 300 ms sonra **bir kez sessizce** yeniden denenir. Yeniden deneme yalnızca `error` durumunda çalışır; satırın boş dönmesi geçici bir arıza değildir.
5. Ekranda selamlama yoktur. Profil okunamadığında görünen ad sentetik e-postadan türetilir; okunamayan veriyi uydurulmuş bir isimle göstermek K-03 ihlalidir.

**Gerekçe:** Fail-closed kalmak, kullanıcıya sebebini yanlış söylemeyi haklı çıkarmaz. Güvenlik kararı ile kullanıcıya kurulan cümle iki ayrı şeydir; birincisi doğru olduğu için ikincisi denetlenmeden kalmıştı.

Üçlü alanın boolean'a tercih edilmesinin sebebi diff büyüklüğü değil, hatanın cinsidir: bu bir "çağrı noktası bilinmeyeni yanlış yorumladı" hatasıdır. Tek alanı üçe çıkarmak, üç çağrı noktasının da yeni durumu ele almasını **derleme zamanında** zorunlu kılar; unutmak mümkün değildir.

Gecikmesiz bir yeniden deneme bilinçli olarak reddedildi: aynı milisaniyede aynı hataya çarpar. 300 ms yalnızca hata yolunda ödenir ve issue'daki belirti — kullanıcının ancak üçüncü denemede düzelen oturumu — tam olarak bağlantının toparlanmasına pay bırakılmasını gerektiriyordu.

**Alternatifler:**

- **Boolean'ı koruyup yanına `profileResolved: boolean` eklemek:** Reddedildi. İki boolean üç durumu kodlar ve dördüncü, anlamsız bir kombinasyonu tip düzeyinde mümkün bırakır. Daha önemlisi mevcut çağrı noktaları derlenmeye devam eder — yani yeni alanı okumayı unutan yer bugünkü hatayı sessizce sürdürür. K-06'nın ısırdığı kalıbın aynısı.
- **Profil okunamazsa `loadAuthenticatedIdentity`'nin hata fırlatması:** Reddedildi. Geçerli oturumu olan kullanıcı tek bir ağ dalgalanmasında dışarı atılırdı — bugünkünden daha sert, üstelik tekrar deneme imkânı da kaybolurdu. Belirtiyi çözmez, yerini değiştirir.
- **`ForcePasswordChangeScreen`'e üçüncü bir dal eklemek:** Reddedildi. Ekran zaten "süresi doldu" dalını taşıyor; üçüncüsü dosyayı üç ilgisiz kaygının ortak evi yapardı. Yeni ekran kendi dosyasına gitti.
- **Boş profil satırına ayrı bir metin yazmak:** Reddedildi (bugünlük). Eksik kurulmuş bir hesapta "tekrar dene" hiçbir zaman işe yaramaz, ancak dördüncü bir durum taşımanın bedeli bugün karşılığını bulmuyor; ortak metin "sorun sürerse kurum yöneticinize başvurun" diyerek ikisini de dürüstçe karşılıyor.

**Kapsam dışı bırakıldı:** Panel verisinin aynı anda yüklenememesi (`loadOrganizations`). Kök neden ortaktır ama issue'nun istediği düzeltme kilit ekranıdır; ayrı ele alınacak.

---

### Karar: `service_role` taşıyan sınır SQL'de durur, TypeScript'te değil

**Durum:** Alındı
**Tarih:** 2026-08-26
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `create-member` (#106), kurum yöneticisinin öğretmen/öğrenci/veli hesabı açmasının sunucu yarısı. Fonksiyon `service_role` anahtarıyla çalışıyor ve o anahtar RLS'i baypas ediyor — yani "bu kişi bu kurumun yöneticisi mi" sorusu **hiçbir politikadan geçmiyor.** Aynı durum `reset-member-password`'de de vardı ve orada yetki kararı `internal_resolve_member_for_reset` içine konmuştu.

**Karar:** `service_role` ile çalışan bir Edge Function'ın yetki kararı **`SECURITY DEFINER` bir SQL fonksiyonunda** yaşar ve pgTAP ile test edilir. Fonksiyonun TypeScript tarafı yalnızca sırayı yürütür.

Bunun üç somut karşılığı `create-member`'da uygulandı:

1. **İki RPC de çağıranı ayrı ayrı doğrular.** İkisi ayrı HTTP çağrısıdır; ikincisinin "birincisi zaten baktı" varsayımına dayanması, onu sınır olmaktan çıkarır.
2. **Yetkisiz çağırana hata değil, boş sonuç döner.** Bulunamayan yetki, askıya alınmış yönetici ve başka kurumun şubesi aynı boş sonucu verir. Ayırt edilebilselerdi çağıran taraf deneme yanılmayla hangi şubelerin var olduğunu öğrenebilirdi.
3. **Hedef kullanıcı da kısıtlanır.** `internal_create_membership`, herhangi bir kurumda üyeliği olan bir kullanıcıyı reddeder ve `admin` rolünü yazmaz. İkisi de "çağıran fonksiyon doğru davranıyor" varsayımını ortadan kaldırmak içindir; ilki olmasaydı fonksiyon var olan birini çağıranın kurumuna bağlayıp görünen adını sessizce değiştirebilirdi.

**Gerekçe:** Bir sınırın sınır olması, yanlış tarafından zorlanabilmesine bağlıdır. RLS politikaları bu güvenceyi veritabanının kendisinden alır; `service_role` onu kaldırdığı anda geriye yalnızca çağıran kodun iyi niyeti kalır. SQL'e taşındığında sınır yeniden **çalıştırılabilir bir kontrole** dönüşür — `create_member.test.sql` bugün 16 iddiayla tam olarak bunu yapıyor.

**İkinci karar — kopyalar tek kaynağa indirildi.** Dört Edge Function'ın dördünde de CORS yüzeyi, üçünde geçici şifre üreticisi ve ömür sabiti, ikisinde sentetik e-posta alan adı ayrı ayrı yazılıydı. `supabase/functions/_shared/` kuruldu ve 351 satır kopya silindi.

Origin listesi bunlar arasında en kritik olanıydı: dört kopya demek, birine eklenen bir adresin diğer üçünde eksik kalması ve boşluğun yalnızca o fonksiyon çağrıldığında görünmesi demektir. Birleştirmeden önce dört kopyanın varsayılan listeleri ve izin verilen yöntemleri karşılaştırıldı; hepsi aynıydı, dolayısıyla taşıma hiçbir fonksiyonun davranışını değiştirmedi.

Sentetik e-posta alan adı ayrı bir modüle kondu çünkü **derleyicinin göremediği bir ikizi var**: `client/src/auth/loginIdentifier.ts` giriş numarasını bu adresten çözüyor. İki derleme hedefi tek dosyayı paylaşamıyor, bu yüzden bağımlılık yorumla yazıldı. İkisi sapsaydı açılan hesaplar giriş yapamaz ve sebebi hiçbir yerde görünmezdi.

**Alternatifler:**

- **Yetki kararını Edge Function'ın TypeScript'inde tutmak:** Reddedildi. Okunması daha kolay olurdu ama test edilebilir tek yolu fonksiyonu ayağa kaldırmaktır; repoda Deno testi yok ve kalite kapısının beş komutu Deno kodunu hiç çalıştırmıyor. Sınır, kapının göremediği bir yerde duramaz.
- **Tek bir RPC:** Reddedildi, teknik olarak mümkün değil. Sentetik adres giriş numarasını içeriyor, numara `person_code`'a muhtaç, auth kullanıcısı ise üyeliğin foreign key'i. Düğüm ancak "önce tahsis, sonra kullanıcı, sonra üyelik" sırasıyla çözülüyor — `bootstrap-organization` da aynı sebeple ikiye bölünmüştü.
- **`admin` rolünü yalnızca Zod şemasında engellemek:** Reddedildi. Şema girdiyi doğrular, sınırı kurmaz; SQL'in izin verdiği bir şey er ya da geç yazılır.
- **`_shared/` yerine dördüncü kopya:** Reddedildi. Kopyanın tehlikesi zaten kodun kendi yorumunda yazılıydı ve yazmak yetmemişti.

**Kapsam dışı bırakıldı:** İki RPC arasında `person_code` yarışı mümkün — tahsis ile ekleme ayrı işlemler ve advisory lock arada bırakılıyor. `organization_memberships_org_person_code_idx` benzersiz indeksi yakalıyor; ikinci istek hata alır ve yaratılan kullanıcı geri alınır. Sonuç güvenli tarafta olduğu için bilinçli olarak bırakıldı.

---

### Karar: Silme koruması korunacakları değil, korunmayacakları sayar

**Durum:** Alındı
**Tarih:** 2026-09-02
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `internal_delete_organization` (Issue #150), 2026-08-29 denetiminin bulgusu. Fonksiyon bir olaydan sonra yazılmış ve **kimliği** koruyordu: kurum silinirken platform operatörünün auth hesabı yok olmuştu. Kurumun **verisi** ise koşulsuz siliniyordu ve bu bugüne kadar zararsızdı — `students`, `classes`, `attendance`, `exams`, `payments` tablolarının hiçbiri yok, yani "dolu kurum" diye bir şey mümkün değildi. v1.2 o tabloları eklediği anda aynı düğme, aynı yerde, geri alınamaz bir veri kaybı yoluna dönüşüyordu.

Yol haritası düzeltmeyi zaten yazmıştı — _"kurumda öğrenci/sınıf/not/ödeme kaydı varsa reddetmelidir"_ — ama issue asıl sorunu başka bir yere koyuyordu: **"İki iş arasında bugün hiçbir bağ yok."** v1.2'yi yazan kişinin her yeni tabloda bu fonksiyona dönmeyi hatırlaması gerekiyordu.

**Karar:** Koruma, korunacak tabloları saymaz; **korunmayacakları** sayar. `public` şemasında `organization_id` sütunu taşıyan her tablo içerik kabul edilir ve doluysa silme reddedilir. İstisna listesi dört yapısal tablodur: `branches`, `organization_memberships`, `audit_events` (kurumla birlikte silinir) ve `platform_audit_events` (kurumla birlikte silinmez, `organization_id` NULL'a düşer).

Red, `ORB01` SQLSTATE'i ile durur; engelleyen tablo ve satır sayısı `detail` alanında taşınır ve operatöre olduğu gibi gösterilir. Reddin kendi denetim kaydını Edge Function yazar (`platform.organization_delete_refused`), çünkü exception işlemi geri sarar ve fonksiyonun içinden yazılan hiçbir satır kalmaz.

**Gerekçe:** Bu projede hatırlamaya bırakılan adım üç kez atlandı; K-08 tam olarak bunun için yazıldı. Sabit bir tablo listesi bugün **boş** olurdu — korunacak hiçbir tablo yok — ve boş bir liste, hiç yazılmamış bir korumadan ayırt edilemez. Ters çevrilmiş liste ise v1.2'nin ilk tablosunu eklendiği gün, kimse bir şey yazmadan kapsar.

Bu K-04'ün ("bilinmeyende güvenli tarafta kal") şema seviyesindeki karşılığıdır: **bilinmeyen tablo, korunan tablodur.**

Ödenen bedel bilinçli ve tersi tercih edilir: gerçekten kurumla birlikte silinmesi gereken yeni bir tablo eklendiğinde birileri istisna listesini düzenlemek zorunda kalır. Unutmanın sonucu artık veri kaybı değil, açıkça reddedilen bir silme.

**Sınır — dürüstçe kayda geçiyor:** koruma yalnızca `organization_id` sütununa bakar. Kuruma dolaylı bağlanan bir tablo (yalnızca `class_id` taşıyan bir `class_enrollments` gibi) doğrudan görülmez; pratikte kapsanır, çünkü böyle bir kayıt ancak `classes` doluyken var olabilir. Yine de v1.2'nin her dilimi şunu beyan etmelidir: **kuruma ait her tablo `organization_id` taşır.** Taşımayan bir tablo yalnızca bu korumayı değil, tenant modelinin tamamını deler.

**Koşullu kısım — K-12 gereği sahibi yazılıyor.** Bugün dolu bir kurumu silmenin **hiçbir yolu yok**; koruma mutlak. Bu bilinçli: gerçek öğrenci verisi taşıyan bir kurumun tek çağrıyla yok edilebilmesi, çözdüğünden çok sorun üretir. Ama KVKK'nın silme hakkı er ya da geç bir yol gerektirecek. **Şart:** ilk gerçek kurum verisi girdikten sonra bir silme/anonimleştirme talebi geldiğinde. **Kontrol edecek adım:** `v2.0-01` (hesap silme ve anonimleştirme) diliminin açılışı. **Yapılacak iş:** kaldırma yolunu ayrı bir yetki ve ayrı bir denetim kaydıyla tasarlamak — bu fonksiyonun korumasını gevşetmek değil.

**Alternatifler:**

- **Sabit tablo listesi (`students`, `classes`, `exams`, …):** Reddedildi. Bariz çözümdü ve bugün yazılamazdı: tabloların hiçbiri yok. Yazılabilseydi bile her yeni tabloda hatırlamaya dayanırdı — issue'nun şikâyet ettiği şeyin ta kendisi.
- **pgTAP ile sürüklenme testi (yeni tablo eklendiğinde CI kırmızıya dönsün):** Reddedildi. Sabit listeden iyidir ama alarm **tablo eklendikten sonra** çalar ve birinin doğru tepkiyi vermesine bağlıdır. Ayrıca listeye tablo eklemekle sayım kontrolünü eklemek iki ayrı iştir; birincisi yapılıp ikincisi atlanabilir.
- **Foreign key'leri `on delete restrict` yapmakla yetinmek:** Reddedildi. Mevcut tablolar zaten öyle ve bu bir dereceye kadar korur — ama koruma tablo tasarımcısının tercihine kalır. `on delete cascade` yazan bir dilim, sessizce veri kaybeder ve hiçbir hata görünmez. Üstelik FK ihlali operatöre "silinemedi" der, **neden** silinemediğini söylemez.
- **Reddetmek yerine zorlama (`force`) parametresi eklemek:** Reddedildi (bugünlük). Yol haritası "reddetmelidir" diyor ve bir kaçış yolu, alışkanlığın oturduğu yerdir — geri alınamaz bir işlemde ilk denemede reddedilmek, ikinci denemede onaylamaktan daha değerlidir. Gerçek kaldırma ihtiyacı yukarıdaki K-12 maddesinde sahiplendirildi.
- **Reddedilen denemeyi hiç kaydetmemek:** Reddedildi. Bu, geri alınamaz bir veri kaybına kıl payı kalmış bir denemedir; iz bırakmazsa hiçbir yerde görünmez.

**Kapsam dışı bırakıldı:** Silme onay ekranındaki sayılar (`platform_organization_stats`) hâlâ yalnızca üyelik, şube ve denetim kaydı sayıyor. Yeni bir iş tablosu o görünüme eklenmezse operatör "boş" görünen bir kurumu silmeye çalışır ve reddedilir — şaşırtıcı ama zararsız. Görünümü genişletmek her v1.2 diliminin isteğe bağlı işidir; **korumanın doğruluğu ona bağlı değildir** ve bu ayrım bilinçli kuruldu.

---

### Karar: Kimlik jeton değişince tazelenir, kullanıcı değişince değil

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `AuthProvider` kimliği iki ayrı yoldan çözüyordu — açılışta `supabase.auth.getSession()`, ve `onAuthStateChange` abonelik kurulurken auth-js'in ürettiği `INITIAL_SESSION` olayı. İkisi de aynı beş tabloyu okuyordu; canlı ağ trafiğinde ölçüldü, tek bir sayfa yenilemesi **beş sorgu yerine on istek** üretiyordu (#145). Aynı çift okuma girişte de vardı: `signIn` kimliği kendisi okuyor, ardından `SIGNED_IN` olayı aynı işi tekrarlıyordu.

**Karar:** Açılış tek yola indirildi — `getSession()` kaldırıldı, kimlik yalnızca olay akışından çözülüyor. Tekrarı engelleyen koruma **erişim jetonuyla** anahtarlanıyor: aynı jeton için kimlik ikinci kez okunmaz.

**Gerekçe — ölçütün kullanıcı olMAMASI bir zorunluluktur.** Sezgisel olan "aynı kullanıcı → atla" idi ve **sessiz bir gerileme** üretirdi: zorunlu ilk şifre değişiminden sonra `completeRequiredPasswordChange` kimliği bilerek yeniden okuyor, çünkü `must_change_password` bayrağını veritabanı tetikleyicisi düşürüyor ve düşmüş bayrağı görmenin tek yolu yeniden okumaktır. Kullanıcı ölçütü o okumayı engeller, kilit ekranı açık kalırdı — K-09'un kaynağı olan #102'nin yakın akrabası. Şifre değişimi oturumu döndürdüğü için jeton yenidir ve okuma yapılır. Aynı sebeple `TOKEN_REFRESHED` de kimliği tazeler; sunucuda rolü değişmiş bir kullanıcı ısrar etmez.

**Tek yola inmek güvenli, çünkü ölçüldü.** Kurulu auth-js sürümünde (2.112.3) `onAuthStateChange`, abonelik kurar kurmaz `_emitInitialSession` çağırıyor ve o fonksiyon **her yolda** geri çağrımı tetikliyor: başarıda oturumla, hata dalında `null` ile. Olayın hiç yayılmadığı bir durum yok. Bu, kaynaktan doğrulandı — varsayılmadı (**K-10**).

**İkinci tuzak, `loading` kilidi.** Kilit karardan **bağımsız** düşürülüyor. "Kurtarma sürüyor" dalı olayı yok sayıyor; kilit karara bağlansaydı kurtarma bağlantısıyla gelen kullanıcı sonsuz spinner görürdü — bugüne kadar o kilidi kaldıran şey, kaldırılan `getSession()` yoluydu. Issue'nun _"`loading` durumunun ilk boyamada doğru kalması korunmalı"_ uyarısı tam olarak bunu kastediyordu.

Karar mantığı `client/src/auth/sessionEvents.ts`'te saf bir fonksiyon olarak duruyor. Sebebi `idleTimeout.ts`'teki `resolveIdleTracking` ile aynı: depoda bileşen testi altyapısı yok ve yeni bağımlılık eklenmiyor, dolayısıyla sınanabilir olan kısım bileşenden ayrılıyor.

**Alternatifler:**

- **Kullanıcı kimliğiyle anahtarlanan koruma:** Reddedildi. Yukarıdaki gerileme; issue'nun önerdiği iki yönden biri buydu ve olduğu gibi uygulanamazdı.
- **`getSession()`'ı bırakıp yalnızca olay yolunu korumak:** Reddedildi. Çift okumanın asıl kaynağı iki yolun varlığıdır; birini korumak, ikisini de bakımda tutmak demekti.
- **`signIn`'in kendi okumasını kaldırıp `SIGNED_IN`'e bırakmak:** Reddedildi. `signIn` okuma başarısız olduğunda kullanıcıyı dışarı alıp hatayı çağırana fırlatmak zorunda; olay yolunda fırlatılan hata kimseye ulaşmaz.

**Kapsam dışı bırakıldı — dürüstçe:** Bu değişiklik **yerelde ve preview'da hiç koşmuyor.** `isDemoMode = deploymentEnvironment !== "production"` olduğu için `AuthProvider`'ın oturum `useEffect`'i o ortamlarda en başta dönüyor. Doğrulanan şey, saf karar fonksiyonu (13 iddia) ve auth-js'in olay sözleşmesidir; **davranışın tek gerçek doğrulama yeri production'dır.** Bu yeni bir açık değil, `PLATFORM_SETTINGS.md` §5'te kayıtlı "Auth, RLS ve platform paneli preview'da doğrulanamıyor" açığının somut bedelidir.

---

### Karar: Demo modu derleme zamanı sabitidir

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Demo verisi hiçbir üretim ekranında gösterilmiyordu (#133 bunu kapatmıştı) ama JS paketinin **içinde** duruyordu: son ölçümde `Merve Karaca` 18, `Zeynep Kaya` 11 kez geçiyordu (#144). İşlevsel bir açık değil — sızıntı yok, sır yok. Ticari risk gerçek: pilot okulun bilişimcisi paketi açıp Türkçe kişi adları görürse sızmış müşteri verisi sanar.

Kod zaten doğru kalıbı kullanıyordu — `educationData.ts`'in her ihracı `isDemoMode ? demoX : []`. Ama üçlünün hiçbir dalı eleniyordu, çünkü `isDemoMode`, `resolveDeploymentEnvironment(...)` **fonksiyon çağrısından** türüyordu ve Rollup katlayamıyordu. Doğru yazılmış bir koruma, yanlış zamanda çalıştığı için hiçbir şey korumuyordu.

**Karar:** Ortam kararı `vite.config.ts`'te **bir kez** veriliyor ve `__ORBIT_DEMO_MODE__` define'ı olarak gömülüyor. `isDemoMode` bu define'ı okuyor; üretim derlemesinde literal `false` olur, üçlüler `[]`'e çöker ve `demoData.ts` ulaşılamaz hale gelip elenir.

**Bunun bir kuralı vardır ve ileriye dönük bağlayıcıdır:** `isDemoMode` bir **derleme zamanı sabiti** olarak kalmalıdır. Onu çalışma zamanında hesaplanan bir şeye (fonksiyon çağrısı, context değeri, prop) bağlayan her değişiklik demo verisini sessizce pakete geri sokar — ve bu, hiçbir testin yakalamayacağı bir gerilemedir. Gerileme yalnızca paket taranarak görülür.

**Gerekçe — isim değiştirme neden reddedildi.** Issue ucuz bir alternatif sunuyordu: demo isimleri `Demo Öğretmen 1` gibi belirgin biçimde kurgusal yapmak. Bu, ticari riski çözer ama `PROJECT_STATE.md`'de yazılı ürün kararını bozar — demo verisinin var olma sebebi _"müşteriye sunum yaparken kurumun dolu gözükmesini sağlayan gerçekçi örnek veriler"_. Bir sorunu çözerken başka bir kararı bozmak, kararı veren tarafa sorulmadan yapılmaz.

**Doğrulama iki yönlüdür ve tek yönlü olamaz.** Üretim paketinde altı demo isminin altısı da 0; preview (demo) paketinde `Merve Karaca` 18, `YKS 12-A` 17, `stu-001` 3 — hepsi yerinde. Yalnızca birinci ölçüm yapılsaydı, demo modunu tamamen kırmış olmak da aynı sonucu verirdi. Satış sunumunun temeli olan bir özelliği "temizledim" diye bozmak, düzeltilen sorundan pahalıya mal olurdu.

**Alternatifler:**

- **Demo isimlerini kurgusallaştırmak:** Reddedildi, yukarıdaki karar çakışması.
- **`demoData.ts`'i dinamik `import()` arkasına almak:** Reddedildi. Dört üretim modülü ondan içe aktarım yapıyor; hepsini asenkron hale getirmek geniş ve riskli bir refactor olurdu — üstelik kalıcı çözüm zaten daha küçük bir yerdeydi.
- **`vite.config.ts`'te ortam kararını satır içi yazmak:** Reddedildi. Aynı karar iki yerde yaşardı (config ve `runtime.ts`) ve fail-closed davranış ikizlenirdi — **K-06**. Bunun yerine saf mantık `deploymentEnvironment.ts`'e taşındı ve iki taraf da oradan okuyor.

**Kapsam dışı bırakıldı:** `roleEmail` gibi birkaç küçük demo sabiti hâlâ `demoMode` prop'una bağlı tüketicilerden erişilebilir; bunlar kişi adı taşımadığı için #144'ün gerekçesine girmiyor.

---

### Karar: ORBIT tüm rollere "siz" diye hitap eder

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Hitap biçimi hiçbir yerde yazılı değildi ve aynı rolde bile tutarsız uygulanıyordu (#147):

```
StudentDashboard        "bugün planın hazır"        → sen
HomeworkPage (öğrenci)  "Dersleriniz… takip edin"   → siz
SettingsProfileSection  "şifrenizi unutmanız…"      → siz
```

Öğrenciye "sen" demek bilinçli bir tercih **olabilirdi** — ama yazılı olmadığı için tercih mi kaza mı olduğu bilinemiyordu, ve her yeni metin yazan kişi kendi sezgisine göre karar veriyordu.

**Karar:** ORBIT **her role "siz" diye hitap eder.** Öğrenci dahil, istisnasız.

**Gerekçe:** Kural tek cümlede yazılabiliyor ve ihlali gözle yakalanabiliyor. Role göre dallanan bir hitap kuralı (öğrenciye "sen", yetişkinlere "siz") daha sıcak bir öğrenci deneyimi verirdi ve Türkçede çocuğa "siz" demek mesafeli durur — ama her metin yazıldığında "bu ekranı kim görüyor" sorusunun ayrıca sorulmasını gerektirirdi. Yazılı olmayan bir kuralın tutarsız uygulanması bu issue'nun sebebiydi; **uygulanması düşünme gerektiren bir kural, aynı sona daha yavaş varır.**

Ürün kuruma satılıyor ve ekranların çoğunu yetişkinler görüyor: kurum yöneticisi, öğretmen, veli. Tek biçimli "siz", pilot görüşmesinde de tutarlı bir ton veriyor.

**Alternatifler:**

- **Öğrenciye "sen", diğerlerine "siz":** Reddedildi. Mevcut `StudentDashboard` metinlerinin niyetine daha yakındı ve Türkçe konuşma normlarına daha uygundu, ancak her metin için ek bir karar gerektiriyor. Kuralın ucuz uygulanabilirliği tercih edildi.
- **Herkese "sen":** Reddedildi. Yönetici, öğretmen ve veli yetişkin müşteri; pilot görüşmesinde fazla samimi algılanma riski var.

**Kapsam dışı bırakıldı:** `demoData.ts` içindeki gün planı görev başlıkları (`"Sabah dersinin yoklamasını sisteme işle"` gibi). Bunlar uygulamanın kullanıcıya hitabı değil, kullanıcının kendi yapılacak listesindeki madde metinleridir; emir kipi orada doğaldır.

---

### Karar: İş verisi RLS ile yazılır, kimlik işlemleri Edge Function'da kalır

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-01'e kadar `authenticated` rolü hiçbir tabloda `SELECT` dışında yetki taşımıyordu; on bir RLS politikasının onu okumaydı ve tek yazma politikası `profiles_update_self`'ti. Bütün yazmalar `service_role` taşıyan Edge Function'lardan geçiyordu.

Bu, kimlik katmanı için doğru bir tercihti ve öyle kalıyor: hesap açmak, şifre sıfırlamak, kurum kurmak ve kurum silmek `auth.users`'a dokunan ayrıcalıklı işlemlerdir; hiçbiri tenant içinde kalmaz.

Ama v1.2, on iki dilim boyunca öğrenci, sınıf, yoklama, sınav, ödev ve ödeme tablolarını getiriyor. Aynı deseni sürdürmek, her CRUD işlemi için ayrı bir Edge Function demekti.

**Karar:** Kurum kapsamlı iş verisi **RLS politikalarıyla doğrudan** yazılır. Edge Function'lar kimlik ve ayrıcalıklı işlemlerde kalır.

Sınır tek soruyla çizilir: **işlem `auth.users`'a mı dokunuyor, yoksa tenant içinde mi kalıyor?**

Sınır ikinci kez sütun yetkileriyle çizilir. `students` tablosunda `auth_user_id` ve `organization_id` hiçbir yazma yetkisinde yoktur: bir öğrenciye giriş hesabı bağlamak ve bir öğrenciyi başka kuruma taşımak, adını düzeltmekle aynı sınıfta işlemler değildir. RLS politikası doğru yazılmamış olsa bile bu iki sütun yazılamaz.

**Gerekçe:** İş verisinin sınırı kurumdur ve RLS bu sınırı tam olarak ifade edebilir; Edge Function'ın ekleyeceği tek şey bir ağ atlaması olurdu. Buna karşılık her fonksiyon **elle deploy edilen ayrı bir parçadır** ve bu bizi bir kez ısırdı: #113/#114'te arayüz deploy edilmemiş bir fonksiyona bağlandı ve form sessizce çalışmadı.

Değişmeyen şey önemlidir: **yetki kararı hâlâ SQL'de yaşıyor.** Değişen, kararın nerede alındığı değil, isteğin oraya hangi yoldan gittiğidir.

**Bedeli — açıkça kabul ediliyor:** `authenticated` artık iki tabloya yazabiliyor; bir politika hatası doğrudan veri hatasıdır. Karşılığı testtir: her yazma yolunun bir olumlu ve bir olumsuz pgTAP testi var — yönetici kendi kurumuna yazabiliyor, başka kuruma yazamıyor.

**Alternatifler:**

- **Her yazma Edge Function'dan:** Reddedildi. En sıkı seçenekti ama on iki dilim × N işlem kadar fonksiyon, iki kişilik ekipte sürdürülemez; her biri ayrıca elle deploy gerektirir ve unutulan deploy sessiz bir arıza üretir.
- **Karma (okuma/güncelleme RLS, oluşturma/silme fonksiyon):** Reddedildi. Hangi işlemin hangi yoldan gittiğini her dilimde yeniden karara bağlamak gerekirdi; sınır sorusu tek ve sabit olmalı.

---

### Karar: Zorunlu şifre değişimi kilidi iş tablolarında baştan sunucuda durur

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `current_user_must_change_password()` Faz E3'te yazıldı ve süreyi de okuyor, ama **hiçbir RLS politikasında kullanılmıyordu** — kilit yalnızca istemcideydi. `ROADMAP.md` bunu ayrı bir dilime (**v1.2-11**) koymuş ve v1.2-01…09'un tamamına bağlamıştı: bütün iş tabloları yazıldıktan sonra hepsine birden eklenecekti.

**Karar:** Koşul, v1.2-01'den itibaren **her yeni iş tablosunun her politikasına yazıldığı gün** girer. `students` ve `guardians`'ın sekiz politikasının sekizi de taşıyor.

**Gerekçe:** v1.2-01 sistemin **yazma yetkisi olan ilk iş tablosunu** getirdi. Kilit bugüne kadar yalnızca istemcide durabiliyordu çünkü kilitli bir kullanıcının REST API'den ulaşabileceği tek şey kendi profiliydi; zarar teorikti. Öğrenci tablosuyla birlikte zarar gerçek oluyor.

Koşulu dokuz dilim sonraya bırakmak, o dokuz dilimin kilitsiz yaşaması demekti — ve dokuz tablo biriktikten sonra yapılacak toplu tarama, tam olarak K-08'in tarif ettiği "sonra hatırlanacak iş" sınıfına girer. Bir satır bugün, dokuz tablo sonra yapılacak bir taramadan ucuzdur.

**K-11 kaydı — bu karar başka bir kaydı geçersiz kıldı:** v1.2-11'in kapsamı daraldı. Dilim artık "her tabloya ekle" değil, **"2026-09-04 öncesi tabloları tara ve tamamla"** işidir; o tabloların listesi bilinen ve sonludur (`profiles`, `organizations`, `branches`, `organization_memberships`, `audit_events`). Not `ROADMAP.md` §4.6'daki v1.2-11 bloğuna düşüldü.

**Alternatifler:**

- **Plana sadık kalıp v1.2-11'i beklemek:** Reddedildi. Planın kendisi, iş tablolarının kilitsiz kalmasının kabul edilemez olduğunu yazıyordu; o cümleyi yazıp dokuz dilim beklemek kendi içinde tutarsız.

---

### Karar: İş tabloları asgari kişisel veriyle açılır

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `students` tablosu tasarlanırken hangi kişisel alanların taşınacağı soruldu: TC kimlik numarası, doğum tarihi, adres, telefon. Dershaneler resmî kayıt için TC istiyor ve doğum tarihinin ileride somut bir gerekçesi var — "veli üzerinden kurtarma" kararı bir yaş sınırı gerektiriyor.

Buna karşılık KVKK envanteri v1.5'e planlı ve kişisel verinin Frankfurt'ta tutulması **kayda geçmemiş bir karar** olarak `PLATFORM_SETTINGS.md` §5'te duruyor; şartı "ilk gerçek kurum verisi girmeden önce".

**Karar:** `students` ve `guardians` yalnızca ad, kurum bağı, şube ve opsiyonel giriş hesabıyla açılır. TC kimlik numarası, doğum tarihi, adres ve telefon **bu dilimde eklenmez**.

**Gerekçe:** Tabloya bugün yazan hiçbir şey yok — ekran v1.4-01'de geliyor. Dolayısıyla şimdi eklenen her kişisel alan spekülatiftir. Ve iki yön simetrik değil: **sütun eklemek ucuz bir migration, toplanmış kişisel veriyi geri almak değildir.** Yanılma maliyeti düşük olan tarafta durulur.

**Şart, sahip ve yapılacak iş (K-12):** Alanlar v1.4-01 (öğrenci kaydı CRUD) açılışında, o sırada yazılacak aydınlatma metniyle **birlikte** kararlaştırılır. Ayrı bir "alanları ekle" işi açılmaz; ekranı yazan dilim bu soruyu da cevaplar.

**Alternatifler:**

- **Doğum tarihini şimdi eklemek:** Reddedildi. Gerekçesi gerçek ama gelecekteki bir dilime ait; o dilim geldiğinde bir sütun eklemek bir migration'dır.
- **TC dahil tam set:** Reddedildi. Frankfurt/KVKK borcunu, onu ödeyecek dilim gelmeden öne çeker.

---

### Karar: Sistem taşınabilir kurulur; sağlayıcı bir tercih, bağımlılık değildir

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** İleride tüm sistemin **Hetzner** üzerinde kendi sunucumuza taşınması değerlendiriliyor. Karar henüz verilmedi, ama ihtimalin varlığı bugün alınan tasarım kararlarını etkiliyor.

Taşınabilirliğin bugünkü durumu 2026-09-04'te ölçüldü ve beklenenden iyi çıktı:

|                                                   |                                                       |
| ------------------------------------------------- | ----------------------------------------------------- |
| SQL (migration + pgTAP)                           | 4.735 satır                                           |
| Edge Function TypeScript                          | 1.186 satır                                           |
| `@supabase/supabase-js`'e dokunan istemci dosyası | 4 (biri test, biri tek dikiş)                         |
| Supabase Auth admin API yüzeyi                    | 3 çağrı: `createUser`, `deleteUser`, `updateUserById` |
| Kullanılan Supabase Storage                       | yok (`workspace_documents` ölü)                       |

Bu bir tesadüf değil: **"yetkilendirme veritabanında, veri erişimi servis katmanında"** kararının doğrudan sonucu. Yetkilendirmenin tamamı düz Postgres'te yaşıyor — RLS, `SECURITY DEFINER` fonksiyonlar, trigger'lar — ve hiçbiri Supabase'e özgü değil. İstemcide adres tek bir dikişten geliyor (`client/src/lib/supabaseClient.ts`), ESLint de `components/` katmanının Supabase'i doğrudan import etmesini engelliyor.

**Karar:** Taşınabilirlik **korunacak bir özelliktir**, sonradan kazanılacak bir şey değil.

1. Yeni bir sağlayıcı özelliği veya bağımlılık eklenirken şu soru sorulur: **"bu, düz Postgres veya standart bir arayüzle (S3, SMTP, OIDC) yapılabilir mi?"** Yapılabiliyorsa öyle yapılır.
2. Yetkilendirme SQL'de kalmaya devam eder. Bu kural zaten vardı; taşınabilirlik onun ikinci gerekçesidir.
3. **Somut ilk uygulama:** v1.6 Storage, Supabase Storage'ın kendi istemcisi yerine **S3-uyumlu** bir arayüze göre tasarlanır (Hetzner Object Storage S3-uyumludur). Bugün bedava, v1.6 yazıldıktan sonra pahalı.

**Gerekçe:** Taşınabilirlik bugün büyük ölçüde elimizde ve korumak bedava; kaybedip geri kazanmak pahalı. Kilitlenme tek bir büyük kararla oluşmaz — her biri tek başına makul görünen küçük tercihlerle birikir, ve fark edildiğinde geri dönüş maliyeti zaten ödenmiştir.

**Bunun çözmediği şey — açıkça:** Hetzner'e geçmek **veri yerleşimi sorununu çözmez.** Hetzner'in veri merkezleri Nürnberg ve Falkenstein (Almanya), Helsinki (Finlandiya), Ashburn ve Hillsboro (ABD), Singapur'dadır; **Türkiye yoktur.** Frankfurt'tan Falkenstein'a geçmek hukuken yatay bir harekettir — ikisi de KVKK anlamında yurt dışına aktarımdır. Veri yerleşimi ayrı bir karardır ve `PLATFORM_SETTINGS.md` §5'teki "Kişisel veri Frankfurt'ta" satırına aittir.

**Bedeli — açıkça kabul ediliyor:** Kendi sunucuya geçmek, bugün Supabase'in yaptığı işleri devralmak demektir: yedekleme ve **test edilmiş** geri yükleme, Postgres/GoTrue/PostgREST yamaları, izleme ve nöbet. GitHub → Supabase migration entegrasyonu da gider; migration'ları uygulayan CI adımı bizim olur. Sunucu ücreti düşer, **operasyon zamanı ücreti artar** — ve iki kişilik bir ekipte o ücret sunucu ücretinden büyüktür.

**Şart, sahip ve yapılacak iş (K-12):**

- **Taşınma kararının tetikleyicisi:** bir pilot kurum sözleşmede veri yerleşimi şartı koyduğunda, **veya** Supabase kullanımı ücretsiz katmanı aştığında. İkisinden biri gerçekleşene kadar taşınma gündeme alınmaz.
- **Taşınabilirliğin kontrol noktası:** **v1.6-01 açılışı** (Storage). Taşınabilirliği sınayacak ilk dilim odur, çünkü bugüne kadar hiç kullanılmamış tek Supabase bileşeni Storage'dır.
- **Veri yerleşiminin kontrol noktası:** ayrı ve daha erken — `PLATFORM_SETTINGS.md` §5, "ilk gerçek kurum verisi girmeden önce".

**Alternatifler:**

- **Şimdi taşınmak:** Reddedildi. v1.2'nin ortasında altyapı değiştirmek, iş tablolarını yazmayı durdurur ve hiçbir bugünkü sorunu çözmez.
- **Taşınabilirliği hiç hedeflememek:** Reddedildi. Maliyeti bugün sıfıra yakın; tek gerektirdiği, sağlayıcıya özgü bir kolaylık seçerken durup sormak.
- **Veri yerleşimi için Hetzner'e geçmek:** Reddedildi — sorunu çözmüyor. Yukarıya bakınız.

---

### Karar: Sınıf bir öğretim yılına aittir; dönem tablosu yerine arşivleme

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-02 `classes` tablosunu getirdi ve şu soruyu doğurdu: "YKS 12-A" adı her öğretim yılında yeniden kullanılacak. Sınıfı yıla bağlamanın iki yolu var — bir `academic_terms` tablosu açmak, ya da her yıl yeni bir sınıf satırı açıp eskisini arşivlemek.

Soru önemsiz değil çünkü yoklama (v1.2-04), sınav (v1.2-05) ve ders programı (v1.2-07) hep sınıfa bağlanacak. Yanlış modellenirse geçen yılın yoklaması bu yılın sınıfında görünür.

**Karar:** Dönem tablosu açılmaz. **Her öğretim yılı yeni bir `classes` satırıdır**; eski satır `archived_at` ile arşivlenir.

- Benzersizlik kısmi indekstir: `unique (organization_id, name) where archived_at is null`. Böylece ad her yıl yeniden kullanılabilir ama aynı anda iki tane olamaz.
- Aynı kalıp `organizations` ve `branches`'te zaten var; yeni bir kavram getirilmiyor.
- Kayıt ve atama satırlarında da UPDATE yalnızca `archived_at`'e açık: bir öğrenciyi sınıftan sınıfa **taşımak** yerine kaydı arşivleyip yenisini açmak gerekiyor.

**Gerekçe:** Geçmişi koruyan şey dönem etiketi değil, **her yılın kendi satırı olmasıdır.** Yoklama kaydı sınıf satırına bağlandığı için, geçen yılın 12-A'sı ayrı bir satır olduğu sürece karışma imkânı yok — dönem sütunu eklemek aynı sonucu bir tablo fazlasıyla verirdi.

Taşıma yerine arşivlemenin sebebi de aynı: bir öğrenci Kasım'da sınıf değiştirirse, Ekim'deki yoklaması hangi sınıfa aitse orada kalmalı. `class_id`'yi güncellemek o geçmişi geriye dönük olarak değiştirirdi.

**Bunun ikinci sonucu — rehberlik ile ders vermek ayrı ilişkilerdir.** Arayüz ikisini zaten ayrı gösteriyor (`ClassGroup.mentor` ve `ScheduleItem.teacher`) ve model bunu takip etti:

- **Rehber öğretmen** `classes.mentor_membership_id` sütunudur. Sütun olması "bir sınıfın en fazla bir rehberi olur" kuralını bedavaya getirir; ayrıca yazılması gereken bir kısıt olmaz.
- **Ders vermek** `class_teachers` tablosudur (üyelik + sınıf + ders) ve çoka-çoktur.
- Kapsam sorusunda ikisi **birleşir**: `current_user_teaches_class()` hem atamayı hem rehberliği sayar. Sınıfın rehberi o sınıfın öğrencilerini görebilmeli, ve bunun için ayrı bir yetki kavramı yaratmaya gerek yok.

**Bir dönem tablosu ne zaman gerekir:** Kurum "2025-2026 yılının tüm sınıflarını listele" veya "geçen döneme göre kıyasla" gibi bir raporlama isterse. O gün `classes`'a bir `term` sütunu eklemek bir migration'dır; bugün tablo açmak, kullanılmayan bir kavramı her sorguya taşımaktır.

**Alternatifler:**

- **`academic_terms` tablosu:** Reddedildi. Bugün hiçbir soruyu cevaplamıyor ve her sınıf sorgusuna bir join ekliyor.
- **Sınıfı yeniden kullanıp öğrencileri değiştirmek:** Reddedildi. Geçmiş yoklama ve sınav kayıtlarının hangi öğrenci grubuna ait olduğu belirsizleşirdi.
- **Rehberliği `class_teachers`'a bayrakla koymak:** Reddedildi. İki farklı kavramı tek tabloda taşır ve "en fazla bir rehber" kuralı ayrıca kısmi unique index gerektirirdi.

**İlgili:** [[Rol, atama ve bağlantı üç ayrı kavramdır]] — bu karar onun v1.2-02'deki uygulamasıdır.

---

### Karar: Veli yalnızca okur ve yalnızca kendi bağını görür

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-03 `student_guardians` bağını getirdi ve velinin kapsamını ilk kez gerçek hâle getirdi. İki soru cevaplanmak zorundaydı: veli ne kadar **yazabilir**, ve aynı öğrencinin **diğer velisini** görür mü?

**Karar:**

1. **Veli hiçbir tabloya yazamaz.** Öğrenci kaydını, sınıfını, kayıt satırını ve kendi bağını değiştiremez. Yalnızca okur.
2. **Veli yalnızca kendi bağlarını görür.** Aynı öğrenciye bağlı diğer veli — örneğin ayrı yaşayan diğer ebeveyn — onun için görünmez.

**Gerekçe (1):** Kurum kaydını kurum tutar. Velinin "çocuğumun şubesi yanlış girilmiş" demesi bir **talep**tir, doğrudan bir düzeltme değil; aksi hâlde kurumun kendi kaydı üzerinde denetleyemediği bir yazma yolu açılır. Aynı gerekçe öğretmen için de geçerliydi ("öğretmen öğrenci ekleyemez", 2026-08-29).

**Gerekçe (2):** Bu bilgi veliye ait değil. Velayet ve ayrılık durumları hedef kitlede yaygın ve bir ebeveynin diğerinin kuruma verdiği iletişim bilgisine erişmesi, ürünün çözmesi gereken bir sorun değil **yaratabileceği** bir sorundur. Kapalı başlayıp gerektiğinde açmak, açık başlayıp sonra daraltmaktan güvenli (K-04).

**Bir ayrıntı bilinçli:** kapsam kontrolü hem bağda hem **veli kaydında** `archived_at is null` arıyor. Yalnızca bağa bakılsaydı, kurumdan ayrılmış ve kaydı arşivlenmiş bir velinin erişimi bağ üzerinden sessizce devam ederdi. Testi var.

**Kapsam dışı — bilinçli:** `student_guardians` bir yakınlık derecesi (anne/baba/vasi) veya birincil iletişim bayrağı taşımıyor. Hiçbir politikanın buna ihtiyacı yok ve tabloya bugün yazan bir ekran da yok; alanlar v1.4'te ekranla birlikte, aydınlatma metniyle birlikte kararlaştırılır — "İş tabloları asgari kişisel veriyle açılır" kararının aynısı.

**İlgili:** [[Rol, atama ve bağlantı üç ayrı kavramdır]] — velinin kapsamının **bağlantıdan** gelmesi o kararın üçüncü ayağıdır ve bu dilimle tamamlandı.

---

### Karar: Öğretmenin yazma yetkisi rolünden değil atamasından gelir

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-04'e kadar öğretmen sistemde **hiçbir tabloya yazamıyordu**; her yerde salt okurdu. Yoklama bunu değiştirmek zorundaydı — yoklama almak öğretmenin kurumdaki asıl işidir ve her yoklama için yöneticiye gitmek ürünü kullanılamaz kılar.

Soru şuydu: yazma yetkisi **role** mi bağlansın (rolü `teacher` olan yoklama alabilir), yoksa **atamaya** mı (o sınıfa atanmış olan alabilir)?

**Karar:** Atamaya. `current_user_teaches_class()` kontrol edilir, `role = 'teacher'` değil.

Somut sonucu iki yönlü:

- Rolü `teacher` olup o sınıfa **atanmamış** biri yoklama alamaz — komşu sınıfın yoklamasına dokunamaz.
- Rolü `admin` olup o sınıfa **atanmış** biri alabilir — küçük dershanenin hem yöneten hem ders veren sahibi kendi dersinin yoklamasını alır.

**Gerekçe:** "Ders vermek bir atama, rol değildir" kararının (2026-08-25) doğal devamı. Rol, hangi panelin açılacağını belirler; **ne yapılabileceğini** atama belirler. Yetkiyi role bağlamak, o kararı yazma tarafında geri alırdı: bir kurumdaki bütün öğretmenler bütün sınıfların yoklamasını değiştirebilir hâle gelirdi.

**Okuma ile yazma kapsamı bilinçli olarak farklı.** Öğretmen, dersini verdiği öğrencinin **bütün** yoklama geçmişini okuyabilir — devamsızlık bir örüntüdür ve tek derse bakarak anlaşılmaz. Ama yalnızca **kendi oturumuna** yazabilir. Bu yüzden okuma öğrenciye (`current_user_teaches_student`), yazma oturuma (`current_user_can_record_attendance`) bağlandı.

**Yoklamayı kimin aldığı istemciden gelmez.** `recorded_by_membership_id` hiçbir yazma yetkisinde yok; bir trigger çağıranın kimliğinden dolduruyor. Sütun yazılabilir olsaydı bir öğretmen yoklamayı başkasının aldığını iddia edebilirdi ve izlenebilirliğin anlamı kalmazdı.

**Geçmişe dönük düzeltme kısıtlanmadı** ve bu da bilinçli. Tek yöneticili küçük bir kurumda dünkü yoklamayı düzeltecek başka kimse olmayabilir; süre sınırı koymak sistemi kullanılamaz hâle getirir. Karşılığı erişim kısıtı değil **izlenebilirlik** — aynı gerekçe yönetici-veli çıkar çatışması için de yazılmıştı ([[Rol, atama ve bağlantı üç ayrı kavramdır]]). `recorded_by_membership_id` bu izlenebilirliğin veri tarafındaki ilk parçası; denetim kaydı yazma işi v1.4'te CRUD akışlarıyla gelir.

**Alternatifler:**

- **Yazmayı role bağlamak:** Reddedildi. Uygulaması bir satır daha kısaydı ama kurumdaki her öğretmene her sınıfın yoklamasını verirdi.
- **Geçmişe dönük düzeltmeyi N gün sonra kilitlemek:** Reddedildi. Tek yöneticili kurumda düzeltmenin tek yolunu kapatır. Sorun erişimde değil izlenebilirlikte.

---

### Karar: Sütun maskeleme RLS'in işi değildir; sıralama bir fonksiyondan gelir

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Soru 6'nın onaylı cevabı, v1.2-05'e kadar karşılaşmadığımız bir şey istiyordu: _"Öğrenci ve veli yalnızca kendi/bağlı öğrencisinin sonucunu ve sırasını görecek; diğer öğrencilerin kimlikleri anonim olacak."_

Buradaki incelik şu: öğrenci **tüm sıralamayı** görmek zorunda. Kaçıncı olduğunu bilmesi için kaç kişinin önünde olduğunu görmesi gerekiyor; yalnızca kendi satırını görürse "sıra" diye bir bilgi kalmaz. Ama diğer isimleri görmemeli.

Yani gizlenmesi gereken şey **satır değil, aynı satırın bazı sütunları**. RLS satır gizler; bu isteği politikayla ifade etmek mümkün değil.

**Karar:** Sıralama, tablo üzerinden değil `public.exam_ranking(uuid)` fonksiyonundan okunur. Fonksiyon `SECURITY DEFINER`'dır, yetkiyi içeride çözer ve her satır için ayrı ayrı "çağıran bu öğrenciyi görebilir mi" sorusunu sorar. Cevap hayırsa **isim ve kimlik `null` döner, sıra ve puan durur.**

- Yetkisiz çağırana hata değil **boş küme** döner: sıralamayı görmeye hakkı olmayan biri "bu sınav var ama göremiyorsun" bilgisini de almamalı.
- Sıralamayı görme koşulu, sınavda **en az bir öğrenciyi görebiliyor olmak**. Sınava girmemiş ve orada kimseyi okutmayan biri isimsiz puan dağılımını bile göremez — o dağılım ona ait bir bilgi değil.
- Tablonun kendi RLS politikaları **ayrıdır ve daha dardır**: doğrudan okuyan yalnızca görme yetkisi olan satırları alır, maskeleme yoktur. İki yol birbirinin yerine geçmez.

**Gerekçe:** Kalıp yeni değil — `platform_organization_stats` da yetkiyi içeride çözen, yetkisiz çağırana veri değil `null` dönen bir `SECURITY DEFINER` fonksiyondu. Buradaki fark, kararın **satır bazında** verilmesi.

Maskeleme sorusu yeni bir yetki kavramı getirmiyor; v1.2-01…04'te kurulmuş dört kapsamın birleşimi: yönetici, öğrenciyi okutan öğretmen, öğrencinin kendisi, öğrencinin velisi. Bu önemli — yetkilendirme mantığı ikinci bir yerde yeniden yazılsaydı, kapsam değiştiğinde biri güncellenip diğeri unutulurdu (**K-06**).

**Sessiz bir sızıntı kapatıldı:** sonuçlar eşit puanda isme göre sıralansaydı, anonim satırların **alfabetik yeri** ele verilirdi — yeterince sınavla bir öğrencinin adının baş harfi daraltılabilirdi. Sıralama `(sıra, öğrenci kimliği)` ile yapılıyor; UUID bilgi taşımaz.

**Alternatifler:**

- **Görünüm (view) + `security_invoker = false`:** Reddedildi. Aynı işi yapardı ama fonksiyon, "yetkisiz çağırana boş küme" kuralını ve giriş doğrulamasını daha açık taşıyor; ayrıca repo'da zaten fonksiyon kalıbı var.
- **Sıralamayı istemcide hesaplamak:** Reddedildi. İstemcinin sıralayabilmesi için bütün sonuçları okuması gerekir; tam olarak engellenmek istenen şey bu.
- **Öğrenciye yalnızca kendi sırasını (tek sayı) vermek:** Reddedildi. Dağılımı göstermeden "142.'sin" demek, öğrenciye durumu hakkında hiçbir şey anlatmıyor ve ürünün akademik takip vaadini boşa çıkarıyor.

---

### Karar: Ödeme kurum ile aile arasındadır; öğretmen ve öğrenci görmez

**Durum:** Alındı
**Tarih:** 2026-09-04
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-06 ödeme planı ve taksit takibini getirdi. Bugüne kadar her dilimde kapsam **genişliyordu**: öğretmen atamadan, öğrenci kendi kaydından, veli bağdan. Ödeme, bu eğilimin tersine döndüğü ilk yer.

**Karar:** Ödeme verisini yalnızca **kurum yöneticisi ve veli** görür.

1. **Öğretmen hiç görmez.** Sistemde `current_user_teaches_student` kapsamının bilinçli olarak **kullanılmadığı** ilk yer burasıdır.
2. **Öğrenci kendi planını da görmez.**
3. **Veli okur, yazmaz.** Ödemeyi aldığını kaydeden taraf kurumdur.

**Gerekçe (1):** Bir öğretmenin bir öğrenciyi okutuyor olması, o ailenin borcunu görmesi için sebep değil. Ödeme kurum ile aile arasındaki bir ilişkidir ve öğretmen o ilişkinin tarafı değil. Dahası zararı somut: öğretmenin sınıfındaki "parası ödenmemiş çocuğu" bilmesi, öğrenciye davranışını farkında olmadan değiştirebilir.

**Gerekçe (2):** 14 yaşındaki bir öğrencinin panelinde "3.500 TL gecikmiş taksit" yazması, ürünün çözmesi gereken bir şey değil. Ailenin borcu çocuğun ekranına düşmemeli.

**Bedeli — açıkça kabul ediliyor:** E-postasız yetişkin kursiyer kendi ödemesini kendi hesabından göremez. Yol kapalı değil: o kişi için bir **veli kaydı** açılır ve kendi kendinin velisi olur. Alternatifi — "velisi olmayan öğrenci görsün" — reddedildi çünkü yetkiyi **başka bir tablodaki satırın yokluğuna** bağlardı: veli bağı silindiği anda öğrencinin erişimi sessizce açılır ve bunu kimse fark etmez.

**Bir ikinci karar aynı dilimde: taksit durumu saklanmaz.** "Ödendi", "gecikti", "yaklaşıyor" `paid_at` ve `due_date`'ten türetilir. Saklanan bir durum, vade tarihi geçtiği gün sessizce yanlışa döner ve kimse onu güncellemez — **K-02**'nin (gösterim ile karar ayrı tutulur) veri modeline yansıması.

**Ve bir sınır şemaya yazıldı:** kart numarası, IBAN, ödeme jetonu veya banka hesabı taşıyan **hiçbir sütun yok ve olmayacak.** Böyle bir sütun eklendiği gün ürün PCI-DSS kapsamına girer ve iki kişilik bir ekibin taşıyamayacağı bir uyum yükü doğar. Tahsilat gerektiğinde doğru yol, ödemeyi lisanslı bir sağlayıcıya devredip buraya yalnızca **sonucu** yazmaktır.

**Alternatifler:**

- **Öğrenci kendi planını görsün:** Reddedildi. Yetişkin kursiyer için doğal olurdu ama küçük öğrenci de görürdü.
- **Velisi olmayan öğrenci görsün:** Reddedildi. Yukarıdaki sessiz açılma sebebiyle.
- **Öğretmen kendi öğrencisinin ödeme durumunu görsün:** Reddedildi. "Takip kolaylığı" gerekçesi vardı; öğrenciye davranışı etkileme riski ondan ağır.

---

### Karar: Dersin planlanması kurumun, yürütülmesi öğretmenin işidir

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-04 öğretmene sistemdeki ilk yazma yetkisini vermişti: kendi sınıfının yoklamasını alabiliyor. v1.2-07 ders programını getirince aynı soru yeniden soruldu — öğretmen kendi sınıfının programını da düzenleyebilmeli mi?

**Karar:** Hayır. Program **yalnızca yönetici** tarafından yazılır; öğretmen okur.

Ayrım tek cümleyle: **dersin planlanması kurumun işidir, yürütülmesi öğretmenin.** Yoklama yürütmedir — o saat gerçekleşti, kim vardı. Program planlamadır — hangi sınıf, hangi saatte, hangi odada.

**Gerekçe:** Program paylaşılan kaynakları bağlar: oda, saat, öğretmenin kendisi. Bir öğretmen kendi saatini kaydırabilseydi, başka bir sınıfın odasını veya başka bir öğretmenin saatini kurumun haberi olmadan işgal edebilirdi. Yoklamada böyle bir paylaşılan kaynak yok; öğretmen yalnızca kendi dersinin olgusunu kaydediyor.

**Okuma tarafı ise bilinçli olarak geniş:** öğretmen sınıfı okutuyorsa görür, **ve ayrıca** satır doğrudan ona yazılmışsa görür. İkincisi vekil öğretmen içindir: `class_teachers`'ta ataması olmayan biri bir saati doldurabilir ve o saati görebilmesi gerekir. Bu yüzden `schedule_entries.membership_id` ile `class_teachers` arasında **tutarlılık zorlanmadı** — vekillik gerçek bir durum ve şemayı ona kapatmak, kurumu sistem dışında çalışmaya iter.

**İkinci karar: gün, beş değil yedi.** İstemcideki `WeekDay` tipi Pazartesi–Cuma taşıyor. Veritabanı bu sınırı **miras almadı**: `day_of_week` 1–7 aralığında ISO 8601 numarasıdır. Dershanelerde hafta sonu kursu yaygın ve şemayı arayüzün bugünkü darlığına göre kurmak, yarın ürünü satılamaz kılardı. Sayı enum'a tercih edildi — doğal sıralanıyor, `extract(isodow from date)` ile karşılaştırılabiliyor ve veritabanına Türkçe gösterim metni girmiyor.

**K-11 kaydı:** bu, istemciyi veritabanının gerisinde bıraktı. Kayıt `ROADMAP.md` §4.6'ya düşüldü; ekran bağlanırken (v1.2-10) ya tip genişletilecek ya da hafta sonu açıkça kapsam dışı ilan edilecek.

**Alternatifler:**

- **Öğretmen kendi sınıfının programını düzenlesin:** Reddedildi. Paylaşılan kaynak çakışmalarını kurumun göremediği bir yerden üretirdi.
- **`day_of_week`'i beş günlük enum yapmak:** Reddedildi. Arayüzle birebir örtüşürdü ama hafta sonu kursu veren bir kuruma ürün satılamazdı.
- **`membership_id`'yi `class_teachers`'a bağlamak:** Reddedildi. Tutarlılığı garanti ederdi ama vekil öğretmeni imkânsız kılardı.

---

### Karar: Kişisel çalışma alanı kurumun değil kişinindir

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-09'a kadar kurulan on beş tabloda kurum yöneticisi **her zaman** en geniş kapsama sahipti. Ödemede öğretmen ve öğrenci dışlandı ama yönetici yine görüyordu. Gün Planı (`tasks`, `calendar_events`) bu deseni ilk kez kırıyor.

Soru 5'in onaylı cevabı zaten bunu söylüyordu: _"Kayıtları yalnızca sahibi görebilir ve yönetebilir."_ Karar, o cümlenin **yöneticiyi de kapsadığını** açıkça yazıya dökmek için alındı — çünkü bu noktaya kadarki her desen tersini bekletiyordu.

**Karar:** `tasks` ve `calendar_events` üzerinde **yönetici politikası yoktur.** Kayıtları yalnızca sahibi okur, yazar ve günceller.

**Gerekçe:** Yöneticinin bir öğretmenin kendine yazdığı "veli görüşmesine hazırlan" notunu görmesi için hiçbir işlevsel sebep yok. Ve görebilseydi sonuç erişim değil **davranış** değişikliği olurdu: insanlar bu alanı kullanmayı bırakır, gerçek notlarını başka yere yazar, özellik ölü doğardı. Kişisel alanın değeri tam olarak kişisel olmasından geliyor.

Sınır, kurumun meşru ihtiyacını kesmiyor: kurumsal duyuru zaten ayrı bir tabloda (`daily_feed_posts`) ve orada yönetici en geniş kapsama sahip. Ayrım "kim yazdı" değil, **kayıt kime yönelik**: duyuru başkalarına, görev kendine.

**İki modelin ayrı tablolarda durması bu kararın önkoşulu.** Aynı tabloda birleştirilselerdi, kişisel bir notun duyuru akışına sızması tek bir politika hatası uzağında olurdu. Soru 5'in "ayrı veri modeli" cevabının pratik karşılığı budur.

**Sahiplik sütunu bilinçli olarak trigger'la doldurulmadı.** `attendance_sessions.recorded_by_membership_id` ve `homework_assignments.assigned_by_membership_id` trigger'la dolduruluyor çünkü onlar **denetim iddiası**: yanlış bir değer sessizce yanlış kalır. `owner_membership_id` ise erişimin **anahtarı**: `with check` sahipliği doğruladığı için yanlış değer zaten yazılamaz, yazılabilseydi bile kayıt yazana görünmez olurdu — kendini bozan bir hata. İki sütun aynı şekle sahip ama farklı şeyler; aynı mekanizmayı ikisine de uygulamak, farkı görünmez kılardı.

**Alternatifler:**

- **Yöneticiye okuma yetkisi vermek:** Reddedildi. "Gerekirse bakarım" ihtiyacı gerçek değil; maliyeti özelliğin kullanılmaması.
- **Tek tabloda `visibility` sütunuyla ayırmak:** Reddedildi. Kişisel ile kurumsal arasındaki sınır bir sütun değerine indirgenirdi ve tek bir politika hatası ikisini karıştırırdı.

---

### Karar: Kapsam istemcide değil veritabanında çözülür

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `scopeFilters.ts` #136'da yazıldı: kim neyi görür sorusunu istemcide cevaplayan yedi fonksiyon. O gün doğru bir çözümdü — kapsamı çözecek hiçbir şey yoktu ve üretimde **boş küme** dönmek, bilinmeyende dar tarafta kalmaktı (K-04).

v1.2-01…09 bu zemini değiştirdi: on sekiz tablo, 97 RLS politikası, altı kapsam yardımcısı. Kapsam artık **sunucuda**, çağıranın kimliğiyle çözülüyor.

**Karar:** Kapsam yalnızca veritabanında çözülür. `scopeFilters.ts`'in üretim dalı gelen satırları **olduğu gibi geçirir**; ikinci kez filtrelemez.

**Gerekçe — bu bir hazırlık değil, hata düzeltmesiydi.** Boş küme bırakılsaydı, v1.3'te veri aktığı gün sonuç şu olurdu: RLS doğru satırları getirir, istemci onları yok eder, her öğretmen ve veli boş bir panel görür. Ve sebebi hiçbir hata mesajında görünmez; kimse "filtre" aramaz çünkü filtre bir güvenlik önlemi sanılır. Koruma değil, patlamayı bekleyen bir mayındı.

**Sınırın nerede olduğu artık yazılı:** bu dosya güvenlik yapmıyor, RLS yapıyor. `if (isDemo)` dalları yalnızca satış sunumunun tutarlı görünmesi için duruyor — demo verisi RLS'ten geçmediği için kendi filtresine muhtaç.

**Geçirgenliğin tek dayanağı:** üretim dalına yalnızca RLS'ten geçmiş veri ulaşmalı. Bugün yapısal olarak garanti — `isDemoMode` derleme zamanı sabiti ve veri kaynağı aynı sabitle kapılı, yani demo verisiyle üretim dalı bir araya gelemez. **Bu ikisi bir gün ayrışırsa geçirgenlik sızıntıya döner.**

**Değişiklik sırasında yapılan hata da kayda değer:** o `return []` satırı iki iş birden yapıyordu — üretimin cevabı **ve** demo modunda filtresi olmayan rollerin kapısı. Geçirgen yapılınca demo modunda üç fonksiyon sızmaya başladı. Mevcut testler bunu yalnızca birinde yakaladı; üçünde vardı. Ders: **tek bir `return` iki farklı soruya cevap veriyorsa, birini değiştirmek diğerini sessizce bozar.**

**Alternatifler:**

- **Boş kümeyi korumak:** Reddedildi. Yukarıdaki sessiz boş panel senaryosu.
- **İstemcide de filtrelemeye devam etmek (savunma derinliği):** Reddedildi. RLS'in getirdiği satırı istemcide yeniden filtrelemek savunma değil **çift kaynak**: iki yer aynı soruya cevap verir, biri güncellenir, diğeri unutulur (K-06). Ve yanlış taraf istemci olduğunda sonuç sızıntı değil **görünmez veri** olur — teşhisi çok daha zor.

---

### Karar: Kilit kullanmayı durdurur, tanıtmayı değil

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Zorunlu şifre değişimi kilidi (`current_user_must_change_password()`) v1.2-01'den itibaren yazılan her iş tablosunun politikasına kondu. v1.2-11'in işi, daha eski tabloları taramaktı — `ROADMAP.md` beş tablo saymıştı.

Tarama sırasında `client/src/auth/authService.ts` okundu ve **dördünün kilitlenemeyeceği** görüldü.

**Karar:** Kilit, kullanıcının sistemi **kullanmasını** durdurur; kendini **tanıtmasını** durdurmaz. Kimlik katmanı kilitten muaftır.

Muaf kalan altı politika ve sebepleri:

| Politika                             | Neden muaf                                                      |
| ------------------------------------ | --------------------------------------------------------------- |
| `profiles_select_self`               | `must_change_password` buradan okunuyor — kilidin kendisi       |
| `profiles_update_self`               | İlk giriş akışının parçası; kurtarma e-postası burada ekleniyor |
| `memberships_select_self`            | Kimlik çözümlemesinin ilk adımı                                 |
| `organizations_select_member`        | Aynı akış, üstelik `.single()` ile                              |
| `branches_select_member`             | Aynı akış                                                       |
| `platform_operators_select_operator` | Operatör kimliğinin aynı hikâyesi                               |

**Gerekçe:** Kilit bir kapı, kimlik katmanı ise o kapının anahtarını uzatan el. `profiles` kilitlenseydi kullanıcı "şifreni değiştir" yerine "okunamadı" ekranını görürdü — **K-09'un tarif ettiği hatanın tam olarak kendisi** — ve o ekrandan çıkış yolu olmazdı. `organizations` `.single()` ile okunduğu için sıfır satır sorguyu hataya düşürür ve kullanıcı "kurum bilgisi yüklenemedi" diye **yanlış bir mesajla** oturumdan atılırdı.

**Sınır tablo bazlı değil soru bazlıdır.** Aynı tablo hem kimlik hem iş verisi taşıyabiliyor: `organization_memberships`'te "bu benim üyeliğim mi" kimliktir, "kurumun üye listesi" iş verisidir. Bu yüzden `memberships_select_self_or_admin` **ikiye bölündü**; tek politikada iki farklı soruya cevap verildiği sürece kilidi yalnızca birine uygulamanın yolu yoktu.

(v1.2-10'da aynı ders bir `return` için öğrenilmişti: tek bir ifade iki soruya cevap veriyorsa, birini değiştirmek diğerini bozar. Burada ifade bir politikaydı.)

**Muafiyet listesi testle sabitlendi.** `password_lock_boundary.test.sql`, kilit koşulunu taşımayan politikaların **kümesini** iddia ediyor. Yeni bir politika kilitsiz yazılırsa test kırmızıya döner ve yazarına "bu gerçekten kimlik okuması mı" diye sorar. Liste güncellenebilir — ama bilinçli bir hareketle, unutkanlıkla değil.

**Alternatifler:**

- **Beş tabloya da eklemek (maddede yazan):** Reddedildi. Kilitli kullanıcı giriş yapamaz, kilitli olduğunu öğrenemez ve kilitten çıkamazdı.
- **Kilidi yalnızca istemcide bırakmak:** Zaten reddedilmişti; REST API doğrudan çağrılabiliyor.
- **`profiles_update_self`'i de kilitlemek:** Reddedildi. İlk giriş akışında kurtarma e-postasının eklenmesi bu politikadan geçiyor olabilir; kapatmak o akışı kırma riski taşıyor ve kazancı yok — kilitli kullanıcının kendi görünen adını değiştirmesi zararsız.

### Karar: İstemci veri katmanı React Query üzerine kurulur

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.3-01 yedi servisi birden getirecek ve 37 ekran aynı desenle yazılacak. Bugün ortada **iki çelişen desen** var ve hangisinin ev kuralı olduğu hiçbir yerde yazılı değil: `@tanstack/react-query` kurulu, `main.tsx`'te `QueryClientProvider` mount edilmiş — ama uygulamada **sıfır** `useQuery` çağrısı var. Tek gerçek sorgu ekranı olan `AuditLogPage` elle `useEffect + useState + Durum` union tipiyle çalışıyor.

Karar ölçütü olarak **"ileride hangisi daha az teknik borç açar"** seçildi (Arda Bülent, 2026-09-05).

**Karar:** React Query. `AuditLogPage` bu desene taşınır ve v1.3-00'da sözleşme yazılır: cache anahtarı biçimi, sayfalama, invalidation ve hata durumu.

**Gerekçe — iki borcun karşılaştırması, "hangisi daha temiz" değil.**

Elle yazılan desenin borcu **dağıtık** olur: 37 dosyada tekrarlanan bir kalıp, her biri kendi yükleme/hata durumunu kurar. Dağıtık borç ödenmesi en zor türdür — düzeltmek 37 dosyaya dokunmayı gerektirir ve o yüzden hiç düzeltilmez.

Belirleyici olan **v1.3-05**: Realtime abonelikleri bu turda dilim aldı. Realtime'ın karşılığı tazelemedir ve React Query'de bu tek satırdır (`invalidateQueries`), elle yazılan desende **her ekranın kendi aboneliğini ve kendi tazelemesini yazması** demektir. Yani elle desenin borcu v1.3-05'te ikiye katlanır.

React Query'nin borcu ise **merkezî ve görünür**: bir bağımlılık, bir sürüm, ve cache anahtarı disiplini. Biri bozulduğunda tek yerde bozulur.

**Taşınabilirlik sınırını bozmuyor** (`DECISION_LOG` — "Taşınabilirlik sınırı"): React Query servis katmanının **üstünde** durur, Supabase'i tanımaz. Sağlayıcı değişse `queryFn`'in içi değişir, deseni değişmez.

**Reddedilen:** "Karar v1.3-00'da ölçülerek verilsin" seçeneği. İki deseni bir ekranda deneyip karşılaştırmak bir hafta alırdı ve v1.3-05 zaten cevabı belirliyordu; ölçüm bilinen bir sonucu doğrulamak için harcanmış olurdu.

### Karar: Hafta yedi gündür — istemci tipi veritabanına uyar

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-07 `schedule_entries.day_of_week`'i **ISO 8601 (1–7)** olarak yazdı ve gerekçesini kaydetti: dershanede hafta sonu kursu gerçektir. İstemcideki `WeekDay` tipi ise beş gün (Pazartesi–Cuma). Ayrım bir **K-11 kaydı** olarak bırakılmış, kararı v1.3-01'e çapalanmıştı.

**Karar:** İstemci tipi yediye genişletilir. Uygulama yeri **v1.3-00**, ekranların tabloya bağlanmasından önce.

**Gerekçe:** Beşte kalmak ücretsiz değildi — "kaydedilmiş ama hiçbir ekranda görünmeyen ders satırı" riskini kapatmak için veritabanına ayrıca bir kısıt yazmayı gerektirirdi. Yani dar seçenek **hem gerçeğe aykırı hem de daha çok iş**. Görünmeyen kayıt, kullanıcının veri kaybı sandığı ama aslında yalnızca görüntülenmeyen kayıttır ve teşhisi zordur.

### Karar: Staging ortamı v1.5'e ertelenir

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Preview derlemeleri demo modunda çalışıyor, dolayısıyla Supabase'e hiç istek gitmiyor ve **auth ile RLS davranışının tek doğrulama yeri production.** Bu `PLATFORM_SETTINGS` §5'te kabul edilmiş bir açık olarak zaten kayıtlı ve tetikleyicisi _"panel gerçek kurum verisi yönetmeye başladığında"_ yazıyor. 2026-09-05 kapsam turu bunu yeniden gündeme getirdi: v1.3 yedi servisi canlı sorguya bağlayacak ve risk büyüyor.

**Karar:** Ayrı bir Supabase staging projesi **şimdi kurulmaz**; v1.5'te ele alınır. §5'teki kayıt ve tetikleyicisi geçerliliğini korur.

**Gerekçe ve kabul edilen bedel:** v1.3 boyunca her servis bağlantısı **canlı sistemde ilk kez sınanacak.** Bu bilinerek kabul edildi. Hafifleten iki şey var: v1.3-01 yazma değil **okuma** getiriyor (yazma akışları v1.4'te), ve production'da bugün yalnızca iki test kurumu var, gerçek kurum verisi yok.

**Yeniden değerlendirme:** §5'teki tetikleyici korunuyor. Ek olarak **v1.4-00 açılışında** yeniden bakılmalıdır — orada kimlik ve akademik kayıt bağlanacak, yani yazma akışları başlayacak ve "canlı sistemde ilk kez sınama" bedeli okumadan yazmaya geçecektir.

### Karar: Yetki RLS'te, bütünlük şemada durur

**Durum:** Alındı
**Tarih:** 2026-09-05
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.2-14, iki tabloda "bir kayıt iki ucuna birden aittir" kuralını uygulayacaktı (**K-17**). Doğal refleks bunu mevcut RLS politikalarına bir koşul daha ekleyerek yapmaktı — sistemdeki bütün kapsam mantığı orada yaşıyor.

**Karar:** Bu tür kurallar RLS politikasına değil **trigger'a** yazılır. Genel biçimiyle: **"kim yazabilir" RLS'in, "yazılan satır tutarlı mı" şemanın işidir.**

**Gerekçe — üç sebep, üçü de tek başına bağlayıcı:**

1. **`service_role` RLS'i atlar.** İş tablolarında `grant all ... to service_role` var ve Edge Function'lar bu rolle yazıyor. Politikaya yazılan bir bütünlük kuralı onlar için **hiç var olmazdı** — yani kuralın en çok güvenilmesi gereken yazma yolunda hiç bulunmazdı.
2. **Bu bir yetki sorusu değil.** "Yoklama kaydının öğrencisi oturumun sınıfında mı" sorusunun cevabı çağırana göre değişmez. Çağırandan bağımsız bir doğruluk koşulunu çağırana bağlı bir mekanizmaya yazmak, kavramları karıştırmaktır.
3. **Politikalar `OLD` ile `NEW`'i karşılaştıramaz.** Kuralın tam hâli "ekleme doğru olsun" değil "ebeveyn sonradan taşınıp kuralı bozmasın" — bu ancak trigger'da ifade edilebilir.

**Zaten var olan örnekle tutarlı:** bileşik yabancı anahtarlar tenant sınırını RLS'ten bağımsız olarak veri düzeyinde tutuyor. Bu karar aynı ayrımı bir adım ileri götürüyor.

**Bedeli, bilinerek kabul edildi:** hata artık politika reddi (`42501`) değil özel bir SQLSTATE (`ORB02`). Yani istemci iki farklı ret biçimini ayırt etmek zorunda. Karşılığında ret **sebebini** taşıyor: `detail` hangi öğrenci ve hangi sınıf olduğunu, `hint` ne yapılacağını yazıyor — politika reddinin veremediği bilgi.

**Reddedilen:** aynı koşulu hem politikaya hem trigger'a yazmak. İki yerde tutulan bir olgunun biri eskir (**K-06**) ve burada eskiyen taraf sessizce açık bırakırdı.

### Karar: Kendi verisine erişim arşivlenmez; devredilen erişim arşivlenir

**Durum:** Alındı
**Tarih:** 2026-09-06
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Kapsam turu bir tutarsızlık buldu: `current_user_guards_student` hem bağın hem veli kaydının `archived_at`'ine bakıyor, `current_user_owns_student_record` ise hiçbirine bakmıyor. İlk bakışta "biri unutulmuş" gibi duruyordu.

**Karar:** Asimetri **kasıtlıdır ve korunur.** İki fonksiyon farklı bir soruyu soruyor:

- **Veli erişimi devredilmiş bir erişimdir.** Velilik bağı sona erebilir — velayet değişikliği, ayrılık, kurumun bağı kaldırması. Sona erdiğinde erişimin de bitmesi gerekir; `archived_at` kontrolü v1.2-03'ün "veli yalnızca kendi bağını görür" kararının uygulanma yeridir.
- **Öğrencinin erişimi kendi kaydınadır.** Arşivlenme "kurumdan ayrıldı" demektir, "geçmiş yoklaması artık ona ait değil" demek değildir.

**Gerekçe — simetri burada bir erdem değil hata olurdu.** `owns_student_record`'a `archived_at` eklemek, ayrılan bir öğrenciyi kendi devamsızlık ve sınav geçmişinden keserdi. KVKK açısından da savunulamaz: kişinin **kendi verisine** erişim hakkı kurumdan ayrılmasıyla bitmez.

**Karar testle çivilendi ve çivinin tuttuğu ölçüldü.** `attendance.test.sql`'e "arşivlenmiş öğrenci kendi geçmişini okur" iddiası eklendi; sonra fonksiyona geçici olarak `archived_at is null` eklenip süit koşuldu ve **yalnızca o test kırmızıya döndü**. Yani ileride biri "tutarlılık" adına aynı düzeltmeyi yaparsa sessizce geçemez.

### Karar: Ders, sınıfa bağlanmaz — çünkü sınıfın ders listesi diye bir model yok

**Durum:** Alındı
**Tarih:** 2026-09-06
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Kapsam turu, `attendance_sessions.subject_id` ve `exams.subject_id`'nin o sınıfta okutulan bir derse ait olduğunun kontrol edilmediğini buldu. Bileşik yabancı anahtarlar dersin **aynı kuruma** ait olmasını garanti ediyor, "bu sınıfın dersi" olmasını değil.

**Karar:** Kısıtlanmaz. Kontrol noktası **v1.4-02** (sınıf yönetimi).

**Gerekçe — kısıtlamak var olmayan bir modeli icat etmek olurdu.** Şemada `class_subjects` diye bir tablo yok; sınıf ile ders arasındaki tek bağ `class_teachers (class_id, subject_id)`, yani _"bir öğretmen bu sınıfta bu dersi veriyor"_. Onu "sınıfın ders listesi" saymak iki şeyi birden yapardı:

1. **Karar verilmemiş bir modeli sessizce benimsemek.** Bir sınıfın ders listesi olup olmadığı hiçbir yerde konuşulmadı.
2. **Meşru bir sırayı kırmak.** Öğretmen atanmadan o sınıfa yoklama oturumu açmak veya sınav tanımlamak imkânsız hale gelirdi; dershanede deneme sınavı öğretmen atamasından önce planlanır.

**Orantı:** yanlış ders seçmenin bugünkü bedeli ekranda görünen bir veri giriş hatasıdır — yetki sızıntısı değil. Kısıtın bedeli ise gerçek bir akışı kapatmak olurdu.

Gerekçe `comment on column` ile şemaya da yazıldı: tutarsızlığı orada gören bir sonraki kişi, kararın kendisini de orada görür.

### Karar: Cache anahtarı kurumu taşır; sayfalama imleçlidir; sessiz kesme yoktur

**Durum:** Alındı
**Tarih:** 2026-09-07
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** _"İstemci veri katmanı React Query üzerine kurulur"_ kaydı (2026-09-05) sözleşmenin **v1.3-00'da** yazılacağını söylemişti: cache anahtarı biçimi, sayfalama, invalidation ve hata durumu. Bu kayıt o borcu ödüyor.

Ölçülen bugünkü durum (2026-09-07 otomasyon turu, `ROADMAP.md` §4.9): `new QueryClient()` **varsayılansız** kurulmuş, ve yayında olan iki liste — `audit/auditService.ts:165` ile `platform/platformService.ts:190` — `.limit()` ile **sessizce** kesiliyor. İmleç yok, toplam yok, arayüzde kesildiğine dair hiçbir işaret yok.

---

**Karar 1 — cache anahtarı sonucu değiştiren her girdiyi taşır; `organization_id` istisnasız.**

Anahtar biçimi `[alan, kaynak, kapsam]`. Kapsamın içinde **her zaman** aktif kurum bulunur.

Bu bir düzen tercihi değil, bir **izolasyon kuralıdır.** Kurum kimliği anahtarda yoksa, iki kuruma da erişimi olan bir platform operatörü kurum değiştirdiğinde React Query önceki kurumun satırlarını cache'ten servis eder. RLS bunu engelleyemez — çünkü sunucuya hiç gidilmez. **Tenant sınırı bu depoda iki bağımsız mekanizmayla tutuluyor (RLS ve bileşik yabancı anahtarlar); cache üçüncü bir sınırdır ve tek koruması bu kuraldır.**

Aynı sebeple oturum kapandığında cache **temizlenir**; bir sonraki kullanıcı öncekinin verisini görmemelidir. Paylaşılan dershane bilgisayarı senaryosu (#132) bunu zorunlu kılar.

---

**Karar 2 — zamana göre sıralı listeler imleçle, sınırlı listeler tek sorguyla.**

| Liste türü                           | Yöntem                                         | Örnek                                       |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------- |
| Zamana göre sıralı, sınırsız büyüyen | **İmleç** — `.lt(sıra_sütunu, imleç).limit(n)` | denetim kaydı, günlük akış                  |
| Doğal olarak sınırlı ve kapsanmış    | **Tek sorgu**, makul üst sınırla               | bir sınıfın öğrencileri, bir günün programı |

**Offset reddedildi ve sebebi somut:** denetim kaydı `created_at desc` sıralı ve **büyüyen** bir tablo. Offset ile ikinci sayfaya bakarken yeni bir olay eklenirse bir satır iki kez görünür ya da bir satır hiç görünmez. Denetim kaydı bir **uyum yüzeyidir**; orada atlanan satır kabul edilemez. Derin sayfalarda Postgres'in yavaşlaması ikincil bir sebep.

Offset'in tek gerçek üstünlüğü — "3. sayfaya git" ve toplam sayfa sayısı — bu iki liste için kimsenin ihtiyacı olmayan şeydir.

---

**Karar 3 — kesildiği söylenmeden hiçbir liste kesilmez.**

Bir listenin sonu, ya **gerçek sonudur** ya da devamının olduğu **kullanıcıya görünür**. Üçüncü bir seçenek yok.

Bu **K-03**'ün ("çözümlenemeyen veri uydurulmuş değerle gösterilmez") liste hâlidir: eksik bir liste, eksik olduğunu söylemediği sürece **tam bir liste olduğunu iddia eder.** Bugünkü denetim kaydı yöneticiye en yeni 50 olayı gösterip "hepsi bu" diyor; oysa bilmiyor.

**Gerekçe — neden kural sayfalama değil de görünürlük üzerine yazıldı.** Sayfalama bir uygulama detayıdır ve ekrandan ekrana değişebilir; değişmemesi gereken şey, kullanıcının gördüğüne güvenebilmesidir. Kuralı "her liste sayfalanacak" diye yazsaydık, sayfalamaya ihtiyacı olmayan ekranlarda gereksiz iş üretir ve asıl meseleyi — sessizliği — yakalamazdı.

**Karşılığı ölçülebilir bir release gate maddesidir** (`ROADMAP.md` §4 v1.3): sayfa boyundan fazla satır üretilir, ekranda ya devamı ya da kesildiği görünür.

---

**Karar 4 — `QueryClient` varsayılanları açıkça yazılır.**

Varsayılanı varsayılan bırakmak da bir karardır, ama **kaydedilmemiş** bir karardır: v1.3'te bağlanacak 33 ekranın hepsi onu miras alır ve kimse ne miras aldığını bilmez.

Yeniden deneme, izin hatalarında yapılmaz. RLS'in reddettiği bir sorgu üç kez daha reddedilir; tek kazancı kullanıcının hatayı üç kat geç görmesidir.

Hata **ekranın kendisine** ulaşır. Genel bir bildirim, hangi ekranın başarısız olduğunu gizler ve v1.3-02'nin yazacağı hata durumlarını anlamsız kılar.

Kesin değerler `v1.3-00`'ın uygulamasında yazılır ve `main.tsx`'te yorumuyla birlikte durur.

**Reddedilen:** varsayılanları React Query'nin kendi seçimine bırakmak. Bugünkü `refetchOnWindowFocus` varsayılanı `true`; paylaşılan bir dershane bilgisayarında sekme değiştikçe sorgu üretir ve ücretsiz katmanda bu bedeli ölçmeden kabul etmiş oluruz.

### Karar: Servis ve sorgu hook'ları alan klasöründe, bileşenler `components/` altında

**Durum:** Alındı
**Tarih:** 2026-09-07
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Depoda iki yerleşim bir arada duruyor ve hangisinin kural olduğu yazılı değil (2026-09-07 turu, `ROADMAP.md` §4.9):

| Klasör                    | İçeriği                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `platform/`               | bileşen + servis + test bir arada — 11 dosya                     |
| `audit/`, `organization/` | yalnız servis; bileşenleri `components/education/pages/` altında |

v1.3-01 otuz üç eğitim ekranını veriye bağlayacak ve sorgu hook'larının nerede yaşayacağı bugün **hiçbir yerde** yazılı değil.

**Karar:** Servisler ve sorgu hook'ları **alan klasöründe** (`audit/`, `organization/`, `education/` …); bileşenler `components/` altında. `platform/` **belirlenmiş bir istisnadır**.

**Gerekçe — istisna neden istisna kalıyor.** `platform/` bir alan değil, **ayrı bir yüzeydir**: kendi rotası (`/platform`), kendi kabuğu (`PlatformShell`) ve kurum kullanıcılarının hiç görmediği bir izleyici kitlesi var. Bir özellik klasörü olarak durması tesadüf değil, o yüzden bozulmuyor.

**Reddedilen: her şeyi özellik klasörüne taşımak.** Tek bir tutarlı kural üretirdi, ama bedeli 33 bileşenin taşınması — v1.3-01'in önüne konan, davranış değiştirmeyen büyük bir diff ve ESLint kuralının yolla eşleşen mantığının yeniden yazılması. **Tutarlılık için ödenen bu bedel, tutarsızlığın bugüne kadar yol açtığı bir soruna karşılık gelmiyor.** Kararın asıl işi taşımak değil, **yazmaktı**.

**Bağlayıcı sonuç — ESLint kuralı genişletilir.** Taşınabilirlik sınırı (`DECISION_LOG` — "Taşınabilirlik sınırı") bugün yalnız `components/` ve `pages/` için koşuyor. `hooks/` ve `contexts/` Supabase istemcisini serbestçe import edebiliyor — **ve v1.3'ün sorgu hook'ları tam oraya yazılacak.** Kural genişletilmezse taşınabilirlik sınırı, onu ilk kez zorladığımız gün sessizce delinir.

Sorgu hook'ları servisi çağırır, Supabase'i değil. Supabase'i tanıyan tek katman servis modülleridir ve bu kararla o katmanın nerede yaşadığı da yazılı hale gelir.

### Karar: Veli adı ve ders veren öğretmenin adı kurum içinde görülebilir bilgidir

**Durum:** Alındı
**Tarih:** 2026-09-07
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.3-01/A incelemesinde canlıda ölçüldü (#228). Geçici bir öğrenci, sınıf, veli ve bağ yazılıp dört rolün kimliğiyle sorgulandı, sonra silindi:

| Rol     | öğrenci | veli  | bağ   | sınıf | profil           |
| ------- | ------- | ----- | ----- | ----- | ---------------- |
| admin   | 1       | 1     | 1     | 1     | **4**            |
| teacher | 1       | **0** | **0** | 1     | 1 (yalnız kendi) |
| student | 1       | **0** | **0** | 1     | 1 (yalnız kendi) |
| parent  | 1       | 1     | 1     | 1     | 1 (yalnız kendi) |

`guardians` yalnız `_select_admin` ve `_select_self` politikalarına sahipti; `profiles` ise self, platform operatörü ve kurum admini. Yani öğretmen, öğrettiği çocuğun velisinin adını göremiyordu; öğrenci de kendi sınıfının öğretmeninin adını.

⚠️ **Düzeltme (2026-09-08).** Bu kayıt ilk yazıldığında _"bunun bilinçli olduğuna dair hiçbir kayıt yoktu"_ diyordu. **Yanlıştı ve kaydı aramak için yeterince derine bakılmamıştı.** Kayıt `DECISION_LOG`'da değil, **testte**:

```sql
-- supabase/tests/database/student_guardians.test.sql:275
'a teacher sees no guardian links — that is not their business'
```

Yani öğretmenin veliyi görmemesi bir boşluk değil, **gerekçesi yazılmış ve teste sabitlenmiş bir sınırdı.** Karar kaydı seviyesinde değildi — migration yorumunda da gerekçe yoktu — ama açık bir niyet beyanıydı.

**Bu kayıt, o sınırın bilerek geri alınmasıdır.** Arda Bülent önceki sınır kendisine gösterildikten sonra kararını sürdürdü (2026-09-08).

**Neden geri alınıyor:** _"bu onun işi değil"_ cümlesi bir dershanenin işleyişini yanlış tarif ediyor. Öğretmenin veliyle konuşması istisna değil, işin kendisi — devamsızlık, ödev, sınav sonucu. Adını bilmediği bir veliyle iletişim kuramaz.

**Ve açılan şey dar:** `guardians` tablosunda telefon ve e-posta **yok** (2026-09-04, "İş tabloları asgari kişisel veriyle açılır"). Öğretmenin öğrendiği tek şey **velinin adı**. Sınır kaldırılmıyor, daraltılmış haliyle yeniden çiziliyor: kurumdaki her veli değil, **kendi öğrencilerinin** velisi.

**Eski test iddiası silinmiyor, tersine çevriliyor ve sebebi yanına yazılıyor.** Silinen bir iddia, o iddianın hiç var olmadığı izlenimi bırakır.

**Karar:** İkisi de görülebilir. Veli adı, çocuğu okutan öğretmene açıktır; ders veren öğretmenin adı, o dersi gören öğrenciye ve velisine açıktır. Bunlar özel bilgi değil, kurumun günlük işleyişinin gerektirdiği bilgidir — bir öğretmenin veliyle konuşabilmesi ve bir öğrencinin öğretmeninin adını bilmesi olağandır.

**Kapsam dar tutulur, "görülebilir" ile "herkese açık" aynı şey değildir.** Öğretmen kurumdaki her velinin değil, **kendi öğrencilerinin** velisini görür. Öğrenci kurumdaki her üyenin değil, **gördüğü sınıfın** öğretmenini görür. Ölçüt yine öğretim ilişkisidir; rol değil (`DECISION_LOG` — "Öğretmenin yazma yetkisi rolünden değil atamasından gelir").

**Uygulama iki farklı araç istiyor ve sebebi sütunlar.**

- **Veli adı → RLS politikası.** `guardians` tablosu ad, kurum bağı, opsiyonel giriş hesabı ve arşiv damgasından ibaret. Hassas sütun yok; satır düzeyinde açmak yeterli. `student_guardians` bağ satırları da açılır, aksi halde bağ görünmediği için veli de görünmez.
- **Öğretmen adı → fonksiyon, politika DEĞİL.** `display_name` hassas değil, ama `profiles` onunla aynı satırda `recovery_email`, `phone`, `must_change_password` ve `password_expires_at` taşıyor. RLS **satır** düzeyinde çalışır; tabloyu ada erişim için açmak, kurtarma e-postasını ve telefonu da açar. Karşılığı `DECISION_LOG` — "Sütun maskeleme RLS'in işi değildir; sıralama bir fonksiyondan gelir": `exam_ranking` aynı sebeple fonksiyondur.

**Reddedilen: `profiles` için "üyeler birbirini okuyabilir" politikası.** En kısa yol buydu ve yanlış olurdu. Bir kurumda herkesin kurtarma e-postasını ve telefonunu meslektaşlarına açardı; üstelik bunu yaparken **hiçbir hata vermezdi** — açılan şey istenen şeyden fazla olduğunda kimse fark etmez.

**Reddedilen: kurum geneli ad görünürlüğü.** "Aynı kurumdaki herkes birbirinin adını görsün" de basit olurdu, ama `organization_memberships` velileri ve öğrencileri de kapsıyor: her öğrenci her velinin adını görürdü. Soru "öğretmenimin adı" idi, cevabı "kurumdaki herkes" değil.

**Bedeli — bilinerek yazılıyor:** iki yeni kapsam yolu, iki yeni test yükü ve `guardians` üzerinde bugüne kadar olmayan bir okuma yolu. Yanlış yazılırsa bir kurumun velileri başka bir öğretmene görünür. Bu yüzden pgTAP tarafında **olumsuz senaryo** zorunludur: öğretmediği öğrencinin velisini **göremediği** ayrıca sınanır.

### Karar: Devam yüzdesinde izinli ders hiç sayılmaz; geç kalma devamdır

**Durum:** Alındı
**Tarih:** 2026-09-08
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `Student.attendance` (arayüzde "Devam %") v1.3-01/A'da opsiyonel bırakıldı, çünkü kaynağı yoktu: `students` tablosunda böyle bir sütun yok, değer `attendance_records`'tan **türetilmeli**. C parçası bunu türetecek — ama hangi kuralla türeteceği **hiçbir yerde yazılı değildi.**

Veritabanı dört durum tutuyor: `present`, `late`, `absent`, `excused` (arayüzde Katıldı / Geç kaldı / Gelmedi / İzinli).

**Karar:**

```
Devam % = (Katıldı + Geç kaldı) / (Katıldı + Geç kaldı + Gelmedi)
```

**İzinli ne payda ne paydadadır** — o ders, o öğrenci için hiç olmamış gibi ele alınır.

**Gerekçe — izinli neden iki tarafta da yok.** İki uç da yanlış bir şey söylüyor. İzinliyi **devamsız** saymak, raporlu ya da kurumdan izinli bir çocuğu cezalandırır ve velisine düşük bir yüzde gösterir. İzinliyi **devam** saymak ise hiç derse gelmemiş bir öğrenciyi %100 devam gibi gösterebilir. Üçüncü seçenek — dersi hiç saymamak — ikisinin de yalanını söylemez: izin verilmiş bir yokluk, ölçülen şeyin dışındadır.

**Geç kalma neden devam sayılıyor.** Öğrenci derste. Dakiklik ayrı bir mesele ve arayüzde zaten ayrı bir sinyal olarak görünüyor; onu devam yüzdesine katmak iki farklı olguyu tek sayıya sıkıştırır ve ikisini birden okunamaz kılar.

**Payda sıfır olabilir ve bunun cevabı var.** Bütün kayıtları izinli olan bir öğrencide payda sıfırdır. O durumda yüzde **hesaplanmaz** — `undefined` kalır ve **K-22** gereği rozet hiç çizilmez. Sıfıra bölmenin sonucu `0` değildir; "bu öğrencinin devamı ölçülemedi" demektir ve ekran bunu bir sayı uydurarak söyleyemez.

**Kaydı olmayan öğrenci de aynı yere düşer.** Hiç yoklama kaydı olmayan bir öğrencinin devamı `%0` değildir; **bilinmiyordur**.

**Reddedilen: `Katıldı / tüm kayıtlar`.** Tek ve tartışmasız bir tanım olurdu, ama derste bulunan bir öğrenciyi devamsız sayarak öğretmenin gözlemiyle çelişirdi; ayrıca izinli öğrenciyi de devamsız gösterirdi.

**Reddedilen: izinliyi devam saymak.** Payda hiç sıfır olmazdı ve her öğrencinin bir yüzdesi olurdu — ama hiç derse gelmemiş bir öğrencinin %100 görünmesi, sayının anlamını yok eder.

**Bu bir sunum kuralı değil, iş kuralıdır.** Bu yüzden türetme servis katmanında yapılır ve ekran yalnız gösterir; iki ekran aynı öğrenci için farklı yüzde hesaplamamalıdır (**K-06**).

---

### Karar: Katılımcı sayısı sınavın sayısıdır, okuyanın gördüğü satırların değil

**Durum:** Alındı
**Tarih:** 2026-09-08
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.3-01/D sınav başlığını canlıya bağlarken "54 katılımcı" ibaresini `exams` sorgusuna gömülen `exam_results` dizisinin **uzunluğunu sayarak** üretiyordu. `exam_results` üzerindeki RLS satır bazlıdır: yönetici kurumun hepsini, öğretmen yalnız okuttuğu öğrencilerin satırını, öğrenci ve veli yalnız kendisininkini görür.

Canlıda ölçüldü (`begin; … rollback;`, kalıcı satır yazılmadı). Üç kişinin girdiği bir kurum geneli denemede:

```
gerçek katılımcı : 3
yönetici görür   : 3   ✅
öğretmen görür   : 2   ❌
öğrenci görür    : 1   ❌
```

Yani öğrenci ve veli için ekranda **her zaman "1 katılımcı"**, sınava girmemiş biri için **her zaman "0 katılımcı"** yazacaktı. Sabit, yetkili görünen ve yanlış bir sayı.

**Karar:** Bir sınava kaç kişinin girdiği **sınavın kendi olgusudur**, okuyanın yetkisinin değil. Sayı `exam_participant_count(uuid)` fonksiyonundan gelir; fonksiyon `security definer`'dır ve sayımı sınavın tamamı üzerinde yapar.

**Yetki koşulu uydurulmadı, `exam_ranking`'inkinin aynısıdır:** çağıran sınavda **en az bir öğrenciyi görebiliyorsa** sayı döner. Aynı olgunun iki yerde iki farklı kurala bağlanması, birinin sessizce eskimesi demekti (**K-06**).

**Yeni bir yetki açılmıyor ve bu ölçüldü.** `exam_ranking` bugün sınavdaki **her sonuç için bir satır** döndürüyor — isimler maskeli ama satır sayısı gerçek. Aynı ölçümde yönetici, öğretmen ve öğrenci üçü de o fonksiyondan **3 satır** aldı; sınavla ilgisi olmayan üye boş küme aldı. Yani katılımcı sayısı aynı çağırana zaten türetilebilirdi; yeni fonksiyon onu ucuza veriyor.

**Yetkisize `0` değil `null` döner.** `0`, "bu sınava kimse girmedi" demektir ve bu bir iddiadır (**K-22**). `null` bir şey söylemez; istemci de o ibareyi hiç çizmez. Sonucu henüz girilmemiş bir sınav da `null` döner: "kimse girmedi" ile "sana gösterecek bir şey yok" ayrımını yapmak, ilgisiz bir üyeye "bu sınavın sonuçları girilmiş" bilgisini sızdıracak yeni bir kanal açardı.

**Reddedilen: sayıyı `exam_ranking`'ten satır sayarak almak.** Doğru sayıyı verirdi, ama 500 kişilik bir denemede başlıktaki tek sayı için 500 satır taşınırdı — ve LİSTE ekranı SIRALAMA yoluna bağlanmış olurdu. Bu günlüğün kendi cümlesi: _"İki yol birbirinin yerine geçmez."_

**Reddedilen: sayıyı yalnız yöneticiye göstermek.** Yönetici için doğru olurdu, ama istemci "yönetici her satırı görür" varsayımını kendi içinde yeniden kurardı; o varsayım RLS'in işidir ve iki yerde tutulan her olgu gibi eskirdi (**K-06**).

**Reddedilen: sayıyı hiç göstermemek.** Yanlış olmazdı ama bilinen bir şeyi saklardı. Susmak, ancak cevap bilinmiyorken doğru cevaptır.

**Bu, C parçasındaki sessiz tavanla aynı ailedendir.** Orada devam yüzdesi eksik bir satır kümesinden hesaplanıyordu; burada katılımcı sayısı süzülmüş bir satır kümesinden sayılıyordu. İkisinde de ekran, sistemin bilmediği bir şeyi biliyormuş gibi gösteriyordu.

---

### Karar: Ödeme durumu iki değerlidir; planı olmayan "Güncel" değildir

**Durum:** Alındı
**Tarih:** 2026-09-09
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Şema durumu bilerek saklamıyor. `installments` tablosunun kendi yorumu şunu yazıyor: _"Ödendi, gecikti, yaklaşıyor gibi durumlar `paid_at` ve `due_date`'ten TÜRETİLİR, saklanmaz"_ — çünkü saklanan bir durum, tarih geçtiği gün sessizce yanlışa döner.

Türetileceği yazılıydı; **hangi kuralla türetileceği hiçbir yerde yazılı değildi** (#239). Arayüz de kendi içinde tutarsızdı: `Student.payment` iki değerli (`"Güncel" | "Takip gerekli"`), ödeme ekranının `PaymentRow.status`'ü üç değerli (`"Güncel" | "Hatırlatma gerekli" | "Gecikme riski"`). Demo verisi üçüncü bir şey söylüyordu: iki satır da vadesi geçmiş, biri "Hatırlatma gerekli" biri "Gecikme riski" — yani ayrım gecikmenin **süresi** gibi duruyor ama eşik hiçbir yerde yok.

**Karar:**

```
vadesi geçmiş ödenmemiş taksit var  →  "Takip gerekli"
yok                                 →  "Güncel"
görülebilir ödeme planı yok         →  hiçbir şey (rozet çizilmez)
```

**Üçüncü satır kuralın yarısıdır.** Ödeme planı olmayan öğrenci "Güncel" **değildir** — güncel olunacak bir şey yoktur. Aynı yere ödemeyi görmeye yetkisi olmayan çağıran da düşer: öğretmen ve öğrenci boş küme alır ve boş küme "Güncel"e çevrilmez. Yetkisi olmayana "Güncel" demek, ona ödeme hakkında bir şey söylemektir (**K-22**).

**İki ekran aynı kelimeyi kullanır.** `PaymentRow.status` union'ına `"Takip gerekli"` eklendi. İki ekranın aynı olguya iki farklı ad vermesi, aynı olgunun iki yerde tutulmasının en sinsi biçimidir (**K-06**).

**Reddedilen: üç durum, "yaklaşan / geçmiş" ayrımıyla.** `"Hatırlatma gerekli"` = önümüzdeki yedi gün içinde vadesi gelen, `"Gecikme riski"` = vadesi geçmiş. Okunaklıydı ve yedi günlük pencere `educationData.ts`'te zaten yazılı. Ama demo verisiyle çelişiyordu ve asıl mesele şu: bu bir **yeni kural yazmak** olurdu, mevcut bir kuralı uygulamak değil.

**Reddedilen: üç durum, gecikme eşiğiyle.** Demo'nun ima ettiği okuma (`N günden az` / `N günden çok`). Eşiği kimse yazmamış; uydurulan bir eşik, veliye gönderilen hatırlatmanın zamanlamasını belirlerdi.

**Demo değişmedi.** Üç durum demoda eskisi gibi görünüyor. Üretim onları çizmiyor çünkü kuralları yok — eksik değil, **kuralı yazılana kadar kapsam dışı**.

**Vade karşılaştırması istemcide yapılmaz.** "Bugün" kurum saatine (`Europe/Istanbul`) göre veritabanında hesaplanır. Tarayıcının saat dilimine bırakılsaydı aynı taksit iki veliye iki farklı gün gecikmiş görünürdü (**K-06**). Ayrıntı: v1.3-15 migration'ı.

---

### Karar: Denetim kaydının imleci saat değil sıra numarasıdır

**Durum:** Alındı
**Tarih:** 2026-09-09
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** 2026-09-07 kararı ("sessiz kesme yoktur") zamana göre sıralı, sınırsız büyüyen listeler için yöntemi yazmıştı: **imleç** — `.lt(sıra_sütunu, imleç).limit(n)`. Ama **hangi sütun** olduğunu yazmamıştı. Doğal okuma `created_at` derdi.

**Karar:** Sıra sütunu ve imleç ölçütü **`id`**'dir, `created_at` değil. `created_at` ekranda gösterilmeye devam eder; değişen yalnız sıralama ve imleç ölçütüdür.

**Gerekçe — `created_at` sessizce satır atlar ve bu ölçüldü.** `created_at` varsayılanı `now()` ve `now()` **işlem başlangıç zamanıdır**. Canlıda ölçüldü: tek bir işlem içinde, arada 150 ms uyku olmasına rağmen iki `now()` çağrısı **birebir aynı** değeri döndürdü; `clock_timestamp()` ise ilerledi.

```
now()          → 2026-09-09 15:13:45.958729+00
pg_sleep(0.15)
now()          → 2026-09-09 15:13:45.958729+00
```

Yani aynı işlemde yazılan her denetim olayı **aynı zaman damgasını** taşır. `.lt(created_at, imleç)` biçiminde bir imleç, sınır zaman damgasını paylaşan satırların hepsini birden atlar. Bu, offset'in reddedilme sebebiyle aynı hatadır — sadece daha sinsisi, çünkü offset'te satır atlanması eşzamanlı yazmaya bağlıyken burada **tek bir işlemin kendisi yetiyor**.

**`id` bu sorunların hiçbirini taşımıyor.** İki denetim tablosunda da `id bigint generated always as identity`: tekil ve artan. Keyset imleci üzerinde eşitlik, atlama ya da tekrar yok. PostgREST bunu doğrudan ifade ediyor (`.lt("id", imleç)`); `(created_at, id)` bileşik keyset'i ise `or(...and(...))` cambazlığı veya ayrı bir veritabanı fonksiyonu gerektirirdi — yani daha kırılgan bir çözüm, daha kötü bir sebep için.

**Kabul edilen bedel: duvar saatinden küçük bir sapma.** İki eşzamanlı işlem, `created_at` sırasının tersine `id` alabilir: A önce başlar, B önce yazar. Bu yalnız eşzamanlı işlemlerde olur ve orada "hangisi önce oldu" sorusunun zaten kesin bir cevabı yoktur. Buna karşılık kazanılan şey, listenin **hiçbir satırı atlamayacağının garantisi**.

**Reddedilen: `(created_at, id)` bileşik keyset.** Duvar saati sırasını da korurdu. Ama PostgREST'te ifadesi kırılgan, indeksi daha geniş, ve kazandırdığı şey — eşzamanlı işlemlerde kesin sıralama — bu iki ekran için kimsenin ihtiyacı olmayan bir kesinlik.

**Reddedilen: `created_at`'i `clock_timestamp()`'e çevirmek.** Çakışmayı gerçekten çözerdi ama iki yayında olan tabloda varsayılan değiştirmek demek; üstelik `id` zaten elde hazırken.

**İndeks:** `audit_events (organization_id, id desc)`. Canlıda doğrulandı — plan hem kurum süzmesini hem imleci tek indeks taramasında karşılıyor. `platform_audit_events` süzmediği için birincil anahtar indeksi yetiyor. Eski `created_at` indeksleri **bırakıldı**: tarih aralığıyla filtreleme hâlâ onların işi.

---

### Karar: Realtime tetikleyiciyle yayınlanır; kanalın adı kapsamdır

**Durum:** Alındı
**Tarih:** 2026-09-09
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.3-05 Realtime'ı getiriyor ve **v1.4'ün release gate'i buna dayanıyor**. Bu bir otonom davranış açıyor — her açık sekme kalıcı bir WebSocket tutacak — bu yüzden mekanizma seçilmeden önce açıklandı ve onaylandı (**K-20**).

Ölçülen başlangıç: `supabase_realtime` yayını var ama **içi boş**; istemcide hiç Realtime kodu yok; `realtime.messages` RLS açık ve **sıfır politikalı** (yani her özel kanal kapalı); on bir iş tablosunun hepsinde `REPLICA IDENTITY = default`.

**Karar:** Değişiklikler **veritabanı tetikleyicisinden Broadcast** ile yayınlanır. Konu adı `org:<organization_id>`; yetki `realtime.messages` üzerindeki tek bir politikayla, **kanal düzeyinde** çözülür. `postgres_changes` kullanılmaz.

**Gerekçe 1 — silme sızıntısı.** `postgres_changes` yolunda silme olayında eski satırdan yalnız birincil anahtar kalır (`REPLICA IDENTITY = default`), yani RLS'in süzeceği `organization_id` yoktur ve **başka kurumda silinen satırın kimliği her aboneye giderdi**. Bu depoda tenant sınırı iki bağımsız mekanizmayla tutuluyor; üçüncü bir yerden delinmesine izin verilmedi.

Tetikleyici yolu sorunu ortadan kaldırıyor: tetikleyicinin `OLD` kaydı `REPLICA IDENTITY`'den bağımsız olarak **tam satırdır**. Ölçüldü — DELETE tetiklendi ve doğru kuruma gitti.

**Gerekçe 2 — kanalın adı kapsamdır.** 2026-08-21 kararı zaten şunu yazmıştı: _"kanallar kurum ve gerekli sınıf kapsamıyla sınırlandırılacak"_. `postgres_changes`'te kapsam istemci tarafı bir süzgeçtir; burada **konu adının kendisidir** ve yetki her mesajda her abone için değil, abonelikte bir kez çözülür.

**Gerekçe 3 — yayın hiçbir veri taşımıyor.** Yük yalnızca tablo adı ve işlem türü. Yayın yükü satır düzeyinde RLS'ten geçmez; içine bir kimlik bile konsa kurum içindeki rol ayrımları (öğretmen ödeme görmez, öğrenci veli listesi görmez) yayında uygulanmazdı. Yayın bir **veri kanalı değil, bir dürtme**: istemci tazeler, veri her zamanki gibi RLS'ten geçerek gelir. Böylece Realtime kapsamı genişletmiyor, **yalnızca zamanlamayı** değiştiriyor.

**Reddedilen: `postgres_changes` + `REPLICA IDENTITY FULL`.** Silme sızıntısını kapatırdı ama her UPDATE'te tüm eski satırı WAL'a yazmak demekti, ve RLS her abone için her mesajda yeniden çalışırdı.

**Reddedilen: `postgres_changes`, silme kapsam dışı.** Sızıntıyı kapatırdı ama silinen kayıt ekranda durmaya devam ederdi — "kullanıcının gördüğüne güvenebilmesi" kuralıyla doğrudan çelişir.

**Ölçümler (canlı, `begin; … rollback;`):**

- Tek INSERT deyimi iki kuruma üç satır yazdı → **her kuruma tam bir mesaj** (deyim düzeyinde tetikleyici + geçiş tablosu).
- UPDATE ve DELETE birer mesaj üretti; DELETE yükünde yalnız tablo adı ve işlem türü vardı — veri yok.
- Kanal yetkisi: A üyesi A kanalında 1, **B üyesi A kanalında 0**, uydurulmuş konu adında **0**.
- `current_user_has_membership(null)` hata vermiyor, `false` dönüyor — bozuk konu adı kendiliğinden kapalı kapıya çarpıyor.

**Bir provizyon tuzağı bulundu ve yazıldı.** `realtime.messages` bölümlenmiş bir tablo ve ilk ölçümde **sıfır bölümü** vardı; `realtime.send` sessizce düşüyordu (kendi içinde `EXCEPTION WHEN OTHERS THEN RAISE WARNING` taşıyor). Sebep provizyondu: projede Realtime hiç kullanılmamıştı. Tek bir istemci aboneliği açıldı ve servis **beş günlük bölümü kendisi yarattı**. Bölüm yaşam döngüsü Supabase'in işi; `realtime` şemasında nesne oluşturma iznimiz yok (denendi, reddedildi).

---

### Karar: Akademik kayıt ile giriş hesabı ayrı bir adımda bağlanır

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `students.auth_user_id` ve `guardians.auth_user_id` sütunları v1.2'de açıldı ve **hiçbir zaman dolmadı**. v1.4-00 açılışında zemin canlıda ölçüldü:

|                                 | Ölçüm                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Sütunlar                        | ✅ ikisi de var, `nullable`                                                        |
| Yabancı anahtar                 | `auth.users(id)` **`on delete set null`** — hesap silinince kayıt durur, bağ kopar |
| Tekillik                        | `unique … where auth_user_id is not null` — bir hesap en fazla bir kayda bağlanır  |
| `students` / `guardians` satırı | **0 / 0**                                                                          |
| `deneme3` kurumunda             | **1 öğrenci üyeliği ve 1 veli üyeliği var, ikisinin de akademik kaydı yok**        |

RLS zinciri geçici bir satırla ölçüldü (işlem içinde, geri alındı): `auth_user_id` boşken öğrenci **0** satır görüyor, bağlandığında **1** — doğru ad, `current_user_owns_student_record` → `true`; başka kurumun yöneticisi **0**.

Üç politika (`students_select_self`, `guardians_select_self`, `student_guardians_select_guardian`) ve üç fonksiyon (`current_user_owns_student_record`, `current_user_guards_student`, `current_user_attends_class`) **tamamen** bu sütuna dayanıyor. Yani öğrenci ve veli okuma yolunun tamamı, yazılmayan bir sütuna bağlı.

**Karar:** Bağlama, `create-member` sözleşmesi genişletilerek değil **ayrı bir adım** olarak yapılır.

**Gerekçe:** Asıl sebep geriye dönük düzeltme değil — düzeltilecek kayıt yok, ölçüldü. Sebep ileriye dönük: **her öğrenci giriş hesabı almayacak.** Dershanede kaydı olup girişi olmayan öğrenci normal durumdur. Bağlama doğası gereği **isteğe bağlı ve ayrı** bir adımdır. Ayrıca `create-member` v1.2-17'de idempotency kazandı; sözleşmesi genişlerse idempotency anahtarı da değişir ve canlıda çalışan bir akış bozulur.

⚠️ **Düzeltme (aynı gün):** Bu karar sorulurken seçeneğin gerekçesinde _"bugün elimizde hesabı olmayan öğrenci kayıtları var"_ yazılmıştı. **Yanlıştı ve ölçülmeden yazılmıştı (K-11).** Doğrusu tam tersi: kaydı olmayan hesap var, hesabı olmayan kayıt yok. Karar aynı kalıyor, gerekçesi düzeltildi.

**Bunun getirdiği yükümlülük:** "bağlanmamış" bir ara durum var ve **ekranda görünmek zorunda** (**K-22**). Öğrenci üyeliği olup akademik kaydı olmayan kişi yöneticiye görünmelidir; aksi hâlde o kişi sisteme girer, boş ekran görür ve sebebini kimse bilmez.

**Bir sınır — yazılı olsun:** tekillik indeksi `auth_user_id` üzerinde **kurum ayrımı olmadan** tekildir. Bir kişi **aynı hesapla** iki kurumda birden öğrenci olamaz. Bu, çoklu hesap kararıyla (2026-08-25) tutarlıdır — o karar zaten kurum başına ayrı hesap diyor ve **v1.4-14** geçiş düğmesi bunun üzerine kuruludur.

**Alternatifler:**

- **`create-member` sözleşmesini genişletmek:** Reddedildi. Ara durumu kaldırırdı ama canlı ve idempotent bir akışın sözleşmesini değiştirirdi, ve hesapsız öğrenci kaydı için **yine** ayrı bir yol gerekirdi.

---

### Karar: Kaynağı olmayan alan tek turda değil, sahibi olan dilimde karara bağlanır

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** **#237** ve **#239** kaynağı ya da kuralı olmayan alanları topluyor: ödev tamamlama (`7/9` — teslim tablosu yok), akademik sinyal, deneme ortalaması eşiği ve diğerleri. v1.3'te hepsi **çizilmiyor** (K-22). v1.4 CRUD getiriyor, yani bir kısmı doldurulabilir hâle gelecek.

**Karar:** Alanlar tek bir kapsam turunda değil, **sahibi olan CRUD diliminde** karara bağlanır: öğrenci alanları **v1.4-01**, sınav alanları **v1.4-04**, ödev **v1.4-05**, ödeme **v1.4-06**.

**Gerekçe:** Kararı veren kişi o anda alanın **gerçek kaynağına bakıyor** olur; kaynağı henüz yazılmamış bir alan için bugün kural yazmak tahmine dayanır (**K-11**). Ayrıca hiçbir dilim başkasının alanı için beklemez.

**Bedeli — açıkça:** #237 ve #239 v1.4 boyunca **açık kalır**. Bu bir borç değil, bilinçli bir dağıtım; kapanışları v1.4'ün son CRUD dilimindedir.

**Alternatifler:**

- **Şimdi tek turda hepsini karara bağlamak:** Reddedildi. CRUD dilimleri net bir sözleşmeyle başlardı, ama kaynağı yazılmamış alanlar için uydurma kural üretme riski taşırdı.

---

### Karar: Preview'da doğrulanamayan yüzeyler açık kalır; tetikleyici v1.4 kapanışıdır

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `PLATFORM_SETTINGS.md` §5'teki _"Auth, RLS ve platform paneli preview'da doğrulanamıyor"_ açığının yeniden değerlendirme noktası **v1.4-00 açılışı** olarak yazılmıştı. O nokta geldi.

**Karar:** Açık **kapatılmıyor ve doldurulmuyor**. Tetikleyici **v1.4 kapanışı** olarak yeniden kuruluyor.

**Gerekçe:** v1.3 boyunca bu açığın maliyeti ölçüldü: **sıfır**. Doğrulama üç yoldan yapılıyor ve üçü de preview'a ihtiyaç duymuyor — canlı probe (`begin; … rollback;`), pgTAP (zorunlu `Tenant RLS` kontrolü) ve tarayıcıda gerçek oturum. v1.3'ün bütün ciddi bulguları bu üç yolla çıktı.

**Neden kapatılmıyor:** v1.4 **yazma** yolları getiriyor. Bugüne kadarki doğrulama ağırlıklı olarak okuma üzerineydi; yazma yolunda geri alınamaz bir hatanın maliyeti farklıdır. Bugün "gerek yok" demek, o dünyada da geçerli olduğu anlamına gelmez.

**Alternatifler:**

- **Supabase preview branch'lerini açmak:** Reddedildi (şimdilik). Ücretli, her PR'ı yavaşlatır, ve preview veritabanının canlıdan sapması **yeni bir yanlışlık kaynağı** olurdu (**K-11**).
- **Açığı kapatmak:** Reddedildi. Karşılığı olmayan bir borç taşımamak doğru, ama v1.4'ün yazma yolları görülmeden verilecek bir "gerek yok" kararı erken olurdu.

---

### Karar: Realtime yayını Supabase'e özgüdür ve bilerek kabul edildi

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** _"Sistem taşınabilir kurulur"_ kararının (2026-09-04) birinci maddesi şunu emrediyor: yeni bir sağlayıcı özelliği eklenirken **"bu, düz Postgres veya standart bir arayüzle yapılabilir mi?"** diye sorulur.

**v1.3-17'de bu soru sorulmadı.** Realtime Broadcast (`realtime.send`, `realtime.messages`, `realtime.topic()`) uygulandı ve bunlar düz Postgres değil, Supabase'e özgüdür. Eksik 2026-09-10 taramasında bulundu: kural yazılıydı, uygulanmadı.

**Karar:** Soru **geriye dönük** soruldu, cevabı kabul edildi: Realtime Broadcast bağımlılığı **bilinçli olarak** taşınıyor.

**Gerekçe:** Düz Postgres karşılığı `LISTEN/NOTIFY`'dır ve **kalıcı bir sunucu bağlantısı** gerektirir. Tarayıcı bunu tutamaz; arada dinleyip WebSocket'e aktaracak bir sunucu ister. Bizim böyle bir sunucumuz yok — yani seçenek yoktu, tercih değil zorunluluktu.

**Taşınabilirlik maliyeti küçük ve ölçüldü:** istemci tarafında tek bir kanal (`useOrganizationChannel`) ve o da doğrudan `supabase-js` import etmiyor, **dikişten** (`lib/supabaseClient.ts`) geçiyor. Veritabanı tarafında bir tetikleyici fonksiyon ve bir RLS politikası. Taşınma günü değiştirilecek yer sayılıdır.

**Ölçülen taşınabilirlik durumu (2026-09-10, v1.3'ün 65 dosyasından sonra):**

| Ölçü                                               | 2026-09-04  | 2026-09-10                                               |
| -------------------------------------------------- | ----------- | -------------------------------------------------------- |
| `supabase-js`'e dokunan **gerçek** istemci dosyası | 2 (+dikiş)  | **2 (+dikiş)** ✅                                        |
| Supabase Auth admin API yüzeyi                     | 3 çağrı     | **3 çağrı** ✅                                           |
| Supabase Storage kullanımı                         | yok         | **yok** ✅                                               |
| SQL (migration + pgTAP)                            | 4.735 satır | 14.374 satır — düz Postgres, taşınabilirliğe zarar değil |

**Kural bundan sonra:** bu soru **dilim açılışında** sorulur ve cevabı briefing'e yazılır. Sorulmadığında geriye dönük sorulur; sorulmamış olması cevabın verilmediği anlamına gelmez ama **kaydın eksik olduğu** anlamına gelir.

---

### Karar: Bağlama bir RPC'dir; Edge Function sınırı kimlik **yaratan** işlemleri tutar

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-00 (#261) akademik kaydı giriş hesabına bağlıyor. Bağlanacak sütun (`students.auth_user_id`, `guardians.auth_user_id`) `authenticated` rolünün yazma yetkisinde **yok** — ve bu v1.2-01'de bilerek böyle bırakılmış, gerekçesiyle:

> "Sınır şurada duruyor: kimlik işlemleri Edge Function'da kalır. Bu yüzden `auth_user_id` hiçbir yazma yetkisinde YOK. Bir öğrenciye giriş hesabı bağlamak, adını düzeltmekle aynı sınıfta bir işlem değil; yönetici bunu doğrudan UPDATE ile yapamaz."

**Karar:** Cümlenin **birinci yarısı korunuyor, ikinci yarısı daraltılıyor.** Yönetici bu sütunu hâlâ doğrudan yazamıyor — yetki tablosu değişmedi. Yazma yolu `SECURITY DEFINER` bir RPC ailesi: `link_student_account`, `unlink_student_account`, `link_guardian_account`, `unlink_guardian_account`. Sınırın yeni ifadesi: **kimlik yaratan işlemler Edge Function'da kalır.**

**Gerekçe — ölçüldü:** Bağlama `service_role` istemiyor. Kimlik yaratmıyor, `auth` şemasına yazmıyor, Auth admin API'sine çıkmıyor; `organization_memberships`'i okuyup `public` şemasındaki bir sütunu yazıyor. `create-member`'dan farkı tam olarak bu. Buna karşılık Edge Function ayrı deploy edilen bir parçadır ve bu bizi #113/#114'te bir kez ısırdı: arayüz deploy edilmemiş bir fonksiyona bağlanmış, form sessizce çalışmamıştı. Bir RPC migration ile birlikte iner ve pgTAP ile ölçülür — bu dilimde 37 iddia.

**Bağı çözme aynı ailede ve aynı PR'da.** Sebebi tekillik indeksinin **küresel** olması: yanlış bağlanan bir hesap, çözülmediği sürece başka hiçbir kayda bağlanamaz. Çözme olmasaydı ilk yanlış bağlama elle SQL gerektiren kalıcı bir hata olurdu. Arşivlenmiş kayıt **bağlanamaz ama çözülebilir**; arşivde bağlı kalan satır o hesabı kilitler.

**Alternatifler:**

- **Edge Function (`link-account`):** Reddedildi. `config.toml` satırı, CORS, hız sınırı/idempotency guard'ı ve dağıtım kapısı testi gerekirdi; karşılığında `service_role` gerektirmeyen bir işe ağ atlaması eklemiş olurduk.
- **Sütun yetkisini açmak:** Reddedildi ve en kötüsü buydu. Bugün bağlanan hesabın aynı kurumun üyesi ve doğru rolde olduğunu doğrulayan **hiçbir şey yok**; düz bir UPDATE yetkisi, yöneticiye başka kurumun kullanıcısını kendi öğrencisine bağlama imkânı verirdi.

---

### Karar: Bağlanacak üyeliğin rolü katıdır; öğretmen-veli durumu bilinen bedeldir

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-00'ın bağlama fonksiyonu, hedef üyeliğin rolünü sormak zorunda. Katı ile gevşek arasındaki fark ölçüldü.

**Karar:** Öğrenci kaydı yalnız `student` rollü, veli kaydı yalnız `parent` rollü bir üyeliğe bağlanır. Uymayan çağrı `ORB03` ile reddedilir.

**Gerekçe:** En dar yüzey. Rol bir **kimlik** sorusu ve bağlama anında sorulmalı — v1.2-15'in kurduğu ayrımın aynısı. Durum (`status`) bilinçli olarak sorulmuyor: o bir **canlı yetki** sorusu ve RLS onu zaten her istekte soruyor; karıştırılsaydı henüz aktifleştirilmemiş bir öğrencinin kaydı bağlanamazdı.

**Bilinen bedeli — ölçüldü ve kabul edildi:** Kendi çocuğu da o kurumda okuyan bir **öğretmen**, kurumda zaten `teacher` üyeliği taşıdığı için ikinci bir `parent` üyeliği açamaz (`organization_memberships`'in `(organization_id, user_id)` tekillik indeksi). Dolayısıyla bir veli kaydına **hiç bağlanamaz** ve kendi çocuğunun panelini göremez. Aynısı yönetici-veli için de geçerli.

**Şartı ve sahibi var (K-12):** Gevşetme kararı **v1.4-10**'da (veli–öğrenci bağının kurulması) yeniden sorulur; gerçek bir kurumda bu durumun çıkıp çıkmadığı orada görülür. Gevşetmenin teknik yolu açık: `guardians_select_self` politikası role değil `auth_user_id`'ye bakıyor, yani gevşetme yalnız bu fonksiyonun rol kontrolünü değiştirir.

---

### Karar: Çağrı defteri özeti kimlik belirteci taşımaz

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `internal_function_calls`, tekrarlanan isteği ikinci kez yapmamak için tutulan çağrı defteri (v1.2-17). Kavramsal olarak tenant kaydı değil — platform operatörünün çağrısının kurumu yoktur — ve bu yüzden `organization_id` taşımıyor. Sonucu ölçülmüştü: `internal_delete_organization` o tabloyu **görmüyor**, dolayısıyla silinen bir kurumun üyelerine ait satırlar geride kalıyor ve özetlerinde **giriş numarası** taşıyorlardı.

**Karar:** Satırı temizlemeye çalışmak yerine **taşınacak bir şey bırakmamak.** Giriş numarası üç Edge Function'ın özetinden çıkarıldı (`create-member`, `reset-member-password`, `reset-admin-password`); geriye yalnız `member_created` / `password_reset` bayrakları kaldı.

**Gerekçe:** Kayıp yok — giriş numarası = kurum kodu + `person_code` ve ikisi de yöneticiye zaten açık. Kalıcı kayıt `audit_events` ve `platform_audit_events`'te duruyor; ikisi de kurum kapsamlı, ikisi de kurumla birlikte gidiyor.

**Ölçülen tek bedel:** tekrarlanan istekte istemcinin gösterdiği "(giriş no …)" parantezi artık boş kalıyor. `memberService` bunu zaten koşullu yazıyor, mesaj bozulmuyor. O koşulun kendisi artık ölü — kaldırılması **v1.4-07**'ye (üye satır işlemleri) bırakıldı, çünkü o dilim zaten aynı mesajları elden geçiriyor.

**Doğrulandı (yerel yığın, gerçek zincir):** `create-member` çağrısından sonra defterdeki satır `{"member_created": true}`. Zincir testi de yeşil — tekrarlanan istek hâlâ `replay` dönüyor.

**Alternatifler:**

- **`internal_delete_organization`'a hedefli temizlik adımı:** Reddedildi. Kurum taşımayan bir tabloyu silme fonksiyonuna tanıtmak, tablonun kavramını bozardı.
- **Olduğu gibi bırakmak:** Reddedildi. Tablo bugün boş, yani göç maliyeti sıfır; ilk gerçek kurum verisi girdikten sonra aynı karar bir veri temizliği işine dönerdi.

---

### Karar: Öğrenci numarası kurumun defterinden gelir; sunucu üretmez

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-01 (#264) açılışında ölçüldü: arayüzün `Student` tipinde `code` alanı **vardı**, arama kutusu _"Öğrenci adı, kodu veya sınıf ara…"_ diyordu, `studentService` ise alanı `code: v1.4-01'de gelecek` yorumuyla boş bırakıyordu. Yani arama bugüne kadar **hep boş olan** bir alanda arıyordu. `students` tablosunda böyle bir sütun yoktu.

**Karar:** `students.student_number` — **elle girilir**, **isteğe bağlıdır**, ve **kurum içinde tekildir** (dolu olduğunda; kısmi tekillik indeksi). Arşivlenen kayıt numarasını serbest bırakmaz.

**Gerekçe:** Dershanenin kendi defterinde zaten bir numara var; sunucunun ürettiği ikinci bir numara kağıtla ekranı ayrıştırır ve sahada karışıklık üretir. İsteğe bağlı, çünkü numarasız çalışan kurum da var — zorunlu kılmak numarası olmayan kurumu uydurmaya zorlardı.

**Tekilliğin kurum içinde olması bilinçli** ve `auth_user_id`'nin küresel tekilliğinden ayrılıyor: giriş hesabı bütün sistemde bir kişiyi işaret eder, öğrenci numarası ise kurumun kendi defterindeki sıradır. İki dershanenin ikisinde de "101" numaralı öğrenci olması normaldir.

**Arşiv numarayı serbest bırakmıyor:** bıraksaydı ayrılan bir öğrencinin numarası yenisine verilir ve geçmiş kayıtlar iki kişiye birden işaret ederdi.

**Alternatifler:**

- **Sunucu üretsin (`person_code` gibi):** Reddedildi. Çakışma imkânsız olurdu ama kurumun defteriyle bağı olmayan ikinci bir numara doğardı.
- **Numarayı tamamen kaldırmak:** Reddedildi. En az veriyi işleme ilkesine uygundu, ama MVP kapsamı "Öğrenci No" diyor ve giriş numarası yalnız hesabı olanlarda var — öğrencilerin çoğunun hesabı hiç olmayacak.

---

### Karar: CRUD'un denetim izi tetikleyiciyle düşer

**Durum:** Alındı
**Tarih:** 2026-09-10
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** _"v1.4'ün her CRUD dilimi denetim kaydı yazar"_ yazılıydı ama **nasıl** yazacağı yazılı değildi. v1.4-01 açılışında ölçüldü: `audit_events` `authenticated` rolü için **salt okunur**. Yani istemcinin denetim kaydı yazması teknik olarak mümkün değil.

**Karar:** İz **tetikleyiciyle** düşer (`audit_student_change`). v1.4-14'e kalan: Zod doğrulaması ve **özel metadata** isteyen mutasyonlar.

**Gerekçe:** Yalnız "mümkün olan tek yol" değil, **doğru yol**. Her mutasyon yolunun kaydı ayrı ayrı yazması gerekseydi, yazılmayan ilk yol sessizce izsiz kalırdı — ve eksik bir denetim satırı hata vermez, kimse fark etmez. K-19'un iki kez ölçtüğü ders: hatırlatma kapı değildir.

**İki tasarım kısıtı kayda geçti:**

- Tetikleyici `auth_user_id` değişimini **bilerek atlıyor**: onu v1.4-00'ın bağlama fonksiyonları kendi kayıtlarıyla yazıyor. Atlamasaydı tek bir işlem için defterde iki satır görünürdü. Ayrı bir pgTAP iddiasıyla ölçüldü.
- Güncelleme kaydı değişen **alan adlarını** yazar, eski değerleri **yazmaz**. Denetim defteri bir yedek değil; eski değeri saklamak, silinmiş sanılan veriyi ikinci bir yerde tutmak olurdu.

**Yan karar — `useMutation`'a geçilmedi.** v1.3-02a mutation katmanını bilinçli olarak kapsam dışı bırakmıştı ve bu dilim o kararı **açmadı**: yazma yolu, `MemberCreateDialog`'un zaten kullandığı desen (doğrudan servis çağrısı + `submitting` state'i + `invalidateQueries`). Katman kararı hâlâ ayrı ve verilmedi.

---

### Karar: Kontenjan sınıfın, derslik programın özelliğidir

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `PROJECT_STATE`'in MVP kapsamı _"Sınıf adı, program türü, mentor öğretmen, **öğrenci kapasitesi ve derslik** organizasyonu"_ diyordu. v1.4-02 açılışında ölçüldü: `classes` tablosunda ikisi de **yok**, ve arayüz ikisini de vaat etmiyor. Yani söz yalnızca belgede duruyordu.

**Karar:** **Kontenjan geldi** (`classes.capacity`, isteğe bağlı, 1–1000). **Derslik gelmedi** ve `classes`'a hiç gelmeyecek; karşılığı **v1.4-11**'de (ders programı ekranı). MVP kapsam cümlesi buna göre düzeltildi.

**Gerekçe:** Kontenjan sınıfın kendi özelliğidir ve bir değeri vardır. Derslik ise **ders programına** aittir: aynı sınıf pazartesi bir derslikte, çarşamba başkasında olabilir. `classes` satırına tek bir derslik yazmak, ders programı geldiğinde ya onunla çelişecek ya da taşınacak bir alan üretirdi — ve iki yerde tutulan bilginin biri her zaman eskir.

**Sıfır kontenjan reddediliyor:** "sıfır kontenjanlı sınıf", arşivlenmiş sınıf demenin dolambaçlı yoludur ve bu sistemde arşivlemenin kendi alanı var. Üst sınır 1000, çünkü dört haneli bir kontenjan bir dershane sınıfının kapasitesi değil, veri girişi hatasıdır.

**Kontenjan bir kısıt değil, bilgi.** Dolu sınıfa kayıt veritabanı tarafından **reddedilmiyor**; ekran doluluğu söylüyor ama kaydı engellemiyor. Engelleseydi arayüz, sunucuda karşılığı olmayan bir kuralı varmış gibi gösterirdi (**K-03**). Kontenjanın gerçek bir kısıt hâline gelip gelmeyeceği pilot verisiyle yeniden sorulur.

---

### Karar: Denetim defterini tek bir fonksiyon yazar

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-01, `students` için tabloya özgü `audit_student_change()` yazmıştı. Gerekçesi değişmedi — `audit_events` `authenticated` için salt okunur, dolayısıyla iz tetikleyiciyle düşmek zorunda. Ama v1.4 boyunca en az altı tablo daha aynı şeyi isteyecek: yoklama, sınav, ödev, ödeme, program, akış.

**Karar:** Tek bir `public.audit_row_change()`. Sözleşme tetikleyici argümanında: `tg_argv[0]` varlık adı, kalanı **izlenen sütunlar**. v1.4-01'in fonksiyonu buna katlandı ve düşürüldü.

**Gerekçe:** Üç tablodayken genelleştirmek, sekiz tablodayken genelleştirmekten ucuz. Daha önemlisi: sekiz neredeyse aynı fonksiyon, aralarındaki farkın **kasıtlı mı yoksa kopyalama hatası mı** olduğunu okuyana bırakırdı — ve bu projede tekrar eden bilginin biri her zaman eskiyor.

**İzlenen sütun listesi bir kapsam beyanıdır.** Listede olmayan bir sütunun değişmesi iz bırakmaz, ve bu bir eksiklik değil sözleşmenin kendisi: `students.auth_user_id` tam olarak bu yüzden listede yok — onu v1.4-00'ın bağlama fonksiyonları kendi kayıtlarıyla yazıyor, iki kez yazılsaydı tek işlem için defterde iki satır görünürdü.

**Genelleştirmenin güvenli olduğu ölçüldü:** v1.4-01'in öğrenci iddiaları **değiştirilmeden** geçti, çünkü fonksiyonun adını değil davranışını sınıyorlardı. Tek istisna fonksiyonun kendisinin `authenticated`'a kapalı olduğunu sınayan iddiaydı; o da yazıcıyla birlikte yeni dosyaya taşındı (**K-06** — aynı olgu iki dosyada tutulmaz).

---

### Karar: Yoklama tek nefeste kaydedilir

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Yoklama kaydetmek bir upsert: `attendance_records` üzerinde `unique (session_id, student_id)` var, `archived_at` yok, DELETE ne yetki ne politika olarak var. Öğrenci başına oturumda tek satır; ikinci kayıt güncellemedir.

**Ölçüldü — istemcinin düz upsert'i çalışmıyor.** v1.2-04, `authenticated`'a bu tabloda yalnız **`status`** sütununda UPDATE yetkisi verdi; bilinçliydi, çünkü bir kaydı başka bir öğrenciye taşımak yoklamayı tahrif etmektir. PostgREST'in ürettiği upsert ise yükün **her** sütununu `SET` eder. Yerel yığında üç deneme:

| Deneme                           | Sonuç                         |
| -------------------------------- | ----------------------------- |
| Düz insert                       | geçti                         |
| Tam upsert (her sütunu SET eder) | **`42501 permission denied`** |
| Yalnız `status` SET eden upsert  | geçti                         |

**Karar:** Kaydetmenin tek yolu `record_attendance(target_session_id, entries jsonb)` RPC'si.

**Gerekçe:** Bir sınıfın yoklaması **tek bir işlemdir.** Reddedilen alternatif — istemcinin "önce oku, eksikleri ekle, değişenleri güncelle" yapması — mevcut yetkilerle çalışırdı ama otuz öğrenci için otuza yakın ayrı istek demekti ve ortada kesilirse yarısı kaydedilmiş bir yoklama bırakırdı. **Yarım yoklama, hiç alınmamış yoklamadan kötüdür: alınmış görünür.**

**RPC şemanın kurallarını tekrarlamıyor** (**K-06**): öğrencinin sınıfa kayıtlı olmasını tetikleyici (`ORB02`), durumun geçerliliğini enum, kiracı bütünlüğünü bileşik yabancı anahtarlar zaten sınıyor. Aynı kuralı iki yerde tutmak, birinin sessizce eskimesi demek.

**Yan kayıt:** `attendance_sessions.id` `authenticated` için salt okunur; oturum açarken istemci kimlik **göndermez**, veritabanı üretir. Bu da ölçüldü (yük `id` taşıdığında istek `permission denied` ile dönüyor).

---

### Karar: Denetim kapsamı hacme göre kesilir — yoklamada ilk giriş iz bırakmaz

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4'ün kuralı "her CRUD dilimi iz bırakır" idi ve v1.4-01'den beri tetikleyiciyle uygulanıyor. Yoklama, bu kuralın **ilk kez pahalı** olduğu yer: §4.12 ölçtü, `attendance_records` ölçekte yılda ~90.000.000 satır (öğrenci × ders oturumu). Her kayda bir denetim satırı, defteri tek başına sistemin en büyük tablosu yapardı.

**Karar:** `attendance_sessions` tam denetlenir. `attendance_records` **yalnız UPDATE**'te iz bırakır; ilk giriş (toplu insert) bırakmaz. Fonksiyon değişmedi, yalnız INSERT tetikleyicisi takılmadı.

**Gerekçe — kesme yeri rastgele değil.** İlk yoklama girişi **beklenen ve toplu** olaydır: öğretmen o gün sınıfa girmiş ve listeyi doldurmuştur. Denetime değer olan, sonradan tek bir öğrencinin durumunun değiştirilmesidir — "yok" iken "izinli" olması. **Velinin itiraz edeceği işlem tam olarak odur ve o iz bırakıyor.**

**Bedeli açıkça yazıldı:** ilk girişte kimin ne yazdığı `attendance_records` üzerinden değil, oturumun `recorded_by_membership_id` alanından okunur. O alan tetikleyiciyle dolduğu için güvenilir; ama oturumu açan ile dolduran farklı kişilerse alan **açanı** söyler.

**"İz yok" iddiası da test edildi:** bir kararın sonucu "bir şey yazılmıyor" ise, o da en az "yazılıyor" kadar sınanmalı — yoksa bir gün sessizce yazılmaya başlar ve kimse fark etmez.

---

### Karar: Puanın tavanı vardır, tabanı yoktur

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `exams.max_score` sütunu v1.2-05'ten beri duruyor ama onu **zorlayan hiçbir şey yoktu** — `exam_results` üzerinde puanla ilgili sıfır kısıt, sıfır tetikleyici. Yerel yığında denendi ve kabul edildi: 100 puanlık bir sınavda `update exam_results set score = 500` **geçti**.

**Karar:** `enforce_exam_score_within_max()` tetikleyicisi INSERT ve UPDATE'te puanı sınavın `max_score` değerine karşı sınar; aşarsa **`ORB05`** ile reddeder. `max_score` boşken üst sınır **uygulanmaz**.

**Taban bilinçli olarak yok — ve bunu bir test öğretti.** İlk yazımda negatif puanı da reddetmiştim. v1.2-05'in pgTAP iddiası kırmızıya döndü:

> _'a negative net score is storable — wrong answers can outweigh right ones'_

Türkiye'de net puanlamada yanlış, doğruyu götürür; net eksiye düşebilir. `max_score` bir **tavan** belgeliyor, bir aralık değil. Olmayan bir kuralı şemaya yazmak veriyi korumak değil **reddetmek** olurdu.

**`max_score` boşken kural olmaması da bilinçli:** tavan bilinmiyorsa uydurulmaz. Sınavın 100 üzerinden olduğunu varsaymak, tam olarak #237'nin _"100 üzerinden uydurma olur"_ uyarısıdır.

**Neden şemada, neden yalnız RPC'de değil:** yanlış bir puan yalnız o satırı bozmuyor. `student_latest_exam_scores` onu "son puan" olarak öğrenci listesine taşıyor, ortalamaya giriyor ve veliye gidiyor. Kural RPC'de kalsaydı `service_role` veya ileride yazılacak başka bir yol onu atlardı; bütünlük şemada durur (v1.2-14 kararı).

**`ORB05` aileye yeni giren kod:** "değer izin verilen aralığın dışında". `23514`'ten ayrıldı çünkü istemcinin cevabı farklı — `23514` "biçim yanlış" der, `ORB05` "tavanı aştın, tavan şu" der ve kullanıcı düzeltebilir.

---

### Karar: Sınav denetimi tam tutulur — yoklamanın kesmesi buraya taşınmaz

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Bir dilim önce (v1.4-03) denetim kapsamı ilk kez bilinçli olarak daraltıldı: `attendance_records` yalnız UPDATE'te iz bırakıyor. Aynı gerekçenin sınava da uygulanması beklenirdi.

**Karar:** `exams` ve `exam_results` **tam** denetleniyor — INSERT de UPDATE de iz bırakıyor.

**Gerekçe — yoklamanın iki gerekçesi de burada geçersiz:**

| Yoklamada                                                                                   | Sınavda                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| İlk girişi kimin yaptığı `attendance_sessions.recorded_by_membership_id`'den okunabiliyordu | `exams` tablosunda öyle bir alan **yok**      |
| §4.12 tahmini ~90.000.000 satır/yıl                                                         | ~9.000.000 satır/yıl — **bir büyüklük küçük** |

**Bir notun ilk kez kim tarafından girildiği, velinin soracağı ilk sorudur.** Yoklamada "ilk giriş toplu ve beklenen olaydır" demek mümkündü; bir not için aynı şey söylenemez.

**Kayda geçen asıl şey kesmenin kendisi değil, kesmenin gerekçeye bağlı olduğu:** v1.4-03 bir izin verme değil, iki ölçüye dayanan bir istisnaydı. Ölçüler tutmadığında istisna da taşınmıyor.

---

### Karar: Kuralı olmayan kart, kural yazılarak değil kaldırılarak kapandı

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** #237 sınav ekranında kaynağı ya da kuralı olmayan beş şey saymış ve **üç soru** sormuştu: (1) farklı `max_score`'lu sınavlarda ders ortalaması ne demek, (2) "+6 · Önceki denemeye göre" hangi iki sınav, (3) "Odak alanı" hangi eşikle seçilir.

**Karar:** Üç sorudan **yalnız biri kuralla** cevaplandı; diğer ikisinin cevabı **özelliğin kaldırılması** oldu.

| Soru                        | Cevap                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ders ortalaması             | **Kuralla:** ders geneli değil, **bu sınavın** ortalaması. Yalnız `max_score` dolu sınavda ve girilmiş puan varken çizilir; kaç öğrenciyi kapsadığını kartın kendisi söyler |
| "+6 · Önceki denemeye göre" | **Kaldırıldı.** Hangi iki sınav olduğu yazılamadı; yazılamayan bir kural, çizilemeyen bir karttır                                                                           |
| "Odak alanı" eşiği          | **Kaldırıldı.** Aynı gerekçe                                                                                                                                                |

**Kaldırma kodda da yapıldı, yalnız ekranda değil.** `assessmentOverviewStatTemplates`, `assessmentStatsByRole` ve `demoAssessmentOverviewStatValues` silindi. Sebebi somut: kart ekrandan düştüğünde şablonlar kodda kalmıştı ve onlara dokunan tek yer **testlerdi** — yani testler ölü kodu koruyordu. Şablon durdukça "eşik yok" cevabı görünmez kalır ve kart bir gün geri takılır.

**Bir kartı silmek de bir karardır ve bu yüzden burada.** "Henüz öneri oluşmadı" yazan boş bir kart, olmayan bir özelliğin geleceğini iddia eder (**K-22**).

**Kapsam dışı bırakılan:** `Student.homework` ("7/9" teslim oranı) türetilemiyor çünkü şemada **teslim tablosu yok**. #237 bunu zaten §4.7'nin açık sorusuna bağlamıştı; kontrol noktası **v1.4-05** (ödev akışı).

---

### Karar: Ödev teslim takibi kendi dilimidir; ama takip edilmeyen şey bugün iddia edilmez

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `ROADMAP` §4.7 bir K-12 borcu bırakmıştı: _"Ödev sınıfa verilir, öğrenciye değil. Bu v1.2-08'de bilinçli olarak kararlaştırıldı ve kayıtlı. Ama **kişiye özel ödev** ve **teslim etti/etmedi takibi** yol haritasının hiçbir yerinde yok. Kararın 'şimdilik' mi 'kalıcı' mı olduğu yazılmamış."_ Kontrol noktası v1.4-05 açılışıydı ve geldi.

**Karar — iki parça:**

1. **Teslim takibi ayrı bir dilim: v1.4-15.** Kendi tablosu, kendi RLS'i ve öğretmene işaretleme ekranı demek; v1.4-05'e sıkıştırmak iki dilimlik işi tek dilim gibi göstermek olurdu.
2. **Ama bugün türetilemeyen üç iddia ŞİMDİ kalktı** — `HomeworkStatus`'tan `"Tamamlandı"`, `Student.homework` (`"7/9"`) ve rapor ekranının "Ödev tamamlama" kartı (`reportHomeworkValues`/`Labels` dahil).

**Gerekçe — erteleme ile iddia etmeyi birbirinden ayırmak:** v1.4-15'in ne zaman geleceği belli değil. "Nasılsa yakında gelecek" diyerek bırakılan bir etiket, o güne kadar her gün yalan söyler. Bir ödevin "tamamlandığını" sistem **bilemez**: ödev sınıfa veriliyor ve teslim tablosu yok. Kart ve etiket, olmayan bir bilgiyi varmış gibi gösteriyordu.

**Bu, v1.4-04'ün #237 kararının aynı ailesi ve aynı yöntemi** (`DECISION_LOG` — "Kuralı olmayan kart, kural yazılarak değil kaldırılarak kapandı"): kod da kaldırıldı, yalnız ekran değil. Yoksa testler ölü kodu korumaya devam eder.

**Kişiye özel ödev: şimdilik hayır.** Ödev sınıfa verilmeye devam ediyor; v1.2-08'in kararı korunuyor. Değişen tek şey, kararın artık **"şimdilik"** olduğunun yazılı olması. Açılması gerekirse yol belli: `homework_assignments`'a nullable bir `student_id`, RLS'in o durumu da kapsaması ve ekranda "sınıfa mı kişiye mi" seçimi — ve doğal yeri teslim takibiyle **aynı** dilim, çünkü ikisi aynı soruyu soruyor.

---

### Karar: Ödevin metni de denetlenir — izlenmeyen alan iz bırakmaz

**Durum:** Alındı
**Tarih:** 2026-09-11
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `audit_row_change` tetikleyiciye izlenecek alanları argüman olarak alıyor. `homework_assignments` için ilk yazımda `description` **dışarıda** bırakılmıştı; gerekçe makuldü: serbest metin, uzun olabilir, denetim defterini şişirir.

**Ölçüldü — gerekçe çöktü.** Fonksiyonun gövdesi yeniden okundu:

```sql
if cardinality(degisen) = 0 then return null; end if;
```

İzlenen alanlardan hiçbiri değişmediyse fonksiyon **hiçbir satır yazmıyor**. Yani `description` izlenmeseydi, yalnız ödev metninin değiştiği bir güncelleme **hiç iz bırakmayacaktı**. "İçeriği yazmayalım ama değiştiğini görelim" diye bir orta yol bu fonksiyonda yok: `ayrinti`, izlenen alanların **değerlerinden** kuruluyor.

**Karar:** `description` izleniyor. İzlenen alanlar: `title`, `description`, `due_date`, `subject_id`, `class_id`.

**Gerekçe:** **Ödevin metni ödevin kendisidir.** Teslim tarihinden sonra sessizce yeniden yazılan bir ödev, velinin itiraz edeceği asıl durumdur — v1.4-03'te "yok iken izinli olmak" neyse burada bu.

**Bedeli açıkça yazıldı:** her ödev denetim satırı ödev metnini taşıyor. §4.12 `audit_events`'i zaten _"tek başına en büyük tablo olabilir"_ diye işaretlemişti; bu karar o satırı biraz daha ağırlaştırıyor. Bölümleme borcu yerinde duruyor, tetikleyicisi değişmedi.

**Kayda değer olan asıl şey:** v1.4-03'ün hacim kesmesi bir **izin** değil, iki ölçüye dayanan bir **istisna**ydı. Ödevde o ölçüler tutmuyor — satır sayısı öğrenciyle değil **sınıfla** ölçekleniyor — ve istisna taşınmadı.

---

### Karar: Velinin telefonu kaydın kendisinde durur, giriş hesabında değil

**Durum:** Alındı
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `PROJECT_STATE` MVP madde 2 şunu söylüyor: _"Öğrenci Yönetimi: Ad-Soyad, Öğrenci No, Sınıf, Telefon, **Veli Adı, Veli Telefonu**"_. Ölçüldü: telefon şemada **yalnız `profiles`'ta** — yani giriş hesabının alanı. `guardians` tablosunda telefon yoktu.

**Sonuç: giriş hesabı olmayan velinin telefonu hiçbir yerde durmuyordu** — oysa bir dershanenin veli verisini asıl kullanım biçimi tam olarak odur ve velilerin çoğunun hesabı olmayacak. Yazılı bir MVP sözü, şemada karşılığı olmadan duruyordu.

**Karar:** `guardians.phone` eklendi. Opsiyonel; kısıt `profiles.phone`'unkiyle **birebir aynı** (7–30 karakter, trim'li).

**Kısıtın aynı olması bilinçli** (**K-06**): aynı kavramın iki tabloda farklı kurallara bağlanması, birinin sessizce eskimesi demektir.

**Biçim doğrulaması bilerek yok.** Ülke kodu, sabit hat, dahili numara ve yurt dışı numarası hepsi meşru; şemaya yazılacak tek bir Türkiye kalıbı yok. İstemcide de maske konmadı — şemanın kabul ettiğini ekranın reddetmesi olurdu. Aynı aile: v1.2-11'in `recovery_email` kararı.

**Telefon zorunlu değil.** Elinde numara olmayan kurum veliyi yine de kaydedebilmeli; boş bırakmak uydurmaktan iyidir (**K-03**). Telefonu olmayan velide ekran "Telefon yok" gibi bir etiket **üretmiyor**, tire çiziyor (**K-22**).

⚠️ **KVKK etkisi kayda geçiyor:** yeni bir veri kategorisi açılmıyor (telefon zaten `profiles`'ta işleniyor) ama artık **giriş hesabı olmayan kişilerin** telefonu da tutuluyor. `PLATFORM_SETTINGS` §5'in KVKK envanteri (v1.5-02) bunu kapsamalı.

---

### Karar: Öğrenci kendi velilerini görür

**Durum:** Alındı
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `student_guardians` üzerinde üç SELECT politikası vardı — `admin`, `guardian`, `teacher`. **Öğrenci için hiçbiri yoktu**, yani bir öğrenci kendi kaydının kime bağlı olduğunu göremiyordu.

**Bu bir kararın geri alınması DEĞİL — ve ayrım önemli.** Eski davranışı bir pgTAP iddiası çiviliyordu (_"a student does not read the guardian links either"_), ama ardında **yazılı bir gerekçe yoktu**. Kıyas öğretici: hemen üstündeki öğretmen iddiası, kararı değiştiğinde (#228) neden değiştiğini anlatan koca bir blok aldı; bu iddia hiç almadı, çünkü anlatılacak bir karar yoktu. **Politikanın yokluğu test edilmiş, kararı verilmemişti** (**K-11**).

**Karar:** `student_guardians_select_student` politikası eklendi. `current_user_owns_student_record` üzerine kuruludur — öğrenci yalnız `students.auth_user_id`'si kendisine ait satırların bağlarını okur.

**v1.2-03'ün kararı bundan ayrıdır ve yürürlüktedir:** bir veli aynı öğrencinin **diğer velisini** görmez. İki farklı soru ve testte ikisi de ayrıca sınanıyor.

---

### Karar: Bağ koparmak erişimi bitirir; bağ satırının görünmesi ayrı bir şeydir

**Durum:** Alındı (ölçümle)
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Bir testi yazarken sürpriz bir ölçüm çıktı ve buraya bu yüzden yazılıyor — ikinci kez keşfedilmesin.

`student_guardians` satırı arşivlendikten sonra **veliye görünmeye devam ediyor.** Sebebi `student_guardians_select_guardian` politikasında arşiv süzgecinin **bilerek** olmaması (20260908000000: _"eleme istemcinin işi; iki politika aynı biçimde davranmalı"_).

**Ama asıl soru o satır değil, erişimin bitip bitmediğiydi — ve bitiyor.** `current_user_guards_student` `link.archived_at is null` süzüyor; velinin **bütün** kapsamı o fonksiyona dayandığı için bağ koparıldığında veli öğrenciyi ve ona bağlı hiçbir şeyi göremiyor.

**Karar:** Politika değiştirilmedi. Test, mekanizmayı değil **sonucu** ölçecek şekilde yazıldı (**K-13**): "bağ koparıldı" iddiası, velinin `students` ve `attendance_sessions` üzerinde sıfır satır görmesiyle kanıtlanıyor. Bağ satırının görünmeye devam ettiği de ayrıca test edildi — **davranış kayda geçti, sürpriz olarak kalmadı**.

**Gerekçe:** Arşivlenmiş bir bağ satırı yalnız kimlikler taşıyor ve veli onun üzerinden hiçbir veriye ulaşamıyor. Politikaya süzgeç eklemek, altı politikanın davranışını birbirinden ayırmak olurdu — kazanç görünmezlik, bedel tutarsızlık.

---

### Karar: Yanlış girilmiş taksit arşivlenir — kalıptan bilinçli ayrılış

**Durum:** Alındı
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-06 açılırken ölçüldü — **yanlış girilmiş bir taksiti kaldırmanın hiçbir yolu yoktu.** `installments` üzerinde `archived_at` yok, `authenticated` için DELETE yetkisi yok, DELETE politikası yok. Tutarı düzeltmek mümkündü ama **fazladan girilmiş** bir taksit defterde kalıyor ve planın toplamı kalıcı olarak yanlış oluyordu.

**Bu, yazılı bir nota aykırılıktır ve o yüzden burada.** 20260908050000 şunu diyordu:

> _"Arşiv `payment_plans`'tedir: `installments` tablosunda `archived_at` sütunu YOK — `attendance_records` ve `exam_results` ile aynı kalıp."_

**Karar:** `installments.archived_at` eklendi.

**Gerekçe — kalıp o iki tablo için doğru, taksit için değil.** `attendance_records` ve `exam_results` öğrenci başına **ölçümlerdir** ve varlıkları bir oturuma/sınava bağlıdır: oturum yanlış açıldıysa **oturum** arşivlenir, tek tek satırlar değil. Taksit ise **doğru bir planın içindeki tek yanlış satırdır**; planın tamamını arşivlemek, bir harfi düzeltmek için sayfayı yırtmaktır. Finansal bir defterde DELETE de doğru cevap değil — kayıt kalmalı, yalnız **hesaba katılmamalı**.

**Asıl iş sütun değildi ve bu kayda değer.** Ölçüldü: taksitleri okuyan **üç** fonksiyon var (`student_payment_summaries`, `payment_plan_summaries`, `payment_overview_counts`) ve hiçbiri arşiv süzmüyordu. Sütunu ekleyip durmak, **düzeltmenin hiçbir şeyi düzeltmemesi** olurdu: arşivlenmiş taksit borç olarak sayılmaya devam eder ve veli hâlâ "vadesi geçmiş ödemeniz var" görürdü. Üçü de aynı migration'da yeniden yazıldı.

**`payment_overview_counts`'ta süzgeç `where`'e kondu, `filter`'lara değil.** O fonksiyonun `having count(*) > 0`'ı "görecek taksiti olmayan çağırana hiç satır dönmesin" diyor; süzgeç `filter` içinde kalsaydı **yalnız arşivli taksiti olan** bir kurum üç sıfır okurdu ve o sıfırlar "kurumda hiç ödeme yok" demektir.

**Bir tuzak daha ölçüldü:** `installments_plan_sequence_key` **tam** bir `UNIQUE (plan_id, sequence_no)` idi. Arşivlenen taksit sıra numarasını sonsuza dek tutacağı için, 3. taksit arşivlenip yerine yenisi girilmek istendiğinde `23505` ile çarpışırdı — **arşiv özelliği ilk kullanışta kendini kilitlerdi**. Kısmi indekse çevrildi (`students.student_number` ve `student_guardians`'ın deseni).

---

### Karar: Rapor ekranı kendi dilimidir; #239 ödeme takibini engellemiyor

**Durum:** Alındı
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** #239 _"Ödeme durumlarının kuralı ve rapor ekranının kaynağı yok"_ diye açılmıştı ve v1.4-06'nın önünde duruyor gibi görünüyordu. Ölçüldü — **kapsamı iki dilimde belirgin şekilde küçülmüş** ve beş maddesi kapanmış:

| #239'un maddesi                                | Durum                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `PaymentRow.status` üç değerli, kuralı yok     | ✅ 2026-09-09: **iki değerli** (`overdue_count > 0` → "Takip gerekli") |
| "vadesi geçti hangi güne göre"                 | ✅ `orbit_today()` (v1.3-15), üretimde ölçüldü                         |
| "Planlanan tahsilatın %82'si" (payda tanımsız) | ✅ üretimde çizilmiyor                                                 |
| "Ödev tamamlama" kartı                         | ✅ **v1.4-05'te kaldırıldı**                                           |
| `reportActions` (üretilmiş tavsiye)            | ✅ bilinçli kapsam dışı — §5                                           |

**Karar:** Açık kalan iki kart ("Devam görünümü — Son 4 hafta" ve "Deneme gelişimi") **v1.4-16**'ya taşındı. Ödeme durumu kuralı zaten yazılı olduğu için **#239 ödeme CRUD'unu engellemiyor**.

**Gerekçe:** İki kartın kuralı üç ayrı soru soruyor (hangi dört hafta, kimin kapsamı, izinli nasıl sayılır) ve "kurum ortalaması" #237'nin en zor sorusunun kurum geneli hâli — v1.4-04 onu **tek sınava indirgeyerek** çözmüştü. Bunları ödeme CRUD'una eklemek iki farklı işi tek dilim gibi göstermek olurdu.

**Ve bekletmenin bedeli yok:** üretimde iki kartın değerleri sabit sıfır ve `ReportCard` hepsi sıfır olduğunda çubuk çizmek yerine dürüstçe _"Rapor verisi henüz yok"_ diyor.

⚠️ **O dilim açılırken düzeltilecek bir kusur ölçüldü ve #278'e yazıldı:** `ReportCard`'ın koşulu `values.every(v => v === 0)`, yani **"veri yok" ile "veri sıfır"ı karıştırıyor**. Bugün ateşlenemiyor; kartlar gerçek veriye bağlandığı gün tatil dönemindeki bir sınıf "veri yok" görür (**K-22**).

---

### Karar: Kurumdan çıkarma role göre iki farklı iş yapar

**Durum:** Alındı
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam — üç ölçüm.**

**1. Çıkarma DELETE olamaz.** Üyeliğe bakan **sekiz yabancı anahtarın sekizi de `RESTRICT`** (`attendance_sessions.recorded_by_membership_id`, `class_teachers`, `classes.mentor_membership_id`, `schedule_entries`, `homework_assignments`, `daily_feed_posts`, `tasks`, `calendar_events`). Bir kez iş yapmış üyelik fiziksel olarak silinemiyor ve bu doğru: yoklamayı kimin aldığını silmek defteri bozar.

**2. Geriye `status` kalıyor ve `suspended` bugüne kadar hiç kullanılmamıştı** — üretimde 0 satır, hiçbir fonksiyonda geçmiyor. Bu dilim onu ilk kez çalıştırıyor.

**3. Ama `suspended` her rol için erişimi kesmiyor.** On beş kapsam yardımcısı tek tek okundu:

| Yol                                                                                         | `status = 'active'` süzülüyor mu       |
| ------------------------------------------------------------------------------------------- | -------------------------------------- |
| Yönetici — `current_user_has_membership`                                                    | ✅                                     |
| Öğretmen — `teaches_class`; `teaches_student` ve `can_record_attendance` ona **devrediyor** | ✅                                     |
| **Öğrenci** — `owns_student_record`, `attends_class`                                        | ❌ `students.auth_user_id`'ye bakıyor  |
| **Veli** — `guards_student`, `guards_class`, `can_see_payment_plan`'in veli dalı            | ❌ `guardians.auth_user_id`'ye bakıyor |

Öğrenci ve velinin kapsamı üyelikten değil **bağdan** geliyor — v1.4-00 ve v1.4-10'un kurduğu yol.

**Karar:** Çıkarma **her rolde `status = 'suspended'`** yazar (üye listesinin dürüst kalması için — ayrılmış birinin "aktif" görünmesi yanlış söyler) ve **öğrenci ile velide ek olarak bağı koparır** (erişimi fiilen kesen tek şey o).

**Reddedilen alternatif: beş kapsam yardımcısına `status` süzgeci eklemek.** Onlar RLS'in en sıcak yolu; üstelik v1.4-00'ın _"kapsam bağdan gelir"_ kararıyla çelişirdi. Bir kavramı iki eksene birden bağlamak, ikisinin ne zaman ayrıştığını kimsenin bilmemesi demektir.

⚠️ **Bedeli açıkça yazılıyor:** "çıkarma" role göre farklı şey yapıyor ve **ekran bunu söylemek zorunda**. Yoksa yönetici bir öğrenciyi çıkarır ve akademik kaydının hesaptan koptuğunu bilmez. Onay diyaloğu iki ayrı cümle kuruyor ve bu bir süs değil, kararın taşıyıcısı.

**Dördüncü bir `status` değeri (`removed`) açılmadı.** "Geçici askı" ile "kurumdan ayrılma" ayrımı bugün bir ihtiyaç değil — ikisinde de kişi üye olarak iş yapamaz ve farkı **denetim defteri** söyler. Enum'a değer eklemek geri alması zor bir iştir.

---

### Karar: Üyelik yazma yolu RLS değil Edge Function'dır — ve bu ölçülerek doğrulandı

**Durum:** Alındı (mevcut kararın doğrulanması)
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4'ün her dilimi bugüne kadar bir migration + RLS işiydi. v1.4-07 açılırken ölçüldü: `organization_memberships` üzerinde `authenticated` için **sıfır yazma yetkisi** ve yalnız **iki SELECT politikası**; INSERT/UPDATE/DELETE politikası **hiç yok**.

**Karar:** Rol değiştirme ve çıkarma iki `internal_*` `security definer` fonksiyonunda yaşıyor, iki ince Edge Function onları çağırıyor. Bu yeni bir karar değil — `DECISION_LOG`'un _"İş verisi RLS ile yazılır, kimlik işlemleri Edge Function'da kalır"_ kararının bu dilimdeki karşılığı; kayda geçme sebebi, **v1.4'ün ilk kez migration olmayan dilimi** olması.

**Çağıranın kimliği parametreyle geçiyor, `auth.uid()`'den okunmuyor.** `service_role` bağlamında `auth.uid()` boştur; denetim kaydının failini doğru yazmanın tek yolu onu Edge Function'ın doğrulanmış jetonundan alıp parametre vermektir.

---

### Karar: Erişilemez bir koruma, koruma değildir — K-23 kendi kodumuzda ateşlendi

**Durum:** Alındı
**Tarih:** 2026-09-12
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `internal_change_member_role` ve `internal_remove_member`'a _"çağıran kendini hedef alamaz"_ kapıları yazılmıştı. Gerekçe sağlamdı: son yönetici kendini indirirse kurum sıfır yöneticiyle kalır.

**K-23 mutasyonu onları kaldırdı ve 695 pgTAP iddiası YEŞİL kaldı.**

**Sebep:** çağıran zorunlu olarak **aktif bir yöneticidir** (fonksiyonun ilk kapısı bunu sınıyor), dolayısıyla kendi üyeliğinin rolü de `admin`'dir — ve `hedef.role = 'admin'` kapısı her zaman **önce** ateşleniyor. Kendi-hedef kapısı hiçbir zaman sebep olamıyordu; testi de **yanlış sebeple** geçiyordu.

**Karar:** İki erişilemez dal kaldırıldı. Gerekçe admin kapısının yorumuna taşındı.

🔴 **Ve bir borç yazıldı:** **v1.4-08** (kurum yöneticisi devri) o admin kapısını **gevşetmek zorunda**. O gün "çağıran kendini hedef alamaz" kontrolü **ayrıca yazılmalı** — bugün gereksiz olması, yarın gereksiz olacağı anlamına gelmiyor. Not migration'ın içinde, kapının tam yanında duruyor.

**Kayda değer olan genel ders:** K-23 bugüne kadar hep **yazanın** testlerinde ateşlendi. Bu, ilk kez **denetleyenin kendi kodunda** ateşlendiği yer — ve kural tam da bunun için var.

---

### Karar: Kurum birden fazla yönetici taşıyabilir; "devir" ayrı bir işlem değildir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam — ölçüldü.** "Kurum başına tek yönetici" bugüne kadar **şemada bir kural değildi**: `organization_memberships` üzerinde admin'e dair **sıfır kısıt, sıfır indeks**. Teklik yalnız yaratma yollarının sonucuydu — yöneticiyi `bootstrap-organization` yaratıyor, `internal_create_membership` ise admin üyeliği açmayı açıkça reddediyor. `admin` geçen 24 fonksiyon tarandı ve **hiçbiri tekliği varsaymıyor**.

**Karar:** Bir yönetici başkasını yönetici yapabilir ve ikisi birden kalabilir. "Devir" ayrı bir işlem değil: **terfi + kendini indirme**.

**Gerekçe ölçülü:** tek yönetici bugün **kurtarma zincirinin tek arıza noktası**. `PLATFORM_SETTINGS`'in zinciri _"öğretmen/öğrenci/veli → kurum yöneticisi → doğrulanmış e-postası → platform operatörü"_ diyor; yönetici kilitlenirse geri dönüş yalnız `reset-admin-password` ile, yani **platform operatöründen** geçiyor. İkinci bir yönetici o noktayı kaldırıyor — ve şemada kırılacak bir şey olmadığı da ölçüldü.

**`internal_create_membership` değişmedi:** yeni bir kullanıcı doğrudan yönetici olarak **açılamaz**. Yöneticilik ancak **terfi** ile verilir ve terfi denetim defterine düşer. Yaratma ile yetkilendirmeyi ayrı tutmak, "kim kimi yönetici yaptı" sorusunun cevabını tek bir yerde tutuyor.

---

### Karar: Son yönetici koruması bir SAYIMDIR, bir yasak değil (`ORB06`)

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-07 bir borç bırakmıştı ve notu şuydu — _"yönetici devri bu kapıyı gevşetmek zorunda; o gün **'çağıran kendini hedef alamaz'** kontrolü ayrıca yazılmalı."_

**Borç ödendi ama ödemesi yazıldığından farklı, ve fark kayda değer.**

**O kontrol yanlış olurdu.** İkinci bir yönetici varken kendini indirmek **meşrudur** — devir tam olarak odur. Yasak iki hatayı birden yapardı: meşru devri engellerdi, ve A'nın B'yi indirmesini serbest bırakırdı. Yani korumak istediği şeyi korumazdı.

**Karar:** Kural durumu değil **sonucu** sınıyor (**K-13**): _işlem sonrası kurumda sıfır aktif yönetici kalacaksa reddet._ Tek kural üç durumu birden kapatıyor:

| Durum                                | Sonuç                                        |
| ------------------------------------ | -------------------------------------------- |
| Tek yönetici kendini indirir/çıkarır | ❌ `ORB06`                                   |
| İki yöneticiden biri kendini indirir | ✅ **geçer — devir budur**                   |
| Terfi                                | ✅ hiçbir zaman reddedilmez (sayımı artırır) |

**`ORB06` aileye yeni giren kod:** "bu işlem son yöneticiyi götürürdü". `ORB03`'ten ayrıldı çünkü istemcinin cevabı farklı — `ORB03` _"önce şu atamaları arşivle"_ der ve yol kullanıcının elindedir; `ORB06` _"önce başka birini yönetici yap"_ der, yani **çözüm bir başkasını yetkilendirmektir**.

**Kural fonksiyonda, şemada değil.** Sayım **işlem sonrası** duruma bakıyor ve bunu bir `check` kısıtı ifade edemez; tetikleyici ifade ederdi ama her üyelik UPDATE'inde koşardı ve maliyeti ölçülmedi. `authenticated` için bu tabloda **sıfır yazma yetkisi** olduğu ölçüldüğünden (v1.4-07), `service_role` dışında yazan yol yok ve fonksiyon sınırı bugün yeterli sınır.

**İstemcide taklit edilmedi.** Yönetici sayısını istemcide sayıp düğmeyi baştan kapatmak, iki yöneticinin aynı anda inmeye çalıştığı durumda yanlış cevap verirdi. Sunucunun cevabı gösteriliyor.

---

### Karar: Gereksiz ama görünür bir koşul, görünmez bir sıra bağımlılığından iyidir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `internal_change_member_role`'daki son yönetici sayımı `if hedef.role = 'admin' and new_role <> 'admin'` koşuluyla korunuyor. **K-23 mutasyonu `and new_role <> 'admin'` kısmını kaldırdı ve 717 iddia yeşil kaldı.**

**Sebep:** yukarıdaki `ORB04` kapısı (`hedef.role = new_role` → reddet) sayesinde buraya gelindiğinde ikisi eşit olamaz; `hedef.role` `admin` ise `new_role` zorunlu olarak `admin` değildir. Koşul **gereksiz**.

**Karar: kaldırılmadı.** Ve bu, v1.4-07'de aynı durumda verilen karardan **farklı** — orada erişilemez iki dal kaldırılmıştı.

**Fark nerede:** v1.4-07'deki dallar **ayrı `if` blokları**ydı; kaldırılmaları hiçbir şeyi başka bir satıra bağlamıyordu. Buradaki ise bir **koşulun parçası** ve kaldırmak onu yukarıdaki kapının **sırasına** bağlardı: `ORB04` kontrolü bir gün aşağı taşınırsa, blok sessizce terfiyi de saymaya başlar ve terfi reddedilmeye başlardı.

**Kural olarak:** erişilemez bir **dal** kaldırılır (testi yanlış sebeple geçirir); gereksiz ama **görünür bir koşul**, görünmez bir sıra bağımlılığı yaratmıyorsa bırakılır ve **gereksizliği yazılır**. İkisinin ortak noktası şu: mutasyonun kırmızı vermemesi her zaman "testi düzelt" demek değil — bazen "kodun neden böyle olduğunu yaz" demek.

---

### Karar: Ara denetim bir dilim değil, kapanmış dilimlerin yeniden ölçülmesidir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-09 yazana verilmişken, denetleyen aynı anda **kapanmış dokuz dilimi** ve alınmış kararları taradı. Arda'nın isteği: _"agy bu işi yaparken sen de agy'nin önceden yaptığı tüm işlere ve aldığımız kararları kontrol et — bir ara kontrol noktası uygulayalım."_

**Bulguların tek bir örüntüsü vardı ve asıl kayda değer şey o:** uygulanan standartlar dilim dilim **sıkılaştı**, eski dilimler hiç geri dönülüp hizalanmadı. Bulunan her kusur bu örüntünün bir örneğiydi:

| Ne bulundu                                                             | Neden orada kaldı                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `updateExam` / `archiveExam` çağıransız — sınav düzenleme hiç açılmadı | "Çağıranı var mı" kontrolü **v1.4-05'te** başladı; bu v1.4-04 |
| Dokuz serviste sıfır satırlı yazma "başarılı" sayılıyordu (K-14)       | K-14 koruması yalnız v1.4-05 sonrası servislerde vardı        |
| `class_teachers` ve `schedule_entries` iz bırakmıyordu                 | Denetim v1.4-02'de geldi, o turda bu iki tablo atlandı        |
| Platform defterinde ad çözülemeyince ham kimlik basılıyordu (K-22)     | Aynı kusurun ikizi v1.4-10'da düzeltilmişti, buraya bakılmadı |
| `student_count` / `guardian_count` yok                                 | K-12 kontrol noktası v1.4-01'e çapalıydı; **kimse bakmadı**   |

**Karar: bu bir dilim numarası almaz** (**K-15**). Ara denetim bir iş kalemi değil bir **tur**; numaralandırılsaydı §4.6'daki sıra "yapılacak işler" listesi olmaktan çıkardı. İzi iki commit ve bu kayıttır.

**Çıkan kural: K-24.** Sıkılaşan bir standart geriye uygulanmazsa standart değildir — ve karşılığı iki maddelidir: geriye tara **ve** kuralı kapıya taşı.

---

### Karar: Elle üç kez yapılan kontrol kapıya taşınır — çağıranı olmayan servis kalamaz

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Teslim incelemesinin yazılı adımlarından biri şu: _"İhraç ettiğin her fonksiyonun çağıranı olduğunu ayrıca kontrol edeceğim."_ Üç kez yapıldı, üçünde de bir şey buldu (v1.4-04 sınav, v1.4-05 ödev, ve `restoreStudent`/`restoreClass`).

**Karar:** kontrol `client/src/lib/deadServiceExports.test.ts` ile kapıya taşındı. Gerekçe K-19'un iki kez ölçtüğü ders: **hatırlatma kapı değildir** — ve bu kez hatırlatmayı unutan ajan değil, kuralı koyan kişiydi.

**Kapsam bilerek dar (K-19).** Yalnız `export async function` sayılıyor: `async` bir ihraç neredeyse her zaman bir ağ çağrısıdır, yani bir **servis**; çağıranı olmayan servis, ekranda karşılığı olmayan bir yetenektir. Senkron ihraçlar dışarıda, çünkü saf bir yardımcıyı yalnız kendi birim testi için ihraç etmek meşru bir desendir — ölçüldü, bugün depoda dördü öyle (`buildLoginNumber`, `weekDayToIso`, `dateToIsoWeekDay`, `__writeRawForTest`). Kapsasaydı test kuralı değil **gürültüyü** zorunlu kılardı.

**Muafiyet listesi tek satır ve kendisi de sınanıyor:** `lib/documents.ts` (`PROJECT_STATE`'te kayıtlı, v1.6-01'e ertelenmiş ölü modül). İkinci bir iddia o dosyanın **hâlâ ölü** olduğunu kontrol ediyor; kullanıldığı gün kırmızıya döner ve satırın silinmesini ister. Sınanmayan bir muafiyet listesi, bir süre sonra kuralı sessizce yiyen bir çöplüktür.

⚠️ **Testin kendisi de bir ölçüm gerektirdi ve iki kez yanıldı.** İlk hâli 87 sağlam fonksiyonu "ölü" gösterdi (`/g` bayraklı regex `.test()` çağrıları arasında `lastIndex` taşıyor; ayrıca düz şablon dizisinde `\b` kelime sınırı değil **backspace** karakteri). K-23 mutasyonu üçüncü bir zaafı gösterdi: adı yalnız bir **yorumda** geçen fonksiyonu "çağrılıyor" sayıyordu — oysa ölü bir fonksiyonun en sık bulunduğu yer onu anlatan yorumdur.

---

### Karar: Arşivlemenin geri alınması, arşiv ekranı değil işlemin kendisidir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `restoreStudent` ve `restoreClass` yazıldıkları günden beri çağıransızdı. Çağıran yazmak için önce şu soru cevaplanmalıydı: **kullanıcı arşivlenmiş bir kaydı nerede görüyor?** Cevap: hiçbir yerde — `loadStudents` ve `loadClasses` `archived_at is null` süzüyor ve bu süzgeç seçenekli değil.

**Üç yol vardı:**

1. **Arşiv ekranı açmak** — liste, süzgeç, geri al düğmesi. Bu bir **dilim**, denetim düzeltmesi değil; brifing ister.
2. **Ölü ihracı silmek** — v1.4-05'teki ölü kart şablonlarında verilen karar buydu. Ama oradaki şablonlar **uydurma**ydı; bunlar çalışan, sınanmış, sunucu karşılığı olan fonksiyonlar.
3. **İşlemin kendisinde geri almak** — kullanıcı arşivledi, bildirim "Geri al" sunuyor.

**Karar: üçüncüsü.** Ve seçilme sebebi kısalığı değil, **deseni depoda zaten karara bağlanmış olması**: v1.4-10'da veli bağı koparma tam olarak böyle geri alınıyor. Yani bu yeni bir ürün yüzeyi değil, mevcut desenin uygulanmadığı iki yere uygulanması — ara denetimin tanımı.

⚠️ **Arşiv ekranı yine de yok ve bu bir sınır.** Bildirim kapandıktan sonra geri almanın yolu kalmıyor. Kayda geçiyor: arşivlenmiş kayıtları listeleyen bir ekran gerektiğinde bu bir dilim olarak açılır; bugün gerekliliği **ölçülmedi**, varsayılmadı.

---

### Karar: PostgREST hata gövdesinde alanın adı `details` — ve bunu yalnız ölçüm söyler

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-09, `ORB03`'ün üç halini birbirinden ayırmak için hatanın `detail` alanını okuyordu. Böyle bir alan yok. **Yerel yığında ölçüldü** (gerçek `PATCH /rest/v1/branches` cevabı):

```json
{
  "code": "ORB03",
  "details": "öğrenci=1, sınıf=0, üyelik=0",
  "hint": "Önce bu kayıtları başka bir şubeye taşıyın veya arşivleyin.",
  "message": "Bu şube kapatılamaz: içinde aktif kayıtlar var."
}
```

`@supabase/postgrest-js`'in tipi de aynısını söylüyor: `details`, `hint`, `code`.

**Kayda değer olan, hatanın kendisi değil neden görünmez olduğu.** Üç halin ikisi **doğru** çalışıyordu — ama birincil `detail` dalından değil, ikincil olarak yazılmış `message.includes(...)` dalından. Yani ekran doğru cümleyi söylüyor, sebebi yanlış yerden alıyordu. Üçüncü hal — tek sayı taşıyan hal — sayıları kaybediyordu.

**On sekiz testin hiçbiri yakalamadı** çünkü testler hata nesnesini kendileri kuruyor ve içine `detail` koyuyordu. Test, kodun **varsayımıyla** anlaşıyordu; gerçekle değil. **K-23'ün üçüncü boş biçimi budur** ve kurala eklendi: bir dış sistemin gövdesini taklit eden test, o gövdeyi **ölçmeden** yazılmışsa hiçbir şeyi korumaz.

**Kural olarak:** bir dış sistemin cevabına dayanan her çeviri, o cevabın **ölçülmüş** bir örneğiyle sınanır. Depoda bunun bir yeri var — bu ölçüm `curl` ile yerel PostgREST'e yapıldı ve tekrarlanabilir.

---

### Karar: Hatayı servis çevirir, ekran yalnız taşır

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Bu depoda servisler hatayı çevirip `throw new Error(çeviri)` yapıyor. Ekranlar da yakaladıkları hatayı **bir kez daha** çevirmenden geçiriyordu (v1.4-10'dan beri). Bu zararsızdı çünkü çevirmenlerin son satırı `return message` ile cümleyi olduğu gibi geçiriyordu.

v1.4-09'un R5'i o satırı kaldırdı — ham Postgres mesajının arayüze sızmaması için, ve **bunu denetleyen istedi**. İkinci geçişin o satıra bağlı olduğu görülmedi. Ölçüldü:

|                  |                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------- |
| servis üretiyor  | "Bu şube kapatılamaz: içinde aktif **3 öğrenci, 2 sınıf, 1 üye** kaydı bulunuyor…" |
| ekran gösteriyor | "Şube işlemi gerçekleştirilemedi. Lütfen tekrar deneyin."                          |

Yani R1'in bütün kazancı ekran sınırında yok oluyordu; K-14 mesajları da aynı yerde kayboluyordu. 758 test yeşildi çünkü hepsi çevirmeni **doğrudan** sınıyor, çift çeviri yolunu hiç geçmiyordu.

**Karar: çeviri tek yerde, serviste. Ekran `err.message` okur.** Depoda bu desen zaten vardı (öğrenci ve sınıf arşivleme yolları); v1.4-09 ve v1.4-10 onun dışına düşmüştü.

⚠️ **`guardianService` hâlâ eski düzende** ve bugün çalışıyor — çünkü `translateGuardianError`'ın son satırı `message`'ı geçiriyor. Ama aynı tuzağın üstünde duruyor: o satır bir gün "sebep uydurma" gerekçesiyle sıkılaştırılırsa veli ekranları sessizce genel cümleye düşer. **Sahibi:** denetleyen. **Kontrol noktası:** veli ekranlarına dokunan ilk dilim (**K-12**).

**Korumanın biçimi dürüstçe yazıldı:** kusur yalnız bir yazma **başarısız olduğunda** ortaya çıkıyor ve statik çizimde hiçbir yazma koşmuyor. Bu yüzden bileşen tarafındaki iddia **yapısaldır** — "bileşen `translateBranchError` çağırmaz". Çevirmenin çift geçişte yedeğe düştüğü ise ayrıca çivilendi.

---

### Karar: Depoda barrel dosyası yok

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `client/src/realtime/index.ts` sekiz şey yeniden ihraç ediyordu ve **yedisinin hiç tüketicisi yoktu**; sekizincisi (`useOrganizationChannel`) tek bir dosyadan çağrılıyordu. Ölçüldü: `client/src` altındaki **tek** `index.ts` oydu — diğer bütün modüller doğrudan import ediliyor.

**Karar: kaldırıldı**, tek tüketici asıl modüle bağlandı. Gerekçe tutarlılık: bir depoda tek bir barrel varsa o barrel bir kural değil bir istisnadır, ve istisnalar hangi importun nereden geleceğini tahmin edilemez yapar.

⚠️ **Bu kararın nasıl ortaya çıktığı da kayda geçiyor, çünkü kısmen yanlış bir sebeple alındı.** Ara denetimde eklediğim re-export kapısı dizin importlarını (`from "@/realtime"`) çözemiyordu ve barrel'ın **kullanılan** re-export'unu da "sahipsiz" gösteriyordu — sekiz yanlış pozitif. Yazan testi gevşetmedi (brifing öyle diyordu) ve mimariyi kurala uydurdu; ama kararı hatalı bir kapı zorladı. Kapı düzeltildi (`index.ts` artık iki adla aranıyor: kendi yolu ve bulunduğu dizin) ve **düzeltilmiş haliyle de yedi ölü re-export duruyordu** — yani karar ayakta kalıyor, dayanağı değişiyor.

**Ders:** bir kapı yanlış pozitif verdiğinde, onu izleyen kişinin aldığı karar da o kapının hatasını taşır. Kapıyı kuran, çıktısını **tamamını okuyarak** bildirmek zorundadır — bu turda ben grep'le süzdüm ve sekiz satırın yedisini görmeden "tek çıktısı şu" dedim.

---

### Karar: Bir kuralın değeri neyi saydığında değil, neyi saymadığındadır

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-11 "okutulan ders arşivlenemez" kuralını getirdi. `subjects`'e bakan **beş** yabancı anahtar var ve hepsi `RESTRICT` — yani hepsi DELETE'i engelliyor, hiçbiri arşivlemeyi sınamıyordu.

| Tablo                  | Ne taşıyor             | Sayılıyor mu |
| ---------------------- | ---------------------- | ------------ |
| `class_teachers`       | canlı öğretmen ataması | ✅           |
| `schedule_entries`     | canlı program satırı   | ✅           |
| `attendance_sessions`  | geçmiş yoklama         | ❌           |
| `exams`                | geçmiş sınav           | ❌           |
| `homework_assignments` | geçmiş ödev            | ❌           |

**Karar: yalnız canlı olanlar sayılır.**

**Gerekçe:** beşi de sayılsaydı kural **işe yaramazdı** — bir kez yoklaması alınmış ders bir daha asla arşivlenemez, "artık bu dersi vermiyoruz" demenin yolu kalmazdı. Geçmiş kayıt zaten engellememeli: **arşiv silme değildir.** Satır duruyor, adı çözülmeye devam ediyor; eski bir sınavın "Astronomi" yazması doğrudur ve doğru kalmalıdır.

Engellenen şey bugün birine erişim veren atama ve bu hafta okutulan program satırı. Arşivlenmiş bir derse bağlı **canlı** bir atama, listelerden düşmeyen ama "yok" sayılan bir yapı olurdu — v1.4-09'un dolu şubesiyle aynı cümle.

**K-23 bu kuralda testi değiştirtti.** Fonksiyondaki "yalnız arşive geçiş sınanır" satırını etkisizleştirdiğimde **hiçbir iddia kırmızıya dönmedi**. Sınırın gerekli olduğu ayrıca ölçüldü: `class_teachers`'ın yabancı anahtarı dersin arşivli olup olmadığını **sormuyor**, yani arşivli bir derse canlı atama yazılabiliyor — sınır olmasaydı o ders bir daha asla arşivden çıkarılamazdı. İki iddia eklendi ve aynı mutasyon artık kırmızı veriyor.

---

### Karar: Ders yönetimi ayrı bir dilim değil, atamanın önkoşulu

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `class_teachers.subject_id` **NOT NULL** ve üretimde **0 ders** vardı; `subjects`'e yazan 0 istemci kodu, 0 fonksiyon. Yani öğretmen ataması ekranı yazılsaydı **ilk günden boş bir seçim listesiyle** açılırdı.

**Karar:** ders CRUD v1.4-11'in parçası. Ayrı dilim yapılsaydı öğretmen ataması bir tur geciker, ya da daha kötüsü, çalışmayan bir ekran olarak inerdi.

**Bu üçüncü kez aynı biçimde karşımıza çıktı** ve artık bir desen: v1.4-00'da bağlanacak öğrenci kaydı yoktu, v1.4-10'da bağlanacak veli kaydı yoktu, v1.4-11'de atanacak ders yoktu. Üçünde de dilimin adı **ilişkiyi** söylüyordu ve ilişkinin uçlarından biri hiç yaratılamıyordu. K-10 turunun ilk sorusu artık şu olmalı: _"bu dilimin bağladığı şeylerin ikisi de üretilebiliyor mu?"_

---

### Karar: Derslik çakışması engellenmiyor — serbest metin katı kural taşımaz

> **Sonradan düzeltme (2026-09-16): bu karar tersine çevrildi.** Derslik çakışmasının engellenmesi, _"bir kurumun yönetimi için temel gereklilikler"_ listesine girdi ve `v1.5-15` olarak açıldı. Aşağıdaki gerekçeler **yanlış çıkmadı** — üçüncüsü (`rooms` tablosu + seçim listesi) yeni dilimin **tarifi** oldu, ikincisi ("Online", "Bahçe" gibi paylaşılan değerler) ise onun bir gereksinimine dönüştü. Değişen tek şey, o dilimin artık yapılmaya değer bulunması. Yeni karar: "Derslik bir varlıktır; çakışma serbest metinle değil kimlikle engellenir".

**Durum:** Alındı → **2026-09-16'da değiştirildi (`v1.5-15`)**
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `schedule_entries.room` serbest metin. Öğretmen ve sınıf çakışması şemada zaten engelli (`schedule_entries_teacher_slot_idx`, `schedule_entries_class_slot_idx` — ikisi de kısmi tekil indeks); derslik değil.

**Karar: engellenmiyor.** Üç gerekçe:

1. **Yazım farkı kuralı deler.** "A-101" ile "A101" farklı değerlerdir; indeks ikisini ayrı sayar ve gerçek çakışma geçer. Sonuç, koruduğunu sanan ama korumayan bir kural olurdu.
2. **Doğal olarak paylaşılan değerler var** — "Online", "Bahçe", "Salon". Katı bir kural bunlar için istisna isterdi.
3. Güvenilir çözüm `rooms` tablosu + seçim listesi olurdu; bu yeni bir tablo, RLS ve CRUD ekranı demek ve dilimi belirgin biçimde büyütürdü.

⚠️ **Ekran engelliyormuş gibi görünmemeli.** Çakışmayı gösterebilir; engelleyemez (**K-22** — bir koruma iddiası da bir iddiadır).

---

### Karar: Öğretmen ataması değişmez; kaldırılır ve yeniden açılır

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `class_teachers`'ın `authenticated` için UPDATE yetkisi **yalnız `archived_at`** sütununu kapsıyor (ölçüldü).

**Karar: bu bir kısıt değil bir tasarım ve korunuyor.** Bir atamanın sınıfı, öğretmeni veya dersi değiştiyse o **başka bir atamadır** — eskisi arşivlenir, yenisi açılır. Denetim defteri de bunu böyle okur: iki ayrı olay, biri kapanmış biri açılmış.

Ekranda "Düzenle" düğmesi **yok**. Olsaydı, arkasında yapılacak tek şey yine kaldır+ekle olurdu ve kullanıcıya tek bir işlem yapıyormuş gibi görünürdü.

⚠️ **Ölçüm notu:** bu kısıtın bir **sütun yetkisi** olduğunu görmek için `role_column_grants`'a bakmak gerekti. `role_table_grants` üç tabloda da yalnız `SELECT` gösteriyor ve ona bakıp "politikalar var ama GRANT yok, yani politikalar ölü" sonucuna varmak üzereydim. v1.4-09'daki `is_default` hatasıyla aynı aile: **doğru yere bakmadan yokluk iddia edilmez.**

---

### Karar: Yazarın adı bir RPC'den gelir — çünkü RLS onu kimseye vermiyor

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-12 duyuru panosunu açtı ve ilk teslimde **kurum geneli her duyuru ekranda "adı okunamadı" diyordu.** Ölçüldü (istemci birim testi): kurum geneli bir duyuruda ad çözen RPC **hiç çağrılmıyor**, yazar yedeğe düşüyor.

Sebep bir kod hatası değil, **yanlış kaynağa sorulmasıydı**: ad `class_staff_names`'ten çözülüyordu ve o fonksiyon tanımı gereği yalnız **sınıfın** mentorunu, atanmış öğretmenlerini ve programdaki vekilini döndürür. Kurum geneli duyuruda sınıf yoktur — ve onu yalnız yönetici yazabilir.

**Ve istemcide çözülemiyor.** `profiles`'ın SELECT politikaları üç tane: kişinin kendisi, kurum yöneticisi, platform operatörü. Bir öğrenci, veli veya öğretmen başka bir üyenin profilini **okuyamaz** — bu v1.3-01'de bilinçle çizilmiş bir sınır (#228 tam oradan doğdu).

**Karar: `feed_post_authors(uuid[])`.** `class_staff_names`'in aynası — `security definer`, `authenticated`'a açık, ve çağıranın **görebildiği** kapsamla sınırlı. Farkı kapsamın birimi: sınıf değil **duyuru**.

⚠️ **Görünürlük koşulu uydurulmadı, `daily_feed_posts`'un beş SELECT politikasından kopyalandı.** `security definer` RLS'i atladığı için bu kopya **zorunlu** — bir politikayı fonksiyondan çağırmanın yolu yok. Bu, K-06'nın ("aynı olgu iki yerde tutulursa biri eskir") bilinçli kabul edilmiş bir istisnası ve bedeli yazılı: bir politika değişirse burası da değişmeli. Karşılığı test — `feed_post_authorship.test.sql` beş rolü de sınıyor.

**Advisor sayısı 28'den 29'a çıktı ve bu kararın parçası.** `0029` `authenticated` tarafından çağrılabilen her `security definer` fonksiyonu sayar; bu fonksiyonun çağrılabilir olması işin **tanımı**. Artışın kendisi uyarı değildir; **açıklanamayan** artış uyarıdır (`PLATFORM_SETTINGS` §6).

**Kayda değer ikinci şey — testler kusuru neden kaçırdı.** Mevcut testler **yedeği** sınıyordu: _"ad çözülemediğinde `adı okunamadı` döner"_. Doğruydu ve geçiyordu. Ama kusur tam da **her zaman** yedeğe düşülmesiydi. **Doğru davranışı çivileyen bir test, yanlış olanı yakalamaz.** K-23'ün bir akrabası: test kodun yaptığı şeyi değil, kodun yapması gerekeni ölçmeli.

---

### Karar: Kişisel kayıt iz bırakmaz ve yayılmaz — deseni uygulamamak da bir karardır

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-05'ten bu yana **dokuz** tabloya üst üste denetim ve yayın tetikleyicisi eklendi. v1.4-13 bu desenin yanlış olduğu ilk yeri getirdi.

`tasks` ve `calendar_events` **kesin kişisel**: altı politikanın altısı da `current_user_owns_membership(owner_membership_id)`. Kurum yöneticisi bile başkasının görevini okuyamıyor.

| Ne                    | Karar       | Gerekçe                                                                                                        |
| --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Denetim tetikleyicisi | **yok**     | `audit_events` kurum yöneticisine açık; koymak RLS'in bilerek sakladığı şeyi deftere taşımak olurdu            |
| Yayın tetikleyicisi   | **yok**     | Kanal `org:<kurum>` ve kurumun **her** üyesi abone; kişisel bir kaydı oraya yazmak herkese haber vermek olurdu |
| `set_updated_at`      | **duruyor** | Yokluk **seçici**, toptan değil                                                                                |

**Bu dilimin sunucu yarısı bu yüzden bir migration değil, bir pgTAP testi.** Şema zaten eksiksizdi — politikalar, sütun yetkileri ve indeksler v1.2-09'da doğru yazılmış. Gereken tek şey kararı **korumak**: `personal_records_stay_personal.test.sql` hem yokluğun kendisini (alışkanlıkla tetikleyici eklendiği gün kırmızıya döner) hem de kararın **dayanağını** (yönetici gerçekten okuyamıyor mu) sınıyor.

**Kayda geçen genel ders:** bir deseni dokuz kez uygulamak onu kural yapmaz. Onuncu tabloda sorulacak soru "desen ne diyor" değil, **"bu tablo ne"** olmalı. K-23 mutasyonu bu kez tersine koşuldu: beklenen tetikleyiciler **eklendi** ve üç iddia kırmızıya döndü.

---

### Karar: K-23'ün istediği şey testin kırmızıya dönmesi kadar ne söylediğidir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-13'ün R2 mutasyonu (`loadSchedule`'dan `organization_id` süzgecini kaldırmak) testi gerçekten kırmızıya döndürüyordu — ama çıktı şuydu:

```
TypeError: undefined is not iterable (cannot read property Symbol(Symbol.iterator))
```

Sebebi testin kendisiydi: spy `eqCalls`'ı `undefined` ile başlatıyor, `.eq()` hiç çağrılmayınca iddia bir tip hatasıyla patlıyordu. **Koruma gerçekti, mesajı işe yaramazdı** — o kırmızıyı gören biri süzgecin kaybolduğunu değil, testin bozulduğunu düşünürdü.

**Karar:** spy boş diziyle başlatıldı; kırmızı artık `expected [] to deep equally contain [ 'organization_id', … ]` diyor.

**Kural olarak:** K-23 bir mutasyonun testi kırmızıya döndürmesini ister; bu kayıt onu bir adım ileri götürüyor — **kırmızının nedeni okunabilir olmalı.** Bir `TypeError` "koruma çalıştı" demez, "test çöktü" der; ikisi bir sonraki kişi için aynı şey değildir.

---

### Karar: İş kuralı şemada, biçim doğrulaması sınırda, servis yalnız çevirir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-14 "Zod doğrulama" diye açılmıştı. Soru şuydu: istemci servislerine Zod girsin mi?

**Karar: hayır.** İş kuralı tek yerde kalır — **şema**. Servis sunucunun cevabını çevirir, kuralı taklit etmez. Karşılığı olarak yedi kopya doğrulama kaldırıldı (altı `length > 200` başlık kontrolü + bir `endsAt <= startsAt`); hepsi şemadaki CHECK kısıtlarının kopyasıydı (**K-06**).

**Duran şeyler:** `trim()` normalleştirmesi (kural değil, gönderilecek değerin hazırlanması) ve fail-closed kimlik korumaları (`!organizationId` → sorgu atma; **K-04**). İkisinin de şemada karşılığı yok.

🔴 **Ama kararın gerekçesindeki bir ölçüm yanlıştı ve yazan reddetti.**

Denetleyen "zod depoda hiç kullanılmıyor, bağımlılığı kaldıralım" dedi. Yazan uygulamayı denedi, K-19 kapısı kırmızıya döndü ve kanıtla geri geldi:

- `supabase/functions/_shared/deps.ts:20` → `export { z } from "npm:zod@4.5.4";`
- **7 Edge Function'ın 7'si de** `z.` kullanıyor
- `edgeDependencyPins.test.ts` `deps.ts` ↔ `package.json` paritesini zorunlu tutuyor
- `@hookform/resolvers` zod'u **peer** olarak istiyor

Hatanın kaynağı bir grep deseni: `from "zod"` arandı; oysa fonksiyonlar `{ z }`'yi deps barrel'ından, barrel da `npm:zod@4.5.4`'ten alıyor.

**Ortaya çıkan bölüşüm kararı zaten destekliyor** ve asıl kayıt bu:

| Nerede                  | Ne doğrular                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| Edge Function (**Zod**) | **Dışarıdan gelen** istek gövdesinin biçimi (`AGENTS.md` kuralı) |
| Şema (**CHECK**)        | İş kuralı — "başlık 1–200 karakter"                              |
| Servis                  | Hiçbiri — sunucunun cevabını çevirir                             |

Zod bu depoda **sınırda** duruyor ve kuralı tekrar etmiyor; kaldırılsaydı bozulacak olan şey doğrulama değil **sınır** olurdu.

**Süreç açısından kayda değer olan:** yazan bir talimatı reddetti, gerekçesini ölçümle sundu ve **haklıydı**. Denetleyenin ölçümü de ölçümdür — ve yanlış olabilir. Bu turda iki kez oldu: bu, ve daha önce `role_table_grants`'a bakıp "politikalar ölü" diyecek olmam.

---

### Karar: `details` hata sınıfına göre farklı şey demek — ve asla ham basılmaz

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-09'da "alanın adı `detail` değil `details`" öğrenilmişti. v1.4-14'te bir adım daha çıktı: **`details`'in içeriği hata sınıfına göre değişiyor.** Yerel PostgREST'e ölçüldü:

| Kod                     | `message`      | `details`                                                    |
| ----------------------- | -------------- | ------------------------------------------------------------ |
| `23505` (tekillik)      | kısıt adı      | `Key (class_id, day_of_week, starts_at)=(…) already exists.` |
| `23514` (CHECK)         | **kısıt adı**  | `Failing row contains (…)` — **tüm satır**                   |
| `ORB03` (bizim `raise`) | bizim cümlemiz | `detail =` ile yazdığımız                                    |

**Sonuç 1:** CHECK ihlalinde kısıt adı **`message`**'ta aranır. `dayPlanService` `details`'te arıyordu; üç ayrım da hiç eşleşmiyor, her `23514` genel cümleye düşüyordu. Kusur görünmüyordu çünkü istemcideki kopya doğrulama sunucuya varmadan reddediyordu — kopya kaldırılınca görünür hâle gelecekti.

**Sonuç 2 ve daha önemlisi:** `details` **asla ham basılmaz**. `23514`'te bu, kullanıcıya kendi satırının tamamını — kimlikler ve diğer sütunlar dahil — göstermek olurdu.

**Kural olarak:** bir dış sistemin hata gövdesinden okunan her alan, **o hata sınıfı için** ölçülerek doğrulanır. "Alan adı doğru" yetmez; o alanın **ne taşıdığı** da sınıfa bağlıdır.

---

### Karar: Bir satırın yokluğu tek anlama gelmeli — "bitirdim" bir sinyaldir

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `homework_submissions` "satırın **varlığı** teslimi anlatır" modeliyle tasarlandı ve tasarım denetleyenindi. O modelde bir satırın **yokluğu iki farklı şey** demek:

1. Öğretmen sınıfı işaretledi, bu öğrenci getirmedi.
2. Öğretmen henüz bu öğrenciyi işaretlemedi.

İlk teslim bunu bir sezgiyle çözdü — _"bir ödevde en az bir teslim varsa o ödev takip ediliyor sayılır"_ — ve sezgi **"hiç işaretlenmemiş" durumunu doğru kapatıyordu**. Kapatmadığı şey **yarım** işaretlenmiş ödevdi: öğretmen 15 öğrencinin 3'ünü işaretleyip bıraktığında kalan 12'si "getirmedi" sayılıyordu. Ve o sayı öğrencinin kartında duruyor, **veliye de görünüyor** (**K-03**).

**Karar: öğretmen bitirdiğini söyler.** `homework_assignments.submissions_recorded_at` — boş bırakılabilir, geri alınabilir. `null` iken ekran o ödev için oran **üretmez**.

**Alan adı bilerek `completed_at` değil:** tamamlanan şey ödev değil **işaretleme işi**. Ad, iddia ettiği şeyi doğru söylemeli.

**Genel ders — ve bu, K-22'nin bir katmanı:** K-22 "bir yokluk etiketi de bir iddiadır" der. Buradaki daha derin: **yokluğun kendisi belirsizse, ondan üretilen her sayı belirsizdir.** Bir modelde "kayıt yok"un birden fazla anlamı varsa, çözüm ekranda bir cümle bulmak değil, **şemaya ayırt edici bir sinyal koymaktır**.

⚠️ Kabul edilen bedel yazılı: "bitirdim" demeyi unutan öğretmende oran **hiç çıkmaz**. Yanlış çıkmasından iyidir.

---

### Karar: Payda ile pay aynı kümeden gelir; gelmiyorsa oran yayımlanmaz

**Durum:** Alındı
**Tarih:** 2026-09-13
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.4-15'te ödev kartındaki `X / Y teslim` oranının iki sayısı **farklı kümelerden** geliyordu: payda sınıfın **aktif** öğrencilerini sayıyor, pay ise sınıftan ayrılmış öğrencilerin teslimlerini de sayıyordu (tetikleyici onları bilerek kabul ediyor). 10 aktif öğrencilik bir sınıfta **"12 / 10 teslim"** çıkabiliyordu.

**İlk düzeltme yanlıştı ve yeni bir kusur açtı.** Payda `Math.max(totalStudents, submissionCount)` ile şişirildi ki "12 / 10" görünmesin. İki sonucu oldu:

1. **Payda uyduruldu.** 10 aktif + 2 ayrılmış teslimci = gerçekte 12 kişilik bir kümede ekran **"7 / 10"** yazıyordu. **Makul görünen ve yanlış olan bir sayı, saçma görünen ve doğru olandan kötüdür** — ilki sorgulanmaz.
2. **Durum bozuldu.** Türetme de o paydayı kullanıyordu: `submissionCount > totalStudents` olduğu an `submissionCount >= effectiveTotalStudents` **her zaman** doğru oluyor ve ödev **"Tamamlandı"** görünüyordu — mevcut sınıfın yarısı getirmemişken.

**Karar iki parçalı:**

**1. Payda birleşimdir.** Sınıfın aktif öğrencileri **∪** o ödevi teslim edenler. Bunun için sayaçlar sayı değil **kimlik** döndürüyor; birleşimin boyutu tek doğru paydadır.

**2. Tutarsız çiftten oran üretilmez.** `mapHomeworkRow`'a pay > payda gelirse iki sayı aynı kümeden gelmiyor demektir: payda **yayımlanmaz** ve "Tamamlandı" **türetilmez**. Bilinmeyen bir şeyi iddia etmektense hiçbir şey söylememek doğrudur (**K-22**).

**Kural olarak:** bir oranın iki sayısı **aynı kümeden** gelmek zorundadır. Gelmiyorsa çözüm, küçük olanı büyütmek ya da büyüğünü kırpmak **değildir** — ya küme düzeltilir ya oran yayımlanmaz. Bu, v1.3-01/D'nin (`exam_participant_count`) ve v1.3-01/C'nin (devam yüzdesi) aynı ailesi: **bir sayı, neyi saydığı bilinmeden gösterilemez.**

⚠️ Üçüncü bir ayrım da kayda geçti: sayaçlar artık `null` ("ölçülemedi" — tavan ya da hata) ile boş küme ("ölçüldü, kimse yok") arasında ayrım yapıyor. İlki sayı üretmez, ikincisi `0` üretir. İkisini birbirine karıştırmak, `submissions_recorded_at` kararının kaldırdığı belirsizliği geri getirirdi.

---

### Karar: Sıfır bir ölçümdür, yokluk değildir — ve ikisini kaynak ayırır

**Durum:** Alındı
**Tarih:** 2026-09-14
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** `ReportCard`'ın boş durum koşulu `values.every(value => value === 0)`
idi. Bugün ateşlenemiyordu çünkü üretim değerleri sabit `[0, 0, 0, 0]`; kartlar
canlı veriye bağlandığı gün **canlı bir kusur** olacaktı — dört hafta boyunca
gerçekten %0 devam eden bir sınıf (kapanmış şube, tatil dönemi) _"Rapor verisi
henüz yok"_ görecekti (**K-22**).

**Karar:** Ayrım **ekranda değil kaynakta** kurulur.

| Kaynağın söylediği | Anlamı         | Ekran        |
| ------------------ | -------------- | ------------ |
| sayılar `NULL`     | ölçülmedi      | bar yok      |
| sayılar `0`        | ölçüldü, sıfır | sıfır çubuğu |

`report_attendance_weeks()` ve `report_homework_weeks()` **her zaman tam dört
satır** döndürür; ölçülmemiş hafta boş sayılarla gelir. `ReportCard`'ın değer
tipi `(number | undefined)[]` olur ve boş durum **yalnız dördü de `undefined`**
iken çizilir.

**Gerekçe — eksen neden sunucuda.** İlk yazımda yalnız verisi olan haftalar
dönüyordu. O tasarım ekseni istemciye kurduruyordu: üç haftası boş bir sınıfta
tek satır döner, kalan üç haftanın tarihini istemci **kendi saatiyle**
hesaplamak zorunda kalırdı. `orbit_today()` ile kapatılan saat dilimi tuzağı
(#239) arka kapıdan geri girerdi.

**Bu, `null` / boş küme ayrımının aynısıdır** (v1.4-15, ödev oranları): orada
`null` "ölçülemedi", boş `Map` "ölçüldü, kimse yok" demişti. Aynı ayrım, bu kez
SQL'de.

---

### Karar: Rapor kartlarının kapsamı okuyanın kendisidir; kurum ortalaması öğretmene açılmaz

**Durum:** Alındı
**Tarih:** 2026-09-14
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Rapor ekranının alt başlıkları öğretmene _"Sınıf ve genel
ortalama"_, yöneticiye _"TYT kurum ortalaması"_ diyordu. "Kimin kapsamı"
sorusu #239'dan beri açıktı.

**Karar:** Üç fonksiyon da **`security invoker`**. Kapsamı RLS çizer: öğretmen
okuttuğu öğrencileri, yönetici kurumun tamamını görür. Öğretmene kurum
ortalaması **gösterilmez**; alt başlıklar bunu söyler ("Sınıflarınızın
ortalaması" / "Kurum ortalaması").

**Gerekçe.** Cevap zaten şemadaydı (2026-09-14'te ölçüldü):
`attendance_records` ve `exam_results` politikaları yöneticiye kurum genelini,
öğretmene `current_user_teaches_student` kadarını veriyor. Ve "Raporlar"
bölümü `educationAccess.ts`'te yalnız yönetici ve öğretmende — öğrenci/veli bu
ekranı hiç görmüyor. Kurum ortalamasını öğretmene açmak **`security definer`**
bir toplam gerektirirdi: yeni bir yetki genişlemesi, +1 advisor ve kendi
olumsuz senaryosu.

⚠️ **`exam_participant_count`'un dersiyle karıştırılmamalı.** O kararda
(2026-09-08) "okuyanın gördüğü satır sayısı" yanlıştı, çünkü iddia **sınavın
katılımcı sayısıydı** — okuyandan bağımsız bir olgu. Burada iddia zaten
okuyanın kapsamı. Aynı görünen iki durum, farklı iki soru; ayrım migration
yorumunda da yazılı.

---

### Karar: Sınav eğilimi yüzdedir ve sınav türü iddia edilmez

**Durum:** Alındı
**Tarih:** 2026-09-14
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** "Deneme gelişimi — TYT kurum ortalaması" kartı #239'dan beri
çizilemiyordu: farklı `max_score`'lu sınavlarda ortalama kuralı yazılı değildi.

**Karar:** Her sonuç **kendi sınavının tam puanına** oranlanıp yüzdeye çevrilir;
son dört sınav eskiden yeniye çizilir. **"TYT" etiketi kaldırılır.**

**Gerekçe.** Şemada **sınav türü sütunu yok** (2026-09-14'te ölçüldü). Bir
sınavın TYT olduğunu söyleyen hiçbir veri yokken kartın öyle demesi, #239'un
baştan beri şikâyet ettiği şeydi. Tür eklemek ayrı bir dilimdir (yeni sütun,
yeni form alanı, yeni testler) ve bu kartı beklemeye almaya değmez.

⚠️ **Ölçülen tuzak:** `exams.max_score` için **hiç CHECK yok** — tablodaki tek
CHECK `name` uzunluğu. Yani `0` da negatif de girilebilir ve sıfıra bölmeyi
şema engellemiyor. Süzgeç fonksiyonda: `max_score > 0` (**K-04**). Tavanı
yazılmamış sınav bir yüzde üretemez; bu v1.4-04'ün aynı sebeple aldığı kararın
kurum geneli hâli.

⚠️ Ve o süzgecin **tek** koşul olması bir ölçümün sonucu: yanında bir
`max_score is not null` daha vardı, mutasyon turunda kaldırıldığında **hiçbir
test kırmızıya dönmedi** (**K-23**). Sebep SQL'in kendisi — `null > 0` sonucu
`NULL`'dır. Ölü koşul kaldırıldı: okuyana iki ayrı kural varmış gibi
görünüyordu (**K-06**).

---

### Karar: Hesapları kişinin kendisi bağlar — iki taraflı kanıtla

**Durum:** Alındı
**Tarih:** 2026-09-14
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Yol haritası v1.4-17'yi açarken "mevcut kullanıcıya ikinci üyelik
açmanın guard'ı nasıl gevşetilir" diye soruyordu. Ölçüm sorunun yanlış
olduğunu gösterdi.

**Ölçülenler (2026-09-14):**

1. `organization_memberships_org_user_idx` **tam** bir UNIQUE
   (`organization_id, user_id`). Bir auth kullanıcısının bir kurumda ikinci
   üyeliği **zaten** olamaz. "Rolü kadar hesap" modeli buradan çıkıyor.
2. `internal_create_membership`'in guard'ı gevşetilseydi açılan şey başka bir
   kurumdaki kullanıcıya üyelik yazmaktı — ve fonksiyon aynı işlemde
   `profiles`'a `display_name` **ve** `must_change_password = true` yazıyor.
   Yani guard bir "ad karışır" koruması değil, bir **hesap ele geçirme**
   korumasıdır.

**Karar:** Guard **yerinde kalıyor**. Bağlamayı **kişinin kendisi** yapar:
hesap A bir kod üretir, hesap B'ye girilip o kod tüketilir. Kurum yöneticisi
bağlayamaz.

**Gerekçe.** Yanlış bağlanan bir hesaba **geçiş düğmesiyle girilir** — yani
bağlama, oturum açmakla eşdeğer bir yetkidir. Yönetici kendi kurumundaki
herhangi iki hesabı birleştirebilseydi, kendi hesabını bir öğretmeninkine
bağlayıp onun paneline geçebilirdi. İki taraflı kanıt bunu kapatıyor: iki
hesaba da girebilmek gerekir.

**Ek koşul — `must_change_password` kapalı olmalı.** Yönetici üyeyi kâğıt
fişteki geçici şifreyle yaratıyor ve o şifre `must_change_password` ile
kilitli. Kilit kalkmadan hesabın "sahibi" belirsizdir; geçici şifreyi bilen
yönetici de olabilir. Bağlama ancak kişi kendi şifresini belirledikten sonra
bir sahiplik kanıtıdır.

**Kod uzunluğu bir güvenlik kararıdır, okunabilirlik tercihi değil.** Kodu
bilen iki hesabı bağlayabiliyor; yani kod bir oturum açma sırrıyla aynı
ağırlıkta. 6 hane 10 dakikalık pencerede kaba kuvvetle denenebilirdi; 12
onaltılık karakter (≈2,8 × 10¹⁴) denenemez. Kod **hash'lenmiş** saklanıyor ve
yeni kod üretmek eskisini **siler** — kullanıcının bilmediği bir sır açık
kalmamalı.

**Reddedilen: kişi kayıtlarının birleştirilmesi.** Zaten başka bir kişiye
bağlı bir hesap için kayıtlar birleştirilmiyor (`ORB04`). İki insanın
hesaplarını tek gruba toplama riski taşır ve geri alınması zordur; ihtiyaç
doğduğunda ayrı bir karar olarak açılır (**K-04**).

---

### Karar: Kişi kaydı kurum-üstüdür

**Durum:** Alındı
**Tarih:** 2026-09-14
**Kararı Onaylayan(lar):** Arda Bülent

**Karar:** `people` tablosu **`organization_id` taşımaz** ve bu, `public`
şemasındaki **tek kurum-üstü iş tablosu** olur. RLS'i kurumdan değil
**sahiplikten** gelir.

**Gerekçe.** Bir kişi A kurumunda öğretmen, B kurumunda veli olabilir. Kurum
kimliği taşısaydı bu kişi iki kişi olurdu ve KVKK "verilerimi sil" talebinde
biri gözden kaçardı — 2026-08-25 kararının kişi kaydını gerektiren sebebi tam
buydu.

⚠️ Bunun bir bedeli var ve yazılıyor: §4.12'nin "her CRUD dilimi açık
`organization_id` süzgeci koyar" kuralını burada arayan biri bulamayacak.
Eksiklik değil, tasarım.

**Tablonun alanı yoktur ve olmamalıdır.** Ad `profiles`'ta, rol
`organization_memberships`'ta durur (**K-06**). `people` yalnız bir gruplama
anahtarıdır.

---

### Karar: Pilot onayı beklenirken altyapı yürür; pilotun kapsamı onay gününe kadar yazılmaz

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** v1.5 planlanırken pilot bir tarih gibi ele alınıyordu ve bütün iş ona göre sıralanıyordu. Ama pilot onayı bizim elimizde değil.

**Karar:** v1.5 **iki kola** ayrılır.

- **Altyapı kolu** (`v1.5-06 … v1.5-14`) pilot onayından **bağımsız** yürür. Amacı genel altyapının tamamlanması.
- **Pilot kolu** (`v1.5-01 … v1.5-05`) onaya bağlıdır. Onay geldiğinde kurum ihtiyaçlarına odaklı 1-2 haftalık bir tur koşulur, sonra denemeye geçilir.

**Pilot kolunun kapsamı bugün YAZILMAZ.** Hangi roller açılacak, kaç sınıf ve öğrenci girilecek, hangi ekranlar gerekiyor — hepsi kurumla konuşulunca belli olacak. Bugün yazılacak bir kapsam **tahmin** olurdu ve bu depo tahminlerin kod olarak biriktiğini bir kez ölçtü: v1.3'te 22 PR'lık ekran yazıldı ve hiçbiri gerçek kullanımda görülmedi (`ROADMAP` §4.12).

**Gerekçe.** Beklemek boşa gün, ama tahmin etmek boşa kod. İkisinden de kaçınmanın yolu, onaya bağlı olanı **bilinçli olarak boş bırakmak** (**K-10**).

**Bugünkü ekip durumu bu kararın parçasıdır:** Hamza rakip analizi topluyor ve arayüz sekme/bağlantı listesi o analiz bitince çıkacak. Liste gelmeden arayüz dilimi yazılamaz; bu yüzden iki kol gerçekten paralel.

⚠️ **Liste geldiğinde kodlamadan ÖNCE veri modeline karşı okunur** — hangi sekme hangi tabloya bakıyor, olmayan bir tablo var mı. Aksi halde arayüz işi bizim tarafta yapılmış işi revize ettirir.

---

### Karar: Pilot bir PWA olarak koşulur; native app'in bedeli pilotun kazancından büyük

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** "Web çok profesyonel değil, app yapsak daha iyi olur" değerlendirmesi yapıldı. Hissin kendisi gerçek; sebebi araştırıldı.

**Ölçülenler — hissi yaratan üç şey ve maliyetleri:**

| Sebep                             | Çözümü                                     | Maliyeti             |
| --------------------------------- | ------------------------------------------ | -------------------- |
| `orbit-v3-kappa.vercel.app`       | Alan adı (zaten alınıyor)                  | `v1.5-13`            |
| Adres çubuğunun görünmesi         | PWA "Ana Ekrana Ekle" — kendi ikonu ve adı | Bir manifest dosyası |
| İlk açılışın yavaşlığı (1.166 kB) | Kod bölme                                  | `v1.5-11`            |

**Karar:** Pilot **PWA** olarak koşulur. Native app pilot kapsamı dışındadır.

**Gerekçe — native'in ölçülmüş bedeli** (analiz `ROADMAP` §4.7'de, 2026-09-05):

- **App Store 4.2.6:** şablondan üretilen uygulamalar, içeriğin sahibi göndermedikçe reddediliyor. ORBIT elli dershane için elli uygulamayı kendi hesabından yükleyemez.
- **App Store 4.2 "asgari işlevsellik":** yalnız siteyi saran uygulama **push bildirimi olmadan reddediliyor.** Yani app kararı, aynı turda uygulama içine indirilen bildirim altyapısını **geri zorunlu kılıyor** — ve arka plan işçisi bugün yok.
- **Apple Developer hesabı** tüzel kişilik doğrulaması istiyor; şirketleşme pilot sonrasına bırakıldı.
- **Her güncelleme mağaza incelemesi** — `v1.5-14`'ün (kademeli açılış) tam tersi yönde çalışır ve eski sürümde kalan kullanıcı üretir.

**Ve bir şey native'de YAPILAMIYOR:** ana ekrandaki isim ve ikon manifest'ten, **kurulum anında** okunuyor. Kurum başına alt alan adı kendi manifest'ini sunarsa veli telefonuna "Orbit"i değil **kendi dershanesini** kurar. Native'de uygulama adı derleme anında sabitlenir.

**Tetikleyici:** pilot kurum "mağazada olsun" derse o gerçek kanıttır ve app, şirketleşme sonrası push ile birlikte yapılır.

---

### Karar: Supabase'de kalınır; Hetzner'e geçişin tetikleyicisi bildirim işidir

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Karar:** Bugün taşınma **yapılmaz**. Hetzner, **n8n/bildirim aşamasında** gündeme gelir. Ekstra maliyet üretilmez.

**Gerekçe.** `PLATFORM_SETTINGS` §3.7'deki A/B/C/D ayrımı ölçülmüştü: **B** (Hetzner frontend + Supabase Cloud) ve **C** (her şey Docker'da self-hosted) **sıfır kod değişikliği** istiyor, **D** (Supabase'siz) bir backend yazma projesi. Yani beklemek bizi bir yere mahkûm etmiyor — **C her zaman açık kalıyor** ve maliyeti zamanla artmıyor.

**Tetikleyici bildirimdir, barındırma değil.** Aynı bölümün cümlesi: _"Backend'i doğuracak olan barındırma değil, kimse ekranın başında değilken çalışması gereken iş."_ Bugün arka plan işçisi **yok**; bildirim onu doğuruyor. Dolayısıyla `v1.6-00` ile Hetzner aynı turun parçası olur.

⚠️ **n8n bir kısayol değil, aynı tetikleyicinin parçası.** n8n bir kanal değil orkestratör: WhatsApp düğümü de aynı Cloud API'ye bağlanır. Ve n8n'in **bir yerde çalışması** gerekir — yani "n8n ile çözelim" demek "bir sunucu ayağa kaldıralım" demektir.

🔴 **Taşınma veri yerleşimini ÇÖZMÜYOR.** Hetzner'in veri merkezleri Almanya, Finlandiya, ABD ve Singapur'dadır; **Türkiye yoktur.** Frankfurt'tan Falkenstein'a geçmek KVKK açısından yatay bir harekettir. Değişen tek şey veri işleyen zincirinden **Supabase Inc. (ABD şirketi)** çıkması; konum aynı kalır.

---

### Karar: Hesap bağını kişinin kendisi koparır

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent
**Ölçüm:** 2026-09-16 açılış taraması, `ROADMAP` §4.15 (B1 · B2)

**Bağlam:** 2026-09-14 kararı bağlamayı iki taraflı kanıta bağladı ve _"yanlış bağlanan bir hesap"_ ifadesini kendisi kullandı — yani yanlış bağlamanın olabileceği kabul edilmişti. Ama karşılığı yalnız **önleme**ydi.

**Ölçüldü:** bağı koparan **hiçbir yol yok** — ne canlı şemada, ne migration'larda, ne `accountLinkService`'te, ne arayüzde. `person_id` yalnız değer alıyor, hiçbir yerde `null`'a çekilmiyor; `authenticated` onu yazamıyor ve bunu sabitleyen bir test var. Kalan tek yol `service_role` ile elle müdahale — kuralın yasakladığı şey.

**Karar:** `unlink_accounts()` eklenir ve yetkisi **kişinin kendisindedir.**

**Gerekçe.** Bağlama iki taraflı kanıt ister çünkü iki hesaba da girebilmek bir **sahiplik** kanıtıdır. Koparma tek taraflı olabilir: bir hesabın "ben bu gruptan çıkıyorum" demesi kimseye zarar vermez ve yanlış ya da zorla kurulmuş bir bağı **kurbanın kendisi** kesebilir. Asıl ihtiyacı karşılayan şey budur.

**Reddedilen: kurum yöneticisine koparma yetkisi.** Yönetici bağı **kuramıyor** (2026-09-14 kararı bunu bilerek kapattı); koparabilmesi asimetri yaratırdı.

**Aynı dilimde kapanan ikinci şey — şart kodun bir yarısında duruyordu.** 2026-09-14 kararı _"Ek koşul — `must_change_password` kapalı olmalı"_ diyor ve gerekçesini de yazıyor: _"geçici şifreyi bilen yönetici de olabilir."_ Ölçüldü: şart `link_accounts`'ta (tüketen) **var**, `issue_account_link_code`'da (üreten) **yok.** pgTAP da aynı asimetriyi taşıyor — tüketen taraf için iddia var, üreten taraf için yok.

Açtığı yol, kararın kapattığını söylediği yolun **tam kendisi**: yönetici kâğıt fişteki geçici şifreyle üyenin hesabına girer, kod üretir, kendi hesabında tüketir → `switch-account` ona o üyenin oturumunu **üye kendi şifresini belirledikten sonra da** verir. Şifre sıfırlamadan farkı önemli: sıfırlama **gürültülüdür**, üyenin şifresi çalışmaz ve fark eder. Bu yol sessizdir.

✅ **Ölçüldü: `people` canlıda 0 satır** — geriye dönük veri düzeltmesi gerekmiyor, temiz sayfa.

---

### Karar: Online tahsilat doğrudan pazaryeri olarak kurulur; kurum-başına-hesap aşaması atlanır

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** Kurumların veliden aldığı taksitleri uygulama içinden tahsil etmesi isteniyor. İlk düşünce "önce kurum başına iyzico hesabı, sonra pazaryeri"ydi.

**Karar:** **Doğrudan pazaryeri** (alt üye işyeri). Ara aşama yapılmaz. Şirketleşmeye bağlı olduğu için **pilot sonrası** (`v1.9-01`).

**Gerekçe.** (a)'dan (b)'ye sonradan geçmek entegrasyonu **ikinci kez yazmak** demek: üye işyerinin kim olduğu değişir, veri modeli değişir, mutabakat değişir ve o ana kadar gelen **her kurumla yeniden masaya oturulur.**

Üstüne (a)'nın kalıcı bir güvenlik yükü var: kurum başına iyzico API anahtarı saklamak, veritabanı sızarsa **o kurumun üyeliğinden kart çekilebilmesi** demektir. Bugün şemada kart/IBAN/jeton kalıbına uyan **0 sütun** var; bu duruşu bozmaya değmez.

**Kart verisi bizim alan adımıza hiç girmez:** barındırılan ödeme sayfası + 3DS yönlendirmesi. Saklı kart kullanılırsa token iyzico'da durur, bizde yalnız referansı.

🔴 **İsim çakışması karara bağlanmadan kod yazılmaz.** iyzico'da "taksit" **bankanın karta yaydığı** taksittir; ORBIT'te "taksit" **kurumun ödeme planındaki aydır.** İkisi aynı ekranda görünecek. Üçünün de mümkün olduğu ölçüldü: aylık taksitin tek çekimle ödenmesi, yıllığın karta bölünmesi, ve saklı kartla otomatik aylık tahsilat.

**Komisyonu kurum yutar; banka taksitinde vade farkı veliye yansır** ve seçim kurum başına ayardır. Gerekçe: **ücret sıfırla değil bugünkü tahsilat maliyetiyle kıyaslanır** — veli arama, geciken ve hiç ödenmeyen taksitler, nakit taşıma, elle mutabakat. Her online kart işleminin bir maliyeti var (tek çekimde bile) ve taksitte artıyor; ama tahsilat oranını birkaç puan iyileştirmesi bunu kat kat karşılar. Her şeyi veliye yansıtmak **kullanımı öldürür** ve amaca ters.

**Veri modeli sonucu:** `charged_amount`, `net_amount`, `fee_amount` ve `bank_installment_count` ayrı durur. `paid_at` **"kurumun alacağı kalmadı"** demektir, komisyondan bağımsız.

⏳ **Kaydı düşülen alternatif:** havale/EFT (FAST) + ödeme referansıyla otomatik eşleştirme. Veli için bedava, kurum için çok düşük; bedeli banka entegrasyonu. Tetikleyici: komisyon tutarı, eşleştirme işinin maliyetini geçtiğinde.

---

### Karar: Otomasyon sekmesi gizlenmez, kaldırılır

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Karar:** Otomasyon sekmesi, ekranı, tipleri ve demo verisi **silinir** (`v1.5-10`). Menüden gizlenip kod bırakılmaz.

**Gerekçe.** Arkasında **tablo yok, servis yok**; yalnız ekran var ve demo verisinden besleniyor (`PROJECT_STATE` bağlantı matrisi: Otomasyon satırı "Tablo ❌ Servis ❌ Ekran ✅"). Gizlemek ölü kod bırakır, "çağıranı olmayan servis kalamaz" kapısıyla çatışır ve ileride okuyan biri **çalıştığını sanır.**

**Emsal kendi geçmişimizde:** v1.4-05 türetilemeyen üç öğeyi (`"Tamamlandı"`, `Student.homework` "7/9", "Ödev tamamlama" kartı) beklemeye bırakmadı, **kaldırdı** — ve bu depo aynı kararı bir kez daha verdi: _"Kuralı olmayan kart, kural yazılarak değil kaldırılarak kapandı."_

**Geri getirme yolu kayıtlı:** ekran görüntüsü elde ve git geçmişinde duruyor. İleride eklenirse stil bozulmadan eklenir.

⚠️ Bir ayrım: **silinen şey arayüzdeki sekme.** n8n'in ileride **altyapı** olarak gelmesi ayrı bir iştir (`v1.6-00`) ve bu kararla çelişmez.

---

### Karar: Şirketleşme pilot sonrasına bırakılır — ve üç işi birden erteler

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Karar:** Şirketleşme **pilot sonrası.** Pilot, tüzel kişilik gerektirmeyen kapsamla koşulur.

**Bu kararın kapsamı, adından geniştir.** Üç ayrı iş tüzel kişiliğe bağlıydı ve üçü birlikte pilot dışına çıkıyor:

| İş                     | Neden şirkete bağlı                           | Yeni yeri                    |
| ---------------------- | --------------------------------------------- | ---------------------------- |
| iyzico pazaryeri       | Ana üye işyeri sözleşmesi tüzel kişilik ister | `v1.9-01`                    |
| Apple Developer hesabı | D-U-N-S + tüzel kişilik doğrulaması           | Native app erteleniyor → PWA |
| WhatsApp Cloud API     | Meta Business doğrulanmış işletme ister       | `v1.6-00`                    |

**Gerekçe.** Üçü de pilotun **amacı** değil: pilot, kurumun operasyonunu yönetebildiğimizi görmek için koşuluyor. Tahsilat, mağaza dağıtımı ve WhatsApp bildirimi bunun kanıtı değil, sonrasının ürünü.

✅ **Pilotun bunlara ihtiyacı olmadığı doğrulandı:** tahsilat bugünkü gibi elle işaretlenir · dağıtım PWA ile yapılır · bildirim uygulama içinde kalır · kurtarma maili spam'a düşse bile tek yol değildir, çünkü **yönetici üyenin, operatör de yöneticinin** şifresini sıfırlayabiliyor.

---

### Karar: Derslik bir varlıktır; çakışma serbest metinle değil kimlikle engellenir

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent
**Değiştirdiği karar:** "Derslik çakışması engellenmiyor — serbest metin katı kural taşımaz" (2026-09-13)

**Bağlam:** Derslik çakışmasının engellenmesi _"bir kurumun yönetimi için temel gereklilikler"_ listesine girdi. 2026-09-13'te bu bilinçli olarak açık bırakılmıştı ve gerekçesi üç maddeydi.

**O gerekçeler yanlış çıkmadı — biri planın tarifi oldu, biri gereksinime dönüştü:**

1. _"Yazım farkı kuralı deler"_ ("A-101" ≠ "A101") — **hâlâ doğru**, ve tam olarak bu yüzden çözüm serbest metne indeks koymak değil. Serbest metin **kaldırılıyor**.
2. _"Doğal olarak paylaşılan değerler var"_ ("Online", "Bahçe", "Salon") — **hâlâ doğru**, ve `rooms` tablosunda bir **"paylaşılabilir"** bayrağına dönüşüyor. Paylaşılabilir bir derslik çakışma kuralının dışında kalır.
3. _"Güvenilir çözüm `rooms` tablosu + seçim listesi olurdu; bu dilimi belirgin biçimde büyütürdü"_ — **bu cümle yeni dilimin tarifidir.** Değişen tek şey, o büyüklüğün artık yapılmaya değer bulunması.

**Karar:** `rooms` tablosu eklenir; `schedule_entries.room` serbest metni `room_id`'ye döner ve çakışma kısmi tekil indeksle engellenir.

**Ölçülenler (2026-09-16):**

- ✅ **Öğretmen ve sınıf çakışması şemada ZATEN engelli** — `schedule_entries_teacher_slot_idx` ve `schedule_entries_class_slot_idx`, ikisi de kısmi tekil indeks. Açık olan **yalnız derslikti**; yani bu dilim eksik üçüncü bacağı tamamlıyor.
- ✅ **`schedule_entries` üretimde 0 satır** — serbest metinden kimliğe geçişte **veri göçü yok.** Bu dilimin bugün yapılmasının en ucuz olduğu an; ilk gerçek program girildikten sonra aynı iş bir göç işi olur.

⚠️ **K-22 uyarısı yönü değişiyor.** Eski karar _"ekran engelliyormuş gibi görünmemeli"_ diyordu. Artık gerçekten engelliyor — dolayısıyla yeni yükümlülük tersi: **engellendiğinde sebebi söylenmeli** ("A-101 bu saatte 11-A dersinde"), yoksa kullanıcı neyin çakıştığını bilmez.

---

### Karar: Deneme sınavı ders bazında kırılım taşır — tek net puan dershanenin sorusunu cevaplamıyor

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent

**Bağlam:** "Deneme girişi" temel gereklilik listesine girdi. İlk bakışta bir ekran işi gibi görünüyordu; ölçüm başka söyledi.

**Ölçülenler (2026-09-16, canlı şema):**

| Ne                       | Sonuç                                                           |
| ------------------------ | --------------------------------------------------------------- |
| `exams.class_id`         | **nullable** — kurum geneli bir deneme kaydedilebilir           |
| `exams.subject_id`       | **nullable** — tek derse bağlı olmayan bir sınav kaydedilebilir |
| `exam_results` sütunları | `exam_id`, `student_id`, **`score numeric(6,2)`** — tek sayı    |

Yani şema bir denemeyi **bir satır olarak** tutabiliyor, ama **ders bazında doğru/yanlış/net tutacak hiçbir yeri yok.**

**Karar:** Ders bazında kırılım eklenir. Bir denemede Türkçe/Matematik/Sosyal/Fen ayrı ayrı girilir; net = doğru − yanlış/4.

**Gerekçe.** Bir dershanenin denemeden beklediği şey öğrencinin toplam neti değil, **hangi derste zayıf olduğu** — öğretmene neyi düzelteceğini söyleyen tek bilgi o. Tek `score` ile "Matematik neti düşük" sorusu **hiçbir şekilde** cevaplanamaz; türetilecek bir veri yok, saklanmamış bir veri var.

**Reddedilen: pilotta tek net, kırılım sonra.** Bu depo aynı durumu bir kez yaşadı ve dersi yazılı: v1.4-05'te türetilemeyen üç öğe (`"Tamamlandı"`, `Student.homework` "7/9", "Ödev tamamlama" kartı) beklemeye bırakılmadı, **kaldırıldı** — çünkü söz verilip gelmeyen bir alan, bir veriyi değil bir **beklentiyi** gösterir (`DECISION_LOG` — "Ödev teslim takibi kendi dilimidir; ama takip edilmeyen şey bugün iddia edilmez"). Kırılımı erteleyip ekranda ders adları göstermek aynı kalıba düşerdi.

**Kapsam — bir ekran değil bir şema dilimi:**

- Ders bazında sonuç tablosu (`exam_id` + `student_id` + `subject_id` → doğru, yanlış, net) ve RLS'i
- Toplu giriş ekranı: sınıf listesi üzerinden, ders ders
- **`exam_ranking()` toplamı anlamak zorunda** — sıralama bugün tek `score`'a bakıyor; kırılım gelince toplam net türetilmiş bir değer olur ve sıralamanın kaynağı netleşmeli
- Eksi net **kabul edilir** — mevcut karar aynen geçerli: "Puanın tavanı vardır, tabanı yoktur"

⚠️ **Açık bırakılan soru:** net katsayısı (yanlış/4) sınav türüne göre değişir ve bugün şemada **sınav türü kavramı yok** — mevcut karar bunu bilerek reddetmişti ("Sınav eğilimi yüzdedir ve sınav türü iddia edilmez"). Katsayının nerede yaşayacağı dilim açılışında karara bağlanır: sabit mi, deneme başına mı, yoksa ders başına mı.

---

### Karar: Optik okumaya girilmez — kurum okur, biz sonucu alırız

**Durum:** Alındı
**Tarih:** 2026-09-16
**Kararı Onaylayan(lar):** Arda Bülent
**İlgili karar:** "Deneme sınavı ders bazında kırılım taşır" (2026-09-16) — bu karar o verinin **nasıl geldiğini** belirler

**Bağlam:** Deneme sonuçlarının sisteme girişi araştırıldı. İlk tasarım telefon kamerasıyla **optik form okumaydı** (OMR): öğrenci/öğretmen cevap kâğıdını çeker, sistem baloncukları okur, cevap anahtarıyla karşılaştırır, net hesaplar. Araştırma ciddiydi ve teknik olarak yapılabilir olduğunu gösterdi (OpenCV, perspektif düzeltme, template eşleme, güven skoru).

**Karar: OMR yapılmıyor.** Kurum denemeyi **kendi mevcut okuyucusuyla** okur; platform **yalnız sonucu** alır.

**Gerekçe — üç ayrı sebep ve üçü de bağımsız olarak yeterli:**

1. **Asıl zorluk bizim optiğimiz değil, yayınevlerinin optiği.** Her yayınevinin formu farklı: soru numaralandırması, bölüm başlıkları, baloncuk yerleşimi. Kendi formumuza QR/marker koyabilirdik ama **yayınevinin basılı formuna koyamayız.** Yani her yayınevi için bir "template" tanımlamak ve bakımını yapmak gerekirdi — ürünün asıl işi olmayan, sürekli büyüyen bir bakım borcu.
2. **Hatalar sessiz değil, ama pahalı.** Silgi izi, hafif işaretleme, iki şık, gölge, parlama, kırışık kâğıt, düşük kamera — hepsi doğruluğu düşürüyor. Karşılığı "güven skoru + kullanıcıya sor" olurdu; yani kullanıcı yine tek tek kontrol edecekti. **Kurumun zaten çalışan bir optik okuyucusu varken** bu iş net bir kayıp.
3. **Kurumun çalışma düzenini değiştirmiyoruz.** Dershane denemeyi bugün de okuyor. Ondan "okuma yönteminizi bırakın" istemek, satışta sürtünme; "sonucu bize de verin" istemek ise kolay.

**Ürünün değer önerisi de bu kararla netleşiyor** — ve OMR'dan daha güçlü bir yerde duruyor:

> Hangi yayınevinin, hangi optik okuyucusunun veya hangi sınav sisteminin kullanıldığı önemli değil; **sonuçlar tek yerde birleşir.**

Öğrenci X Yayınları'nda 85, Y'de 79, kurum denemesinde 82 net yaptıysa üçü **aynı grafikte** görünür. Yayınevinin kendi uygulaması bunu yapamaz, çünkü yalnız kendi denemesini bilir.

**Kapsam — `v1.5-16`:**

- Kurum yöneticisi Excel/CSV yükler; **sütun eşleme** ekranı gelir (her yayınevinin/kurumun başlıkları farklı: `TR_D` · `Türkçe Doğru` · `turkce_dogru`)
- **Öğrenci eşleştirmesi isimle DEĞİL `students.student_number` ile.** Anahtar zaten yerinde ve kararı da yazılı: "Öğrenci numarası kurumun defterinden gelir; sunucu üretmez". İsimle eşleştirme aynı adlı iki öğrencide sessizce yanlış sonuç yazardı.
- Ders bazında **doğru / yanlış / boş** saklanır; net **türetilir**, saklanmaz (tek doğruluk kaynağı — **K-06**)
- Sabit sütunlar (`TurkishCorrect`, `MathCorrect` …) **kullanılmaz**; ders bazında satır tutulur. Sebep: TYT/AYT/LGS ve kurum içi sınavların ders kümeleri farklı ve sabit sütun her yeni sınav türünde şema değişikliği isterdi.
- Deneme metadata'sı: yayınevi, deneme adı, kitapçık, yıl

🔗 **Bu dilim `v1.7-02`'ye bağlı ve onu öne çekiyor.** `v1.7-01/02` (CSV/Excel toplu aktarım, sütun eşleme, idempotent import) Phase 2'de duruyordu; deneme sonucu içe aktarma **tam olarak o makineyi** istiyor. İkisini iki kez yazmamak için altyapı bir kez kurulur ve iki tüketici de onu kullanır.

⚠️ **Sınav türü kavramına dokunuyor.** Yayınevi ve kitapçık metadata'sı gerekiyor; mevcut karar ise "Sınav eğilimi yüzdedir ve **sınav türü iddia edilmez**" diyor. O karar sınav türünü _iddia etmemeyi_ seçmişti; burada tür bir **veri alanı** olarak geri geliyor. Dilim açılışında ikisi karşılaştırılmalı — çelişki mi, kapsam genişlemesi mi.

**Reddedilen ama kaydı düşülen:** OMR bir gün ürüne değer katabilir — ama **kendi** oluşturduğumuz optiklerde, QR/marker ile ve kurum içi sınavlar için. Yayınevi formlarını okumak hedef değil. Tetikleyici: kurumların "kendi kurum içi sınavımızı da okutalım" talebi.

**Kapsam dışı — bilinçli olarak sonraya:** yayınevi bağımsız gelişim grafikleri, sınıf/kurum karşılaştırmaları ve konu bazlı analiz. Veri modeli bunları **mümkün kılacak** biçimde kurulur ama ekranları `v1.8` (gelişmiş filtreleme ve raporlama) işidir. YZ destekli yorum (_"son beş denemede matematikte düşüş var"_) v2.0'ın LLM kapısına tabidir.

### Karar: Bağ koparma grubu dağıtmaz, ama son hesapta bağ tamamen çözülür

**Karar (2026-09-18, `v1.5-07` · #319):** `unlink_accounts()` **çağıranın kendi bağını** koparır; gruptaki diğer hesaplara dokunmaz. **İstisna:** koparmadan sonra grupta tek hesap kalacaksa, o hesabın da bağı çözülür.

**Gerekçe — iki farklı soruya iki farklı cevap:**

1. **"Bir hesabı gruptan çıkarmak" ile "yanlış kurulmuş bir bağı geri almak" aynı şey değil.** İlki bir tercih; ikincisi bir **düzeltme**. §4.15'in B1+B2'si birlikte okunduğunda ortaya çıkan senaryo ikincisidir: kâğıt fişteki geçici şifreyle açılan bir bağ, kurbanın hiç istemediği bir bağdır ve geri alınması **tam** olmak zorundadır.
2. **Yarım kalmış bir grup, geri dönüş yoludur.** A ve B bağlıysa ve A koparsa, B'nin `person_id`'si dolu kalır. B o kişi kaydına bağlı tek hesaptır; menüsü çizilmez, geçiş yapamaz — yani **işlevsel olarak** bağsızdır. Ama `person_id` durduğu için B yeni bir bağlama kodu üretip A'yı (ya da başkasını) **aynı kişi kaydına** tekrar bağlayabilir. Koparmanın amacı buysa, yarım bırakmak amacı boşa çıkarır.

**Neden gruba dokunulmuyor (istisna dışında):** üç hesabı olan biri bir tanesini ayırmak isterse, diğer ikisinin bağı onun kararı değil — o iki hesap arasındaki bağ **durmaya devam eder**. Koparma kişinin **kendi** kimliği üzerindeki bir işlem.

⚠️ **İstisna "başka birinin kaydına dokunmak" değil.** Kalan hesap tanım gereği **aynı kişi kaydına** bağlı, yani aynı kişinin hesabı. Başka bir kişinin kaydı hiç okunmuyor: `update` yalnız `person_id = kisi_id` olan satırları görüyor.

**Yetki kişinin kendisinde, yöneticide değil** (karar 2026-09-16 teyit edildi). Sebep bu dilimde daha da netleşti: yönetici koparabilse, **B1'i kullanan kişi izini de temizleyebilirdi** — bağı kurar, kullanır, koparır ve geriye yalnız iki denetim satırı kalırdı.

**Denetim izi:** etkilenen **her** hesabın **her** aktif üyeliğinin kurumuna bir `account_link.severed` satırı yazılır. Bir kurum yalnız kendi üyesine ait olayı görür; başka kurumun hesabı o kuruma yazılmaz. `severed_by_self` bayrağı koparanı işaretler — bir yönetici kendi kurumunun denetim kaydında "bu üyenin hesap bağı koparıldı, koparan kendisi değil" ayrımını görebilir.

⚠️ **Sahipsiz kalan `people` satırı SİLİNMİYOR.** İlk yazımda siliniyordu; **Yıkıcı Migration Kontrolü** o `delete`'i yakaladı ve `-- ALLOW-DESTRUCTIVE` kaçış yolu **kullanılmadı** çünkü silmeye gerek yoktu: güvenlik özelliği _"o kişi kaydına bağlı hesap kalmaması"_ ve onu `update` sağlıyor. Sahipsiz satır opak bir kimlikten başka bir şey taşımıyor, kimse ona bakmıyor — `my_linked_accounts` da geçiş kapısı da `person_id` üzerinden çalışıyor. Emsal aynı ailenin bir önceki migration'ı: eski bağlama kodu silinmek yerine süresi bitiriliyor, gerekçesi de aynı. **Kapı, gereksiz bir yıkıcı ifadeyi kaldırttı.**

**Reddedilen alternatif:** koparmayı "grubu tamamen dağıt" olarak tanımlamak. Üç hesaplı bir kişinin bir hesabını ayırmak isterken hepsini kaybetmesi, kullanıcının istemediği bir yan etki olurdu — ve geri alması için iki kod üretip iki bağ kurması gerekirdi.

### Karar: CSP kapısı `VERCEL_ENV`'e bağlanır, CI'ın körlüğü kabul edilir

**Karar:** CSP ↔ `VITE_SUPABASE_URL` karşılaştırması yalnız `process.env.VERCEL_ENV` tanımlıyken koşar. CI'a gerçek Supabase adresi **verilmez**; CI yer tutucu ile derlemeye devam eder ve gerçek karşılaştırmayı **hiç görmez**.

**Sebep:** Karşılaştırmanın anlamı, uygulamanın _gerçekten bağlanacağı_ adresi _gerçekten servis edilecek_ CSP ile eşleştirmek. Gerçek adresin tek otoritesi Vercel ortam değişkeni. CI'a o adresi yazmak kapıyı CI'da çalıştırırdı ama karşılaştırılan iki değerin ikisi de depoda olurdu — yani kapı kendi kendini onaylardı ve gerçek ayrışmayı (Vercel değişkeni değişti, `vercel.json` unutuldu) **yine göremezdi**. Üstelik `ci.yml`'ye üçüncü bir kopya eklenmiş olurdu: kaldırmaya çalıştığımız ikizi çoğaltmak.

`deploymentEnvironment`'a bağlanmadı ve sebebi ölçüldü: CI `pnpm build` koşuyor, `VERCEL_ENV` tanımsız olduğu için o değer CI'da da `"production"` çözülüyor. Kapı ona bağlansa CI yer tutucu URL yüzünden kırmızıya dönerdi.

**Reddedilen alternatifler:**

- **CI'ya gerçek adresi vermek** — yukarıdaki sebep. Adres gizli değil (`vercel.json`'da ve her pakette düz metin), yani reddin gerekçesi güvenlik değil **anlamsızlık**.
- **Yer tutucu ana adlarını kara listeye almak** (`placeholder.supabase.co` atlanır) — kara listeler çürür; bir gün başka bir yer tutucu kullanılır ve kapı sessizce atlar.

**Bedeli açıkça:** gerçek karşılaştırma yalnız dağıtım derlemesinde koşar. Karşılığı üç CI kapısı — denetleyicinin birim testleri, `vercel.json`'ın tek başına tutarlılığı (`https` ↔ `wss` aynı proje), ve gerçek `vite.config.ts` fonksiyonunu kasten yanlış bir değerle çağıran bir iddia.

---

### Karar: Migration anahtarları saat yakalayana kadar önde kalır

**Karar:** Sıradaki migration `20260928…` olarak adlandırılır. Migration damgası bir tarih değil, bir **sıralama anahtarı** olarak kabul edilir; eklenen her migration mevcut en büyük anahtardan büyük olmak zorundadır.

**Sebep:** İki yol migration'ları ayrı sırayla uyguluyor — yerel ve CI (`supabase test db`) her koşuda sıfırdan **ad sırasıyla**, üretim (Supabase GitHub entegrasyonu) yalnız uygulanmamış olanları **zaman sırasıyla**. Bugün gerçek tarihle (`20260918…`) yazılacak bir migration yerelde dokuz uygulanmış migration'dan önce, üretimde sonra koşar: aynı dosya kümesinden iki ayrı şema evrimi, testler yeşil, üretim başka bir yerde.

Saatle uyum kozmetik; üretimi koruyan özellik tek yönlü artış. Ve "önde olma" kendiliğinden kapanıyor — 2026-09-28'den sonra gerçek tarih zaten en büyük anahtar olur.

**Reddedilen alternatifler:**

- **Dokuz dosyayı yeniden adlandırmak** — uygulanmış migration'ın adı `schema_migrations`'ta kayıtlı; adı değişirse Supabase onu **yeni sanıp tekrar uygular**. Bu, düzeltmeye çalıştığımız şeyden daha ağır bir üretim olayı.
- **Gerçek tarihi kullanıp sıra ayrışmasını kabul etmek** — ayrışmanın sonucu sessiz ve testlerle görünmez.

**Kapısı:** `supabase/tests/deployment/migrationOrderIsMonotonic.test.ts`. İki sayı tutuyor (adet + en büyük anahtar) ve her yeni migration'da ikisinin güncellenmesini istiyor; güncelleme sırasında sorulan soru tam olarak sormamız gereken soru — _"benim dosyam en üstte mi?"_

---

### Karar: Ortaklık sona erdi; üç platform da tek sahibe döndü ve Supabase temiz kurulumla yeniden açıldı

**Durum:** Uygulandı (bekleyen panel ayarları bölüm sonunda)
**Tarih:** 2026-09-19
**Onaylayan:** Arda Bülent

**Bağlam:** 2026-08-22'de GitHub, Supabase ve Vercel'in üçü de Hamza'nın hesaplarına taşınmıştı. Gerekçe o tarihte yazıldı ve doğruydu: Vercel/Supabase koltuk paylaşımı ücretli plan istiyordu, Hamza'nın sahiplenmesi entegrasyonları bağlamasını sağlıyordu. Ortaklık sona erince o gerekçe ortadan kalktı. **O kayıt silinmiyor** — bugün geçersiz olması, o gün yanlış olduğu anlamına gelmez.

**Karar:**

1. **GitHub — devir.** `Hamzabyrk/orbit_v3` → `ardabulent/orbit_v3`. Yeni repo açmak yerine transfer seçildi.
2. **Supabase — yeni proje, temiz başlangıç.** `vlduktyygzfjpjdzuhxy`, org `ORBIT's Org`, bölge `eu-central-1`. 72 göç uygulandı, veri taşınmadı.
3. **Vercel — yeni proje.** `orbit-v3`, kapsam `ardabulent911-3297s-projects`, üretim adresi `orbit-v3-kappa.vercel.app`.
4. **Türkiye'ye taşınma ertelendi.** Pilot anlaşmasına kadar Supabase Cloud'da kalınıyor.
5. **Eski kopyalar silinmiyor.** Yeni kurulum uçtan uca doğrulanana kadar Hamza'daki projeler yedek olarak duruyor.

**Gerekçe:**

**Devir, yeni repo açmaya tercih edildi** çünkü transfer 218 PR, 105 issue ve Actions koşum geçmişini koruyor. Yeni repo yalnız commit geçmişini taşırdı; bu depoda kararların çoğu PR açıklamalarında yaşıyor ve onların kaybı belge kaybıdır.

**Supabase'de devir yerine yeni proje seçildi** çünkü eski proje Hamza'nın organizasyonunda ve proje transferi organizasyon sahipliği gerektiriyor. Ayrıca pilot öncesi olduğumuz için korunması gereken gerçek veri yok — temiz kurulum hem daha hızlı hem daha az riskli. **Bedeli:** kurum ve operatör bootstrap'ı yeniden yapılacak.

**Bölge bilerek `eu-central-1` bırakıldı.** Değiştirmek `ROADMAP` §4.23'ün gecikme ve eşzamanlılık kayıtlarını karşılaştırılamaz hale getirirdi. Veri yerleşimi ayrı bir konudur ve `PLATFORM_SETTINGS` §3.7'de izleniyor.

**Laravel'e geçme tavsiyesi değerlendirildi ve reddedildi.** Öneri iki iddiayı birleştiriyordu: sunucunun Türkiye'de olması gerektiği (**doğru**) ve bunun için Laravel gerektiği (**gerekmiyor**). §3.7'nin 2026-09-10 ölçümü dört seçeneği karşılaştırıyor; Türkiye yerleşimini **self-hosted Supabase** sıfır kod değişikliğiyle çözüyor. Laravel ise 55 PostgREST çağrı yeri, 16 GoTrue çağrısı, `auth` şemasına dokunan 21 göç ve tüm öğrenci/veli RLS zinciri demek — ayrıca K-01..K-29 kural birikimi ve §4.23'ün 21 bulgusu geçersizleşirdi.

**Ölçülen iki yan etki:**

- **`secret_scanning` ve `secret_scanning_push_protection` devirde kapandı.** GitHub bu ayarları transferde taşımıyor. Aynı gün geri açıldı. Public repoda ücretsizler ve push protection "yanlışlıkla anahtar commit'lemek" sınıfını **push anında** durduruyor.
- **Supabase→GitHub ve Supabase→Vercel entegrasyonları koptu.** Beklenen ve doğru: GitHub App kurulumları **hesaba** bağlıdır, repoya değil. Yeniden kurulmaları gerekiyor; o zamana kadar göçler elle uygulanıyor.

**Bir yıllık bilinmez bu turda kapandı.** `PLATFORM_SETTINGS` bölüm 5, 2026-09-04'te _"onay sayısı 0'ken Arda'nın neden merge edemediği bilinmiyor ve üçüncü bir teori uydurulmayacak"_ diye kayda geçmişti. Sebep ölçüldü: **ruleset'in yanında ayrı bir klasik dal koruması** duruyordu ve o 1 onay istiyordu. GitHub ikisini birden uygular. Eski kayıttaki _"main klasik korumayla değil ruleset ile korunuyor"_ çıkarımı yanlıştı; dayandığı 404, korumanın yokluğundan değil **Arda'nın admin olmamasından** geliyordu. Klasik kural silindi, ruleset kaldı.

> 📌 **Denetleyenin ilk teorisi de yanlıştı ve bu da kayda geçiyor.** Engelin `require_extra_approval_for_unattributed_changes` olduğu söylenmişti (commit'ler `Co-Authored-By` taşıdığı için). O ayar kapatıldı ve PR'lar **yine** engelliydi. Yani teori ölçümle çürütüldü. Aynı hata iki kez yapıldığı için sebep ayrı yazılıyor: **admin olmayan bir hesabın 404'ü, "yok" demek değildir.**

**Reddedilen alternatifler:**

- **Yeni GitHub reposu açmak** — PR ve issue geçmişini kaybederdi.
- **Eski Supabase projesini devralmak** — organizasyon sahipliği gerektiriyor ve taşınacak veri yok.
- **Şimdi Türkiye VPS'ine geçmek** — kod değişmezdi ama yedekleme, PITR, yama ve nöbet sorumluluğu bugün üstlenilirdi. Pilot anlaşması yokken bedeli erken.
- **`supabase config push` ile ayarları toplu itmek** — `config.toml` yerel yığın için yazılmıştır ve `[remotes]` bölümü yoktur; push, üretim Site URL'ini `127.0.0.1` yapar ve şifre sıfırlamayı kırar. CLI'ın kendi yardım metni de bu tuzağı adıyla anlatıyor.

---

### Karar: Arayüz dondurma kararı sona erdi; yenileme uzun ömürlü dalda yapılır, kopya klasörde değil

**Durum:** Kabul edildi
**Tarih:** 2026-09-19
**Onaylayan:** Arda Bülent

**Bağlam:** ROADMAP §1'de kayıtlı bir karar vardı: _"UI/UX tasarımı korunacak; yalnızca veri kaynağı, yetkilendirme, form davranışı, loading/error/empty durumları bağlanacak."_ v1.0 zaten bir arayüz demosuydu ve otuz üç günlük bütün altyapı işi onun **altına** yapıldı. Karar o gün doğruydu: değişen bir yüzeyin altına altyapı örmek iki işi birden yapmak olurdu.

Bugün iki şey değişti. Ortaklık bitti ve arayüz kolu sahipsiz kaldı (eski düzende rakip analizi ve ekran listesi Hamza'daydı, teslim edilmedi). İkincisi, hedef netleşti: kurumlarla görüşüp ilk müşteriyi bulmak. O sohbette gösterilecek şey arayüz.

**Karar:**

1. **Arayüz dondurma kararı sona erdi.** Yenileme başlıyor ve kapsamı şu: **13 canlı ekran × 4 rol görünümü.** `Otomasyonlar` kaldırılıyor (`v1.5-10`), yani demoya girmiyor.
2. **Yenileme `feat/arayuz-v2` dalında yapılır.** `main` etkilenmez; üretim dağıtımı tetiklenmez, göçler üretime uygulanmaz.
3. **Kopya klasör yaklaşımı reddedildi** (aşağıda).
4. **Kuruma gerçek uygulama gösterilir.** Önizleme dağıtımları **demo aracı değil, geliştirme sırasında test aracıdır**; Vercel Deployment Protection **açık kalır**.
5. **Repo şimdilik public kalıyor**, gizliye alınmıyor.
6. **Hamza'daki eski kopyalar duruyor**, bizi rahatsız ederse kendi tarafımızdan silinir.
7. **Kullanılmayan shadcn bileşenleri silinmiyor** (aşağıda).

**Gerekçe:**

**Neden önce arayüz, sonra düzeltmeler.** İki turda 32 bulgu birikti (§4.23'ten 21, §4.24'ten 11). "Önce hepsini düzeltelim" yolu bitmez, çünkü arayüz değişince o katmandaki düzeltmeler geçersizleşir. Ama karar sezgiyle değil kapsamla verildi: demo modda gezildiğinde **görünen sorunların tamamına yakını tasarım sorunu** (Genel Bakış sabit kartları, ders ekleme yerinin Ayarlar altında olması, sınav sekmesinin belirsiz amacı, takvimin ay atlaması, gün planı kategorileri, hesap bağlama karmaşası). Buna karşılık C-11, C-02, C-03, C-05, C-08 ve B4 demo modda **hiç ortaya çıkmaz**, çünkü o modda Supabase'e tek istek gitmiyor. Onlar pilot öncesi işidir, demo öncesi değil.

**Kopya klasör neden reddedildi.** Öneri, repoyu ayrı bir klasöre kopyalayıp orada geliştirmek ve sonunda kodları geri yapıştırmaktı. Üç sebeple yapılmıyor:

- **Üç kapıyı birden çöpe atar.** Yalnız hesap geçişi turunda kapılar dört şey yakaladı: k6 dosyalarındaki biçim hatası, CSP ikizinin kopması (negatif testle kanıtlandı, yapıyı durduruyor), `deps.ts` sürüm ayrışması, ortam değişkeni eksikliği. Bir günde dört.
- **"Sonunda kopyalarız" en kötü hâliyle merge problemidir.** Geçmiş yok, aşamalı inceleme yok, çakışma çözümü yok. Bu depo "tek devasa PR riski"ni zaten yazılı olarak yasaklıyor.
- **İstenen izolasyonu git zaten veriyor.** Uzun ömürlü dal `main`'i korur ve hiçbir şeyi kaybettirmez.

**Önizlemenin rolü: test, demo değil.** Ölçüldü: `isDemoEnvironment(environment) = environment !== "production"` ve `deploymentEnvironment = VERCEL_ENV ?? VITE_DEPLOYMENT_ENV`. Yani `VERCEL_ENV=preview` → **demo modu açık** → sahte veri, `demo123` girişi, Supabase'e **sıfır** istek. Geliştirme sırasında üretim verisine hiç dokunmadan denemek için ideal.

⚠️ **Ama tam bu sebeple demo aracı olamaz.** Demo modda gerçek giriş, RLS ve veri akışı **sınanamaz**; kuruma gösterilecek olan bunların çalıştığıdır. Bu yüzden Deployment Protection **açık kalıyor** — önizleme adresi paylaşılmayacak.

📌 **Bu karar bir kez ters yazıldı ve düzeltildi.** İlk plan demoyu önizleme üzerinden kurguluyordu ve oradan şu sonuç çıkmıştı: _"demoda görünen sorunların tamamına yakını tasarım sorunu."_ Arda gerçek uygulamanın gösterileceğini netleştirince **o çıkarım çöktü**: C-11 (giriş ilk denemede hata veriyor), B3 (Genel Bakış sıfır gösteriyor), C-02/C-03/C-05/C-08 (eklenen kayıt görünmüyor) ve B4 demo modda hiç ortaya çıkmazken gerçek uygulamada **ilk dakikalarda** görünür. Faz sırası buna göre değişti: veri katmanı düzeltmeleri demodan **sonraya** değil **önüne** alındı.

Bu, **K-30**'un ürün tarafındaki karşılığıdır: bir ortamda görünmeyen kusur, yok olduğunun kanıtı değildir.

**🆕 Demo verisi listede yoktu ve gerekiyor.** Üretimde şu an sıfır kurum, sıfır öğrenci, sıfır sınıf var. Gerçek uygulamayı boş bir veritabanıyla göstermek, sabit kartlı Genel Bakış'tan daha kötü görünür. Sunumdan önce üretimde gerçekçi bir kurum kurulmalı: sınıflar, öğrenciler, veliler, ders programı, birkaç sınav ve sonucu, yoklama geçmişi, ödeme planları, duyurular. Üç yol var ve **seçim henüz yapılmadı**: elle kurmak (en gerçekçi, akışları da sınar, uzun sürer) · `seed_olcum.sql` (hazır ama performans ölçümü için yazıldı, isimleri sunumda inandırıcı olmayabilir) · sunum için ayrı bir tohum yazmak. ⚠️ Bu veri **üretimin içine** giriyor ve pilot kurumla karışmamalı; adlandırmada ayırt edilebilir olmalı.

**🆕 Sunum provası zorunlu.** Gerçek uygulamayı canlı göstermek, bir şey patlarsa kurumun önünde patlaması demektir. Sunumdan önce aynı yol baştan sona bir kez koşulur: giriş, dört rol, on üç ekran, birkaç canlı kayıt. Provada çıkan her şey demoyu engelleyenler listesine eklenir.

**shadcn bileşenleri neden silinmiyor.** Tarandı: **50 bileşenden 33'ü kullanılmıyor**, yalnız 17'si çağrılıyor. Proje kendi `shared` modülüyle çalışıyor. Önce `input-otp.tsx`'in silinmesi planlanmıştı (`chart.tsx` ile aynı desen) ama ölçüm planı değiştirdi: 33 ölü dosyadan birini keyfî seçmek tutarsız olurdu, **ve yenileme o 33'ten bazılarını isteyebilir.** Doğru an, yenileme hangilerini kullandığını söyledikten sonra toplu temizlik.

⚠️ `chart.tsx` ayrıydı ve silindi: tek `dangerouslySetInnerHTML` oradaydı ve 58 paketlik bir bağımlılık ağacı taşıyordu.

**Reddedilen alternatifler:**

- **Önce bütün bulguları düzeltmek** — arayüz değişince tasarım katmanındaki düzeltmeler geçersizleşir; döngü bitmez.
- **Kopya klasörde geliştirmek** — yukarıda.
- **Repoyu şimdi gizliye almak** — GitHub Pro'da ruleset private repoda da çalışır, yani uygulanabilirdi. Ertelendi çünkü CodeQL ve secret scanning private repoda Advanced Security istiyor ve ikisi de bugün açık. Kazanç, kaybı karşılamıyor.
- **Demo için üretimi kullanmak** — gerçek veri riski ve C-11 gibi maddeler demoyu baltalar; önizleme demo modu ikisini de ortadan kaldırıyor.

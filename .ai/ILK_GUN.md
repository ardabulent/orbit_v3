# İLK GÜN — ORBIT'e yeni katılan geliştirici için

> Bu sayfa bir özettir; karar ya da durum **tutmaz**. Bir şey burada yazandan farklıysa doğrusu bağlantı verilen belgededir (**K-06**). Yazıldığı gün: 2026-10-22.

## 1. ORBIT bir cümlede

Dershane ve kurs merkezleri için çok kiracılı bir yönetim uygulaması: kurum yöneticisi, öğretmen, öğrenci ve veli aynı uygulamaya kendi rolüyle girer; yoklama, ders programı, ödev, sınav/deneme, ödeme, duyuru ve mesajlaşma. Üstte bir de **platform operatörü** var: kurum açar, kurum içeriğini **göremez**.

## 2. Mimari tek resimde

```
Tarayıcı (React + Vite, Vercel'de statik)
   │  supabase-js — anahtar herkese açık; güvenlik burada DEĞİL
   ▼
Supabase
   ├── Postgres + RLS ........ yetkinin tamamı burada: her tablo, her satır
   ├── RPC (SQL fonksiyonları)  toplu ve ağır işler; `security definer` olanlar yetkiyi kendisi denetler
   ├── Auth (GoTrue) ......... giriş; numara → sentetik adres (aşağıda)
   └── Edge Functions (Deno) . yalnız kimlik işleri: kurum kurma, üye açma, şifre sıfırlama, e-posta
```

- **Arka uç sunucusu yok.** Ekran veriyi doğrudan Postgres'ten okur; kimin neyi görebileceğine RLS politikaları karar verir. İstemcideki rol kontrolleri yalnız kullanıcı deneyimidir.
- **Taşınabilirlik:** sistem ileride kendi sunucumuza taşınabilsin diye yetki SQL'de yaşar ve sağlayıcıya özgü özellik az kullanılır (`AGENTS.md` kısıt 6).
- **Numarayla giriş:** herkesin e-postası yok. Her üye 8 haneli bir giriş numarası alır (kurum kodu + kişi kodu); Auth tarafında bu `<numara>@orbit.invalid` adresine çevrilir. `orbit.invalid` **değiştirilemez** — değişirse herkesin girişi kırılır.
- **İlk giriş kilidi:** yeni hesap geçici şifreyle açılır; şifre değişene kadar hiçbir iş verisini göremez. Kilit hem RLS'te hem `definer` fonksiyonlarda hem Edge'de durur.
- **Demo kipi** derleme zamanında seçilir; üretim paketine demo verisi girmez (CI kapısı: `scripts/check-demo-leak.mjs`).

Dosyaların nerede durduğu: `PROJECT_STATE.md` §5 (bir test bu ağacın eksiksiz kalmasını zorlar).

## 3. İlk gün yapılacaklar

1. **Yerel kurulum** — `README.md` → "Yerel Kurulum". Sonunda örnek kurumla, her rolde girebildiğin bir kopyan olur. Canlıya bağlanmaz.
2. **Kapıları bir kez çalıştır** — `pnpm format && pnpm check && pnpm lint && pnpm test`, sonra `npx supabase db reset && npx supabase test db`. Hepsi yeşilse ortam doğru.
3. **Uygulamayı dört rolle gez** — yönetici, öğretmen, öğrenci, veli (giriş numaraları tohumun çıktısında).
4. **Çalışma kurallarını oku** — `CONTRIBUTING.md` (kısa). Özet: `main`'e doğrudan yazılmaz; tür önekli dal → PR → bir insan onayı → squash. Kendi PR'ını onaylayamazsın.
5. **Planı oku** — `ROADMAP.md` §0 ve §4.27. Sıradaki iş oradan seçilir.

## 4. Seni ısıracak on şey

| Kural                                                             | Neden                                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **PR birleşince göçler canlıya kendiliğinden uygulanır.**         | Birleştirme düğmesi canlıyı değiştiren düğmedir. Göç geri alınmaz; düzeltme yeni göçle yapılır.                                 |
| **Uygulanmış bir göç dosyası değiştirilmez.**                     | Canlı onu bir kez çalıştırdı; dosyayı değiştirmek yerelle canlıyı ayırır. Yeni göç yaz. Göç sırası testi zaman damgasını sınar. |
| **Yeni tabloda RLS ve pgTAP testi şart.**                         | `Tenant RLS` CI işi zorunlu; bir kurumun verisi öbürüne sızmamalı. Örnek desenler `supabase/tests/database/`.                   |
| **`components/` ve `pages/` Supabase'i doğrudan çağıramaz.**      | Veri servis modüllerinden geçer; ESLint zorlar.                                                                                 |
| **`definer` fonksiyon politikanın HER şartını taşır** (**K-25**). | RLS'i atlayan fonksiyon, kilit ve kiracı şartını kendisi yazmazsa açık doğar.                                                   |
| **Bilinmeyende kilitli tarafta kal** (**K-04**).                  | Yetki çözülemezse "göster" değil "gösterme". Boş `catch {}` yasak.                                                              |
| **Kişisel veri loga, denetim kaydına, hata kaydına gitmez.**      | KVKK; çocuk verisi. Telefon, TC, e-posta ayıklanır.                                                                             |
| **Depo herkese açık.**                                            | Sır, gerçek kişi verisi, müşteri bilgisi commit edilmez. Gizli anahtarlar yalnız panellerde.                                    |
| **Kullanıcıya görünen her metin Türkçe ve "siz" diliyle.**        | Teknik hata metni ekrana gitmez (`lib/userFacingError.ts`).                                                                     |
| **Değişen karar/durum aynı PR'da belgeye işlenir.**               | Ayrı "belge güncelleme" işi açılmaz; açılırsa yapılmaz. Hangisi nereye: `CONTRIBUTING.md` kural 7.                              |

`K-xx` kodları ekipte tekrar eden hatalardan çıkan kurallardır; listesi `AGENT_WORKFLOW.md`'nin sonunda.

## 5. İlk okunacak on karar

`DECISION_LOG.md` baştan sona okunmaz (4.000+ satır); başındaki indeksten başlıkla aranır. İlk gün şu onu yeter:

1. Taşınabilirlik sınırı — yetkilendirme veritabanında, veri erişimi servis katmanında
2. Kimlik ve Giriş Bilgisi Mimarisi
3. Hesaplar davet e-postasıyla değil, doğrudan geçici şifreyle açılır
4. Platform operatörü ayrı bir eksendir; panel `/platform` altında yaşar ve kurum içeriğine erişmez
5. Rol, atama ve bağlantı üç ayrı kavramdır
6. İş verisi RLS ile yazılır, kimlik işlemleri Edge Function'da kalır
7. Öğretmenin yazma yetkisi rolünden değil atamasından gelir
8. Demo modu derleme zamanı sabitidir
9. Hafıza kayıtları ileriye doğru düzeltilir, geri alınmaz
10. İki geliştiricili çalışma düzeni

## 6. Nereye bakılır

Hangi soru için hangi dosya: kökteki **`AGENTS.md`** tablosu. Geçmiş turların ayrıntısı `.ai/arsiv/`'de; numaraları eski atıflarla aynı.

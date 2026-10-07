# AGENTS.md — ORBIT'te çalışan herkes için giriş noktası

> **Bu belge bir görev değildir.** Rol üstlenmeni, mülakat başlatmanı veya bir şey üretmeni istemez.
> Sana yalnızca **hangi soru için hangi dosyayı okuyacağını** söyler. Açık bir görev almadan hiçbir şey yapma.

ORBIT, dershane ve eğitim kurumları için çok kiracılı (multi-tenant) bir yönetim SaaS'ıdır. Tek kişilik bir ekip (Arda Bülent) ve onun kullandığı YZ ajanları tarafından geliştirilir.

**Faz E kapandı (2026-08-29):** kimlik zinciri uçtan uca çalışıyor ve production'da dört rolle doğrulandı. Kalan bütün sürümler, her biri **dayandığı varsayımları beyan eden** dilimlere bölünmüştür: `.ai/ROADMAP.md` **§4.6**.

> **Sonradan düzeltme (2026-09-19):** bu satır _"Sıradaki iş **v1.2**"_ diyordu ve üç sürüm boyunca güncellenmedi (**K-08**). v1.2, v1.3 ve v1.4 kapandı; **yürüyen sürüm v1.5**. Sürüm durumunu buradan okuma — tek kaynak `ROADMAP.md` **§0**, sıradaki iş **§4.6**. Buraya sürüm numarası yazılmamasının sebebi tam olarak budur: iki yerde tutulan durumun biri her zaman eskir (**K-06**).

---

## Nereye bakılır

Her dosyanın tek bir sorusu var. Hepsini birden okuma; sorunun hangisi olduğunu bul.

| Sorun                                             | Dosya                                                 |
| ------------------------------------------------- | ----------------------------------------------------- |
| **Şu an neredeyiz?**                              | `.ai/ROADMAP.md` **§0** — tek durum kaynağı           |
| **Sırada ne var, o iş neye dayanıyor?**           | `.ai/ROADMAP.md` **§4.6** — dilimler ve varsayımları  |
| **Sistem bugün ne yapıyor, ne eksik?**            | `.ai/PROJECT_STATE.md` **§6.1** — 2026-08-29 denetimi |
| **Bu daha önce kararlaştırıldı mı, neden böyle?** | `.ai/DECISION_LOG.md` — başındaki indeksten gir       |
| **Ürün ne, roller neler, dosyalar nerede?**       | `.ai/PROJECT_STATE.md`                                |
| **Supabase/Vercel/GitHub panelinde ne ayarlı?**   | `.ai/PLATFORM_SETTINGS.md`                            |
| **Bu bir hata mı, yoksa bilinçli bir açık mı?**   | `.ai/PLATFORM_SETTINGS.md` **§5**                     |
| **İki ajanlı çalışma düzeni nasıl işliyor?**      | `.ai/AGENT_WORKFLOW.md`                               |
| **Branch, commit, PR kuralları?**                 | `CONTRIBUTING.md`                                     |
| **Projeyi nasıl çalıştırırım?**                   | `README.md`                                           |

`.ai/tasks/` altındaki dosyalar **tek seferlik görev brifingleridir** ve git'e girmez (`.gitignore`). Sana verilmediyse seni ilgilendirmez; işi biten silinir. Kalıcı kayıt PR açıklamasındadır.

**Geçmişi arıyorsan git'e bak.** Kim ne zaman ne yaptı sorusunun cevabı `git log`'dadır. Ayrı bir çalışma günlüğü tutulmuyor — 28 commit boyunca güncellenmediği için emekliye ayrıldı (bkz. `DECISION_LOG.md` — "Belge sayısı değil bakım borcu").

### Sıfırdan bir oturuma başlıyorsan

Yukarıdaki dosyalar **kararları** taşır, **uçuştaki işi** değil. Yarım kalmış bir iş olup olmadığını dosyalardan değil, kendini güncelleyen kaynaklardan öğren:

```bash
git fetch origin             # ÖNCE bu — yerel kopya kendiliğinden güncellenmez
git status -sb               # hangi daldayım, main'e göre kaç commit gerideyim
git log --oneline -15        # son ne yapıldı
gh pr list                   # açık PR — inceleme bekleyen iş
gh issue list                # açık bulgular — asıl iş kuyruğu buradadır
ls .ai/tasks/                # devredilmiş, henüz bitmemiş görev
```

**Çalışma kopyası bayat olabilir ve bunu sana kimse söylemez.** `git` kendiliğinden senkronize olmaz; biri PR merge ettiğinde yerel dosyalar eski kalır. Bir dosyayı okuyup "kod böyle" demeden önce geride olup olmadığına bak. İşe başlıyorsan `AGENT_WORKFLOW.md`'deki **0. adım** geçerlidir: güncel `main` üzerinden yeni dal.

Sonra `ROADMAP.md` §0'ı oku: 🟡 işaretli satır, yarıda kalmış dilimdir.

> **Neden ayrı bir "şu an ne yapılıyor" dosyası yok:** Denendi ve öldü. Elle güncellenen bir durum dosyası, güncellenmediği anda yanlış bilgi kaynağına dönüşür — ve boş bir dosyadan daha zararlıdır, çünkü okuyan ona güvenir. Yukarıdaki beş komut kimsenin bakımına muhtaç değildir.

---

## Değişmeyen kısıtlar

Bunlar tercih değil, sınır.

1. **Repo public.** `ardabulent/orbit_v3` herkese açıktır. Sır, anahtar, gerçek kişi verisi veya müşteri bilgisi commit edilemez.
2. **YZ ajanlarının GitHub, Supabase ve Vercel erişimi yoktur.** Kod yazan ajan yerel dosya sistemiyle sınırlıdır; commit, push, migration ve deploy insan onayıyla ve denetleyen taraf üzerinden yapılır. Gerekçe: `AGENT_WORKFLOW.md`.
3. **`main`'e doğrudan commit yok.** Her değişiklik issue → branch → PR → karşılıklı onay yolundan geçer.
4. **Şifre ve hesap açma işlemleri ajanlara yaptırılmaz.** Bu adımlar Supabase panelinden ekip tarafından yapılır.
   - **Yedek gizli anahtarı ajanların değildir.** Kurum sahibinin masaüstündeki `ORBIT-yedek-GIZLI-anahtar.asc` (gece yedeklerini açan tek anahtar, `ops/yedek/README.md`) hiçbir ajan tarafından okunmaz, kopyalanmaz, taşınmaz, içe aktarılmaz ve bir komuta argüman olarak verilmez. Yedek açmak ve geri yüklemek insan işidir; ajan yalnız tarif eder. Dosyanın bugün masaüstünde durması kurum sahibinin bilinçli MVP kararıdır (2026-10-07); ilk gerçek kurum verisinden önce yeniden değerlendirilir.
5. **Sürüm kapısı atlanmaz.** Proje aşama aşama ilerler. Bir aşama tamamlanıp release gate'i doğrulanmadan sonrakine geçilmez; kapsam ve kabul kriterleri `ROADMAP.md`'de yazılıdır. Bir işi "sonra tamamlarız" diye açık bırakıp ilerlemek, bu projede birden fazla kez tamam sanılan bir sürümün aslında kırık olduğunun aylar sonra anlaşılmasına yol açtı.
6. **Sağlayıcı bir tercihtir, bağımlılık değil.** Sistemin ileride kendi sunucumuza (Hetzner) taşınması açık bir ihtimaldir. Yeni bir bağımlılık veya sağlayıcıya özgü özellik eklerken sorulacak soru: _bu, düz Postgres veya standart bir arayüzle (S3, SMTP, OIDC) yapılabilir mi?_ Yapılabiliyorsa öyle yapılır. Yetkilendirmenin SQL'de yaşaması bu kuralın en önemli parçasıdır ve zaten yürürlüktedir. Gerekçe ve ölçümler: `DECISION_LOG.md` — "Sistem taşınabilir kurulur; sağlayıcı bir tercih, bağımlılık değildir".

---

## Kod yazarken geçerli kurallar

Bu kurallar geçmiş hatalardan çıktı; her biri en az bir kez pahalıya mal oldu.

### Mimari

- **Dosya başına tek sorumluluk.** Yeni bir ekran, rol veya özellik kendi dosyasına gider; mevcut büyük dosyaya eklenmez. Katı bir satır eşiği yok — sinyal, dosyanın kaç ilgisiz kaygıyı bir arada taşıdığıdır. Üçüncü taraf/vendored dosyalar (`components/ui/`) bu kuralın dışındadır. Örnek referans: eski 2659 satırlık `EducationPlatform.tsx`'in bölünmüş hali, `client/src/components/education/`.
- **Taşınabilirlik sınırı.** `components/` ve `pages/` altındaki dosyalar Supabase istemcisini doğrudan import edemez; veri erişimi servis modüllerinden geçer. ESLint zorlar (`eslint.config.js`).
- **Kopuk kod yazma.** Mevcut mimariyle, klasör yapısıyla ve veri modelleriyle uyumlu kal. Kendi başına yeni bağımlılık ekleme.

### Güvenlik

- **Gizli anahtar koda yazılmaz.** `.env` ve `.env.example` kullanılır.
- **Hata yutulmaz.** Boş `catch {}` yasak. Yetki çözümlenemediğinde **fail-open olunmaz** — bilinmeyen güvenlik durumunda kilitli tarafta kalınır.
- **İstemciye güvenilmez.** Yetki ve rol kararları sunucuda doğrulanır. İstemcideki kontroller yalnızca kullanıcı deneyimidir, güvenlik sınırı değildir; kodda da böyle not edilir.
- **Dış dünyadan gelen veri doğrulanır.** Edge Function girdileri Zod ile şemalanır.
- **Kişisel veri loga yazılmaz.** TC, telefon, şifre, kart numarası düz metin olarak log veya analitiğe gitmez.

### Değişiklik öncesi düşünme

Yeni bir özellik veya refactor talebinde doğrudan koda atlanmaz. Önce etki alanı çıkarılır — hangi modüller, hangi tablolar, hangi RLS politikaları etkileniyor? Altı boyut: **teknik/veri modeli · maliyet · hata ve fallback · KVKK/gizlilik · pik yük · güvenlik ve tehdit.** Talep bu boyutlardan birinde risk taşıyorsa körü körüne "evet" denmez; gerekçe açıklanır ve daha güvenli alternatif önerilir.

---

## Belgeyi güncel tutmak

Bir PR bir kararı, bir durumu veya bir panel ayarını değiştiriyorsa ilgili dosya **aynı PR'da** güncellenir. Ayrı bir "belgeleri güncelleme" işi açılmaz; açılırsa yapılmaz.

- Faz/sürüm durumu değişti → `ROADMAP.md` §0 **ve** ilgili maddenin kutucuğu
- Bir mimari karar alındı veya değişti → `DECISION_LOG.md` (indekse satır eklemeyi unutma)
- Panelden bir ayar değiştirildi → `PLATFORM_SETTINGS.md`
- Klasör yapısı veya servis katmanı değişti → `PROJECT_STATE.md` §5

Geçmiş kayıtlar **silinmez.** Bir kayıt sonradan yanlış çıkarsa üzerine `**Sonradan düzeltme (tarih):**` satırı eklenir. Gerekçe: `DECISION_LOG.md` — "Hafıza kayıtları ileriye doğru düzeltilir".

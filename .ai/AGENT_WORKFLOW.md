# AGENT_WORKFLOW.md — ORBIT'te iki ajanlı çalışma düzeni

> ⚠️ **Bu belge bir görev değildir.** Bir sürecin tarifidir. Hiçbir ajan bu dosyayı okuduğu için bir iş başlatmaz. Yalnızca **açık bir görev brifingi** verildiğinde uygulanır.
>
> Elinizde `.ai/tasks/` altında size verilmiş bir brifing yoksa bu belge sizi ilgilendirmiyor.

---

## Neden var

> **Sonradan düzeltme (2026-10-19):** Ekip yeniden iki kişi oldu (kurucu + yazılımcı ortak). Aşağıdaki "ekip tek kişi" cümlesi o tarihe kadar doğruydu. Bugünkü düzen: YZ ajanı dal açar, commit atar ve PR açar; **birleştirmeyi bir insan yapar** ve kendi açtığı PR'ı onaylayamaz. Yani denetleyen rolünün kaymasını yakalayacak ikinci göz yeniden var. Brifing → uygulama → teslim → inceleme döngüsü iki ajanla çalışılırken aynen geçerli; tek ajanla çalışıldığında inceleme adımını PR'ı onaylayan insan üstlenir. Bkz. `CONTRIBUTING.md` — "Kim ne yapar".

ORBIT sıfır bütçeli bir ekip tarafından geliştiriliyor ve ağır iş yükü yapay zekâ ajanlarında. **2026-09-19'dan beri ekip tek kişi** (önce iki kişiydi); bu belgedeki **yazan / denetleyen** ayrımı iki _insanı_ değil iki _rolü_ anlatır, dolayısıyla ayrım aynen geçerli. Değişen şey şu: insan tarafında ikinci göz kalmadı, yani denetleyen rolünün kaymasını yakalayacak kimse yok — aşağıdaki "denetleyenin kayması daha pahalıdır" maddesi bundan sonra daha da bağlayıcı. Tek bir ajanın hem yazıp hem denetlemesi iki sorun üretiyordu: maliyet ve kör nokta. Bir ajan kendi varsayımını dürüstçe bildirebiliyor ama **yanlış olduğunu göremiyor**.

Bu yüzden iş ikiye ayrıldı: **yazan** ve **denetleyen**. Bu belge o ayrımın kurallarını tutuyor ki oturum değişince kaybolmasın.

---

## Döngü

Her devredilen iş aynı yedi adımdan geçer. Adım atlanmaz.

```
0. TAZELE     Denetleyen: main'i çek, ÜZERİNDEN yeni dal aç
1. BRİFİNG    Denetleyen yazar → .ai/tasks/<sıra>-<kısa-ad>.md
2. UYGULAMA   Yazan uygular, kalite kapısını çalıştırır, DURUR
3. TESLİM     Yazan altı çıktıyı verir (aşağıda)
4. KAPSAM     Denetleyen: brifing dışı dosyaya dokunulmuş mu?
                └─ dokunulmuşsa → REDDET, içeriğe hiç bakma
5. İNCELEME   Denetleyen diff'i okur, kapıyı KENDİ çalıştırır
                ├─ kabul  → 6. adım
                └─ revizyon → 2. adıma dön
6. KAPANIŞ    Denetleyen commit, PR, belgeyi günceller, brifingi siler
                (brifing izlenmiyor — silmek commit gerektirmez)
                └─ merge sonrası: commit'ler main'e GERÇEKTEN girdi mi?
                                 issue'lar GERÇEKTEN kapandı mı?
```

Döngü tamamlanmadan sıradaki iş başlamaz.

**6. adımdaki iki soru ayrı ayrı sorulur.** Commit'in girmesi, issue'nun kapandığı anlamına gelmez. 2026-09-07'de beş issue merge edilmiş PR'lara rağmen açık kaldı: PR açıklamalarında `Kapatır: #212` yazıyordu ve **GitHub yalnız İngilizce anahtar kelimeleri tanıyor** (`Closes`, `Fixes`, `Resolves`). PR şablonu zaten doğrusunu yazıyordu; hata onu görmezden gelmekti. Bedeli, `ROADMAP.md` §0'ın _"açık bulgular `gh issue list`'tedir"_ cümlesinin bir gün boyunca yanlış olmasıydı — beş kapanmış bulgu açık görünüyordu.

**4. adım 5. adımdan önce gelir ve atlanmaz.** Kapsam ihlali varken koda bakmak, kötü bir alışkanlığı ödüllendirir: kod iyiyse ihlal görmezden gelinir ve sınır aşınır. Önce sınır, sonra içerik.

### 0. adım — tazeleme

Her iş, güncellenmiş `main` üzerinden açılan **yeni bir dalla** başlar. Mevcut bir dala devam edilmez.

```bash
git fetch origin
git checkout main && git pull --ff-only
git checkout -b <tip>/<issue-no>-<kisa-ad>
```

Bu tek adım iki ayrı hatayı birden kapatır:

- **Bayat çalışma kopyası.** Git kendiliğinden senkronize olmaz. Yazan ajan çalışma kopyasındaki dosyaları okur; kopya geride ise ajan artık geçerli olmayan bir kod tabanına göre iş yapar ve bunu kimse fark etmez.
- **Merge edilmiş dala commit.** Bir PR merge edildikten sonra o dal ölüdür. Üzerine atılan commit dalda durur, `main`'e hiç girmez ve CI bile koşmaz — çünkü PR kapanmıştır.

> **"Düzenli olarak `git pull` yap" kuralı bilinçli olarak yazılmadı.** Tetikleyicisi olmayan kural uygulanmaz; bu projede `WORK_LOG` tam olarak böyle öldü. Tazeleme bir alışkanlık değil, döngünün **ilk adımıdır** — ve dalı `main` üzerinden açmak, bayatlığı yasaklamak yerine **imkânsız** kılar.

**Aynı adımda yol haritası mutabakatı yapılır.** Çekilen commit'ler ile `ROADMAP.md`'nin söylediği birbirini tutuyor mu:

```bash
git log --oneline -15
```

Listede, yol haritasında hâlâ `[ ]` görünen bir işi bitiren PR var mı? Varsa **brifingi yazmadan önce** kutucuk işaretlenir.

Bu kontrol kapanışa değil **açılışa** kondu ve sebebi şu: kapanışta belge güncellemek kuralı zaten var ve **üç kez atlandı** (#77 · B08, B10 · E4). Önleme çalışmadı; kalan şey tespit. Ve tespit için doğru an burasıdır — yol haritasını **okuyan** taraf bir sonraki görevdir, yanlış bilgiden zarar gören de o.

### 6. adımın son yarısı — commit'ler gerçekten indi mi?

PR merge edildikten sonra, o PR'daki her commit'in `main`'e girdiği doğrulanır:

```bash
git fetch origin
git merge-base --is-ancestor <commit-sha> origin/main && echo "indi" || echo "SIKISTI"
```

**Neden gerekli:** Bu projede iki kez, merge edilmiş bir dala sonradan commit atıldı ve commit'ler sessizce kayboldu (PR #52 → `dc70d6e`; PR #78 → iki commit). İkisinde de yerel `git push` başarılı döndü, uzak dal güncellendi ve **hiçbir hata görünmedi** — çünkü teknik olarak bir hata yoktu; commit doğru dala gitti, o dal artık hiçbir yere bağlı değildi.

Sıkışmış commit varsa çözüm: güncel `main` üzerinden yeni dal açıp `git cherry-pick` ile taşımak ve yeni PR açmak.

---

## Rol dağılımı

| İş                             | Kim            | Neden                                   |
| ------------------------------ | -------------- | --------------------------------------- |
| Tasarım kararları, tartışma    | **Denetleyen** | Bağlamın tamamı ve karar geçmişi orada  |
| Migration, RLS, yetkilendirme  | **Denetleyen** | Hatası sessiz ve geri dönüşü pahalı     |
| Edge Function                  | **Denetleyen** | `service_role` taşıyor                  |
| Production'a dokunan her şey   | **Denetleyen** | Geri alınamaz                           |
| Arayüz bileşenleri             | **Yazan**      | Sınırlı ve geri alınabilir              |
| Mekanik dönüşümler             | **Yazan**      | Hacimli ama düşük riskli                |
| Saf mantık ve testleri         | **Yazan**      | Şartname brifingde net verilebiliyor    |
| `client/src/lib/` yardımcıları | **Yazan**      | Sağlayıcıya dokunmuyor, testi kolay     |
| Vitest testleri                | **Yazan**      | Beklenen davranış brifingde yazılabilir |
| PR açıklaması taslağı          | **Yazan**      | Gerekçeyi zaten biliyor                 |
| `git diff` incelemesi          | **Denetleyen** | Devrin var olma sebebi                  |

Sınır şu soruyla çizilir: **yanlış yapılırsa sessizce mi geçer, yoksa hemen görünür mü?** Sessiz olanlar devredilmez.

**Devredilebilir alan zamanla genişler.** Bir tür iş iki kez sorunsuz teslim edildiyse, üçüncüsünde sınırı daraltmak için sebep yoktur. Daralttıkça devrin anlamı azalır ve denetleyen tıkanma noktasına döner.

**Bir dilim, tek başına anlamlı olduğu sürece bölünmez.** Etkileşmeyen iki iş aynı brifingde verilebilir; her tur bir brifing, bir teslim ve bir inceleme maliyeti getirir ve gereksiz tur en pahalı israftır. Bölmenin tek geçerli sebebi **bağımlılık**: biri diğerinin çıktısına dayanıyorsa ayrılır.

---

## Yazan ajan için kurallar

### Her görevde geçerli

- Brifingde **adı geçmeyen hiçbir dosyaya** dokunma.
- `git commit`, `git push`, `git merge`, PR açma — **hiçbiri**. Branch'te bırak, dur.
- Supabase, Vercel veya GitHub'a **hiçbir çağrı** yapma.
- **Yeni bağımlılık ekleme.** `package.json` ve kilit dosyaları dokunulmaz.
- `supabase/`, `.ai/` (kendi brifingin hariç) ve `.env*` — **dokunulmaz**.
- ESLint kuralını `eslint-disable` ile **susturma**. Kural doğrudur; kod yanlıştır.
- Brifingde **listelenmeyen özellik ekleme**. "Faydalı olur" diye eklenen şey kapsam dışıdır.
- Var olan dosyaları "iyileştirme".
- Görevi tamamlamak için **başka bir dosyayı değiştirmen gerektiğini düşünüyorsan yapma** — dur ve sor. Kapsam dışı bir dosyaya dokunmak, teslimin içeriğine bakılmadan reddedilmesine yol açar.

### Belirsizlik kuralı

Brifingde cevabı olmayan bir şeyle karşılaşırsan **dur ve sor**. Yanlış varsayımla yazılmış kodu düzeltmek, sormaktan pahalıdır.

Varsayım yapmak zorunda kaldıysan teslimde **açıkça yaz**. Nerede tahmin ettiğini bilmek, kodun kendisinden daha değerlidir.

### Kod kuralları

- Arayüz metinleri **Türkçe**.
- Yorumlar Türkçe ve **"ne" değil "neden"** anlatır. `// state'i güncelle` yazma; `// Kaçış yolu bırakılmıyor çünkü ...` yaz.
- Mevcut dosyaların yorum yoğunluğuna ve üslubuna uy.
- `any` kullanma.
- Var olan ortak bileşenleri ve yardımcıları **yeniden kullan**, benzerini yazma.

### Teslim — altı çıktı, eksiksiz

1. `git status --short`
2. `git diff` (yeni dosyada `git add -N . && git diff`)
3. Kalite kapısının beş komutunun **gerçek çıktısı** — "geçti" yazmak yetmez
4. **Varsayımların** — yoksa "varsayım yok" yaz
5. **Emin olamadıkların**
6. **PR açıklaması taslağı**

Son üç madde atlanamaz.

**6. madde neden var:** Denetleyenin en pahalı işi kod okumak değil, PR açıklamasını sıfırdan yazmaktır — çünkü o metin projenin kalıcı hafızası ve "ne yapıldı"dan çok **"neden böyle yapıldı"** anlatmak zorunda. Yazan ajan o gerekçeyi zaten biliyor; denetleyen onu yeniden üretmek yerine düzeltirse iş ucuzlar.

Taslak üç başlık taşır, hepsi kısa:

- **Ne değişti** — madde madde, dosya listesi değil
- **Neden böyle** — reddedilen alternatif varsa gerekçesiyle
- **Neye dokunulmadı** — bilinçli olarak kapsam dışı bırakılanlar

Taslak olduğu gibi kullanılmaz; denetleyen doğruladığı şeyleri ekler ve doğrulayamadığını çıkarır.

### Kalite kapısı

```bash
npx prettier --check .
npx eslint .
npx tsc --noEmit
npx vitest run
npx vite build
```

Hepsi yeşil olmadan teslim etme.

**Bu komutlar için ayrıca izin istenmez.** Beşi de salt okumadır: dosya değiştirmez, ağa çıkmaz, git'e dokunmaz. Yazan ajanın kum havuzu bunları engelliyorsa, kum havuzu dışında çalıştırılmaları **baştan onaylıdır** — her görevde yeniden sorulması gereksiz sürtünmedir.

Onay hâlâ gereken şeyler değişmedi: `pnpm install` veya herhangi bir bağımlılık kurulumu, ağ isteği, `git` komutları, ve brifingde izin verilmeyen bir dosyayı yazan her şey.

`npx prettier --write` yalnızca **brifingin izin verdiği dosyalar üzerinde** serbesttir; kendi çıktını biçimlendirmek kapının parçasıdır.

> **Kapının yeşil olduğunu bildirmek yetmez.** Denetleyen dördünü de kendisi çalıştırır ve bu boşuna değil: C1 teslimi `prettier --check` için yeşil bildirdi, denetleyende kırmızıydı. Rapor iyi niyetle yanlış olabilir; kapı yanılmaz.

---

## Denetleyen ajan için kurallar

Bu bölüm en az diğeri kadar bağlayıcıdır. Denetleyenin kayması, yazanın kaymasından **daha pahalıdır** çünkü onu yakalayacak kimse yoktur.

### Rolü koru

- **Kendin özellik kodu yazma.** İstisnalar: şema, RLS, Edge Function, bağlama (wiring) ve tek satırlık düzeltmeler. Bunun dışına çıkıyorsan dur ve devret.
- "Ben daha hızlı yazarım" düşüncesi devrin **var olma sebebini** ortadan kaldırır. Hız değil, süreklilik hedefleniyor.

### Asla güvenme, doğrula

- Yazanın kalite kapısı raporuna **güvenme**, kapıyı **kendin çalıştır**.

  ⚠️ **Bu soyut bir ihtiyat değil; iki kez ölçüldü ve ikisi de aynı aile.** v1.4-06'da teslim `npx eslint .` için "Exit code 0" diyordu, kendi koşumda `paymentService.test.ts`'te iki `no-explicit-any` çıktı. v1.4-11'de teslim "prettier 0 hata, eslint 0 hata" diyordu; kendi koşumda bir biçim hatası ve `classTeacherService.test.ts`'te yine iki `no-explicit-any` vardı. İkisinde de **kod sağlamdı** — yanlış olan rapordu, ve ikisinde de hata **test dosyasındaydı**.

  Teslim raporunun rolü kanıt sunmak değil, yazanın kapıyı **çalıştırmasını** sağlamak. Kanıt denetleyenin kendi çıktısıdır.

  🔴 **Ve v1.4-15'te bir adım ötesi görüldü: rapordaki çıktı bu depodan gelmiyordu.** Build bloğu `vite v6.4.1`, `1834 modül`, `dist/index.html 0.97 kB`, CSS `80.37 kB` diyordu; depo **vite 7.3.6**, **2718 modül**, `../dist/index.html 1.50 kB`, CSS **150.43 kB**. Vitest **toplamları** doğruydu (58/919) ama gösterilen dosya satırları değildi — `homeworkService.test.ts` 15 değil **50** test taşıyor.

  **Kod doğruydu.** Beş kapı da gerçekten yeşildi ve korumalar mutasyonla sınandığında gerçekti. Yanlış olan kod değil **kanıttı** — ve bu, yanlış bir iddiadan farklı bir şeydir: yanlış iddia düzeltilir, uydurulmuş kanıt raporun tamamının değerini düşürür.

  **Karşılığı yeni bir kural değil, mevcut kuralın neden var olduğu:** denetleyen kapıyı zaten kendisi koşuyor, dolayısıyla uydurulmuş çıktı kimseyi kandırmıyor — yalnız **raporu okunmaz** hâle getiriyor. Bir sayı tutmuyorsa o bölümün tamamı okunmaz sayılır ve her şey yeniden ölçülür.

  ⚠️ **Ucuz bir kontrol:** çıktıdaki sürüm ve büyüklük numaraları depoyla karşılaştırılır. `vite` sürümü, modül sayısı, çıktı yolu (`../dist/`) ve dosya boyutları bu depoda sabittir; biri tutmuyorsa çıktı başka bir yerden gelmiştir.

- **Paylaşılan ağaçta ölçülen sayı, ölçtüğünü sandığın şey olmayabilir.** `vitest` ve `supabase test db` dosya sistemine bakar, git'e değil: diğer ajanın izlenmeyen dosyaları da koşar. Her kapı ölçümünün yanına **koşan dosya sayısı** yazılır ve diskteki sayıyla karşılaştırılır. (Ölçüldü: v1.4 ara denetiminde PR gövdesine `754/50` yazdım, gerçeği `729/48`'di — fark tam olarak yazanın izlenmeyen iki test dosyasıydı.)
- İddia edilen davranışı **ölç**. Yuvarlama, tarih, sınır durumu — çalıştırılabilir bir kontrolle doğrula.
- İçe aktarılan her API'nin **gerçekten var olduğunu** kontrol et. Uydurulmuş bir isim `tsc`'den geçebilir (varsa) veya geçmeyebilir; bakmak ucuz.

### Kapsam kontrolü — her teslimde, koda bakmadan ÖNCE

Bu adım atlanmaz ve içerik incelemesinden **önce** gelir.

```bash
git status --short                    # brifing dışı dosya var mı
git log --oneline -3                  # izinsiz commit var mı
git diff --stat                       # kaç dosya, kaç satır
git diff --name-only                  # tam liste
```

Sonra listeyi brifingdeki dosya adlarıyla **tek tek karşılaştır.** Beklenen dosya sayısını brifingi yazarken zaten biliyorsun; sayı tutmuyorsa dur.

Şunlardan biri varsa **içeriğe bakmadan reddet:**

| Bulgu                                | Neden reddedilir                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Brifingde adı geçmeyen dosya         | Kapsam ihlali; "faydalı olur" diye yapılan değişiklik denetlenmemiş değişikliktir |
| `supabase/` altında herhangi bir şey | Şema ve yetkilendirme devredilmez                                                 |
| `.ai/` altında brifing dışı dosya    | Proje hafızası                                                                    |
| `package.json` veya kilit dosyası    | Bağımlılık yüzeyi                                                                 |
| `.env*`, anahtar, token              | Hiçbir koşulda                                                                    |
| İzinsiz commit veya push             | Kapanış yalnızca denetleyene ait                                                  |
| `eslint-disable`                     | Kural doğrudur; kod yanlıştır                                                     |

Reddetmek kaba değil, **sınırı koruyan şey.** Kod iyi diye ihlali görmezden gelmek sınırı bir kez aşındırır ve bir daha geri gelmez.

Değişiklik gerçekten gerekliyse doğru yol brifingi genişletip yeniden istemektir — sessizce kabul etmek değil.

### Kapanış

- Commit, PR ve production **yalnızca denetleyene** aittir.
- PR açıklaması **neyin neden yapıldığını** anlatır; değişiklik listesi yetmez.
- **Belgeyi aynı PR'da güncelle.** Bu adım isteğe bağlı değildir:
  - bir dilim bittiyse → `ROADMAP.md` §0 tablosu, **o sürümün §4 kapsam kutucuğu** ve **§4.6'daki dilim satırı**. Üçü ayrı yerde ve üçü de güncellenir.
  - bir mimari karar alındı veya değişti → `DECISION_LOG.md` (**indekse de satır ekle**)
  - panelden bir ayar değiştiyse → `PLATFORM_SETTINGS.md`
  - klasör veya servis katmanı değiştiyse → `PROJECT_STATE.md` §5
- **`PLATFORM_SETTINGS.md` §5'in tetikleyicilerini oku.** Kabul edilmiş açıkların her biri bir _"şu olunca yeniden değerlendir"_ cümlesi taşır; dilim o şartı sağlamış olabilir. **Kayıttaki sayılar da eskir** — açık "altı indekssiz foreign key" diyorsa, bugün altı mı, ölç.
- **Biten brifingi sil.** Git geçmişi kaydı tutar; çalışma kopyası temiz kalır.
- Yeni bir hata çıktıysa **aşağıdaki kural listesine ekle.**

> **Adres neden düzeltildi (2026-09-09 kapanış taraması):** Kural eskiden "§0 tablosu **ve** §4.5'teki kutucuk" diyordu. **§4.5 "Faz E — Kimlik Zinciri"dir** — sürümlerin kapsam listeleri orada değil, `## 4` altındaki sürüm başlıklarında yaşıyor; dilim satırı ise §4.6'da. Yani kuralı harfiyen uygulayan kişi yanlış bölüme bakıyordu.
>
> Sonuç ölçüldü: v1.3 kapanırken §4'teki **sekiz kutucuk** bayattı — React Query katmanı, veri deseni, servis yerleşimi, sayfalama sözleşmesi, gün gösterimi, env doğrulaması, yükleme/hata durumları ve Realtime. Hepsi bitmiş, hepsi işaretsiz. 2026-09-07 turu aynı kalıbı zaten görmüş ve _"bir şey Faz E'de yapılıp §4'te işaretlenmiyor"_ diye yazmıştı; **not düşmek düzeltmedi, çünkü sorun unutkanlık değil yanlış adresti.**

> **§5 okuması neden buraya eklendi (2026-09-05):** **K-12** koşullu kararın _sahibini_ yazdırıyordu ama şartı kontrol edecek **anı** vermiyordu. Sonuç ölçüldü: §5'teki "altı indekssiz foreign key" açığının tetikleyicisi _"v1.2 iş tabloları geldiğinde"_ idi; tablolar geldi, kimse §5'e dönmedi ve sayı sessizce **35** oldu. Şart sağlandı, kimse fark etmedi — K-12'nin adıyla tarif ettiği tuzağın kendisi, K-12 yazıldıktan sonra.

> **Neden kapanışta:** Belge güncellemesi uzun süre kimsenin adımı değildi ve sonuç ölçüldü — 28 commit boyunca çalışma günlüğü hiç yazılmadı, `ROADMAP.md` §0 bir gün geride kaldı ve bitmiş üç dilimi "başlanmadı" gösterdi. O tablo, bu belgenin denetleyene gösterdiği tek bağlam çıpasıydı. Ayrı bir "belgeleri güncelleme" işi açmak çözüm değil: açılır, sıraya girer, yapılmaz. Bkz. `DECISION_LOG.md` — "Belge sayısı değil bakım borcu".

### Bağlamı koru

Her göreve başlamadan önce:

- `ROADMAP.md` **bölüm 0** — hangi aşamadayız
- Görevin dayandığı kararlar `DECISION_LOG.md`'de var mı

Yol haritasını hatırlamak denetleyenin işidir. Yazan ajanın bağlamı görev kadardır; **bütünü gören tek taraf denetleyendir.**

---

## Birikimli kurallar — geçmiş hatalardan

> Her görevden sonra buraya bakılır. Yeni bir hata çıktıysa **kural olarak** eklenir, hata kaydı olarak değil.
>
> Gerekçe: hata listesini kimse okumaz, kural listesi ise her brifinge girer.

### K-01 · Süreler ve son tarihler aşağı yuvarlanır

Kalan süre **asla olduğundan uzun gösterilmez**. 1 günün altındaki süreler saat olarak yazılır.

_Kaynak: E3-01. `Math.ceil` kullanılmıştı; 5 saati kalan kullanıcıya "1 gün" görünüyordu. Kullanıcı "yarın hallederim" der ve hesabı kilitlenir._

### K-02 · Gösterim ile karar birbirinden ayrılır

Ekranda gösterilmek üzere yuvarlanmış bir değer, **karar mantığında kullanılmaz**. Karar ham veriden türetilir.

_Kaynak: E3-01. "Süresi doldu" kararı yuvarlanmış gün sayısından geliyordu; yuvarlama biçimi değişince karar da sessizce değişirdi._

### K-03 · Çözümlenemeyen veri uydurulmuş değerle gösterilmez

Tarih, sayı veya biçim çözümlenemiyorsa **hiç gösterilme**. Varsayılan bir değer üretme.

_Kaynak: E3-01. Bozuk tarih ekrana `NaN gün sonra geçersiz olacak` basıyordu._

### K-04 · Bilinmeyende güvenli tarafta kal

Bir güvenlik durumu okunamıyorsa **kısıtlayıcı** olan varsayılır. Kilit bayrağı okunamıyorsa kilit **var** sayılır.

_Kaynak: E3 bağlama. Fail-open olmak, kilidi tek bir ağ hatasıyla atlanabilir kılardı._

### K-05 · Ortak kabuk bileşeni kendi düzenini kurmaz

`AuthShell` gibi ortak kabuklar arka planı ve tam ekran düzenini kendileri sağlar. Onları kullanan bileşen kendi `min-h-screen` sarmalayıcısını yazmaz.

_Kaynak: E3-01 brifingi. İlk yazımda belirtilmemişti; belirtilmeseydi çift sarmalama olacaktı._

### K-06 · Aynı olgu iki yerde tutulursa biri mutlaka eskir

Bir durum, sayı veya liste iki ayrı dosyada tutuluyorsa güncellemelerden biri er ya da geç atlanır — ve iki kaynak çelişince okuyan hangisinin doğru olduğunu bilemez. Çözüm hatırlamaya çalışmak değil, **ikinci kopyayı kaldırıp yerine tek kaynağa işaret koymaktır.**

Bu kural üç kez ısırdı: `WORK_LOG` ile `ROADMAP` durumu ayrı tutuyordu; README ile `PROJECT_STATE` klasör ağacını ayrı tutuyordu; `PROJECT_STATE` §7 ve §9, `ROADMAP` §0 ile aynı gün çelişti — biri güncellendi, ikizi bırakıldı.

Bir metin yazarken şunu sor: **bu olgu başka bir dosyada da yazıyor mu?** Yazıyorsa yazma, işaret et.

_Kaynak: Issue #77 belge denetimi ve Issue #80 (Codex A1 analizi, B10–B11)._

### K-07 · Paralel çalışırken git ağacı ortaktır, dosya kümeleri değil

İki ajan aynı anda çalışabilir ve dosya kümeleri kesişmese bile **git çalışma kopyası tektir.** Dal değiştirmek, hazırlama alanına toplu ekleme yapmak ve dosya geri almak, diğer tarafın commit edilmemiş işine dokunur.

Üç kural, üçü de bir kez ihlal edildiği için yazıldı:

- **`git add -A` / `git add .` kullanma.** Yalnızca açık dosya yolu: `git add path/to/file`. Toplu ekleme, diğer ajanın o an yazdığı dosyaları da commit'ine alır.
- **Dal değiştirmeden önce `git status` boş olmalı.** Boş değilse commit et veya `git stash push -- <yol>` ile yalnızca kendi dosyalarını ayır. Git, commit edilmemiş değişiklikleri çakışma yoksa sessizce yeni dala taşır — ve bunu haber vermez.
- **Diğerinin dosyasını `git checkout -- <yol>` ile geri alma.** O komut, o an üretilmekte olan işi geri döndürülemez biçimde siler. Ayırman gerekiyorsa önce çalışma kopyasının dışına kopyala.

**Ne olduğu:** Denetleyen sunucu tarafını yazarken Codex istemci tarafını aynı ağaçta yazıyordu. Denetleyen bir test dosyasını okumak için dal değiştirdi; Codex'in commit edilmemiş iki dosyası onunla taşındı ve `git add -A` onları sunucu commit'ine süpürdü. Ayrıca daha öncesinde aynı dosyalar `git checkout --` ile geri alınmış, Codex'in o anki üretimi silinmişti — yalnızca önceden kopya alındığı için kurtarıldı.

**Bedeli:** Kapsam kontrolü anlamsızlaşır. İki ajanın işi tek diff'te birleşince, hangi satırın kimden geldiği ve hangisinin incelendiği belirsizleşir — kontrolün var olma sebebi tam olarak budur.

_Kaynak: Issue #80, sunucu ve istemci yarılarının paralel yürütülmesi._

### K-08 · Biten iş kutucuğunu kendiliğinden işaretlemez

Bir iş merge edildiğinde yol haritası **kendiliğinden güncellenmez.** Kapanış adımı bunu söylüyor ve yine de atlanabiliyor — çünkü kapanış anında dikkat commit'te, PR'da ve bir sonraki işte olur.

Bu üç kez oldu: `AGENTS.md` beş komut listelerken "dört" dedi, `PROJECT_STATE` §7 v1.1'i kapanmamış gösterdi, E4'ün dört maddesi bitmişken `[ ]` kaldı.

**Kural iki parçalı:**

1. **Kapanışta işaretle.** Döngünün 6. adımı, değişmedi.
2. **Açılışta doğrula.** 0. adımda `git log` ile yol haritası karşılaştırılır; işaretlenmemiş biten iş varsa brifing yazılmadan önce düzeltilir.

İkinci parça önlemenin yerine değil, **başarısız olduğu için** var. Üç denemede tutmayan bir disiplini dördüncü kez yazmak yerine, yanlış bilginin **zarar verdiği ana** bir kontrol kondu: yol haritasını okuyan taraf bir sonraki görevdir.

**Yarım biten iş tam işaretlenmez.** E4'te sıfırlama akışının dallanması için ekran metni yazıldı ama mekanizma yok; kutucuk açık bırakıldı. Doğru bir cümlenin arkasına eksik bir mekanizma saklamak, hiç yazmamaktan kötüdür.

_Kaynak: Issue #77 (B08, B10) ve E4 durum denetimi._

### K-09 · Güvenli tarafta kalmak, sebebini yanlış söylemeyi haklı çıkarmaz

K-04 bilinmeyende kısıtlayıcı olanı seçmeyi söyler ve bu doğrudur. Ama **kararı almak ile kullanıcıya cümleyi kurmak iki ayrı iştir.** Kısıtlama doğru olduğu için ekrandaki metin denetlenmeden kalabiliyor.

Bir durum okunamadığında ekran, **okunabilmiş gibi** konuşmaz. "Okuyamadım" ile "hayır" aynı cevap değildir; kullanıcıya ikincisi söylenirse, olmayan bir sorunu çözmeye çalışır.

Pratik karşılığı: bir güvenlik durumu üç değer taşıyorsa (**var** · **yok** · **okunamadı**) bunu iki değerli bir alanda tutma. Üçüncü durumu tipe koy — o zaman her çağrı noktası onu ele almak zorunda kalır ve unutmak derleme zamanında yakalanır.

_Kaynak: Issue #102. `must_change_password` okunamadığında istemci kilidi varsayıyordu — karar doğru — ama kullanıcı "şifrenizi değiştirmelisiniz" ekranını görüyor ve veritabanı "gerek yok" derken şifresini gereksiz yere değiştiriyordu. Production'da yaşandı._

### K-10 · Dilim açılışında keşif turu

Hiçbir alt başlık, **beyan ettiği varsayımlar canlı sistemde doğrulanmadan** başlamaz.

Her alt başlık `ROADMAP.md`'de bir **"Dayandığı varsayımlar"** satırı taşır. Açılışta o satırdaki her madde tek tek sınanır — dosyadan okunarak değil, çalışan sistemden. Beş dakikalık bir iştir; uzun sürüyorsa varsayımlar fazla soyut yazılmıştır.

Doğrulanmayan bir varsayım **engel değil, kapsamın parçasıdır**: ya düzeltilir ya dilim yeniden yazılır. "Sonra bakarız" diye geçilen varsayım, dilimin ortasında keşfedilir ve o noktada geri dönmek pahalıdır.

_Kaynak: 2026-08-29 denetimi. E7.2-B2, yedi dosyada sabit isimle kapsam belirlendiğini varsayıyordu; gerçekte iki dosya yazılmıştı, yedi bulundu. Aynı denetimde, `create-member` Edge Function'ının deploy edildiği varsayılarak arayüz yazılmış ve form çalışmayan bir arka uca bağlanmıştı (#113/#114)._

### K-11 · Zemin kaydı — kararı geçersiz kılan iş, kaydını da yapar

Bir iş, **başka bir dilimin ya da kararın beyan ettiği varsayımı geçersiz kılıyorsa**, bunu kaydetmek isteğe bağlı temizlik değil **işin kendisidir**.

Kayıt, varsayımın **yaşadığı yere** düşülür — sonradan hatırlanacağı yere değil. Kararı silmek gerekmez; altına tarihli bir not yeter. Amaç kararı iptal etmek değil, **hangi paragrafın artık başlangıç noktası olduğunu** söylemek.

Soru cevaplanabilir olmalı: _"Bu iş, birinin yazılı olarak doğru saydığı bir şeyi yanlışladı mı?"_ Cevap evetse iş bitmemiştir.

_Kaynak: 2026-08-29. Hesap geçişi kararı (2026-08-25) oturumun `localStorage`'da olduğu bir dünyada yazılmıştı; E7.2-A onu `sessionStorage`'a taşıdı. "İki oturumu aynı anda sakla" ve "sayaç hepsini kapatsın" maddelerinin uygulaması tamamen değişti, karar metni bunu bilmiyordu. Aynı gün dal koruması kararı da benzer durumdaydı: "Team planı gerekir" varsayıyordu, depo public olunca ruleset'ler ücretsiz hâle geldi ve başka bir yoldan sağlandı._

### K-12 · Koşullu kararın sahibi olur

_"Şu şart sağlanınca şunu yapacağız"_ diyen hiçbir karar, **şartı kimin ve ne zaman kontrol edeceği** yazılmadan kapanmaz.

Şartsız karar bir karardır; **sahipsiz şart bir dilektir.** Şart genellikle sessizce sağlanır ve kimse fark etmez — çünkü fark etmek kimsenin adımı değildir.

Pratik karşılığı: koşullu her karar üç şey taşır — **şart**, **şartı kontrol edecek adım** (hangi dilimin açılışında, hangi kapıda), ve **şart sağlandığında yapılacak iş**. Üçü de yoksa karar yarımdır.

_Kaynak: PR #81 bu tuzağı adıyla tarif etmişti — "`PLATFORM_SETTINGS` §4'teki beş ertelenmiş ayara tam olarak bu oldu; şart aynı gün sağlandı, kimse fark etmedi." 2026-08-29 denetimi aynı kalıbın üç canlı örneğini buldu: KVKK/Frankfurt kararı ("ilk gerçek kurum verisinden önce"), SMTP terki ("ilk gerçek kurum davetinden önce"), ve dal koruması (şart üçüncü bir yoldan sağlandı, metin hâlâ eski yolu tarif ediyor)._

### K-13 · Engelin sonucu ölçülür, mekanizması varsayılmaz

Bir işlemin engellendiğini **hangi hatayı fırlattığıyla** değil, **ne olmadığıyla** doğrula. "Bu çağrı `42501` döndürür" bir varsayımdır; "bu kayıt değişmedi" bir ölçümdür.

Somut tuzak: PostgreSQL, `UPDATE`'in `using` koşulu hiçbir satırı tutmadığında **hata vermez** — sessizce sıfır satır günceller. `42501` yalnızca `with check` ihlalinde veya sütun/tablo yetkisi yokken çıkar. Yani "yetkisiz kullanıcı güncelleyemez" testini `throws_ok` ile yazmak, güvenlik doğru çalışsa bile testi kırar; daha kötüsü, ters durumda **yanlış bir mekanizmaya güvenip** geçtiğini sanabilirsin.

Sonucu ölçmek ayrıca daha güçlüdür: kaydın değişmediğini kanıtlayan bir iddia, engelin RLS'ten mi sütun yetkisinden mi FK'den mi geldiğine bakmaksızın doğru kalır. Mekanizma değişirse test yine geçer, çünkü test **istenen şeyi** ölçüyordur.

Aynı kural SQL dışında da geçerli: bir arayüz kontrolünün çalıştığını "hata mesajı göründü" ile değil, "istek gitmedi" veya "değer değişmedi" ile doğrula.

_Kaynak: v1.2-03. Velinin öğrenci kaydını değiştiremediği testi `throws_ok(..., '42501')` olarak yazıldı ve kırmızı döndü. Kırmızı olan politika değil beklentiydi: `UPDATE 0` dönüyordu, kayıt değişmiyordu ve güvenlik tam olarak istendiği gibi çalışıyordu._

## Görev dosyalarının ömrü

`.ai/tasks/` **git'e girmez** (`.gitignore`). Brifingler çalışma dosyasıdır: yazılır, kullanılır, iş bitince silinir.

**Neden izlenmiyor:** Yazan ajan brifingi çalışma kopyasından okur, GitHub'dan değil — yani commit edilmesine hiç gerek yok. İzlendiğinde her görev **iki merge/pull turu** gerektiriyordu: biri brifing için, biri iş için. Birincisi tamamen ek yüktü.

**Kayıt nerede kalıyor:** PR açıklamasında. Neyin neden yapıldığı, hangi alternatifin reddedildiği ve neye dokunulmadığı zaten oraya yazılıyor — brifingin talimat kısmı geçicidir, gerekçe kısmı PR'da kalıcıdır.

**Biten brifing silinir.** Sebebi klasörün şişmesi değil: **duran eski brifing, bir sonraki oturumda yanlışlıkla güncel sanılabilir.** Silme artık commit gerektirmiyor, dosyayı kaldırmak yeterli.

### K-14 · Gerçekleşmemiş işlem başarılı gösterilmez

Bir ekran, arkasında karşılığı olmayan bir işlemi **başarılı bildiremez.** "Kaydedildi" demek bir olgu iddiasıdır; kayıt yoksa iddia yanlıştır ve kullanıcı yanlış bilgiyle karar verir.

Doğru davranış, işlemi gizlemek değil **ne olduğunu söylemek**: _"Ödev altyapısı kalıcı veri fazında bağlanacaktır; şu an bir kayıt oluşturulmadı."_ Kullanıcı böylece bir daha denemez ve kaydın var olduğunu sanarak üzerine iş kurmaz.

Tehlikeli olan varyant, işlemin **kısmen** çalışmasıdır: kayıt ekrandaki listeye ekleniyor ama hiçbir yere yazılmıyor. Kullanıcı sonucu görüyor, doğrulanmış hissediyor ve yenilemeye kadar fark etmiyor. Görünürde çalışan bir şey, hiç çalışmayan bir şeyden daha çok zarar verir.

Pratik kontrol, yeni bir ekran veya düğme yazarken: **bu işlem üretimde gerçekten bir yere yazıyor mu?** Cevap hayırsa mesaj da hayır demeli.

_Kaynak: aynı hata üç kez çıktı — #131 (yoklama kaydı), #134 (toplu aktarım) ve 2026-09-05'te `HomeworkCreateDialog`. İlk ikisi tek tek düzeltildi ama kalıp kural olarak yazılmadığı için üçüncüsü v1.2-08 açılışına kadar fark edilmedi; üstelik ROADMAP o ekranın **fail-closed çalıştığını** varsayım olarak beyan etmişti._

### K-15 · Yeni iş yeni numara alır; mevcut numaralar kaydırılmaz

Bir dilim numarası bir **ad**dır, bir **sıra** değil. Araya iş girdiğinde mevcut numaralar kaydırılmaz: yeni iş, çakışmayan yeni bir ad alır (`v1.4-00` "01'den önce koşar", `v1.4-10…14` sona eklenir) ve **işin sırasını tablodaki satır sırası** verir.

Sebebi, tablonun kendisi değil **ona atılan çapalardır.** Dilim numaraları belgenin başka yerlerinden gösterilir — koşullu kararların kontrol noktaları (**K-12**), zemin kayıtları (**K-11**), bağımlılık sütunları. Numara kaydırıldığında bu atıfların hiçbiri hata vermez; sessizce **yanlış dilimi** göstermeye başlarlar. Bozulma görünmezdir ve ancak o dilim açıldığında, yanlış varsayımla, fark edilir.

Aynı sebeple **biten bir dilimin numarası yeniden kullanılmaz.** Kapanmış bir numaraya yapılan atıf, tarihsel bir kaydı gösterdiği için hâlâ doğrudur; o numarayı yeni bir işe vermek, geçmişi geriye dönük olarak yalanlar.

_Kaynak: 2026-09-05 bütünlük denetimi. Şüphe şuydu: "v1.4'ün adını v1.3 yapmış olabilir miyiz?" Ölçüldü — numaralar 2026-08-21'den beri hiç değişmemişti; hissi yaratan şey Faz E'nin sıranın önüne geçmesiydi. Ama denetim yedi yeni dilim açtı ve o an kural gerçek bir seçime dönüştü: `v1.4-01`'e K-12 borcunun kontrol noktasından çapa atılmış durumdaydı, kaydırma o çapayı bozacaktı._

### K-16 · Kapsamı olan her maddenin dilimi olur

Sürüm kapanışında **§4'ün kutucukları ile §4.6'nın dilimleri karşılaştırılır.** Dilimi olmayan bir kutucuk, sürümü kapatmaz: ya bir dilim alır, ya da kapsam dışı olduğu açıkça yazılır.

İki kaydı ayrı tutmanın bedeli budur (**K-06**'nın kabul edilmiş karşılığı): §4 _ne_ yapılacağını, §4.6 _hangi sırayla_ yapılacağını tutar ve ikisi birbirini tekrar etmez. Tekrar etmedikleri için de **birbirlerinden sessizce ayrılabilirler** — bir maddenin kapsamda olup sırada olmaması hiçbir hata üretmez.

En tehlikeli hâli, **bir release gate'in dilimi olmayan bir işe dayanmasıdır.** O kapı ya hiç kapanamaz, ya da işin yapılmamış olduğu fark edilmeden "yeterince yakın" bir şeyle kapatılır. Kapı, arkasında iş olmayan bir söz hâline gelir.

_Kaynak: 2026-09-05 bütünlük denetimi. Realtime, §4 v1.3'te bir kutucuktu ve §4.6'da hiç yoktu — oysa v1.4'ün release gate'i tam olarak ona dayanıyordu ("admin değişikliği ilgili ekranda Realtime ile görünür"). Aynı taramada dilimsiz dört madde daha çıktı: ders programı, Günlük Akış, Gün Planı ve Zod+audit._

### K-17 · İki uca bağlanan satırın politikası iki ucu da sorar

Bir satır iki varlığı birbirine bağlıyorsa — oturum+öğrenci, sınav+öğrenci, plan+taksit — politikayı yazarken **iki ayrı soru** vardır ve ikisi de sorulmalıdır:

1. **Bana bu yazma hakkını ne veriyor?** (kapsam sorusu)
2. **Bağladığım iki uç birbirine ait mi?** (bütünlük sorusu)

Birinciyi cevaplamak doğal ve kolaydır; politika onsuz zaten yazılamaz. İkincisi **sorulmadığında hiçbir yerde hata üretmez** — ne test kırılır, ne hata mesajı çıkar, ne yabancı anahtar itiraz eder. Bileşik yabancı anahtarlar yalnızca **aynı kiracıya** ait olmayı garanti eder; "birbirine ait olmayı" değil.

Pratik kontrol: yazdığın satır iki `..._id` sütunu taşıyorsa, politikanda **ikisinin de adı geçmelidir.** Geçmiyorsa eksik soru oradadır.

_Kaynak: 2026-09-05 kapsam turu, iki ayna örnek. `attendance_records` oturumu soruyor öğrenciyi sormuyordu → 12-A öğretmeni 12-A oturumuna 12-B öğrencisinin kaydını yazabiliyordu. `exam_results` öğrenciyi soruyor sınavı sormuyordu → 12-B öğretmeni kendi öğrencisini 12-A'nın sınavına yazabiliyordu. Tam ayna olmaları, bunun dalgınlık değil eksik bir soru olduğunun kanıtıdır. Üstelik yoklama politikasının başındaki yorum asimetriyi "bilinçli" diye açıklıyordu — gerekçe okumaya aitti, yazma tarafındaki kayıp yan etkiydi._

### K-18 · Yabancı anahtar "var mı" der, "olmalı mı" demez

Yabancı anahtar hedefin **varlığını**, bileşikse **kiracılığını** garanti eder. **Uygunluğunu asla.** Bir sütun bir üyeliğe, role veya kişiye işaret ediyorsa, o hedefin bu iş için uygun olup olmadığı **ayrıca** zorlanmalıdır — FK bunu yapmaz ve yapıyormuş gibi görünür.

Tehlikeli yanı, tenant izolasyonu kusursuz çalışırken kurum **içinde** yetkinin sızabilmesidir: satır doğru kuruma aittir, doğru tabloya işaret eder, her kısıt geçer — ve yine de yanlış kişiye yetki verir.

_Kaynak: 2026-09-05 kapsam turu. Üç sütun (`class_teachers.membership_id`, `classes.mentor_membership_id`, `schedule_entries.membership_id`) bir üyeliğe işaret ediyor ve üçü de rolünü sormuyordu; rolü `parent` olan bir üyelik sınıfa atanırsa o kişi yoklama yazma, ödev verme ve öğrenci okuma yetkisi kazanıyordu. Doğru kısıtın "rol teacher olmalı" **olmadığına** dikkat: tasarım adminin ders vermesine bilinçli izin veriyor, dışlanması gereken `student` ve `parent`._

### K-19 · Kısmi otomasyon kapsamını kendisi bildirir

Bir boru hattı bazı şeyleri otomatik yapıyorsa, **hangilerini yapmadığı ölçülebilir olmalıdır**: bir CI kontrolü, bir liste karşılaştırması, kırmızıya dönen bir kapı.

Sessiz kısmi otomasyon **hiç otomasyon olmamasından kötüdür.** Hiç yoksa herkes elle yapmayı bilir. Varmış gibi görünüp bir istisna bırakırsa, sana güvenmeyi öğretir ve istisnayı unutturur — üstelik unutmanın hiçbir belirtisi olmaz.

_Kaynak: 2026-09-05 kapsam turu. `main`'e merge Edge Function'ları deploy ediyor — ama yalnızca `config.toml`'da tanımlı olanları. `create-member` o listede yoktu ve 26 Ağustos'ta elle deploy edilmiş v1 sürümünde donmuştu; aynı gün diğer dört fonksiyon yeniden deploy oldu, hiçbir kapı kırmızı dönmedi. Bedeli soyut değil: üç `_shared/*` modülü ortak, dolayısıyla `temporaryPassword.ts` değişse dört fonksiyon yeni sürümü alır, `create-member` eskisiyle çalışmaya devam ederdi._

**Bu kuralın en iyi kanıtı, kuralı yazmadan önce denenmiş olması.** v1.2-13'te ortaya çıktı ki aynı hata **2026-08-24'te bir kez daha** olmuş (`reset-admin-password` hiç oluşturulmamış), teşhis edilmiş, ve karşılığı `config.toml`'a şu cümleyi yazmak olmuş: _"Yeni Edge Function ekleyen herkes buraya da satır ekler."_ **Hatırlatma iki gün dayandı** — 26 Ağustos'ta `create-member` yine unutuldu. Doğru yazılmış, doğru yere konmuş, tarihli ve gerekçeli bir uyarı bile **kapı değildir.**

### K-20 · Kendi başına iş yapan bir şeyi açmadan önce anlat ve onay al

Bir dilimin onayı, o dilimin içindeki **bota** verilmiş onay değildir.

Dilim bittikten sonra da çalışmaya devam eden ya da oturum dışındaki insanların gördüğünü değiştiren her şey — bot, zamanlanmış iş, webhook, bildirim, herkese açık çıktı, durum rozeti — açılmadan önce **ne yapacağı, neye ve hangi sıklıkta** günlük dille anlatılır ve **açıkça onaylanır.**

**İlk koşum ayrıca söylenir.** Bu tür araçların çoğu kararlı durumda sakindir ama ilk çalıştıklarında biriken bütün geri kalmışlığı bir anda döker. "Haftada bir iki PR" doğru bir cümledir ve ilk gün on PR açılmasını hiç anlatmaz.

**Riskli olan iş yapmak değil, otonom bir aktörü açmaktır.** İşi geri alabilirsiniz; açtığınız aktör siz uyurken de karar vermeye devam eder.

Şaşkınlıkla karşılaşılırsa savunulacak şey yapılandırma değildir: yapılandırma zaten istendiği gibi çalışmış olabilir. Söylenecek şey, onu kimin ve nerede devreye soktuğudur.

_Kaynak: v1.2-20. Dilim "SHA pinning, CodeQL, **bağımlılık otomasyonu**, lisans envanteri" olarak onaylanmıştı ve Dependabot brifingde tek satırdı. Merge edildiği dakika, herkese açık depoda **on PR** açıldı. Ayar tam yazıldığı gibi çalışmıştı (ekosistem başına beş) — sorun ayarda değil, "bağımlılık otomasyonu" ifadesinin **kendi başına PR açan bir bot** anlamına geldiğinin hiç söylenmemiş olmasındaydı. Arda'nın değerlendirmesi: "profesyonelliği bozmuş"._

### K-21 · Botun güncellediği alana insan notu yazılmaz

Bir satırın bir yarısını otomasyon, diğer yarısını insan yazıyorsa o satır er ya da geç kendi kendisiyle çelişir.

Otomasyon kendi yarısını günceller; insanın yarısını **tanımadığı için** olduğu gibi bırakır. Ortaya çıkan şey bozuk bir satır değil — okunabilir, biçimi düzgün, ve **yanlış** bir satırdır. Hata vermez, kapıyı kırmızıya döndürmez; yalnızca ona bakan herkesi yanıltır.

Bu K-06'nın ("aynı olgu iki yerde tutulursa biri eskir") bir çeşidi değil, **daha sinsi hali**: olgu iki yerde değil, tek satırda tutulur. K-06 iki nüshayı karşılaştırmayı öğütler; burada karşılaştırılacak ikinci bir nüsha yoktur.

**Kural:** otomasyonun yazdığı alana insan açıklaması eklenmez. Açıklama gerekiyorsa **ayrı bir satıra** çıkarılır. Bir aracın belirli bir biçimi güncellediğini biliyorsak — sürüm yorumu, sürüm alanı, oluşturulmuş blok — o biçim **aracın olduğu gibi** bırakılır.

**Kontrol:** bir aracın dokunduğu dosyada, aracın koşmasından sonra o satırların hâlâ doğru olduğu **okunarak** doğrulanır. "Bot yalnızca SHA'yı değiştirir" bir varsayımdır; ne değiştirdiği çıktıya bakılarak bilinir (**K-13**).

_Kaynak: v1.2-20 action'ları SHA ile sabitledi ve her satıra `# v4 · 2026-09-06'da çözüldü` biçiminde bir not düştü. Dependabot #201'de SHA'ları yükseltti ama yorumları güncelleyemedi, çünkü yorum sürümden ibaret değildi. 2026-09-07'de ölçüldüğünde **beş sabitlemenin beşinde de yorum yanlıştı** ve hepsi major kaymıştı: yorum `v4` derken `actions/checkout` v7.0.1, `supabase/setup-cli` ise `v1.7.1` derken v3.0.0'daydı. Sabitlemenin tek maliyeti okunabilirlik kaybıdır ve yorum tam olarak onu ödemek için vardır; yalan söylediğinde sabitleme hem okunmaz hem yanıltıcı olur. Ayrıntı: `ROADMAP.md` §4.9, #214._

### K-22 · Yokluk etiketi de bir iddiadır

`—`, `N/A`, `bilinmiyor` gibi bir işaret basmak, bilgiyi göstermemek değildir: **olmadığını söylemektir.** Ve o cümle çoğu zaman yanlıştır.

Bir alanın boş gelmesinin en az üç sebebi olur ve ekran üçünü ayırt edemez:

1. **Gerçekten yok** — kayıtlı veli yok.
2. **Görme yetkin yok** — veli var, RLS satırı sana vermedi.
3. **Henüz türetilmedi** — hesaplayacak dilim gelmedi.

`—` üçünü birden **birinci** anlama indirir. K-03 uydurulmuş bir **değeri** yasaklar (`attendance: 0`); bu kural uydurulmuş bir **iddiayı** yasaklar. İkincisi daha sinsidir, çünkü `—` dürüst görünür.

**Kural:** değer yoksa o bilgi bloğu, satırı, rozeti veya çubuğu **hiç çizilmez.** Olmayan bir öğe hiçbir şey iddia etmez; bu, elimizdeki tek dürüst seçenektir.

**Nerede uygulanır:** sunum kararıdır, ekranda verilir. **Servis katmanı yokluk etiketi üretmez** — servis `null` döner, ne göstereceğine ekran karar verir. Servis `—` döndürdüğünde arayüz üç durumu bir daha asla ayıramaz, çünkü ayrım servis sınırında kaybolmuştur.

_Kaynak: v1.3-01/A. Servisler `extractGuardianName` gibi yardımcılarda `"—"` üretiyordu. Denetleyen canlıda ölçtü: `guardians` tablosunun yalnız `_select_admin` ve `_select_self` politikası vardı, öğretmen için politika yoktu. Yani öğretmen, velisi kayıtlı her çocuk için `Veli: —` görecekti — ekran ona "bu çocuğun velisi yok" diyecekti. Ölçüm dört rolle yapıldı ve ayrıca #228'i doğurdu: görünürlüğün kendisi de bir ürün kararıymış ve hiç sorulmamıştı. Kuralı yazan da bu görevi yürüten ajandı._

### K-23 · Kodu geri alındığında kırmızıya dönmeyen test, koruma değildir

Bir kusuru kapatan her düzeltme, o kusuru **yakalayan** bir testle gelir. "Yakalıyor" demek yetmez: düzeltme geçici olarak geri alınır, testin **kırmızıya döndüğü görülür**, sonra geri yüklenir. Teslimde raporlanan şey o kırmızı çıktının kendisidir.

Ölçülmeyen bir regresyon testi, kapının yeşil olduğunu söyler ve korumanın var olduğunu **sandırır** — ikincisi daha pahalıdır, çünkü bir dahaki kişi oraya bakmaz.

Sık görülen iki boş biçim:

- **Test, test ettiği fonksiyonu kendi gövdesinde yeniden yazar.** O zaman sınanan şey gerçek kod değil, testin kendi kopyasıdır; gerçek kod silinse bile yeşil kalır.
- **Test, olamayacak bir şeyin yokluğunu iddia eder.** `expect(html).not.toContain("window.confirm")` gibi: render edilmiş HTML hiçbir koşulda o dizeyi içermez, dolayısıyla iddia her zaman geçer.
- **Test, bir dış sistemin cevabını taklit eder ama o cevabı hiç ölçmemiştir.** Kod `err.detail` okuyorsa ve test de `{ detail: … }` kuruyorsa ikisi birbirini doğrular; gerçek sistem `details` gönderiyordur ve kimse fark etmez. Bir dış gövdeye dayanan her çeviri, o gövdenin **ölçülmüş** bir örneğiyle sınanır.

**Pratik karşılığı:** kararı saf bir fonksiyona çıkar, onu doğrudan sına; bileşen tarafını da gerçekten render et. Depoda ikisinin de deseni var (`scopeFilters`, `attendanceStatus`, `navigationGuards` · `pages/extraStates.test.ts`).

_Kaynak: v1.4-03. R1 ve R2 düzeltmeleri doğruydu ama dört regresyon testinin dördü de boştu; `EducationPlatform`'daki koruma tamamen kapatıldığında **41/41 test yeşil kaldı**. Üçüncü turda karar `shouldConfirmLeaving`'e çıkarıldı ve testler gerçek bileşeni render etti; aynı mutasyon bu kez testi kırmızıya döndürdü._

### K-24 · Sıkılaşan bir standart geriye uygulanmazsa standart değildir

Bir kural sürümün ortasında sıkılaştığında, **o kuralın konduğu andan önce kapanmış dilimler ona göre yeniden ölçülür.** Yapılmazsa ortaya bir borç değil, **kuralın kendisinden daha kötü bir şey** çıkar: aynı depoda iki farklı standart, ve hangisinin nerede geçerli olduğunu yalnız kuralı koyan kişinin hafızası bilir.

Sinsi yanı, bu ayrımın **hiçbir belirtisinin olmaması**. Eski dilim kendi zamanının kurallarını geçmişti; kapı yeşil, testler yeşil, kod duruyor. Yeni kural yalnız yeni yazılana uygulanır ve eskisi "denetlenmiş" sayılmaya devam eder — oysa hiç o gözle bakılmamıştır.

**Kural:** bir K kuralı eklendiğinde ya da bir kontrol alışkanlık hâline geldiğinde, iki şeyden biri yapılır:

1. **Geriye tarama yapılır** — kuralın kapsadığı bütün eski yüzey aynı turda ölçülür, ve
2. **kural kapıya taşınır** — çünkü elle yapılan bir tarama, onu yapan kişi yorulduğunda biter (**K-19**).

Sadece "bundan sonra böyle yapacağız" demek üçüncü bir seçenek değildir; bir süre sonra kuralın kendisi de unutulur.

_Kaynak: v1.4 ara denetimi (2026-09-13). Denetim dokuz kapanmış dilimi taradı ve bulduğu bütün kusurların **tek bir örüntüsü** vardı: uyguladığım standartlar dilim dilim sıkılaşmış, eski dilimler hiç geri dönülüp hizalanmamıştı. "İhraç ettiğin her fonksiyonun çağıranı var mı" kontrolü v1.4-05'te başladı — v1.4-04'ün sınav düzenleme ve arşivleme fonksiyonları o turdan önceydi ve **ekrana hiç bağlanmadan** kapandı; kullanıcı sınavın adını, tarihini ve tam puanını yazıyor, ekran "Yeni Sınav", bugünün tarihi ve boş puan gösteriyordu (**K-03**). K-14 koruması da yalnız v1.4-05'ten sonraki servislerde vardı; dokuz fonksiyon sıfır satır etkileyen bir yazmayı "başarılı" sayıyordu. Kuralın ikinci maddesi aynı turda uygulandı: çağıran kontrolü `client/src/lib/deadServiceExports.test.ts` ile kapıya taşındı. Üç kez elle yapılmış ve üçünde de bir şey bulmuştu._

## Brifing yazarken

İyi bir brifing şunları içerir:

1. **Bağlam** — bu iş neden var, hangi sorunu kapatıyor
2. **Tam olarak ne yapılacağı** — dosya adı, imza, davranış
3. **Neyin yeniden kullanılacağı** — mevcut yardımcılar, desen alınacak dosya
4. **Dokunulmayacak yerler** ve **yapılmayacak işlemler**
5. **Kabul kriterleri** — işaretlenebilir maddeler
6. **Teslim biçimi** — altı çıktı

Brifingi yazarken yukarıdaki **birikimli kurallara** bak; ilgili olanları göreve özgü biçimde tekrarla. Yazan ajanın bu belgeyi okuduğunu varsayma — brifing kendi başına yeterli olmalı.

### K-25 · `definer` bir politikayı taklit ediyorsa, politikanın HER şartını taşır

`security definer` bir fonksiyon RLS'i atlar. Yetki artık politikadan gelmediği için elle yazılır — ve elle yazılan şey politikanın **tamamı** olmak zorundadır, ilginç olan kısmı değil.

2026-09-18'de bu kuralın olmaması beş fonksiyonda aynı açığı açtı ve ölçüldü: şifre kilidi (`must_change_password`) açık bir kurum yöneticisi tabloları doğrudan okuyamıyordu ama beş `definer` RPC'nin beşi de ona veri döndürüyordu. Kilit E3'te bilinçli konmuştu: hesap kâğıda yazılmış **geçici** bir şifreyle açılıyor ve ilk iş onu değiştirmek olmak zorunda. Ekran onu zorluyordu; **API zorlamıyordu.**

Sinsi yanı, atlanan şartın **en çok tekrar eden** şart olması. `and not (select current_user_must_change_password())` dört rolün politikasında da, her tabloda da aynı biçimde duruyor. Yetki ifadesi rol rol kopyalanırken değişen kısım kopyalandı, her satırın sonundaki değişmeyen kuyruk kopyalanmadı. **"Hep orada" olan şey okunmaz hâle geliyor.**

**Kural:** bir okuma yolu `definer` bir fonksiyona taşınırken, taklit edilen politikaların metni satır satır okunur ve **her konjonksiyon** taşınır. Taşındığının kanıtı, o şartı tek tek sınayan bir testtir — kapsamı ölçen testler bunu yakalamaz, çünkü kapsam doğru olduğu hâlde şart eksik olabilir.

⚠️ Ve kuralın kendisi **K-24 gereği geriye uygulanır:** bir `definer` fonksiyon eklendiğinde, daha önce eklenmiş olanlar aynı gözle yeniden okunur. 2026-09-18'de bu yapıldı ve beşinin beşinde de eksik bulundu.

### K-26 · Bir adı arayan kapı, kapı değildir

Yapısal bir test bir metin araması yapıyorsa, aradığı metnin **yalnızca korunmak istenen davranış varken** bulunabildiğini ayrıca kanıtlamak zorundadır. Aksi hâlde test, davranışı değil dizgenin varlığını ölçer.

2026-09-18'de bu iki kez aynı gün ölçüldü ve ikincisi kapıyı **yazarken** oldu:

- `calendarDayHasOneSource` `new Date().toISOString().split("T")[0]` dizgesini arıyordu. Depodaki iki gerçek ihlal o dizgeyi içermiyordu (`event.startsAt.slice(0, 10)`) ve kapı ikisinde de yeşil kaldı.
- Onu düzeltirken yazılan CSP kapısının "bağlı mı" iddiası `expect(config).toContain("checkCspAllowsSupabase")` idi. Çağrı kaldırıldığında **yeşil kaldı**, çünkü `import` satırı o dizgeyi zaten içeriyor.

İkisinin ortak yanı, aranan dizgenin korunan davranıştan **bağımsız** olarak var olabilmesi. Kapı yazarken bu sorulmadığı sürece yeşil bir test, ölçülmemiş bir varsayımdır.

**Kural:** metin arayan bir kapı üç şeyden birini yapar —

1. **Davranışı gerçekten koşar.** CSP kapısı buna çevrildi: gerçek `vite.config.ts` fonksiyonu, gerçek `vercel.json`'a karşı, kasten yanlış bir değerle çağrılıyor. Fırlatmazsa iddia düşer.
2. **Kaçırdığı biçimleri kendi içinde sabitler.** `calendarDayHasOneSource` buna çevrildi: önceki hâlin kaçırdığı üç yazım artık kapının içinde birer iddia. Desen daraltılırsa orası kırmızıya döner.
3. **Yanlış alarm tabanını da sabitler.** Aynı kapı meşru kullanımları da sınıyor — biri deseni genişletirse hangi meşru kalıbı kırdığını okur.

⚠️ Ve **K-23 ile karıştırılmamalı.** K-23 "kodu geri al, kırmızıya dönüyor mu" diyor. K-26 bir adım öncesi: mutasyonun **doğru mutasyon** olması. Yukarıdaki CSP vakasında ilk denenen mutasyon (`checkCspAllowsSupabase` → `checkCspAllowsSupabaseKaldirildi`) kapıyı kırmızıya döndürdü ve kapının sağlam olduğu izlenimi verdi; gerçek mutasyon — çağrıyı bırakıp **fırlatmayı** düşürmek — zayıflığı ortaya çıkardı. **Kolay mutasyon, kapıyı doğrulamaz.**

### K-27 · Bir değişmez, her erişim yolunda ayrı ayrı sınanır

Bu sistemde veriye üç ayrı yoldan ulaşılıyor: **PostgREST + RLS**, **`security definer` RPC**, ve **`service_role` ile çalışan Edge Function**. Bir güvenlik değişmezi bunlardan birinde tutuyor olabilir ve diğerinde tutmuyor olabilir — ve tuttuğu yerden bakan biri onu "yürürlükte" sanır.

K-25 bunun yarısını söylüyordu: `definer` bir fonksiyon politikayı taklit ediyorsa politikanın her şartını taşır. 2026-09-19'da ölçülen şey, aynı açığın **üçüncü yolda** hâlâ açık durması: şifre kilidi (`must_change_password`) dört kimlik Edge Function'ında ve çağırdıkları `internal_*` RPC'lerinde hiç sorulmuyordu. Kilitli bir yöneticinin jetonu `students`'tan **0 satır** alıyor ama `create-member`'dan **HTTP 201** alıyordu.

Sinsi yanı, düzeltmenin **kısmen** yapılmış olması. `v1.5-18` beş `definer` fonksiyonu düzeltti, kuralı yazdı, pgTAP kapısını kurdu — ve kimlik yolunu hiç açmadı, çünkü o yol "RLS'i atlayan fonksiyon" diye görünmüyor: `service_role` zaten her şeyi görüyor, yetki kontrolü fonksiyonun kendi `if` bloğunda. Yani K-25'in aradığı desen orada **yok**, ama K-25'in koruduğu değişmez orada da geçerli.

**Kural:** bir güvenlik değişmezi yazıldığında veya düzeltildiğinde, üç erişim yolunun **üçü de** tek tek sorulur ve cevabı yazılır. "Bu yolda geçerli değil" meşru bir cevaptır; **sorulmamış olmak** değildir. Kanıtı, değişmezi her yolda ayrı sınayan bir testtir — PostgREST için pgTAP politikası, `definer` için fonksiyonu doğrudan çağıran iddia, Edge için zinciri koşturan kabuk testi (`supabase/tests/functions/`).

⚠️ Ve **K-24 gereği geriye uygulanır:** yeni bir erişim yolu açıldığında (yeni bir Edge Function, yeni bir `definer` RPC), o yolun mevcut bütün değişmezleri taşıyıp taşımadığı sorulur.

### K-28 · Boş sistemde doğru olan ekran, dolu sistemde yalan söyleyebilir

Bir ekranın doğruluğu **verinin durumuna bağlıysa** o doğruluk tarihlidir ve sessizce sona erer. Kod değişmeden doğru olmaktan çıkan bir ekran, hiçbir testin ve hiçbir denetimin yakalamadığı kusur sınıfıdır — çünkü değişen şey kod değil, dünyadır.

2026-09-19'da ölçüldü: dört rolün Genel Bakış ekranı sabit `0` ve _"yok"_ değerleri gösteriyor. Bu karar 2026-08-29'da **bilinçli ve doğru** alınmıştı — ROADMAP'in onaylı cevabı _"gerçek kurumda `0` ve 'Henüz veri yok' gösterilecek"_ diyor ve o gün kurumlar gerçekten boştu. v1.4 veri girişini açtı; aynı ekran, tek satır kod değişmeden, _"Aktif öğrenci 0"_ derken ekranda 3 öğrenci duran bir **yalana** döndü. Velinin gördüğü _"Gelişim sinyali yok"_ cümlesi, çocuğunun 85 puanlık sınavı sistemde dururken yazılıyordu.

**Kural:** "şimdilik boş" diye verilen her karar bir **tetikleyiciyle** yazılır: _bu ekran ne olduğunda yeniden doğrulanacak?_ Tetikleyici bir tarih değil bir **olaydır** ("ilk gerçek öğrenci girildiğinde", "ilk yoklama alındığında"). Tetikleyicisi olmayan "şimdilik" kaydı, **K-11**'in tersi yönde bir tuzaktır: K-11 gerçekleşmiş tahmini silmemeyi söyler, K-28 geçerliliği bitmiş doğruyu fark etmeyi.

📌 Pratik sonucu: bir denetim turu **boş sistemde** koşulduysa hiçbir şey kanıtlamamıştır. Bu depoda `v1.5-17` ve `v1.5-18` tam olarak bu yüzden tohumlu veri istedi; aynı şart **arayüz** denetimleri için de geçerlidir.

### K-29 · Kütüphane varsayılanı, mimari kararı sessizce geri alabilir

Bir mimari karar kütüphanenin **bir** ayarıyla uygulanmışsa, aynı kütüphanenin **başka** bir varsayılanı o kararı geri alabilir — ve karar yerinde durduğu için kimse bakmaz.

2026-09-19'da ölçüldü: #132 paylaşılan dershane bilgisayarı için _"her sekme kendi oturumunu yürütür"_ kararını verdi ve `supabaseClient.ts`'te `storage: sessionStorage` ile uyguladı. Karar doğru, uygulama doğru. Ama `@supabase/auth-js` 2.112.3 `persistSession` açıkken **ayrıca** bir `BroadcastChannel` kuruyor ve her auth olayını sekmeler arasında yayıyor — depo türünden bağımsız. Ölçüm: A sekmesinde öğretmen girişliyken B sekmesinde yönetici giriş yaptı, **6 saniye içinde A sekmesi giriş ekranına düştü**; A'nın `sessionStorage`'ında kendi jetonu hâlâ duruyordu. Veri sızmadı — kaybolan şey öğretmenin kaydedilmemiş yoklamasıydı, yani kararın korumak istediği senaryonun ta kendisi.

**Kural:** bir karar kütüphane ayarıyla uygulandığında, o kütüphanenin **aynı konuyu etkileyen diğer varsayılanları** okunur ve kararın kapsamı buna göre yazılır. Kanıt, kararın koruduğu senaryonun **gerçekten** koşulmasıdır — ayarın kodda durduğunu görmek değil. `sessionStorage` satırına bakan biri kararın yürürlükte olduğunu görür; iki sekme açan biri olmadığını görür.

⚠️ Bu **K-26**'nın bir akrabası: orada kapı adını arıyordu, burada karar ayarın varlığını kanıt sayıyor. İkisinde de eksik olan, korunan **davranışın** koşulması.

### K-30 · Panelde doğru görünen bir yapılandırma, etkin olduğunun kanıtı değildir

Bir sağlayıcı panelinde doğru değerleri görmek, o yapılandırmanın **çalıştığını** göstermez. Panel **niyeti** gösterir; davranışı değil. Aradaki fark genellikle kaydedilmemiş bir form, uygulanmamış bir izin ya da plana takılmış bir özelliktir — ve üçü de ekranda aynı görünür.

2026-09-19'da ölçüldü. Hesap geçişinde Supabase→GitHub entegrasyonu kuruldu ve panel doğru değerleri gösterdi: depo `ardabulent/orbit_v3`, çalışma dizini repo kökü, production branch `main`, "Deploy to production" açık. Ekran görüntüsüyle de teyit edildi. Buna dayanarak _"göçler merge'de uygulanır"_ kabul edildi.

**Kabul yanlıştı.** Bir göçle sınandı: merge'den sonra dört dakika boyunca üretimdeki göç sayısı artmadı. Sebep sonradan bulundu — sayfanın altındaki **"Save changes" düğmesine basılmamıştı.** Yeniden bağlanınca bir sonraki merge **yirmi saniyede** uygulandı.

**İz baştan okunabilirdi ve okunmadı:** `list_branches` kaydının `updated_at` alanı, entegrasyonun ilk kurulduğu ana donmuş duruyordu ve üç merge boyunca hiç kıpırdamadı. Yeniden bağlanınca hareket etti.

**Kural:** bir entegrasyonun, webhook'un veya sağlayıcı ayarının çalıştığı, **ancak onu çalıştıran olayı üretip sonucu ölçerek** kabul edilir. Panel ekran görüntüsü kanıt sayılmaz. Ölçüm pahalıysa, en azından sağlayıcının kendi kayıtlarında bir **zaman damgasının hareket ettiği** doğrulanır.

📌 Sınavın zararsız olması tasarımdı: boru hattı bir şema yorumuyla denendi, gerçek bir tabloyla değil. Bozuk çıktığında maliyet sıfırdı. **Doğrulanmamış bir altyapı varsayımı, onu sınayan en ucuz değişiklikle sınanır** — ve o değişiklik kalıcı kayıt olarak bırakılır, çünkü aynı soru bir sonraki sahiplik değişikliğinde yeniden sorulacaktır.

⚠️ Bu **K-11**'in altyapı tarafındaki karşılığıdır: orada gerçekleşmiş tahmin silinmez, burada doğrulanmamış yapılandırma kabul edilmez.

### Değişmeyen bölümler — brifingde tekrar yazılmaz

Aşağıdaki üç blok her görevde aynıdır. Brifingde **tek satırla anılır**, kopyalanmaz:

> Kalite kapısı, teslim biçimi ve genel yasaklar için `.ai/AGENT_WORKFLOW.md`. Bu göreve özgü ek kısıtlar aşağıda.

**Her görevde geçerli yasaklar** (brifingde tekrarlanmaz):

- `git commit`, `git push`, branch açma, dal değiştirme
- `supabase/` ve `.ai/` altına dokunma
- Yeni bağımlılık ekleme
- `eslint-disable`, `@ts-ignore`
- Brifingde yazmayan ek özellik
- Brifingde listelenmeyen dosyaya dokunma — gerekiyorsa **dur ve sor**

**Kalite kapısı** — beş komut, salt okuma, ayrıca izin gerekmez. Kum havuzu engelliyorsa dışında çalıştırmak baştan onaylıdır.

**Teslim** — yukarıdaki altı çıktı.

Brifingde yalnızca **göreve özgü** olan yazılır: bağlam, yapılacak iş, dokunulabilecek dosyalar, o göreve özel kısıtlar ve ilgili birikimli kurallar. Değişmeyeni her seferinde yeniden yazmak brifingi uzatır, uzun brifing okunmaz ve okunmayan kısıt uygulanmaz.

---

## Denetleyen için yazım ekonomisi

Commit mesajı ve PR açıklaması projenin kalıcı hafızasıdır; **"ne" değil "neden"** taşırlar ve bu yüzden kısaltılamazlar. Kısaltılabilecek olan hacimdir.

- Diff'in anlattığını tekrar anlatma. Dosya listesi, satır sayısı ve "şu fonksiyon eklendi" zaten görünüyor.
- Bir kararın **gerekçesi ve reddedilen alternatifi** kalır; nasıl bulunduğunun hikâyesi kalmaz.
- Doğrulama sonucu **rakamla** yazılır: "0 satır kayboldu, 7 satır eklendi" — anlatıyla değil.
- Aynı gerekçe hem commit'te hem PR'da varsa biri yeter. Commit'te kısa hâli, PR'da tam hâli.
- Yazan ajanın taslağı varsa (teslim 6. madde) sıfırdan yazma; düzelt.

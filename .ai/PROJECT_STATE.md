# PROJECT_STATE.md — ORBIT

> Ürün tanımı, roller, teknoloji yığını ve klasör yapısı burada yaşar. Giriş noktası ve hangi soru için hangi dosyanın okunacağı: kökteki `AGENTS.md`.
>
> **Durum:** ONAYLI MVP MİMARİSİ (Keşif Mülakatı Tamamlandı).

---

## 1. Ürün Tanımı & MVP Kapsamı

**ORBIT** — Devlet kısıtlılıkları gerektirmeyen özel eğitim kurumları (LGS/YKS kurs merkezleri, butik etüt merkezleri, özel dil kursları) için tasarlanmış; müşteri görüşmeleri ve saha doğrulaması için optimize edilmiş yalın CRM, sınıf ve öğrenci yönetim platformu.

### 🎯 MVP (Faz 1) Kapsamı:

1. **Sınıf & Grup Yönetimi:** Sınıf adı, program türü, mentor öğretmen ve öğrenci kontenjanı. ⚠️ **Derslik bu maddeden çıkarıldı (v1.4-02, 2026-09-11):** derslik sınıfın değil **ders programının** özelliğidir — aynı sınıf farklı saatlerde farklı derslikte olabilir. Karşılığı **v1.4-11**'de (`DECISION_LOG` — "Kontenjan sınıfın, derslik programın özelliğidir").
2. **Öğrenci Yönetimi:** Ad-Soyad, Öğrenci No, Sınıf, Telefon, Veli Adı, Veli Telefonu.
3. **Müşteri Doğrulama Odaklı Rol Arayüzü:** Auth bariyeri olmadan 4 farklı rol (Admin, Öğretmen, Öğrenci, Veli) arasında tek tıkla geçiş yapılabilen, saha testine ve demo sunumlarına uygun arayüz. ⚠️ **Sonradan düzeltme (2026-09-19):** bu madde **v1.0'ı** anlatıyor ve v1.1'den beri geçerli değil. Rol geçişi kaldırıldı; rol artık `organization_memberships` satırından ve gerçek Supabase oturumundan geliyor. Rolleri tek tıkla gezen arayüz yalnız **demo modunda** var (`__ORBIT_DEMO_MODE__`, üretim paketinde sabit `false`) ve orada da giriş ekranındaki rol kartlarıyla sınırlı. Aynı kişinin iki gerçek hesabı arasındaki geçiş ayrı bir özelliktir ve şifre ister (`v1.4-17`).
4. **İzole Mock Veri Katmanı:** Müşteriye sunum yaparken kurumun dolu gözükmesini sağlayan, `isMock: true` olarak bayraklanmış ve istendiğinde tek tıkla sıfırlanabilen gerçekçi örnek veriler. ⚠️ **Sonradan düzeltme (2026-09-19):** `isMock` bayrağı hiç var olmadı; ayrım **derleme zamanında** yapılıyor (`educationData.ts` her ihracı `isDemoMode ? demo : []` kalıbında sarıyor, #144). Gerçek modda bu katman **boş dizi**; demo veri kümesi üretim paketinden eleniyor. 🔴 **Ve bunun bir bedeli ölçüldü (`ROADMAP` §4.23 B3):** Genel Bakış ekranları hâlâ bu katmandan besleniyor, yani gerçek kurumda kalıcı olarak `0` gösteriyorlar — kurumlar boşken doğru olan bu davranış, veri girilince yalana döndü (**K-28**). Düzeltmesi `v1.5-22`.

### 🚫 Faz 1 Kapsam Dışı (Non-Goals):

- Karmaşık Auth / Şifreleme (Müşteri görüşmeleri aşamasında gereksiz sürtünmeyi önlemek için)
- n8n / Zapier webhook entegrasyonları
- Otomatik SMS / WhatsApp / E-posta gönderim API'leri
- Online ödeme ağ geçitleri (Iyzico, Stripe vb.)

---

## 2. Ekip Dinamiği & Geliştirme Kültürü

- **Ekip:** 1 Kişi (Arda) — Uçtan uca Full-Stack / Vibe Coding.
- **Kullanılan YZ Araçları:** Claude Code, Codex, Antigravity.
- **Hedef Takvim:** Birkaç gün içinde Vercel üzerinde yayına çıkacak MVP.
- **Bütçe:** 0₺ (Tamamen ücretsiz katmanlar). ⚠️ **Bu kısıt v1.5'te karara açıldı (2026-09-16):** `ROADMAP` §4.12'nin tetikleyici tablosu _"Supabase Pro → ilk gerçek kurum verisi girmeden önce"_ diyor ve ölçüldü — organizasyon planı bugün `free`, yani **otomatik yedek de PITR de yok.** İkisi birlikte doğru olamaz; karar `v1.5-08`'e bağlandı. Pilot, gerçek çocuk verisini geri dönüşü olmayan bir veritabanına koymak demektir.
- **Çalışma Prensibi:** Tek doğruluk kaynağı (`.ai/`), atomik commit'ler, branch bazlı PR ve karşılıklı onay süreci. Kurallar: `CONTRIBUTING.md` ve `AGENTS.md`.
- **Karar Alma İlkesi (Graph-First):** Herhangi bir kod yazılmadan önce problem 6 Boyutlu Graf Haritası (Teknik Tipler/State/DB, Ticari Bütçe, Hata/Fallback, KVKK/Gizlilik, Pik Yük/Darboğaz, Güvenlik) olarak analiz edilir; risk varsa proaktif itiraz (pushback) yapılır.

---

## 3. Kullanıcı Rolleri & Erişim Modeli (RBAC)

1. **Kurum Yöneticisi (admin):** Kurum genel görünümü, tüm sınıflar, tüm öğrenciler, yoklama ve operasyon ayarları.
2. **Öğretmen (teacher):** Kendi sınıfları, ders programı, yoklama alma, öğrenci listeleri.
3. **Öğrenci (student):** Kendi sınıfı, kişisel ders programı, sınav ve ödev görünümü.
4. **Veli (parent):** Bağlı öğrencinin devam durumu, ders programı ve kurum duyuruları.

---

## 4. Teknoloji Yığını (Stack)

> **Sonradan düzeltme (2026-09-16):** Bu listenin sürüm numaraları dört yerde eskimişti (Vite 7.1, TypeScript 5.9, Vitest 2.1, ESLint 9) ve aşağıdakiler **yüklü paketlerden okunarak** düzeltildi. Sebep yapısaldı ve kayda geçiyor: `AGENTS.md`'nin "Belgeyi güncel tutmak" listesinde **bağımlılık/yığın değişikliği için bir satır yok** — yani bu bölümü güncelleyecek bir tetikleyici hiç tanımlanmamıştı. Dependabot sürümleri yükseltiyor, burayı kimse güncellemiyor (**K-06** + **K-21**).

- **Frontend:** Vite 7.3 + React 19.2 + TypeScript 6.0
- **Yönlendirme:** `wouter` (pnpm patch: `patches/wouter@3.7.1.patch`)
- **UI & Stil:** Radix UI + Tailwind CSS v4 + shadcn/ui (`components.json`) + Lucide Icons + Sonner Toast
- **Form / Doğrulama:** `react-hook-form` + `zod`
- **Sunucu State:** `@tanstack/react-query` v5
- **Veri Saklama:** React State + Yerel Kalıcılık (Local Persistence) & bağlı Supabase projesi (Faz 1'de deny-by-default RLS; gerçek veri kullanımı Faz 3'te)
- **Test:** Vitest 5.0 — 67 dosya, **1007 test** (2026-09-18'de koşuldu) + pgTAP **58 dosya, 970 iddia** (259 olumsuz)
- **Kod Kalitesi:** ESLint 10 (flat config) + typescript-eslint + eslint-plugin-react-hooks **v7** (üç yeni kural `error` seviyesinde etkin, 2026-09-09'da açıldı) + eslint-plugin-react-refresh
- **CI/CD & Dağıtım:** GitHub Actions + Vercel (`https://orbit-v3-kappa.vercel.app`)
- **Paket Yöneticisi:** pnpm (v10.4.1)

---

## 5. Klasör Yapısı

```
client/src/
├── components/
│   ├── ui/                 # 53 adet Radix/shadcn UI bileşeni
│   ├── education/          # ORBIT Eğitim Çekirdek Ekranları (rol/sayfa bazlı bölünmüş)
│   │   ├── types.ts          # Student/ClassGroup/ScheduleItem/Automation/PaymentRow
│   │   ├── demoData.ts       # YALNIZ demo verisi — üretim paketinde elenir (#144)
│   │   ├── educationData.ts  # Demo/üretim ayrımının tek kapısı: üretimde boş döner
│   │   ├── shared.tsx        # Badge, StatCard, PageHeader vb. paylaşılan UI parçaları
│   │   ├── LoginScreen.tsx   # EducationLoginScreen
│   │   ├── StudentDetail.tsx # Öğrenci profil çekmecesi
│   │   ├── EducationPlatform.tsx # Kompozisyon kökü (state + localStorage demo kalıcılığı)
│   │   ├── dashboards/       # AdminDashboard, TeacherDashboard, StudentDashboard, ParentDashboard
│   │   ├── guardianChild/    # Veli çocuk seçicisi: üst çubukta, bütün veli sekmelerinde geçerli (#423)
│   │   ├── familyTabLoading.ts # Öğrenci/veli kurum listelerini yalnız ilgili sekmede okur (#441)
│   │   └── pages/            # StudentsPage, ClassesPage, AttendancePage, ... SettingsPage vb.
│   │                         #   SettingsMembersSection + MemberCreateDialog: üye tablosu ve ekleme
│   ├── credentials/        # Giriş fişi: bir kez göster, yazdır. Operatör ve kurum
│   │                       #   yöneticisi aynı bileşeni kullanır; ikinci kopya yok
│   ├── auth/               # AuthShell + SetPasswordScreen, ForgotPasswordScreen,
│   │                       #   ForcePasswordChangeScreen (ilk giriş kilidi), AccountSwitchMenu
│   ├── educationAccess.ts  # Rol bazlı yetki matrisi (RBAC)
│   ├── educationAccess.test.ts # Vitest yetki testleri
│   ├── OrbitMark.tsx       # Logo / Marka bileşeni
│   └── ErrorBoundary.tsx   # React Hata Yakalayıcı
├── auth/                   # Kimlik katmanı — servis modülleri, bileşen değil
│   ├── AuthProvider.tsx    # Oturum, şifre kurtarma ayrıştırması, demo kimliği
│   ├── AuthContext.ts / useAuth.ts  # Context tanımı ve tüketici hook'u
│   ├── authService.ts      # loadMembershipIdentity / loadPlatformOperatorIdentity
│   ├── accountLinkService.ts # Kişi kaydı, bağlama kodu üretme/bağlama, kardeş hesaplar, geçiş
│   ├── types.ts            # AuthIdentity — üyelik ve platform operatörlüğü iki bağımsız eksen
│   ├── loginIdentifier.ts  # Giriş numarası ↔ sentetik adres; giriş ekranına bağlı (E3)
│   ├── passwordPolicy.ts   # Şifre kuralları, Türkçe harflerle uyumlu
│   ├── idleTimeout.ts / useIdleTimeout.ts  # 30 dk hareketsizlik sayacı
│   ├── sessionEvents.ts    # Supabase auth olaylarının ayrıştırılması
│   ├── profileContactService.ts  # İletişim bilgisi ve kurtarma kanalı (E4)
│   ├── deploymentEnvironment.ts  # ⚠️ Üretim/demo ayrımının TEK kaynağı — `vite.config.ts` de
│   │                             #   bunu import eder; karar iki yerde yazılmasın diye (K-06)
│   └── runtime.ts          # isDemoMode — preview derlemeleri demo modundadır

> **Sonradan düzeltme (2026-09-16):** Bu ağaçta **dokuz modül eksikti** — `education/` altında altı (`homeworkService`, `guardianService`, `subjectService`, `classTeacherService`, `feedService`, `dayPlanService`) ve `auth/` altında üç (`sessionEvents`, `profileContactService`, `deploymentEnvironment`). Altısı v1.4'ün kendi dilimleriyle geldi ve `AGENTS.md` bu bölümü **her PR'ın yükümlülüğü** yapmasına rağmen hiçbiri işlenmedi (**K-08**). En kritik eksik `deploymentEnvironment.ts`'ti: sahte verinin kullanıcıya gitmemesini sağlayan kararın tek kaynağı, ve sıfırdan bir oturuma başlayan ajanın "dosyalar nerede" diye baktığı haritada adı geçmiyordu.
>
> 🔴 **Sonradan düzeltme (2026-09-19) — aynı kusur ÜÇÜNCÜ kez:** `lib/` satırında `postgrestLimits.ts` ve `cspConnectSrc.ts` eksikti. İkisi de `v1.5-09`'da (#321) eklendi — yani yukarıdaki düzeltmeden **iki gün sonra**, ve o düzeltmenin kendisi "bir daha olmasın" diye yazılmıştı. İkisi de sıradan yardımcı değil: biri platformun tamamına ait tavanın tek kaynağı, diğeri bir kapının denetleyicisi. Kayıt `ROADMAP` §4.23 B13. **Bu üçüncü tekrar, kuralın kapıya bağlanmadıkça işlemediğini gösteriyor** — `AGENTS.md` bu bölümü her PR'ın yükümlülüğü yapıyor (**K-08**) ve üç kez atlandı; kapı adayı: `client/src/**` altındaki modül sayısı ile bu ağaçtaki satır sayısını karşılaştıran bir dağıtım testi.
├── education/              # Eğitim alanının veri katmanı (v1.3-01) — bileşen değil
│   ├── studentService.ts   # Öğrenci listesi; Student nesnesinin kurulduğu TEK yer (K-06)
│   ├── classService.ts / scheduleService.ts / attendanceService.ts
│   ├── examService.ts / paymentService.ts / reportService.ts
│   ├── homeworkService.ts / homeworkSubmission (v1.4-05, v1.4-15)
│   ├── guardianService.ts  # Veli kaydı ve öğrenci–veli bağı (v1.4-10)
│   ├── subjectService.ts / classTeacherService.ts  # Ders ve öğretmen ataması (v1.4-11)
│   ├── feedService.ts      # Günlük akış (v1.4-12)
│   ├── dayPlanService.ts   # Gün planı: görev ve takvim (v1.4-13)
│   ├── educationQueries.ts # React Query anahtarları ve hook'ları — [alan, kaynak, kapsam]
│   ├── weekDays.ts         # Hafta yedi gün; ISO 1–7 ↔ etiket dönüşümünün tek kaynağı
│   ├── trDate.ts           # Türkçe tarih biçimlendirici + getOrbitToday (takvim gününün tek kaynağı)
│   ├── attendanceStatus.ts # Yoklama durumu eşlemesi
│   ├── turkishSearch.ts    # Türkçe arama: `search_fold` / `turkish_name_key`'in istemci ikizi (#429)
│   └── examAbsenceService.ts # "Sınava girmedi" işareti: koy, geri al (#433)
├── audit/                  # Kurum denetim kaydı
│   ├── auditService.ts     # İmleçli sayfalama; sıra sütunu `id`, `created_at` DEĞİL
│   └── auditQueries.ts     # useInfiniteQuery
├── realtime/               # Kurum kanalı aboneliği (v1.3-05)
│   ├── useOrganizationChannel.ts  # `org:<id>` özel kanalı; tek abonelik, tek yer
│   └── realtimeMapping.ts  # Tablo → sorgu anahtarı eşlemesi (K-06)
├── settings/               # Ayar ekranlarının sorgu katmanı
│   └── settingsQueries.ts  # Üyeler, şubeler, kişi iletişim bilgisi
├── organization/           # Dershane tarafının veri katmanı — kurum yöneticisinin gördüğü
│   └── memberService.ts    # Kurum üyeleri: listeleme, şifre sıfırlama, üye oluşturma, şubeler.
│                           #   Giriş numarası kurulumu ve sıralama saf fonksiyonlarda
├── platform/               # Platform operatörü paneli — dershane ağacından ayrı
│   ├── PlatformShell.tsx   # Kabuk, sekmeler, boş durum
│   ├── tabs.ts             # Sekme tanımları
│   ├── platformService.ts  # Panelin veri katmanı; service_role KULLANMAZ
│   ├── platformQueries.ts  # React Query; platform kapsamı `{ scope: "platform" }`
│   ├── organizationSlug.ts # Kurum adından slug (Türkçe harf çevirisi)
│   ├── PlatformOrganizations.tsx / OrganizationCreateDialog.tsx
│   ├── OrganizationProfileDialog.tsx # Kurum profili ve şifre sıfırlama
│   ├── PlatformOperators.tsx / PlatformAuditLog.tsx
│   └── PlatformErrorReports.tsx # "Hata Kayıtları" sekmesi (#443)
├── errorReporting/         # Ekran hataları kendi veritabanımıza (v1.5-06, #443)
│   ├── scrubErrorText.ts   # Kişisel veri ayıklama — sunucudaki `internal_scrub_error_text` ile aynı kurallar
│   ├── errorReporter.ts    # Aynı mesaj 10 dk'da bir, açılış başına 20 kayıt
│   ├── errorReportService.ts # `report_client_error` / `list_client_error_reports`
│   └── installErrorReporting.ts # `error` + `unhandledrejection` dinleyicileri; demo modunda kapalı
├── contexts/               # ThemeProvider
├── hooks/                  # useComposition
├── lib/                    # supabaseClient, utils, demoStorage (+ test), useDebouncedValue, documents (ÖLÜ KOD)
│   ├── postgrestLimits.ts  # POSTGREST_MAX_ROWS — platform geneli tavan, tek kaynak (v1.5-09)
│   ├── cspConnectSrc.ts    # CSP connect-src ↔ VITE_SUPABASE_URL denetleyicisi; `vite.config.ts` çağırır (v1.5-09)
│   └── pagedRead.ts        # Sayfa sayfa okuma: READ_PAGE_SIZE 500, `*_TOTAL_CAP` tavanları (#435)
└── pages/
    ├── Home.tsx            # Giriş yönlendirici; önce kilit, sonra operatör → /platform
    ├── Platform.tsx        # Platform paneli rotası
    ├── ForgotPassword.tsx  # /sifre-sifirla
    ├── SetPassword.tsx     # /sifre-belirle — Supabase kurtarma bağlantısının hedefi
    └── NotFound.tsx        # 404 sayfası
```

**Repo kökünde, istemci dışında (2026-10-07):** `ops/yedek/` — gece yedeğinin anahtar üretme ve geri yükleme betikleri ile tarifi (`README.md`); görev `.github/workflows/gece-yedegi.yml`. Gizli anahtar repoda **değil** (`AGENTS.md` kısıt 4).

**Bağlayıcı kural — taşınabilirlik:** `components/` ve `pages/` altındaki dosyalar Supabase istemcisini **doğrudan import edemez**; veri erişimi yukarıdaki servis modüllerinden geçer. Kural ESLint ile zorlanır (`eslint.config.js`). Gerekçe: `DECISION_LOG.md` — "Taşınabilirlik sınırı".

**Edge Function'ların ortak katmanı:** `supabase/functions/_shared/` — `http.ts` (origin listesi, CORS, JSON yanıtı), `temporaryPassword.ts` (ömür sabiti ve üretici), `syntheticEmail.ts` (giriş adresi alan adı). Alt çizgiyle başladığı için ayrı bir fonksiyon olarak deploy edilmez. `syntheticEmail.ts`'in istemci tarafında derleyicinin göremediği bir ikizi var: `client/src/auth/loginIdentifier.ts` giriş numarasını bu adresten çözer, dolayısıyla ikisi birlikte değişir.

**Ölçüm tohumu — `supabase/perf/seed_olcum.sql` (eklendi 2026-09-17):** bir dershane-yılı sentetik veri (20 kurum, ~520 bin satır, 205 MB) üreten tek dosya. Kimlikleri `md5(anahtar)::uuid` ile ürettiği için **tekrarlanabilir**: iki koşu aynı kimlikleri verir ve iki `EXPLAIN ANALYZE` çıktısı karşılaştırılabilir kalır. Ölçümleri `ROADMAP` §4.17'de.

🔴 **Bu dosya `config.toml`'daki `[db.seed].sql_paths`'e EKLENMEMELİDİR.** Orada yalnız `./seed.sql` yazıyor ve tohum o globa bilinçli olarak girmiyor: `supabase start` / `db reset` onu yüklerse **CI'daki pgTAP testleri boş veritabanı sayımlarına dayandığı için kırılır**. Tohum elle çalıştırılır (`docker exec -i … psql < …`). 🔴 **Ve `supabase/tests/` altında duramaz:** o klasör pg_prove'un glob'udur, altındaki **her `.sql` dosyası pgTAP testi olarak koşulur** (`.sh` ve `.ts` kardeşleri toplanmadığı için bu görünmüyor). Tohum ilk turda oraya konmuş, `supabase test db` onu test sanıp `No plan found in TAP output` ile düşmüş, ve pg_prove tohumu gerçekten koşturduğu için ardından gelen bütün pgTAP dosyaları kirli veritabanına bakıp kırılmıştı — yani zorunlu kontrol `Tenant RLS` kırmızıya dönerdi. Ölçüm dosyaları bu yüzden `supabase/perf/` altında.

Aynı sebeple dosya `analyze;` ile bitiyor — o satır atlanırsa planlayıcı boş tablo varsayımıyla çalışır ve ölçüm yanlış plan ölçer.

**Eşzamanlılık takımı — `supabase/perf/k6/` (eklendi 2026-09-19):** tohumun ürettiği **veri**nin üzerine bir dershane-saati **yük** bindiren k6 senaryosu ve hesap fabrikası. Tohum giriş yapabilen hesap üretmediği (şifre alanı geçerli bir hash değil) ve 683 jetonu şifreyle almak GoTrue'nun 30/5 dk/IP sınırına takıldığı için jetonlar **testin dışında**, yerel `JWT_SECRET` ile basılıyor. 🔴 **Yalnız yerel; üretime yük basılmaz** ve üretimde bu yol zaten yoktur (`JWT_SECRET` bilinmez). Basılan `jetonlar.json` git'e girmez. Ölçümleri ve yorumlanabilirlik sınırı: klasörün kendi `README.md`'si ve `ROADMAP` §4.23.

**`lib/documents.ts` ölü koddur** — hiçbir yerden çağrılmıyor ve dayandığı `workspace_documents` tablosunda hiç policy yok. "Belgeler" özelliği v1.6'da yeniden ele alınana kadar bu şekilde kalır; bkz. `PLATFORM_SETTINGS.md` kabul edilmiş açıklar. **Bu satır artık bir kapının dayanağı (2026-09-13):** `client/src/lib/deadServiceExports.test.ts` "çağıranı olmayan servis kalamaz" kuralını zorluyor ve `lib/documents.ts` oradaki **tek muafiyet**, gerekçesi olarak buraya işaret ediyor. Muafiyetin kendisi de sınanıyor — dosya kullanılmaya başlandığı gün test kırmızıya döner ve satırın silinmesini ister.

---

## 6. Sıradaki Uygulama Adımları

> **Sonradan düzeltme (2026-08-24):** Bu bölüm v1.0 döneminden kalmıştı ve mock veriye bağlı arayüz işlerini sıralıyordu; o işlerin bir kısmı artık v1.4'e, bir kısmı Faz E5'e ait. Tek doğruluk kaynağı `ROADMAP.md` bölüm 0 (durum tablosu) ve bölüm 4.5 (Faz E) hâline gelmiştir. Aşağıdaki liste oraya işaret eder, kendi sırasını tutmaz.

Güncel sıra **`ROADMAP.md` bölüm 4.5 — Faz E**'dedir:

1. **E0** — Supabase e-posta değişimi spike'ı (kod değil, bulgu teslim edilir).
2. **E1** — Kurum kurma makinesi: `person_code`, `admin.createUser` + geçici şifre, operatörün panele düşmesi.
3. **E2** — Test kurumunun kaldırılması.
4. **E3** — İlk giriş kilidi ve numarayla giriş.
5. **E4** — İletişim bilgisi, e-posta doğrulama ve kurtarma zinciri.
6. **E5** — Mock verinin kaldırılması (eski v1.3'ün tamamı).
7. **E6** — Kurum yöneticisinin kullanıcı ekleme ekranı.
8. **E7** — Uçtan uca doğrulama.

Eski listedeki "sınıf/öğrenci CRUD" ve "yoklama güncellemeleri" maddeleri v1.4'te, `isMock` temizliği E5'te ele alınır.

**Güncelleme (2026-08-29):** Faz E'nin sekiz adımının sekizi de kapandı. Güncel sıra artık `ROADMAP.md` **bölüm 4.6 — Dilimler ve dayandıkları varsayımlar**'dadır. Sıradaki iş **v1.2-01**'dir.

---

## 6.1 Sistem denetimi — 2026-08-29

> Faz E kapanışında, kayıt ile gerçeğin karşılaştırıldığı beş aşamalı bir denetim yapıldı: 82 PR ve 60 issue okundu, canlı şema ve Edge Function'lar envanterlendi, bağlantı matrisi çıkarıldı, güvenlik canlı istekle sınandı, dört rolle production turu koşuldu.
>
> Bu bölüm **o denetimin cevabıdır**: ne inşa edildi, ne eksik, nereden devam edilecek.

### Ne inşa edildi

**Kimlik zinciri uçtan uca çalışıyor.** Platform operatörü kurum açar → varsayılan şube oluşur → kurum yöneticisi giriş numarası ve geçici şifreyle açılır → girer, şifresini değiştirir → kendi öğretmen/öğrenci/velisini açar → hepsi kendi numarasıyla girer → şifre satırdan sıfırlanabilir → her adım denetim kaydı yazar. **Zincirin hiçbir halkasında elle veritabanı müdahalesi gerekmiyor** ve bu production'da doğrulandı (kurum 1003).

**Güvenlik mimarisi sağlam ve tutarlı.** Canlı sisteme istek atılarak ölçüldü:

| Kontrol                    | Sonuç                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `anon` → 8 tablonun tamamı | `401 / 42501` — yetki düzeyinde red, RLS'e sıra gelmiyor                                      |
| `anon` → RPC               | `current_user_*` 401 · `internal_*` **404, keşfedilemiyor**                                   |
| Kayıt olma (signup)        | `422 signup_disabled`                                                                         |
| Edge Function ×5           | Kimliksiz çağrıda 401                                                                         |
| Güvenlik başlıkları        | Altısı da yerinde (CSP, HSTS 2 yıl + preload, `X-Frame-Options: DENY`, …)                     |
| Sütun yetkileri            | `recovery_email`, `must_change_password`, `password_expires_at` → kullanıcı **okur, yazamaz** |
| Sır taraması               | Depo, git geçmişi ve **canlı paket** temiz                                                    |
| pgTAP                      | 13 dosya, **135 iddia**, beşi kurumlar arası negatif test                                     |
| Depo ↔ production          | 18/18 migration, 5/5 fonksiyon — **sıfır ayrışma**                                            |

**Sızma, ihlal veya yetki yükseltme yolu bulunmadı.** v1.1.1 denetiminde tespit edilen yükseltme yolu iki bacağından da ölü.

**Yazma mimarisi bilinçli ve tek biçimli:** 11 RLS politikasının 10'u SELECT; tek yazma politikası `profiles_update_self`. Diğer bütün yazmalar `service_role` üzerinden Edge Function ve `internal_*` RPC'lerle geçiyor, yetki kararları SQL'de yaşıyor ve pgTAP ile sabitleniyor.

### Ne eksik

**Eğitim alanı bir kabuk.** Ölçüm net:

```
40 eğitim bileşeni      →  3'ü veritabanına ulaşıyor
educationData.ts        →  Supabase import sayısı: 0
İş tabloları            →  students, classes, attendance, exams, payments,
                           student_guardians, homework, schedule → HİÇBİRİ YOK
```

Üretimde eğitim paneli veritabanına **boş dönmüyor — hiç sormuyor.** Her ihraç `isDemoMode ? demo… : boş` kalıbında sabitlenmiş.

**Sonradan düzeltme (2026-09-04):** Yukarıdaki "İş tabloları → HİÇBİRİ YOK" satırı ve aşağıdaki bağlantı matrisinin son satırı, denetim gününün doğru fotoğrafıdır ama **artık güncel değildir.** v1.2-01 `students` ve `guardians` tablolarını ekledi: Öğrenci satırının "Tablo" sütunu ✅, "Yazma" sütunu ✅ oldu; Servis ve Ekran ❌ olarak duruyor — dilimin sınırı bilinçli olarak tablo + RLS + test'ti. Diğer varlıklar (Sınıf, Program, Yoklama, Sınav, Ödev, Ödeme, Mesaj, Gün planı, Otomasyon) satırı olduğu gibi geçerli.

**İkinci düzeltme (2026-09-04, v1.2-02):** `classes`, `class_enrollments`, `subjects` ve `class_teachers` de eklendi. Bağlantı matrisinde **Sınıf** satırının "Tablo" ve "Yazma" sütunları da ✅ oldu; Servis ve Ekran ❌ olarak duruyor. Öğretmen ilk kez gerçek bir kapsam kazandı — ama yalnızca veritabanında: ekranlar hâlâ `scopeFilters.ts`'ten besleniyor ve üretimde boş küme dönüyor. Ekranların bu tablolara bağlanması **v1.2-10**'dur.

Aynı düzeltme "**Yazma mimarisi bilinçli ve tek biçimli**" paragrafını da kapsıyor: `authenticated` rolü artık **on dokuz** tabloya yazabiliyor (biri eskiden beri `profiles`) ve toplam RLS politika sayısı 11'den **97**'ye çıktı — 2026-09-05'te v1.2-09 sonrası yerel veritabanından sayıldı. Dört rolün dördünün de kapsamı veritabanında kurulu: yönetici **kurumdan**, öğretmen **atamadan**, öğrenci **kendi kaydından**, veli **bağdan**.

**Üçüncü düzeltme (2026-09-04, v1.2-04):** `attendance_sessions` ve `attendance_records` eklendi; matriste **Yoklama** satırının "Tablo" ve "Yazma" sütunları ✅ oldu. Bu dilimle birlikte **öğretmen ilk kez yazabiliyor** — ve yetkisi rolünden değil sınıf atamasından geliyor. Denetim kaydının veri tarafındaki ilk parçası da burada: `recorded_by_membership_id` trigger ile çağıranın kimliğinden doldurulur, istemci yazamaz. Yetki kararı hâlâ SQL'de yaşıyor — değişen, isteğin oraya hangi yoldan gittiği. Gerekçe: `DECISION_LOG.md` — "İş verisi RLS ile yazılır, kimlik işlemleri Edge Function'da kalır".

**Dördüncü düzeltme (2026-09-04, v1.2-05):** `exams` ve `exam_results` eklendi; matriste **Sınav** satırının "Tablo" ve "Yazma" sütunları ✅ oldu. Bu dilim ayrıca sistemdeki **ilk sütun maskeleme** mekanizmasını getirdi: `exam_ranking()` yetkiyi satır bazında çözüp isim ve kimliği maskeliyor. RLS'in yapamadığı bir işi yaptığı için tablo politikalarının yerine geçmiyor, yanında duruyor — tabloyu doğrudan okuyan hâlâ yalnızca görme yetkisi olan satırları alır.

**Beşinci düzeltme (2026-09-04, v1.2-06):** `payment_plans` ve `installments` eklendi; matriste **Ödeme** satırının "Tablo" ve "Yazma" sütunları ✅ oldu. Bu dilim kapsamın **daraldığı** ilk yer: öğretmen ve öğrenci ödeme verisine hiç erişemiyor. Ölçülebilir hâli — ödeme tablolarının politikalarında `teaches` geçen **sıfır** ifade var. Ayrıca şemada kart/IBAN/jeton kalıbına uyan sıfır sütun var ve bu dilim de eklemedi.

**Altıncı düzeltme (2026-09-05, v1.2-07):** `schedule_entries` eklendi; matriste **Program** satırının "Tablo" ve "Yazma" sütunları ✅ oldu. Bu dilim ayrıca istemciyi veritabanının gerisinde bıraktı: veritabanı haftanın yedi gününü kabul ediyor, istemcideki `WeekDay` tipi beş gün taşıyor. Kayıt `ROADMAP.md` §4.6'da.

**Yedinci düzeltme (2026-09-05, v1.2-08):** `homework_assignments` eklendi; matriste **Ödev** satırının "Tablo" ve "Yazma" sütunları ✅ oldu. Bu dilimin açılışında `HomeworkCreateDialog`'un üretimde **gerçekleşmemiş bir kaydı başarılı gösterdiği** bulundu ve aynı PR'da düzeltildi; kalıp **K-14** olarak kurallara eklendi.

**Sekizinci düzeltme (2026-09-05, v1.2-09):** `daily_feed_posts`, `tasks` ve `calendar_events` eklendi; matriste **Mesaj** ve **Gün planı** satırlarının "Tablo" ve "Yazma" sütunları ✅ oldu. Bu dilim, **kurum yöneticisinin göremediği ilk tabloları** getirdi: kişisel çalışma alanı kurumun değil kişinindir. Ölçülebilir hâli — `tasks` ve `calendar_events` politikalarında `admin` geçen sıfır ifade var. Böylece **v1.2'nin tablo işi bitti**; kalan üç dilim (10, 11, 12) tablo değil bağlantı, tarama ve ekran işidir.

**Dokuzuncu düzeltme (2026-09-05, v1.2-10):** Kapsam istemciden veritabanına taşındı. `scopeFilters.ts` artık bir **güvenlik sınırı değil** — sınır RLS; oradaki filtreler yalnızca demo modunda çalışıyor. "Üretimde boş küme" ifadesi bu belgede ve `scopeFilters.ts` başlığında geçtiği her yerde geçersizdir. Bağlantı matrisi değişmedi: **Servis** ve **Ekran** sütunları hâlâ ❌ ve bunlar v1.3-01'in işi.

**Onuncu düzeltme (2026-09-05, v1.2-11):** Zorunlu şifre değişimi kilidi artık **yalnızca istemcide değil**. 98 RLS politikasının **92'si** koşulu taşıyor; muaf kalan altısı kimlik okumasıdır ve muafiyet kümesi pgTAP ile sabitlenmiştir. `PLATFORM_SETTINGS.md` §5'teki "kilit yalnızca istemcide" değerlendirmesi bu tarihten itibaren geçersizdir.

**On birinci düzeltme (2026-09-05, v1.2-12) — ve v1.2'nin kapanışı:** Kurum denetim kaydı ekranı eklendi (#149). Bu, eğitim panelindeki **ilk gerçek sorgu ekranı**: diğer sayfalar hâlâ `educationData.ts`'ten besleniyor ve üretimde boş, bu sayfa doğrudan veritabanını okuyor. Dolayısıyla "Ne eksik" bölümündeki "40 eğitim bileşeni → 3'ü veritabanına ulaşıyor" ölçümü de artık dörttür. Yükleniyor/hata/boş durumları burada gerçek — v1.2'nin "Loading ve error durumları" maddesinin ilk somut karşılığı.

🔴 **On ikinci düzeltme (2026-09-05, bütünlük denetimi) — sistemin durumu hakkında en önemli tek cümle:** **Kimlik zinciri ile akademik kayıt zinciri birbirine bağlı değil.** `internal_create_membership` tam olarak üç tabloya yazıyor — `profiles`, `organization_memberships`, `audit_events` — ve başka hiçbirine. Yani rolü `student` veya `parent` olan bir üyelik açıldığında ortada bir `students` veya `guardians` satırı **yok**, dolayısıyla o tabloların `auth_user_id` sütunları **hiç dolmuyor**.

Bu, aşağıdaki bağlantı matrisinin okunuşunu değiştirir: **tablo, RLS ve servis sütunları dolu olsa bile öğrenci ve veli için sonuç boş ekrandır.** Kapsam sorgularının tamamı (`current_user_guards_student`, öğrencinin kendi kaydı, yoklama görünürlüğü) tek bir koşula bakıyor — `auth_user_id = (select auth.uid())` — ve o koşul bugün hiçbir satırda sağlanamaz.

Ölçüm yöntemi kayda değer: eksiklik testlerde görünmedi, çünkü **dokuz pgTAP dosyası `auth_user_id`'yi fixture'da kendisi dolduruyor.** Testler doğru soruyu soruyor ("bağlı veli çocuğunu görebilir mi?") ama üretimde o bağı **kimsenin kurmadığını** soramaz — bir birim testinin değil, bir zincir denetiminin işi.

**Canlı ölçüm (2026-09-05):** `organization_memberships`'te rolü `student` veya `parent` olan **2 üyelik** var; `students` **0** satır, `guardians` **0** satır, `student_guardians` **0** satır. Yani üretimde giriş hesabı olan iki kişinin akademik karşılığı bugün **yok**. Boşluk gelecekte açılacak değil, **açılmış** durumda. Sahibi **v1.4-00**; ayrıntı `ROADMAP.md` **§4.7**.

**Bağlantı matrisi** — hangi varlığın hangi katmanı var:

| Varlık                                                        | Tablo  |  Servis  | Ekran |    Yazma     |
| ------------------------------------------------------------- | :----: | :------: | :---: | :----------: |
| Kurum · Şube · Üyelik · Profil · Operatör · Platform denetimi |   ✅   |    ✅    |  ✅   |  ✅ / kısmi  |
| Kurum denetim kaydı                                           |   ✅   |    ❌    |  ❌   | ✅ yazılıyor |
| Öğrenci · Sınıf · Yoklama · Sınav · Ödev · Ödeme              |   ✅   |    ✅    |  ✅   |      ✅      |
| Program                                                       |   ✅   | ✅ okuma |  ✅   |      ❌      |
| Mesaj · Gün planı                                             |   ✅   |    ❌    |  ✅   |      ❌      |
| Otomasyon                                                     |   ❌   |    ❌    |  ✅   |      ❌      |
| Veli · Veli–öğrenci bağı                                      |   ✅   |    ✅    |  ✅   |      ✅      |
| Öğretmen–sınıf ataması                                        |   ✅   |    ❌    |  ❌   |      ❌      |
| Belge (`workspace_documents`)                                 | ☠️ ölü |  ☠️ ölü  |  ❌   |      ❌      |

**On üçüncü düzeltme (2026-09-11, v1.4-01 … v1.4-04):** Yukarıdaki matris **v1.4 boyunca dört kez eskidi ve bu turda toplu olarak düzeltildi.** Eskiden tek bir satır on varlığı birden "❌ ❌ ✅ ❌" diye anlatıyordu; bugün o on varlık **dört farklı durumda** ve tek satırda tutmak K-06'nın tam olarak uyardığı şeydi.

Ölçülerek yazıldı, iddiaya bakılmadı: `public` şemasında 27 tablo var (canlı sorgu, 2026-09-11) ve `client/src/education/` altındaki altı servisin hangisinin yazdığı `.insert(` / `.update(` / `.rpc(` sayımıyla ayrıldı. `scheduleService` ve `paymentService` **yalnız okuyor** — içlerindeki tek tük `.rpc(` çağrıları `class_staff_names`, `payment_plan_summaries`, `student_payment_summaries` ve `payment_overview_counts`, hepsi okuma.

Dört varlık v1.4'te uçtan uca bağlandı — **Öğrenci** (v1.4-01), **Sınıf** (v1.4-02), **Yoklama** (v1.4-03) ve **Sınav** (v1.4-04). Bunların ekranı artık `educationData.ts`'ten değil veritabanından besleniyor ve **yazma da gerçek**: yoklama ve sınav sonucu birer RPC ile (`record_attendance`, `record_exam_results`), öğrenci ve sınıf doğrudan tablo yazımıyla.

⚠️ **"Ekran ✅" hâlâ ekranın doğru şeyi gösterdiği anlamına gelmiyor** — yalnız bir ekranın var olduğunu söylüyor. **Otomasyon** satırının tablosu yok ve ekranı duruyor; bu bir eksiklik değil, kapsam kararıdır (`ROADMAP.md` §5 — otomasyon ayrı bir roadmap kararına bağlı).

**On dördüncü düzeltme (2026-09-11, v1.4-05):** **Ödev** satırı ayrıldı; "Servis" ve "Yazma" sütunları ✅ oldu. `homeworkService` geldi ve ekran `educationData.ts` yerine gerçek sorgudan besleniyor.

Bu dilimin kaydı, eklediğinden çok **kaldırdığı** için düşülüyor: `HomeworkStatus`'tan `"Tamamlandı"`, `Student` tipinden `homework` (`"7/9"` teslim oranı) ve rapor ekranından "Ödev tamamlama" kartı silindi. Sebep matrisin kendisinde görünüyor — ödev teslimi için **tablo yok**, dolayısıyla o üç öğe bir veriyi değil bir **beklentiyi** gösteriyordu. Teslim takibi **v1.4-15**'te açılacak (`DECISION_LOG`); o gün bu satırın hiçbir sütunu değişmeyecek ama **yeni bir satır** eklenecek.

⚠️ Böylece v1.4'ün CRUD dilimleri bitti: matriste "Servis ✅ + Yazma ✅" taşıyan beş varlık var (Öğrenci, Sınıf, Yoklama, Sınav, Ödev). **Program ve Ödeme hâlâ yalnız okuma** — ödeme kurallarının kaynağı yok (#239) ve o karar verilmeden yazma açılamaz.

**v1.4-11 düzeltmesi (2026-09-13):** **Program** satırı da yazma grubuna geçti (#287) ve matrise **Ders (`subjects`)** ile **Öğretmen ataması (`class_teachers`)** girdi. Üçünün de yazma yüzeyi (politika + **sütun yetkileri**) şemada zaten hazırdı; eksik olan ekrandı ve `subjects`'in denetim izi.

⚠️ Dersin üretimde **0 satırı** vardı ve onu yaratan hiçbir yol yoktu; `class_teachers.subject_id` NOT NULL olduğu için öğretmen ataması da imkânsızdı. Bu yüzden ders CRUD ayrı bir dilim değil, bu dilimin parçası oldu (`DECISION_LOG`).

**v1.4 ara denetimi düzeltmesi (2026-09-13):** Yukarıdaki _"**Sınav** (v1.4-04) uçtan uca bağlandı"_ cümlesi **eksikti**. Sınav **sonucu** girişi gerçekten bağlıydı; sınavın kendisini **düzenlemek ve arşivlemek** bağlı değildi — `updateExam` ve `archiveExam` yazılmış, sınanmış ve hiçbir yerden çağrılmamıştı. Üstelik ekran yeni sınav oluşturulduğunda kullanıcının az önce yazdığı adı, tarihi ve tam puanı değil `"Yeni Sınav"`, bugünün tarihi ve boş puan gösteriyordu (**K-03**). İkisi de denetimde kapandı. **"Ekran ✅" satırının yukarıdaki uyarısının somut örneği budur.**

**On altıncı düzeltme (2026-09-12, v1.4-06):** **Ödeme** satırı yazma grubuna geçti; "Servis" ve "Yazma" sütunları ✅ oldu. Yazma yüzeyi v1.2-06'dan beri açıktı, eksik olan ekrandı.

Bu dilim bir eksiği de kapattı: `installments`'ta `archived_at` yoktu, yani **yanlış girilmiş bir taksiti kaldırmanın hiçbir yolu yoktu** ve planın toplamı kalıcı olarak yanlış kalıyordu (`DECISION_LOG`).

⚠️ **Geriye tek bir okuma-satırı kaldı: Program.** `schedule_entries` tablosu ve RLS'i v1.2-07'den beri duruyor, `scheduleService` okuyor, yazan ekran yok — karşılığı **v1.4-11** (ders programı ve derslik). Yani v1.4'ün CRUD işinde yazma açılmayan tek varlık program.

**On beşinci düzeltme (2026-09-12, v1.4-10):** **Veli** ve **veli–öğrenci bağı** ayrı bir satır oldu ve dört sütunu da ✅. Bu, matrisin en uzun süredir dolmayan satırıydı ve `guardians` tablosu v1.2-03'ten beri duruyordu.

Ölçülerek yazıldı: dilim açılırken `guardians` tablosuna yazan **0** veritabanı fonksiyonu, **0** istemci kodu vardı ve üretimde **0** satır. v1.4-00 dört RPC yazmıştı ama ikisi (`link_guardian_account`, `unlink_guardian_account`) hiç çağrılmıyordu — bağlanacak kayıt olmadığı için. Bu dilim o zinciri kapattı.

⚠️ **Aşağıdaki paragrafın "son iki satır" ifadesi bu düzeltmeyle güncellendi.** Kapsamın kaynağı artık yalnız **öğretmen–sınıf ataması** ve **belge** satırlarıdır; veli–öğrenci bağı o gruptan çıktı. `class_teachers` tablosu var ve RLS'i kurulu (v1.2-02) ama onu yazan ekran yok — karşılığı **v1.4-11**.

Kapsam artık yalnız **öğretmen–sınıf ataması** satırından eksik: tablosu var, yazan ekranı yok. E7.2-B2'de yedi filtrenin üretimde boş küme dönmesinin sebebi bu gruptu ve grup bir satıra indi.

### Yapısal borçlar

Denetimin ortaya çıkardığı, tek bir issue'ya sığmayan üç kalıp:

1. **Koşullu kararların sahibi yok.** PR #81 bunu adıyla tarif etmiş ama mekanizma kurulmamıştı; üç canlı örnek bulundu (KVKK/Frankfurt, SMTP terki, dal koruması). → **K-12**
2. **Kararların zemini sessizce kayıyor.** Hesap geçişi kararı `localStorage` dünyasında yazıldı, E7.2-A zemini değiştirdi, karar bunu bilmiyordu. → **K-11**
3. **Dilimler doğrulanmamış varsayımlarla başlıyor.** `create-member` deploy edilmiş sanılarak arayüz yazıldı; kapsam iki dosyada sanılırken yedi çıktı. → **K-10**

Üçü de `AGENT_WORKFLOW.md`'ye birikimli kural olarak yazıldı; `ROADMAP.md` bölüm 4.6 bunları dilim başına varsayım beyanına bağlar.

### Nereden devam edilecek

**Açık issue'lar:** #118 (kurtarma, sağlayıcı bekliyor) · #144–#151 (denetim bulguları).

**Sıra:** #143 (zaman aşımı yenilemeyle aşılıyor) **2026-08-29'da kapandı** — çalışmayan bir koruma, korumasızlıktan kötüdür. Sıradaki kapı **#150**: dolu kurumun silinmesi engellenmeden `ROADMAP.md` 4.6'daki **v1.2-01** açılmaz.

**Pilot öncesi kapatılması zorunlu, koda bağlı olmayan iki kapı:** KVKK/Frankfurt kararı ve e-posta sağlayıcısı. İkisi de **bugün sahipsiz** ve ikisi de "ilk gerçek kurum" şartına bağlı — yani tetiklenmelerine az kaldı.

---

## 7. v1.1 Auth ve Tenant Temeli (Issue #8)

**Durum: tamamlandı (2026-08-25).** PR #9 merge edildi; migration ve `bootstrap-organization` Edge Function production Supabase'e deploy edildi. İlk tenant Edge Function akışıyla değil, kontrol düzleminden doğrudan RPC ile oluşturulmuştu; onboarding mekanizması uzun süre doğrulanmadan kaldı. Faz E1 mekanizmayı yeniden yazdı ve panel üzerinden kurum kurma production'da çalıştı; E2'de o ilk tenant silindi. Kalan işler v1.1.1, v1.1.2 ve Faz E'ye dağıtıldı (bkz. `ROADMAP.md` §0).

> **Sonradan düzeltme (2026-08-25):** Bu bölüm aynı gün `ROADMAP.md` §0'da v1.1 ✅ yapılırken güncellenmedi ve iki dosya birbiriyle çelişir hâlde kaldı. Codex'in A1 analizinde bulundu (Issue #80, B10). Ders kayda geçti: **durum iki yerde tutuluyorsa biri mutlaka eskir** — bu yüzden tek durum kaynağı `ROADMAP.md` §0'dır ve bu bölüm yalnızca oraya bakar.

> **Sonradan düzeltme (2026-08-24):** Bu paragraf önceden _"kurucu yöneticinin e-posta/şifre girişi çalışmıyor ve UI'da şifre belirleme ekranı yok"_ diyordu. **İkisi de çözüldü:** şifre belirleme/sıfırlama ekranları production'da (`/sifre-sifirla`, `/sifre-belirle`, Issue #25) ve kurucu yönetici kendi şifresiyle giriş yapıyor. Giriş çalışmamasının kök nedeni Auth panelinde e-posta sağlayıcısının kapalı olmasıydı; Issue #29'da bulunup açıldı.
>
> Gate'in o gün kapanmamış olmasının sebebi farklıydı: kurum yöneticisi hesabının **davetle** açılması öngörülüyordu ve `type=invite` istemcide hiç ele alınmıyordu. **Faz E1 bu yolu tamamen kaldırdı ve gate kapandı** — hesaplar artık giriş numarası ve geçici şifreyle açılıyor.

- Kimlik doğrulama production'da Supabase Auth e-posta/şifre oturumuyla çalışır. Rol istemciden alınmaz; aktif `organization_memberships` kaydından çözülür.
- Local geliştirme ve Vercel Preview derlemeleri demo modundadır. Vercel Production derlemesinde rol geçişi gizlenir ve demo şifresi kabul edilmez.
- Tenant çekirdeği `profiles`, `organizations`, `branches`, `organization_memberships` ve `audit_events` tablolarından oluşur.
- Organizasyon yöneticisi org-wide üyelik taşır; aktif ekran bağlamı varsayılan şubeden başlar. Şube sınırlı üyelikler yalnızca kendi şubesini görür.
- İlk kurum, varsayılan şube ve kurum yöneticisi `bootstrap-organization` Edge Function üzerinden hazırlanır. Operatör kontrolü **`platform_operators` tablosuna taşındı** (Issue #37, production'da v17 olarak canlı); `app_metadata.platform_admin` bayrağı artık kullanılmıyor. Aktif bir operatör kaydı bulunduğu için fonksiyon çağrılabilir durumdadır. **Faz E1'de davet yerine `admin.createUser` + geçici şifre kullanacak biçimde değiştirildi**; `inviteUserByEmail` yolu kaldırıldı.
- Tarayıcıya yalnızca anon key verilir. `service_role` yalnızca Supabase Edge Function sunucu ortamında kullanılır.
- RLS istemci yazılarını deny-by-default bırakır; üyeler yalnızca kendi tenant kapsamlarını, adminler ise yetkili audit kapsamını okuyabilir.
- İlk tenant için `orbitdershane` / `orbit123` kararı verildi. İlk denemede `yonetici@orbit.edu.tr` adresi `email_address_invalid` ile reddedildi ve yarım kayıt oluşmadı; ardından kurum kurucu ekip üyesinin hesabıyla kuruldu. Bu kayıt **test verisi** sayılıyordu. **Sonradan düzeltme (2026-08-25):** Faz E2'de silindi; kurum, şubesi, üyeliği ve denetim kayıtları artık yok. Silme sırasında bir tasarım hatası da ortaya çıktı — kurum silmek, o kurumun tek üyesi olan kişinin platform operatörlüğünü de düşürüyordu. Düzeltildi (Issue #63): bir kimlik, başka bir yer onu sahiplenmiyorsa silinir. Bkz. `DECISION_LOG.md`.
- v1.2 iş tabloları ve v1.3 mock temizliği bu dalın bilinçli kapsamı dışındadır.

### Şifre belirleme ve sıfırlama akışı (Issue #25)

- Giriş ekranındaki "Şifremi unuttum" bağlantısı `/sifre-sifirla` adresine gider; oradan Supabase şifre sıfırlama e-postası tetiklenir. Hesabın kayıtlı olup olmadığı sızdırılmaz, her durumda aynı onay mesajı gösterilir.
- E-postadaki bağlantı `/sifre-belirle` adresine döner. Bu değer Supabase Redirect URL listesiyle uyumlu olmalıdır; liste `PLATFORM_SETTINGS.md` bölüm 3.2'de kayıtlıdır.
- **Şifre sıfırlama bağlantısı da geçerli bir Supabase oturumu açar.** Bu nedenle `PASSWORD_RECOVERY` olayı normal girişten ayrıştırılır ve kullanıcı panele alınmaz; aksi halde şifresini hiç belirleyemeden içeri girerdi. Bayrak, şifre belirlenene veya vazgeçilene kadar kalıcıdır.
- Yeni şifre kaydedildikten sonra oturum kapatılır ve kullanıcı yeni şifresiyle giriş yapar. Bu bilinçli bir karardır: akışın amacı şifrenin gerçekten çalıştığını doğrulamaktır.
- Şifre politikası istemcide de doğrulanır (minimum 8 karakter, küçük harf + büyük harf + rakam) ancak kaynak doğruluk sunucudadır. Politika panelden değiştirilirse `client/src/auth/passwordPolicy.ts` ve testleri güncellenmelidir.
- Akış demo modunda (yerel geliştirme ve Vercel Preview) kapalıdır.

---

## 8. Platform Sahipliği ve Production Bağlantıları (Issue #14)

**Durum:** Tamamlandı. Supabase sahiplik transferi ve production bağlantıları doğrulandı; Arda `ORBIT Platform` Owner davetini kabul etti.

- Production Supabase projesi `orbit-dershane`, silinmeden ve proje kimliği değiştirilmeden Hamza'nın sahibi olduğu `ORBIT Platform` organizasyonuna transfer edildi.
- Transfer sonrasında Auth kullanıcısı, profil, kurum, şube, üyelik ve audit kayıt sayıları kaynak envanteriyle eşleşti; `workspace_documents` ve Storage nesne sayıları sıfır kaldı.
- Hamza ve Arda `ORBIT Platform` organizasyonunda Owner'dır.
- `ardabulent/orbit_v3` GitHub production entegrasyonu repo kökü, `main` branch'i ve production migration uygulamasıyla yeniden etkinleştirildi.
- Vercel `orbit-v3` projesi Hamza'nın Owner olduğu `ORBİT` Hobby takımındadır. Production adresi `https://orbit-v3-kappa.vercel.app` ve deployment durumu `Ready` olarak doğrulandı.
- Vercel'deki `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` tüm ortamlarda korunmuştur. Proje kimliği ve API anahtarları transferde değişmediği için uygulama bağlantısı kesilmedi.
- Least-privilege gereği Vercel Marketplace Supabase kurulumu yapılmaması kararlaştırılmıştı. **Bu karar korunmadı:** Vercel `orbit-v3` projesine `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY`, `POSTGRES_PASSWORD` ve `POSTGRES_URL` türevleri dahil 16 sunucu değişkeni eklendi. Bu değerlerin production istemci bundle'ına sızmadığı doğrulandı (Vite yalnızca `VITE_` önekli değişkenleri istemciye açar) ve hassas olanlar Vercel'de `Sensitive` işaretli olduğu için API üzerinden geri okunamıyor. Kalan risk build ortamıdır; uygulamanın ihtiyaç duymadığı bu değişkenlerin temizliği v1.1.1 kapsamındadır.
- Uygulamanın gerçekten kullandığı değişkenler yalnızca `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY`'dir. `NEXT_PUBLIC_` önekli değişkenler bu Vite projesinde hiçbir kod tarafından okunmaz.

---

## 9. Platform Operatörü Ekseni ve `/platform` Paneli (Issue #16, hedef v1.1.2)

**Durum: tamamlandı.** Veritabanı şeması (Issue #27), Edge Function operatör kontrolü (#37), kimliğin iki eksene ayrılması (#40) ve panelin kendisi — kurum listesi, kurum oluşturma, operatör listesi, denetim kaydı (#41) — hepsi production'da. Ayrıntılı gerekçe için bkz. `DECISION_LOG.md` — "Platform operatörü ayrı bir eksendir".

> **Sonradan düzeltme (2026-08-25):** Bu satır uzun süre _"panel ve Edge Function güncellemesi bekliyor"_ diyordu; ikisi de 2026-08-24'te bitmişti. Codex'in A1 analizinde bulundu (Issue #80, B11).

Sistemde iki bağımsız kimlik ekseni bulunur. Bir kullanıcı ikisinden birine, hiçbirine veya (teoride) her ikisine de ait olabilir:

```
auth.users
  ├─→ organization_memberships   → kurum içi rol (app_role)      → /          dershane paneli
  └─→ platform_operators         → platform ekseni               → /platform  yönetim paneli
```

- **`app_role` enum'u (`admin`, `teacher`, `student`, `parent`) genişletilmez.** Bu roller her zaman bir kuruma bağlıdır; platform operatörü hiçbir kuruma ait değildir.
- Operatör kaydının tek doğruluk kaynağı `platform_operators` tablosudur. `auth.users.app_metadata` üzerinde bayrak tutulmaz. Yetki kontrolü, `current_user_has_membership()` ile aynı desende yazılacak `current_user_is_platform_operator()` security-definer fonksiyonu ile yapılır.
- Panel `client/src/platform/` altında kendi bileşen ağacıyla yaşar. `client/src/components/education/` ağacına dokunulmaz (dosya başına tek sorumluluk kuralı; bkz. `AGENTS.md`).
- Yetkilendirme her zaman sunucudadır. Rota koruması yalnızca kullanıcı deneyimi içindir; her platform işlemi operatör kontrolünü sunucuda yapan bir Edge Function üzerinden yürür.
- **Kapsam kabı ile sınırlıdır:** kurum, şube, kurum yöneticisi hesabı ve operatör listesi yönetilir. Öğrenci, not, yoklama, ödev ve ödeme verisine erişim yoktur — bu, mevcut RLS politikalarının doğal sonucudur ve "platform operatörü her şeyi okur" türünde bir policy eklenmeyecektir.
- Kuruma bağlı olmayan platform işlemleri `platform_audit_events` tablosuna yazılır; `audit_events.organization_id` NOT NULL olduğu için o tablo kullanılamaz.
- Şemadaki roller `owner` ve `operator`, durumlar `active` ve `suspended`'dır. Yalnızca `active` operatörler yetkili sayılır.
- `platform_operators` ve `platform_audit_events` tablolarına **istemciden yazma yolu yoktur**; ekleme ve denetim kaydı üretme yalnızca `service_role` ile çalışan Edge Function üzerinden yapılır. Aksi halde bir operatör kendi yetkisini yükseltebilir veya sahte denetim kaydı üretebilirdi.
- Operatörün kurum içeriğine erişemediği `supabase/tests/database/platform_operators.test.sql` içinde üç ayrı testle doğrulanır. Bu, KVKK gerekçesiyle verilen taahhüdün çalıştırılabilir karşılığıdır ve ileride sessizce gevşetilirse CI'da kırılır.
- İlk operatör hesapları, panel kendi kendini oluşturamayacağı için bir defaya mahsus kontrollü biçimde eklenir. Bu, "kayıtlar elle oluşturulmaz" kuralının tek tanımlı istisnasıdır.

---

## 10. Kurum Kurulum İş Akışı (uçtan uca)

Kararların gerekçeleri için bkz. `DECISION_LOG.md` — "Kimlik ve Giriş Bilgisi Mimarisi".

### Adım adım

> **Sonradan düzeltme (2026-08-24):** Aşağıdaki 1., 2. ve 5. adımlar davet e-postası akışını anlatıyordu. **Davet akışı kaldırılmıştır.** Güncel hâl bu blokta; gerekçe için bkz. `DECISION_LOG.md` — "Hesaplar davet e-postasıyla değil, doğrudan geçici şifreyle açılır".

1. **Platform operatörü kurumu oluşturur.** Panel; kurumu, varsayılan şubeyi, kurum kodunu (1000'den otomatik artan) ve kurum yöneticisi hesabını üretir. **E-posta sorulmaz**; yönetici de herkes gibi giriş numarası ve geçici şifreyle açılır.
2. **Yönetici ilk girişte şifresini değiştirir ve e-postasını doğrular.** Şifre değiştirilmeden hiçbir ekrana gidilemez. E-posta doğrulaması kurum yöneticisi için **zorunludur** — kendi kurumundaki herkesin kurtarma kanalı odur.
3. **Yönetici sınıfları oluşturur.** Öğrenciler sınıfa atanacağı için bu adım öğrenci aktarımından önce gelmek zorundadır.
4. **Yönetici öğretmen ve öğrencileri içe aktarır.** Panelden indirilen şablon doldurulur, yüklenir, önce doğrulama önizlemesi gösterilir, onaydan sonra kayıt yapılır.
5. **Sistem giriş bilgilerini üretir.** Giriş hesabı açılan herkese 8 haneli kişi numarası ve kişiye özel geçici şifre üretilir. E-posta ve telefon toplanır ancak giriş için kullanılmaz; kurtarma içindir ve öğretmen/öğrenci/veli için isteğe bağlıdır.
6. **Yönetici yazdırılabilir listeyi bir kez indirir** ve dağıtır.
7. **Kullanıcılar ilk girişte şifrelerini değiştirir.**

### Bağlayıcı kurallar

- **Platform operatörü, ürün üzerinden kurum içeriğini okuyamaz — ancak kimlik bilgisi üreterek yetki yükseltebilir.**

  > **Sonradan düzeltme (2026-08-24):** Bu madde önceden _"Platform operatörü kurum yöneticisinin şifresini bilmez"_ diyordu ve gerekçesi, yöneticinin şifresini davet bağlantısıyla kendisinin belirlemesiydi. Davet akışı kaldırıldığı için **operatör artık geçici şifreyi görüyor** ve eski ifade doğru değil.
  >
  > Daha önemlisi, eski ifade davet akışıyla bile tam doğru değildi: operatör kurum yöneticisinin şifresini her zaman **sıfırlayabilir** — kurtarma zincirinin son halkası budur ve tasarım gereği vardır. Yani yetki yükseltme imkânı geçici şifreden değil, operatörlüğün kendisinden geliyor.

  Taahhüdün doğru ve savunulabilir hâli:
  - **Ürün üzerinden erişim yoktur.** Operatör; öğrenci, not, yoklama, ödeme verisini hiçbir ekrandan, sorgudan veya API çağrısından okuyamaz. RLS bunu zorlar ve pgTAP ile sınanır (`platform_operator_reads.test.sql`).
  - **Yetki yükseltme mümkündür ve gizlenmez.** Operatör kimlik bilgisi üretebilir veya sıfırlayabilir. Bu, her SaaS sağlayıcısı için geçerlidir; iddia edilmeyecek bir şeyi iddia etmiyoruz.
  - **Her yükseltme denetim kaydı üretir.** Geçici şifre üretimi ve şifre sıfırlama işlemleri `platform_audit_events`'e yazılır; kayıt operatör tarafından silinemez veya değiştirilemez (istemciden yazma yolu yoktur).

    > **"Zorunlu" ne demek — 2026-08-25'te netleştirildi.** Bu madde uzun süre denetim kaydını zorunlu ilan ediyordu, kod ise yazımı en-iyi-çaba yapıyordu; ikisi açıkça çelişiyordu (Issue #80 · B05).
    >
    > Çelişki kod lehine değil, **tanım netleştirilerek** kapatıldı: zorunluluk _"denetim yazılamazsa işlem geri alınır"_ değil, **"denetim yazılamadığı operatörden gizlenemez"** anlamındadır. İşlemi geri almak daha kötü olurdu — oluşmuş bir kurumu "oluşmadı" göstermek, tekrar denendiğinde slug çakışması üretir; değişmiş bir şifreyi "değişmedi" göstermek ise hem eski hem yeni şifreyi kullanılamaz kılar.
    >
    > Karşılığı: Edge Function yanıtları `audit_written` alanını taşır ve panel `false` olduğunda operatöre işlemin ize geçmediğini söyler. Aynı desen kilit bayrağı için `password_lock_set` ile de geçerlidir.

  - **Kurum yöneticisi haberdar edilir.** Kendi hesabında yapılan her kimlik bilgisi işlemi ona bildirilir. Bildirim kanalı, e-postası doğrulandıktan sonra çalışır.

  Bu ayrım KVKK açısından da doğrudur: veri işleyenin teknik erişim imkânını inkâr etmek değil, **denetlenebilir ve hesap verebilir** kılmak beklenir.

- **Geçici şifreler düz metin saklanmaz.** Oluşturma anında bir kez gösterilir. Kaybedilirse yeniden üretilir; bu nedenle hem tek kişi hem sınıf bazında "şifreyi yeniden üret" işlemi bulunmak zorundadır.
- **İçe aktarma yarım kalmamalıdır.** Doğrulama kayıttan önce yapılır, işlem parçalara bölünür ve tekrar çalıştırıldığında aynı kişiyi iki kez oluşturmaz.
- **Şablon biz veririz.** Rastgele Excel dosyalarından sütun eşleştirmeye çalışmak kapsam dışıdır.
- **Fotoğraf/OCR ile veri çıkarma yapılmaz.** Öğrenci listesi görüntüsünü bir OCR servisine göndermek, çocukların kişisel verisini üçüncü tarafa aktarmak anlamına gelir ve ayrı bir veri işleme sözleşmesi gerektirir. El yazısı Türkçe isimlerde doğruluk da düşüktür ve hatalar sessizdir.

### Giriş hesabı kime açılır — kararı kurum verir

Sistemde **kayıtlı olmak** ile **giriş hesabı olmak** iki ayrı şeydir ve karıştırılmamalıdır.

|               | Nedir                                      | Kimde bulunur               |
| ------------- | ------------------------------------------ | --------------------------- |
| Öğrenci kaydı | Ad, sınıf, not, yoklama, ödeme             | Herkeste                    |
| Giriş hesabı  | `auth.users` satırı, giriş numarası, şifre | Yalnızca giriş yapacaklarda |

Dokuz yaşındaki bir öğrenci sisteme kayıtlıdır, öğretmeni not girer, velisi kendi hesabından takip eder; ancak kendi giriş hesabı yoktur. On ikinci sınıftaki bir öğrenci kendi deneme sonuçlarını görmek isteyebilir ve hesabı olur. İkisi de sistemdedir.

Gerekçe KVKK'daki veri minimizasyonu ilkesidir: hiç giriş yapmayacak bir çocuk için kimlik oluşturmak, ihtiyaç duyulmayan kişisel veriyi işlemektir.

**Kararı ORBIT vermez, kurum verir.** İlkokul dershanesiyle YKS kursunun ihtiyacı aynı değildir. Kurum iki yerden seçer:

1. **İçe aktarma şablonunda `Giriş Hesabı` sütunu** — satır bazında evet/hayır
2. **Öğrenci listesinde işlem** — sonradan fikir değişirse tek işlemle hesap üretilir

Bu tercih için veritabanında ayrı bir bayrak **tutulmaz**: `students.auth_user_id` doluysa hesap vardır, boşsa yoktur. Şablondaki sütun saklanan bir alan değil, içe aktarma anına ait bir talimattır. Aynı bilgiyi iki yerde tutmak bu projede tekrar eden hata kalıbıdır.

**O sütunu kim doldurur (v1.4-00, #261).** Hesap açmak ile kaydı hesaba bağlamak **iki ayrı adımdır**: `create-member` hesabı açar, bağlamayı dört RPC yapar — `link_student_account`, `unlink_student_account`, `link_guardian_account`, `unlink_guardian_account`. Sütun `authenticated` için hâlâ salt okunur; yönetici onu doğrudan UPDATE ile yazamaz. Bağlanan üyeliğin aynı kurumda ve doğru rolde olması fonksiyonun içinde sınanır. Gerekçe ve reddedilen alternatifler: `DECISION_LOG` — "Bağlama bir RPC'dir".

### Şema ekleme sırası

| Ne zaman                | Ne                                                                                                                 | Neden                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Eklendi (Issue #37)** | `organizations.code` (4 hane, 1000'den artan, benzersiz)                                                           | Panel kurum üretmeye başladığı anda her kurumun kodu olmalı; sonradan geriye dönük atamak gerekirdi |
| v1.2                    | `students`, `guardians`, `student_guardians`, `classes`, `class_enrollments` ve `students.auth_user_id` (nullable) | Panelin bu tablolara ihtiyacı yok; kurum, şube ve yönetici tabloları zaten mevcut                   |
| ~~İçe aktarma (v1.4)~~  | ~~`profiles.login_number`, `profiles.must_change_password`, `profiles.phone`~~                                     | **Geçersiz — aşağıdaki düzeltmeye bakın**                                                           |
| Faz E1                  | `organization_memberships.person_code` + kurum başına benzersizlik                                                 | Panel kurum yöneticisi hesabı üretmeye başladığı anda numaranın ikinci yarısı gerekli               |
| Faz E3                  | `profiles.must_change_password`, `profiles.password_expires_at`                                                    | Geçici şifre üretilen ilk anda kilit de gerekli; ikisi ayrı fazda olamaz                            |
| Faz E4                  | `profiles.phone`, `profiles.pending_email` ve doğrulama alanları                                                   | Kurtarma zinciri burada kuruluyor                                                                   |

> **Sonradan düzeltme (2026-08-24):** Üstteki üstü çizili satır iki bakımdan yanlıştı.
>
> **Yer:** `profiles.login_number` kurum kodunu ikinci kez saklardı — giriş numarası `<kurum:4><kişi:4>` olduğu için kurum kodu hem `organizations.code`'da hem burada dururdu. Bu, projenin yedi kez tökezlediği drift kalıbının aynısıdır. Doğrusu `organization_memberships.person_code`: yalnızca kişi yarısı saklanır, kurum yarısı üyelik üzerinden zaten bellidir.
>
> **Zaman:** v1.4 çok geç. Panel kurum yöneticisi hesabını Faz E1'de üretmeye başlıyor; numara olmadan hesap açılamaz.

Sonradan nullable kolon eklemek ucuz ve kırıcı değildir; bu nedenle şemanın tamamını erkenden kurmak gerekmez. `organizations.code` ve `person_code` istisnadır çünkü veri üretimi onlarla başlar.

### Henüz tasarlanmamış, pilot öncesi gereken adımlar

- ~~Öğrenci veya öğretmenin kurumdan ayrılması (`membership_status = suspended` mevcut, akış yok)~~ ✅ **v1.4-07'de kapandı** (`internal_remove_member` + `remove-member` Edge Function; ayrılan kişinin `students`/`guardians` bağı da koparılıyor). Son yöneticiyi koruyan sayım **v1.4-08**'de eklendi (`ORB06`).
- ~~Kurumun ikinci ve sonraki şubelerinin eklenmesi~~ ✅ **v1.4-09'da kapandı** (#284). RLS yazma politikaları, varsayılan şube tetikleyicisi (BEFORE olmak zorunda çıktı), dolu şube `ORB03` ile arşivlenemiyor; ekranda ekle/düzenle/kapat/yeniden aç ve "varsayılan yap". Üye ve öğrenci formlarında şube seçimi varsayılandan ön-doluyor.

> ⚠️ **Bu iki satır v1.4-07 ve v1.4-09 geldiğinde güncellenmedi; v1.4 ara denetiminde (2026-09-13) yakalandı.** Kayda geçiyor çünkü listenin adı "henüz tasarlanmamış" ve içinde **tasarlanmış, yazılmış, üretime çıkmış** bir madde duruyordu. Bir eksiklik listesi eskidiğinde yanlış olmakla kalmaz, bakan kişiye **yapılmış işi yapılmamış** gösterir (**K-24**).

- KVKK silme hakkı (pilot öncesi güvenlik listesi; bkz. `ROADMAP.md` v1.5)
- Veri işleme sözleşmesi, aydınlatma metni ve açık rıza akışı

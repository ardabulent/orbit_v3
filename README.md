# 🎓 ORBIT — Eğitim Kurumu & Dershane Yönetim Platformu

> **ORBIT**, 1–5 şubeli dershane, kurs merkezi ve eğitim kurumları için tasarlanmış; kurum yöneticisi, öğretmen, öğrenci ve veli rollerini tek bir modern çalışma alanında birleştiren yeni nesil eğitim CRM ve operasyon platformudur.

---

## 🚀 Projeye Genel Bakış ve Mimari

ORBIT; devamsızlık takibi, ders programı, deneme sınavı analizleri, veli iletişimi ve kayıt/ödeme operasyonlarını rol bazlı erişim modeli (RBAC) ile yönetir.

### 👥 Roller ve Çalışma Alanları

- 👑 **Kurum Yöneticisi (Admin):** Kurum genel özeti, öğrenci ve sınıf organizasyonu, yoklama takibi, sınav sonuçları ve sınıf karşılaştırması, kayıt ve ödeme takibi, raporlar ve ayarlar.
- 🧑‍🏫 **Öğretmen (Teacher):** Ders programı, hızlı yoklama alma, sınıf listeleri, sınav sonuçları, takip gereken öğrencilerin dikkat listesi ve duyurularla veli iletişimi.
- 🎒 **Öğrenci (Student):** Kişisel ders programı, ödev takibi, deneme sonuçları (ders ders doğru/yanlış/net ve sınıf ortalaması), kurum duyuruları ve öğretmenleriyle mesajlaşma.
- 👨‍👩‍👧 **Veli (Parent):** Öğrencinin devam durumu, son sınav karnesi, ödeme planı/taksit takibi ve kurum duyuruları.

---

## 🛠️ Teknoloji Yığını (Tech Stack)

| Katman                 | Teknoloji                           | Açıklama                                                              |
| :--------------------- | :---------------------------------- | :-------------------------------------------------------------------- |
| **Frontend**           | React + TypeScript + Vite           | Maksimum tip güvenliği, hızlı derleme ve modüler SPA                  |
| **Stil & Tasarım**     | Tailwind CSS + Radix UI + shadcn/ui | Erişilebilir headless bileşenler (`components/ui/`), modern tipografi |
| **Yönlendirme**        | `wouter`                            | Hafif ve performanslı istemci yönlendirici                            |
| **BaaS / Veri**        | `@supabase/supabase-js`             | Doğrudan istemciden Supabase BaaS bağlantısı                          |
| **State Yönetimi**     | `@tanstack/react-query`             | Sunucu durumu senkronizasyonu                                         |
| **İkonlar & Bildirim** | `lucide-react`, `sonner`            | Tutarlı arayüz ikonları ve zengin bildirimler                         |
| **Test**               | Vitest + pgTAP                      | Birim, yetkilendirme (RBAC) ve veritabanı politikası testleri         |
| **Paket Yöneticisi**   | `pnpm`                              | Hızlı ve disk tasarruflu paket yönetimi                               |

> **Sürüm numaraları burada tutulmuyor, `package.json`'da yaşıyor.** Bu tablo bir süre sürüm de yazıyordu ve ayrıştı: 2026-09-19'da _"Vitest 2.1"_ ve _"TypeScript 5.9"_ yazarken kurulu olanlar **5.0** ve **6.0**'dı. Aynı gerekçe aşağıdaki klasör ağacı için de geçerli — iki yerde tutulan bilginin biri her zaman eskir.

---

## 📁 Klasör Yapısı

```
client/src/      # React uygulaması — auth, platform paneli, dershane ekranları
supabase/        # Migration'lar, Edge Function'lar ve pgTAP testleri
.ai/             # Mimari kararlar, yol haritası ve platform ayarları
.github/         # CI iş akışları ve şablonlar
```

Dosya dosya ayrıntı — hangi modül ne yapar, hangi servis nerede yaşar — tek yerde tutulur:
**[`.ai/PROJECT_STATE.md`](.ai/PROJECT_STATE.md) bölüm 5.** Burada ikinci bir kopya tutulmuyor; iki ağaç bir süre sonra birbirini tutmuyor.

---

## ⚡ Yerel Kurulum (Geliştirici Rehberi)

ORBIT yerelde iki kipte açılır. **Geliştirme gerçek kipte yapılır**; demo kipi yalnız satış sunumu içindir.

| Kip        | Ne çalışır                                                                                      | Ne zaman                   |
| :--------- | :---------------------------------------------------------------------------------------------- | :------------------------- |
| **Demo**   | Yalnız arayüz; veriler koda gömülü örneklerdir. Veritabanı, giriş, yetki (RLS) **hiç çalışmaz** | Ekrana hızlı bakmak, sunum |
| **Gerçek** | Bilgisayarındaki Supabase: veritabanı, giriş, RLS, Edge Function'lar, e-posta (sahte kutuya)    | Her geliştirme ve her test |

> Yerel kopya canlı sisteme (orbit-v3-kappa.vercel.app) **hiç bağlanmaz**. Yerelde her şeyi silip yeniden kurabilirsin; kimse etkilenmez.

### Gerekenler

- **Node 22+** (`.nvmrc`) ve **pnpm** — `corepack enable` pnpm'i `package.json`'daki sürümle getirir.
- **Docker Desktop** — yerel Supabase Docker'da çalışır; kurulumdan önce açık olmalı.
- **Supabase CLI** — kurmak şart değil, `npx supabase …` ile çalışır. CI `2.115.0` kullanır.
- Edge Function'ları denetlemek istersen **Deno 2** (`deno check` için; şart değil).

### İlk kurulum (bir kez, ~15 dakika)

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Edge Function'ların yerel ayarı (e-postalar yerel sahte kutuya düşer)
cp supabase/functions/.env.example supabase/functions/.env

# 3. Yerel Supabase'i başlat — ilk seferde Docker imajları iner (birkaç dakika).
#    Göçlerin hepsi kendiliğinden uygulanır; veritabanı boş açılır.
npx supabase start

# 4. Örnek kurumu kur: operatör, yönetici, iki öğretmen, öğrenci, veli,
#    8 öğrenci, sınıflar, program, yoklama, sınav, ödeme, duyuru, mesaj.
pnpm yerel:tohum
```

Tohum, giriş numaralarını ekrana yazar. **Bütün örnek hesapların şifresi `Yerel-Orbit-2026`** (yalnız yerel; `ORBIT_YEREL_SIFRE` ile değiştirilebilir). Operatör e-postayla girer: `operator@orbit.test`. Tohum yerel olmayan bir adreste çalışmayı reddeder.

```bash
# 5. Arayüzü gerçek kipte bağla: kökte .env.local oluştur (git'e girmez)
npx supabase status -o env      # API_URL ve ANON_KEY satırlarını al
```

```ini
# .env.local
VITE_DEPLOYMENT_ENV=production
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<supabase status'taki ANON_KEY>
```

```bash
# 6. Aç
pnpm dev                        # http://localhost:5173
```

**Gerçek kipte olduğunun kanıtı:** giriş ekranında rol kartları ve "Demo şifresi" satırı **görünmez**; giriş numarası istenir. Demo kipine dönmek için `.env.local`'ı silmek ya da yeniden adlandırmak yeter (demo şifresi `demo123`).

⚠️ **`VERCEL_ENV` değişkenini set etme.** O varken `vite.config.ts`'in CSP kapısı devreye girer ve yerel adresle derleme durur (`v1.5-09`).

### Günlük kullanım

| İş                                    | Komut                                                                      |
| :------------------------------------ | :------------------------------------------------------------------------- |
| Yığını başlat / durdur                | `npx supabase start` / `npx supabase stop` (veri korunur)                  |
| Veritabanını sıfırla + örnek veri     | `npx supabase db reset && pnpm yerel:tohum`                                |
| Gönderilen e-postaları gör            | `npx supabase status` → Mailpit adresi (varsayılan http://127.0.0.1:54324) |
| Veritabanı panosu (Studio)            | `npx supabase status` → Studio adresi (varsayılan http://127.0.0.1:54323)  |
| Edge Function değişikliğini yükle     | `docker restart supabase_edge_runtime_orbit_v3`                            |
| `supabase/functions/.env` değişikliği | `npx supabase stop && npx supabase start`                                  |

Yeni bir göç yazdığında `npx supabase db reset` onu sıfırdan uygular; tohum betiği arayüzün kullandığı RPC ve Edge Function'lardan geçtiği için göç bir akışı bozarsa tohum da durur ve hangi adımda durduğunu söyler.

### Testler — PR açmadan önce

```bash
pnpm format && pnpm check && pnpm lint && pnpm test   # her PR (CI'daki quality-gate)
npx supabase db reset && npx supabase test db         # supabase/ değiştiyse: pgTAP (boş veritabanında)
bash supabase/tests/functions/create_member_chain.sh  # Edge Function değiştiyse
deno check supabase/functions/*/index.ts              # Edge Function değiştiyse
pnpm build && node scripts/check-demo-leak.mjs        # demo verisi üretim paketine sızdı mı
```

⚠️ **pgTAP boş veritabanı bekler.** Bazı testler tüm veritabanını sayar (örn. "operatör listesinde bir kişi var"); örnek veri yüklüyken 7 dosyada 11 iddia kırılır. Bu yüzden önce `db reset`, testlerden sonra `pnpm yerel:tohum` (üçü birlikte ~1 dakika). CI'da örnek veri yoktur. Zincir testi (`create_member_chain.sh`) örnek veriden etkilenmez.

### Windows: `supabase start` port hatası verirse

Windows, Docker'ın kullanacağı bazı port aralıklarını kendine ayırabiliyor (Hyper-V/WinNAT). Belirti: `supabase start` _"ports are not available"_ ya da _"bind: An attempt was made to access a socket…"_ hatası. Ayrılmış aralıkları gör:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

543xx portlarından biri bir aralığın içindeyse `supabase/config.toml`'daki portları boş bir aralığa taşı (örn. 553xx: `[api] port = 55321`, `[db] port = 55322`, `[studio] port = 55323`, `[local_smtp] port = 55324` …) ve bu değişikliği **commit etme** — yalnız senin makinene ait:

```bash
git update-index --skip-worktree supabase/config.toml   # git artık bu dosyadaki yerel değişikliği görmez
```

`.env.local`'daki `VITE_SUPABASE_URL` da yeni API portunu göstermeli. Geri almak için: `git update-index --no-skip-worktree supabase/config.toml && git checkout supabase/config.toml`.

---

## 📋 Kullanılabilir Komutlar

| Komut              | Açıklama                                                                                          |
| :----------------- | :------------------------------------------------------------------------------------------------ |
| `pnpm dev`         | Vite geliştirme sunucusunu başlatır (`.env.local` yoksa demo kipi)                                |
| `pnpm build`       | Production derlemesi oluşturur (yalnızca Vite — tip kontrolü için ayrıca `pnpm check` çalıştırın) |
| `pnpm preview`     | Üretilen derlemeyi yerelde önizler                                                                |
| `pnpm check`       | TypeScript tip kontrollerini çalıştırır (`tsc --noEmit`)                                          |
| `pnpm lint`        | ESLint ile kod kalitesi kontrollerini çalıştırır                                                  |
| `pnpm test`        | Vitest ile birim testlerini çalıştırır                                                            |
| `pnpm format`      | Prettier ile tüm kodları formatlar                                                                |
| `pnpm yerel:tohum` | Boş yerel veritabanına örnek kurumu kurar (yalnız yerel adreste çalışır)                          |

---

## 🤝 Geliştirme ve Git Kuralları

Kurallar tek yerde yaşar: **[`CONTRIBUTING.md`](CONTRIBUTING.md)**. Özet — `main`'e doğrudan commit yok; her iş tür önekli bir dalda (`fix/…`, `feat/…`) PR olarak ilerler, bir insan onayıyla squash birleştirilir. YZ ajanları PR açar, birleştirmez.

YZ ajanlarıyla çalışma düzeni için `.ai/AGENT_WORKFLOW.md`, projeye giriş için kökteki **[`AGENTS.md`](AGENTS.md)**.

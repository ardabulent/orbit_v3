# 🎓 ORBIT — Eğitim Kurumu & Dershane Yönetim Platformu

> **ORBIT**, 1–5 şubeli dershane, kurs merkezi ve eğitim kurumları için tasarlanmış; kurum yöneticisi, öğretmen, öğrenci ve veli rollerini tek bir modern çalışma alanında birleştiren yeni nesil eğitim CRM ve operasyon platformudur.

---

## 🚀 Projeye Genel Bakış ve Mimari

ORBIT; devamsızlık takibi, ders programı, deneme sınavı analizleri, veli iletişimi ve kayıt/ödeme operasyonlarını rol bazlı erişim modeli (RBAC) ile yönetir.

### 👥 Roller ve Çalışma Alanları

- 👑 **Kurum Yöneticisi (Admin):** Kurum genel özeti, öğrenci ve sınıf organizasyonu, yoklama takibi, sınav sonuçları ve sınıf karşılaştırması, kayıt ve ödeme takibi, raporlar ve ayarlar.
- 🧑‍🏫 **Öğretmen (Teacher):** Ders programı, hızlı yoklama alma, sınıf listeleri, sınav sonuçları, takip gereken öğrencilerin dikkat listesi ve duyurularla veli iletişimi.
- 🎒 **Öğrenci (Student):** Kişisel ders programı, ödev takibi, deneme sonuçları (ders ders doğru/yanlış/net ve sınıf ortalaması) ve kurum duyuruları. Birebir mesajlaşma henüz yok.
- 👨‍👩‍👧 **Veli (Parent):** Öğrencinin devam durumu, son sınav karnesi, ödeme planı/taksit takibi ve kurum duyuruları.

---

## 🛠️ Teknoloji Yığını (Tech Stack)

| Katman                 | Teknoloji                           | Açıklama                                                                  |
| :--------------------- | :---------------------------------- | :------------------------------------------------------------------------ |
| **Frontend**           | React + TypeScript + Vite           | Maksimum tip güvenliği, hızlı derleme ve modüler SPA                      |
| **Stil & Tasarım**     | Tailwind CSS + Radix UI + shadcn/ui | Erişilebilir headless bileşenler (`components/ui/`), modern tipografi     |
| **Yönlendirme**        | `wouter`                            | Hafif ve performanslı istemci yönlendirici (`patches/wouter@3.7.1.patch`) |
| **BaaS / Veri**        | `@supabase/supabase-js`             | Doğrudan istemciden Supabase BaaS bağlantısı                              |
| **State Yönetimi**     | `@tanstack/react-query`             | Sunucu durumu senkronizasyonu                                             |
| **İkonlar & Bildirim** | `lucide-react`, `sonner`            | Tutarlı arayüz ikonları ve zengin bildirimler                             |
| **Test**               | Vitest + pgTAP                      | Birim, yetkilendirme (RBAC) ve veritabanı politikası testleri             |
| **Paket Yöneticisi**   | `pnpm`                              | Hızlı ve disk tasarruflu paket yönetimi                                   |

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

## ⚡ Hızlı Başlangıç (Geliştirici Rehberi)

Projeyi yerelinizde çalıştırmak için aşağıdaki adımları izleyin:

```bash
# 1. Bağımlılıkları yükleyin
pnpm install

# 2. Ortam değişkenlerini kopyalayın
cp .env.example .env

# 3. Geliştirme sunucusunu başlatın
pnpm dev
```

Tarayıcınızda `http://localhost:5173` adresine giderek demoyu açabilirsiniz.
Giriş ekranında **Kurum Yöneticisi, Öğretmen, Öğrenci veya Veli** rollerinden birini seçerek anında ilgili arayüze geçiş yapabilirsiniz (Demo şifresi: `demo123`).

### 🔴 Yukarıdaki komut **demo modudur** — Supabase'e hiç istek gitmez

`pnpm dev` uygulamayı demo verisiyle açar: `vite.config.ts` ortamı `VERCEL_ENV ?? VITE_DEPLOYMENT_ENV` ile çözüyor ve `.env.example` `development` diyor, yani `isDemoMode = true`. Ekranlar dolu görünür ama **hiçbiri gerçek veritabanından gelmez**; giriş, yetki, RLS ve Edge Function'ların hiçbiri koşmaz.

Bu satır 2026-09-19'da yazıldı çünkü tarifin yokluğu ölçülebilir bir zarar verdi: _"yerelde uçtan uca prova yapıldı"_ diyen bir denetim, farkında olmadan demo modunda bakmış olabilir (`ROADMAP` §4.23 B5).

**Gerçek modda çalıştırmak için** — yerel Supabase yığını ayakta olmalı:

```bash
# 1. Yerel yığını başlat (Docker gerekir) ve anahtarları oku
supabase start
supabase status -o env          # API_URL ve ANON_KEY buradan

# 2. Vite'ı gerçek modda başlat (değerleri kabuktan geç, .env'e yazma)
VITE_DEPLOYMENT_ENV=production \
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=<supabase status'tan ANON_KEY> \
pnpm dev
```

⚠️ **`VERCEL_ENV` değişkenini set etme.** O değişken varken `vite.config.ts`'in CSP kapısı devreye girer ve `vercel.json`'daki üretim adresiyle karşılaştırma yapar; yerel adresle derleme durur (`v1.5-09`).

**Gerçek modda olduğunun kanıtı:** giriş ekranında rol kartları ve "Demo şifresi" satırı **görünmez**; giriş numarası istenir. Veritabanı boş başlar — kurumu, yöneticiyi ve üyeleri platform operatörü olarak sen oluşturursun.

---

## 📋 Kullanılabilir Komutlar

| Komut          | Açıklama                                                                                          |
| :------------- | :------------------------------------------------------------------------------------------------ |
| `pnpm dev`     | Vite geliştirme sunucusunu başlatır                                                               |
| `pnpm build`   | Production derlemesi oluşturur (yalnızca Vite — tip kontrolü için ayrıca `pnpm check` çalıştırın) |
| `pnpm preview` | Üretilen derlemeyi yerelde önizler                                                                |
| `pnpm check`   | TypeScript tip kontrollerini çalıştırır (`tsc --noEmit`)                                          |
| `pnpm lint`    | ESLint ile kod kalitesi kontrollerini çalıştırır                                                  |
| `pnpm test`    | Vitest ile birim testlerini çalıştırır                                                            |
| `pnpm format`  | Prettier ile tüm kodları formatlar                                                                |

---

## 🤝 Geliştirme ve Git Kuralları

Kurallar tek yerde yaşar: **[`CONTRIBUTING.md`](CONTRIBUTING.md)**. Özet — `main`'e doğrudan commit yok, her iş `feat/<issue-no>-<kisa-ad>` branch'i ve PR üzerinden ilerler, karşılıklı review zorunludur.

YZ ajanlarıyla çalışma düzeni için `.ai/AGENT_WORKFLOW.md`, projeye giriş için kökteki **[`AGENTS.md`](AGENTS.md)**.

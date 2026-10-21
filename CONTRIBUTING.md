# CONTRIBUTING.md — Ekip Anayasası

Bu dosya **git, inceleme ve iş bölümü kurallarını** tutar. Kod yazan taraf ister bir insan ister bir YZ ajanı olsun, aşağıdakiler herkes için geçerlidir.

Projeye yeni başlıyorsan önce kökteki **`AGENTS.md`**'yi oku: hangi soru için hangi dosyaya bakılacağını orası söyler. Yerel kurulum `README.md`'de.

> **2026-10-19:** Ekip iki geliştiriciye çıktı ve bu dosya o güne göre yeniden yazıldı. Önceki hâl "ekip tek kişi, insan onayı istenmiyor" diyordu. Kararlar ve gerekçe: `.ai/DECISION_LOG.md` — "İki geliştiricili çalışma düzeni".

## Kim ne yapar

| Rol                       | Yapar                                                                                                                                         | Yapmaz                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Geliştirici (insan)**   | Kod yazar, PR açar, **başkasının PR'ını inceler ve birleştirir**, panel ayarlarını değiştirir, şifre ve gizli anahtarları yönetir             | Kendi PR'ını onaylayamaz (GitHub izin vermez)                                                        |
| **YZ ajanı (Claude vb.)** | Dal açar, kod ve göç yazar, yerelde test eder (tip, lint, birim, pgTAP, tarayıcı), commit atar, PR açar, canlıya **yalnız salt okunur** bakar | **Birleştirmez.** Panel ayarı değiştirmez, şifre ve gizli anahtar görmez/girmez, canlı veriye yazmaz |

Canlıyı değiştiren her adım — PR'ı birleştirmek (göçler Supabase'e otomatik uygulanır), Supabase/Vercel/GitHub ayarı, gizli anahtar — **bir insanın elinden** geçer.

## Temel kurallar

1. **`main` dalına doğrudan commit atılamaz.** Her değişiklik dal + PR üzerinden ilerler.
2. **Birleştirme bir insan onayı ister ve squash ile yapılır.** PR'ı açan kişi kendi PR'ını onaylayamaz; YZ'nin açtığı PR'ı iki geliştiriciden biri onaylar. PR `main`'e tek commit olarak girer; squash başlığı PR başlığıdır.
3. **Üç zorunlu kapı geçmeden birleştirme yok:** `quality-gate`, `Yıkıcı Migration Kontrolü`, `Tenant RLS`. Kapı kırmızıysa onay da yetmez.
4. **Dal adları tür önekiyle başlar:** `feat/`, `fix/`, `perf/`, `ui/`, `docs/`, `chore/`, `test/` + kısa Türkçe ad (örn. `fix/veli-telefon-eslesmesi`). Issue varsa numarası ada eklenebilir (`fix/481-veli-telefon`).
5. **Issue isteğe bağlıdır.** Birden çok PR'a yayılan ya da sonraya kalan iş issue olarak açılır; küçük iş issue'suz PR olabilir. Issue kapatan PR açıklamasında anahtar kelime **İngilizce** yazılır: `Closes #123` (Türkçe "Kapatır" GitHub'da çalışmaz).
6. **Commit ve PR başlıkları [Conventional Commits](https://www.conventionalcommits.org/) formatında:** `feat:`, `fix:`, `perf:`, `refactor:`, `test:`, `chore:`, `docs:`. Kapsam isteğe bağlı: `fix(auth): …`.
7. **Değişen bilgi aynı PR'da belgeye işlenir.** Karar → `DECISION_LOG.md`, durum → `ROADMAP.md` §0 ve §4.27'deki madde, panel ayarı → `PLATFORM_SETTINGS.md`, klasör/servis yapısı → `PROJECT_STATE.md` §5. Ayrı bir "belgeleri güncelleme" işi açılmaz; açılırsa yapılmaz.
8. **Modülerlik & tek sorumluluk:** yeni ekran veya özellik kendi dosyasına gider, büyük dosyaya eklenmez. Ayrıntı: `AGENTS.md`.
9. **Önce etki alanı:** kod yazmadan önce değişikliğin dokunduğu modüller, tablolar, RLS politikaları ve maliyet/güvenlik/KVKK boyutu düşünülür (`AGENTS.md` — "Değişiklik öncesi düşünme").

## İş akışı

```bash
git checkout main
git pull --ff-only                   # her iş güncel main'den başlar
git checkout -b fix/kisa-ad
# ... geliştirme, commit'ler (squash'ta birleşecekleri için sayıları serbest) ...
pnpm format && pnpm check && pnpm lint && pnpm test
git push -u origin fix/kisa-ad
gh pr create                         # şablonu doldur
# İnceleyen onaylar → "Squash and merge" → dal otomatik silinir
```

**Birleşen dal ölüdür.** Üzerine commit atma; `main`'i çekip yeni dal aç. Birleştirmeden sonra dala atılan commit `main`'e girmez, CI koşmaz ve `git push` hata vermez — bu projede iki kez oldu (PR #52, PR #78).

**Birleştirmeden sonra canlıyı doğrula.** Vercel yayını ve (göç varsa) Supabase göç sayısı kontrol edilir; yöntemler `PLATFORM_SETTINGS.md` §6'da.

## İnceleme beklentileri

İnceleyen yalnız kodun çalıştığına değil, **yapılması gereken şeyin bu olduğuna** bakar — kapılar birincisini ölçer, ikincisini ölçemez.

- PR açıklaması ne değiştiğini, neden değiştiğini ve nasıl denendiğini söylüyor mu?
- Göç varsa: yıkıcı mı (gerekçesi yazılı mı), RLS'e dokunuyor mu, pgTAP testi var mı?
- Gizli anahtar, gerçek kişi verisi ya da canlı adres koda girmiş mi? (Depo herkese açık.)
- Yeni bağımlılık varsa gerekçesi yazılı mı?
- Mevcut desenle (klasör yapısı, servis katmanı, adlandırma) tutarlı mı?
- Belge aynı PR'da güncellenmiş mi (kural 7)?

YZ ajanlarıyla iki rollü (yazan/denetleyen) çalışırken ayrıca `.ai/AGENT_WORKFLOW.md` geçerlidir.

## Lisans

Kod herkese açık görünür ama **tüm hakları saklıdır** (`LICENSE`). Katkıda bulunan kişi, katkısının bu koşullarla depoya girdiğini kabul eder.

## Ne değişti, neden?

<!-- Bir iki cümle: hangi sorun, nasıl çözüldü. Squash başlığı PR başlığıdır; başlık Conventional Commits formatında olsun (fix: …, feat: …). -->

Closes #

<!-- Issue yoksa satırı silin. Anahtar kelime İNGİLİZCE olmak zorunda: Closes / Fixes / Resolves.
     "Kapatır: #123" GitHub'da çalışmaz; issue kapanmaz ve kimse fark etmez (2026-09-07, beş issue). -->

## Etki alanı

- **Dokunulan modüller / ekranlar:**
- **Dokunulan tablolar / RLS politikaları:** <!-- yoksa "yok" -->
- **Güvenlik, KVKK veya maliyet riski:** <!-- yoksa "yok"; varsa açıklayın -->

## Nasıl denendi?

- [ ] `pnpm format && pnpm check && pnpm lint && pnpm test`
- [ ] Tarayıcıda denendi (hangi rol, hangi ekran):
- [ ] Hatalı girdi / yetkisiz erişim gibi kenar durumlar denendi

### Göç varsa (`supabase/migrations/`)

- [ ] Yerelde temiz kuruldu, pgTAP testi eklendi ve geçti (`supabase test db`)
- [ ] Yıkıcı değil — ya da gerekçesi aşağıda yazılı
- [ ] Göç sırası testi (`supabase/tests/deployment/migrationOrderIsMonotonic.test.ts`) güncellendi

### Edge Function değiştiyse (`supabase/functions/`)

- [ ] `deno check` ve fonksiyonun testleri geçti
- [ ] Girdi Zod ile doğrulanıyor

## İnceleyen için

- [ ] Gizli anahtar, gerçek kişi verisi ya da canlı adres yok (depo herkese açık)
- [ ] Yeni bağımlılık yok — ya da gerekçesi yazılı
- [ ] Mevcut desenle tutarlı (klasör yapısı, servis katmanı, adlandırma)
- [ ] Değişen karar / durum / ayar aynı PR'da belgeye işlendi (`DECISION_LOG`, `ROADMAP` §0, `PLATFORM_SETTINGS`, `PROJECT_STATE` §5)

<!-- Birleştirdikten sonra: Vercel yayını ve (göç varsa) Supabase göç sayısı kontrol edilir — PLATFORM_SETTINGS.md §6. -->

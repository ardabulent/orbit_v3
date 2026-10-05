/**
 * PostgREST'in satır tavanı ve ona bağlı varsayımlar (v1.5-09).
 *
 * PostgREST her yanıtı bir üst sınıra kadar döndürür (`db-max-rows`). Sınır
 * aşıldığında **hata verilmez** — yanıt sessizce kesilir. Bu yüzden bu depoda
 * her liste okuması kendi `.limit()`'ini açıkça veriyor ve kesilmeyi kendisi
 * ölçüyor (`truncated` bayrağı, **K-03**): uygulamanın tavanı kendisi
 * bilmesi, sunucunun tavanına bel bağlamamasından daha güvenli.
 *
 * ## ✅ Bu sayı ÜRETİMDE ÖLÇÜLDÜ (2026-09-18): 1000
 *
 * Uzun süre doğrulanmamış bir varsayımdı (`ROADMAP` §4.12). `v1.5-09`'da
 * arandı ve **veritabanından okunamadığı** ölçüldü: proje düzeyi bir PostgREST
 * ayarı, rol yapılandırmalarında `pgrst.db_max_rows` yok. Kalan tek yol panel
 * okumasıydı ve yapıldı — **Supabase → Settings → API → Max rows = 1000**,
 * yani `supabase/config.toml`'daki yerel değerle aynı ve buradaki sabit doğru.
 *
 * ⚠️ **Değer değişirse buradaki sabit de değişmek zorunda, ve DÜŞÜRÜLMEMELİ.**
 * `homeworkService`'in iki iç adımı tavanını açıkça `POSTGREST_MAX_ROWS` olarak
 * istiyor. Üretimdeki tavan bundan düşük olursa sunucu daha az satır döndürür,
 * istemcinin `rows.length === limit` karşılaştırması tutmaz ve **"kesilme yok"**
 * der — yani eksik veriyi tam sanar. Yükseltmenin ise hiçbir faydası yok:
 * hiçbir okuma 1000'den fazlasını istemiyor.
 *
 * Sayı bu dosyaya taşındı çünkü platformun tamamına ait bir gerçek, tek bir
 * özelliğin servis dosyasına değil (**K-06**). Eskiden
 * `education/homeworkService.ts` içinde duruyordu.
 *
 * ## Gerçek güvenlik özelliği, sayının doğruluğu değil
 *
 * Tehlikeli olan, bir okumanın `POSTGREST_MAX_ROWS`'a **eşit veya üstünde** bir
 * tavan istemesi: o noktada gelen satır sayısı hangi tarafın kestiğini söylemez
 * ve `truncated` bayrağı anlamını yitirir. On dokuz `DEFAULT_…_LIMIT`'in hepsi
 * 50-200 arası, yani kapı bugün rahat geçiyor — kapısı
 * `postgrestLimits.test.ts` ve işi bu aralığın gevşemesini engellemek.
 *
 * ⚠️ **İlk yazımda burada şu cümle vardı ve YANLIŞTI:** _"üretimdeki tavan
 * bundan düşük olsa bile uygulama sessizce yanlış sayı üretmez, çünkü açık
 * `.limit()` veren her okuma kendi tavanını ölçüyor."_ Cümle "her okuma kendi
 * tavanını **küçük** veriyor" varsayımına dayanıyordu; oysa `homeworkService`'in
 * iki iç adımı tavanını açıkça `POSTGREST_MAX_ROWS` olarak istiyor. O iki
 * okuma için düşürülmüş bir sunucu tavanı tam olarak sessiz yanlış sayı
 * üretir — yukarıdaki uyarının sebebi bu. Kayıt düzeltildi, silinmedi
 * (**K-10**).
 *
 * **Sonradan düzeltme (2026-10-05):** `homeworkService`'in o iki iç adımı
 * kaldırıldı; ödev sayımı artık tek bir veritabanı çağrısı
 * (`homework_completion_counts`, v1.5-24). Bugün bu sabite açıkça dayanan
 * okuma yok; listeler `lib/pagedRead.ts` ile sayfa sayfa okunuyor ve sayfa
 * boyu bu sabitin altında tutuluyor. "Düşürülmemeli" uyarısı yine geçerli:
 * sayfa boyu ile bu sabit arasındaki ilişkiyi kapı ölçüyor.
 */

export const POSTGREST_MAX_ROWS = 1000;

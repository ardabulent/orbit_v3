import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Yeni bir migration her zaman en üste gelir (v1.5-09 · §4.15 B8, **K-19**).
 *
 * ## Ölçüm B8'in çerçevesini düzeltti
 *
 * §4.15 bulguyu şöyle yazıyordu: _"son sekiz migration'ın dosya adı bugünden
 * ileri tarihli … gerçek tarihle yazılacak bir migration uygulanmışların
 * öncesine sıralanır."_ İlk yarısı doğru ama teşhis eksik: **migration
 * damgası bir tarih değil, bir sıralama anahtarıdır.** İleri tarihli olmak
 * kendi başına bir kusur değil; kusur, sonradan yazılan bir dosyanın
 * öncekilerden **küçük** bir anahtar almasıdır.
 *
 * Neden zararlı olduğu bu depoda somut, çünkü iki yol migration'ları **ayrı
 * sırayla** uyguluyor:
 *
 *   - **Yerel ve CI** — `supabase test db` her koşuda sıfırdan kurar ve
 *     dosyaları **ad sırasıyla** uygular
 *   - **Üretim** — Supabase GitHub entegrasyonu yalnızca **henüz
 *     uygulanmamış** olanları, gerçek zaman sırasıyla uygular
 *
 * Yani bugün (2026-09-18) gerçek tarihle `20260918…` adlı bir migration
 * yazılsa: yerelde `20260919`–`20260927` arasındaki **dokuz** migration'dan
 * ÖNCE koşar, üretimde SONRA koşar. Aynı dosya kümesinden iki ayrı şema
 * evrimi çıkar; testler yeşil geçer ve üretim başka bir yerde durur.
 *
 * ⚠️ **Çözüm yeniden adlandırmak DEĞİL.** Uygulanmış bir migration'ın adı
 * `schema_migrations` tablosunda kayıtlı; adı değişirse Supabase onu yeni
 * sanıp **tekrar uygular**. Dokuz dosya olduğu yerde kalıyor.
 *
 * ## Kapının şekli
 *
 * Korunan özellik **tek yönlü artış**: eklenen her migration, mevcut en büyük
 * anahtardan büyük olmak zorunda. Dosya sisteminde hangi dosyanın "yeni"
 * olduğu görünmediği için iki sayı kayda geçiyor — **adet** ve **en büyük
 * anahtar**. Bir migration eklendiğinde adet değişir; en büyük anahtar
 * değişmediyse yeni dosya en üste gelmemiş demektir ve kapı kırmızıya döner.
 *
 * Bedeli: her yeni migration'da bu iki sayının güncellenmesi. Bu bilinçli bir
 * bedel — güncellemeyi yapan kişi tam olarak sormamız gereken soruyu sormuş
 * olur: _"benim dosyam en üstte mi?"_
 *
 * 📋 **Ve bir karar gerektirdi** (`DECISION_LOG`, 2026-09-18): saat yakalayana
 * kadar sıradaki migration `20260928…` olarak adlandırılıyor. Yani depo bir
 * süre daha saatin önünde kalıyor, ve "önde olma" kendiliğinden sıfıra
 * iniyor. Alternatif — gerçek tarihi kullanıp sıra ayrışmasını kabul etmek —
 * reddedildi: üretimi koruyan özellik tek yönlü artış, saatle uyum ise
 * yalnızca kozmetik.
 */

const depoKoku = path.resolve(import.meta.dirname, "..", "..", "..");
const migrationKoku = path.join(depoKoku, "supabase", "migrations");

/**
 * Bilinen durum. Yeni bir migration eklendiğinde **ikisi de** güncellenir.
 *
 * `EN_BUYUK_ANAHTAR` güncellenmeden adet artıyorsa, yeni dosya en üste
 * gelmemiştir — kapının yakaladığı hâl tam olarak bu.
 */
const BEKLENEN_ADET = 92;
const EN_BUYUK_ANAHTAR = "20261017000000";

function migrationlar(): { ad: string; anahtar: string }[] {
  return readdirSync(migrationKoku)
    .filter(ad => ad.endsWith(".sql"))
    .map(ad => ({ ad, anahtar: ad.split("_")[0] }))
    .sort((a, b) => a.anahtar.localeCompare(b.anahtar));
}

describe("migration sırası tek yönlü artar (v1.5-09 · B8)", () => {
  it("migration dosyaları okunabildi", () => {
    // Ayrıştırma bozulursa aşağıdakiler boş küme üzerinde sessizce yeşil
    // geçerdi (K-04).
    const hepsi = migrationlar();
    expect(hepsi.length).toBeGreaterThan(50);
    expect(hepsi.every(m => /^\d{14}$/.test(m.anahtar))).toBe(true);
  });

  it("🔴 eklenen her migration en üste geliyor", () => {
    const hepsi = migrationlar();
    const enBuyuk = hepsi[hepsi.length - 1].anahtar;

    // ⛔ Azalma: uygulanmış bir migration silinmiş. Üretimde çalışmış bir
    //    ifadeyi depodan kaldırmak, sıfırdan kurulan her ortamı üretimden
    //    ayırır — ve `schema_migrations` o satırı hâlâ taşıyor.
    expect(
      hepsi.length,
      `Migration adedi ${BEKLENEN_ADET} → ${hepsi.length} düştü: uygulanmış bir migration silinmiş ` +
        `veya yeniden adlandırılmış görünüyor. İkisi de üretimden ayrışma demek — ` +
        `yeniden adlandırılan dosya Supabase tarafından YENİ sanılıp tekrar uygulanır.`
    ).toBeGreaterThanOrEqual(BEKLENEN_ADET);

    if (hepsi.length === BEKLENEN_ADET) {
      // Hiçbir şey eklenmedi: en büyük anahtar da aynı kalmalı. Aynı kalmadıysa
      // bir dosya yeniden adlandırılmış (adet sabit, anahtar değişti).
      expect(
        enBuyuk,
        `Adet değişmedi ama en büyük anahtar ${EN_BUYUK_ANAHTAR} → ${enBuyuk} oldu: ` +
          `bir migration yeniden adlandırılmış. Uygulanmış bir migration'ın adı DEĞİŞTİRİLEMEZ.`
      ).toBe(EN_BUYUK_ANAHTAR);
      return;
    }

    // Migration eklendi. Yeni dosya mevcut hepsinden BÜYÜK bir anahtar almalı.
    expect(
      enBuyuk > EN_BUYUK_ANAHTAR,
      `Migration adedi ${BEKLENEN_ADET} → ${hepsi.length} oldu ama en büyük anahtar hâlâ ${enBuyuk} ` +
        `(kayıtlı: ${EN_BUYUK_ANAHTAR}) — yani yeni dosya ARAYA girmiş. Yerelde ad sırasıyla, ` +
        `üretimde zaman sırasıyla uygulandığı için araya giren bir migration iki ayrı şema ` +
        `evrimi üretir: testler yeşil geçer, üretim başka bir yerde durur. Dosyayı ` +
        `${EN_BUYUK_ANAHTAR}'dan büyük bir anahtarla yeniden adlandırın ve bu dosyadaki iki ` +
        `sayıyı güncelleyin.`
    ).toBe(true);
  });

  it("hiçbir anahtar tekrarlanmıyor", () => {
    // Aynı anahtara sahip iki dosyanın sırası tanımsızdır ve iki ortamda
    // farklı çözülebilir.
    const anahtarlar = migrationlar().map(m => m.anahtar);
    expect(anahtarlar.length).toBe(new Set(anahtarlar).size);
  });

  it("kararın gerekçesi dosyada yazılı", () => {
    // ⚠️ Bir davranışı değil bir **kaydı** koruyor. Gerekçe silinirse biri
    // "bu dosyalar neden ileri tarihli" diye sorup onları yeniden
    // adlandırmaya kalkar — ve o, üretimde tekrar uygulama demek (**K-10**).
    const icerik = readFileSync(
      path.join(
        depoKoku,
        "supabase",
        "tests",
        "deployment",
        "migrationOrderIsMonotonic.test.ts"
      ),
      "utf8"
    );

    expect(icerik).toContain("Çözüm yeniden adlandırmak DEĞİL");
    expect(icerik).toContain("schema_migrations");
  });
});

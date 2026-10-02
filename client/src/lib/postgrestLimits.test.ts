import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { POSTGREST_MAX_ROWS } from "./postgrestLimits";

/**
 * Hiçbir liste tavanı PostgREST'in tavanına dayanmaz (v1.5-09 · §4.12).
 *
 * §4.12'nin kaydı şöyleydi: _"`max_rows` hiçbir belgede geçmiyor … üretimdeki
 * değer doğrulanmadı."_ Doğrulaması bu dilime bağlanmıştı ve ölçüm kaydı iki
 * yönden düzeltti:
 *
 * 1. 🔴 **Sayı belgede değil, KODDA varsayılmış.** `POSTGREST_MAX_ROWS = 1000`
 *    `education/homeworkService.ts` içinde duruyordu — platformun tamamına ait
 *    bir gerçek, tek bir özelliğin servis dosyasında (**K-06**). v1.5-09'da
 *    `lib/postgrestLimits.ts`'e taşındı.
 *
 * 2. ✅ **Üretimdeki değer 2026-09-18'de ÖLÇÜLDÜ: 1000.** Veritabanından
 *    okunamadığı ölçüldü (rol yapılandırmalarında `pgrst.db_max_rows` yok),
 *    kalan tek yol panel okumasıydı ve yapıldı —
 *    **Supabase → Settings → API → Max rows**. Yerel `config.toml` ile aynı,
 *    yani buradaki sabit doğru bir tabanın üzerinde duruyor.
 *
 * ## Bu yüzden kapı sayının doğruluğunu değil, ona BAĞIMLILIĞI ölçüyor
 *
 * Üretimdeki tavan 1000'den düşük olsa bile uygulama sessizce yanlış sayı
 * üretmez, çünkü açık `.limit()` veren her okuma kesilmeyi kendisi ölçüyor
 * (`truncated`). Tehlikeli olan tek hâl, bir okumanın `POSTGREST_MAX_ROWS`'a
 * **eşit veya üstünde** bir tavan istemesi: o noktada gelen satır sayısı
 * hangisinin kestiğini söylemez ve `truncated` bayrağı anlamını yitirir.
 *
 * Yani doğrulanamayan bir dış ayar, doğrulanabilir bir iç özelliğe çevrildi.
 */

const istemciKoku = path.resolve(import.meta.dirname, "..");

function kaynakDosyalar(kok: string): string[] {
  const cikan: string[] = [];
  for (const ad of readdirSync(kok)) {
    const yol = path.join(kok, ad);
    if (statSync(yol).isDirectory()) {
      cikan.push(...kaynakDosyalar(yol));
      continue;
    }
    if (!/[.](ts|tsx)$/.test(ad)) continue;
    if (/[.]test[.](ts|tsx)$/.test(ad)) continue;
    cikan.push(yol);
  }
  return cikan;
}

/** `export const DEFAULT_…_LIMIT = <sayı>;` girdilerini toplar. */
function varsayilanTavanlar(): { ad: string; deger: number; dosya: string }[] {
  const cikan: { ad: string; deger: number; dosya: string }[] = [];

  for (const yol of kaynakDosyalar(istemciKoku)) {
    const icerik = readFileSync(yol, "utf8");
    for (const eslesme of icerik.matchAll(
      /export const (DEFAULT_[A-Z_]*LIMIT)\s*=\s*(\d+)\s*;/g
    )) {
      cikan.push({
        ad: eslesme[1],
        deger: Number(eslesme[2]),
        dosya: path.relative(istemciKoku, yol).split(path.sep).join("/"),
      });
    }
  }

  return cikan;
}

describe("PostgREST satır tavanı (v1.5-09 · §4.12)", () => {
  it("varsayılan tavanlar bulunabildi", () => {
    // Ayrıştırma bozulursa aşağıdaki iddia boş listeyi ölçer ve sessizce
    // yeşil geçer. Bu iddia onu engelliyor: depoda ölçüldü, on dokuz tavan
    // var ve hepsi `export const DEFAULT_…_LIMIT` biçiminde.
    expect(varsayilanTavanlar().length).toBeGreaterThanOrEqual(15);
  });

  it("🔴 hiçbir varsayılan tavan PostgREST tavanına eşit veya üstünde değil", () => {
    // Eşit olduğu an `truncated` bayrağı anlamını yitirir: gelen satır sayısı
    // "uygulamanın istediği kadar" mı "sunucunun izin verdiği kadar" mı
    // olduğunu söylemez.
    const asanlar = varsayilanTavanlar()
      .filter(t => t.deger >= POSTGREST_MAX_ROWS)
      .map(t => `${t.dosya}: ${t.ad} = ${t.deger}`);

    expect(asanlar).toEqual([]);
  });

  it("🔴 sayfalı okumaların sayfa boyu PostgREST tavanının altında", () => {
    // 2026-10-03: ders programı sayfa sayfa okunuyor. Sayfa boyu tavana eşit
    // ya da üstünde olsaydı, tavan düşürüldüğünde her sayfa eksik gelir ve
    // döngü onu "son sayfa" sanıp sessizce dururdu.
    const asanlar: string[] = [];
    let bulunan = 0;
    for (const yol of kaynakDosyalar(istemciKoku)) {
      const icerik = readFileSync(yol, "utf8");
      for (const eslesme of icerik.matchAll(
        /const ([A-Z_]*PAGE_SIZE)\s*=\s*(\d+)\s*;/g
      )) {
        bulunan += 1;
        if (Number(eslesme[2]) >= POSTGREST_MAX_ROWS) {
          asanlar.push(`${eslesme[1]} = ${eslesme[2]}`);
        }
      }
    }
    // Ayrıştırma bozulursa boş liste sessizce yeşil geçmesin.
    expect(bulunan).toBeGreaterThanOrEqual(1);
    expect(asanlar).toEqual([]);
  });

  it("tavan tek bir yerde tanımlı (K-06)", () => {
    // Sayı `homeworkService.ts` içinde yaşıyordu ve orada kalsaydı ikinci bir
    // kopyanın sessizce eklenmesini hiçbir şey engellemezdi.
    const tanimlar: string[] = [];

    for (const yol of kaynakDosyalar(istemciKoku)) {
      const icerik = readFileSync(yol, "utf8");
      if (/(?:export )?const POSTGREST_MAX_ROWS\s*=/.test(icerik)) {
        tanimlar.push(
          path.relative(istemciKoku, yol).split(path.sep).join("/")
        );
      }
    }

    expect(tanimlar).toEqual(["lib/postgrestLimits.ts"]);
  });

  it("ölçümün tarihi, değeri ve yeniden doğrulama yolu yazılı", () => {
    // ⚠️ Bir davranışı değil bir **kaydı** koruyor (**K-10**). İki yönü var:
    //
    //   - Sayının ÖLÇÜLDÜĞÜ ve ne zaman ölçüldüğü — tarihsiz bir sayı bir yıl
    //     sonra hâlâ doğru sanılır.
    //   - Yeniden doğrulama yolunun yazılı olması — değer panelden değişebilir
    //     ve o gün soruyu soran kişi nereye bakacağını bilmek zorunda.
    //
    // Ayrıca düşürmenin tehlikeli olduğu uyarısı: `homeworkService` tavanını
    // açıkça bu sayı olarak istiyor, düşürülürse eksik veri tam sanılır.
    const icerik = readFileSync(
      path.join(istemciKoku, "lib", "postgrestLimits.ts"),
      "utf8"
    );

    expect(icerik).toContain("ÜRETİMDE ÖLÇÜLDÜ (2026-09-18): 1000");
    expect(icerik).toContain("Settings → API → Max rows");
    expect(icerik).toContain("DÜŞÜRÜLMEMELİ");
  });
});

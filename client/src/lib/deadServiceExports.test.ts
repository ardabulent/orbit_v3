import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Çağıranı olmayan servis ihracı kalmaz (v1.4 ara denetimi, **K-19**).
 *
 * Bu test bir davranışı değil bir **tekrarı** ölçüyor. v1.4 boyunca aynı kusur
 * üç kez çıktı: servis yazıldı, testi yazıldı, kapı yeşil geçti — ve ekranda
 * onu çağıran hiçbir şey yoktu.
 *
 *   - v1.4-04: `updateExam` ve `archiveExam` (sınav düzenleme hiç açılmadı)
 *   - v1.4-05: ödev tarafında üç fonksiyon
 *   - v1.4-08'e kadar: `restoreStudent` ve `restoreClass`
 *
 * Üçü de teslim incelemesinde **elle** yakalandı ("ihraç ettiğin her fonksiyonun
 * çağıranı olduğunu ayrıca kontrol edeceğim"). Elle yapılan bir kontrol, onu
 * yapan kişi yorulduğunda biter; bu dosya o kontrolü kapıya taşıyor.
 *
 * ## Kapsam açıkça dardır (**K-19**)
 *
 * Yalnız **`export async function`** sayılır. Gerekçe: `async` bir ihraç
 * neredeyse her zaman bir ağ çağrısıdır — yani bir **servis**. Çağıranı olmayan
 * bir servis, ekranda karşılığı olmayan bir yetenektir ve tam olarak yukarıdaki
 * kusurdur.
 *
 * Senkron ihraçlar **bilerek** dışarıda: saf bir yardımcıyı yalnız kendi birim
 * testi için ihraç etmek meşru bir desendir ve bugün depoda dördü öyle
 * (`buildLoginNumber`, `weekDayToIso`, `dateToIsoWeekDay`, `__writeRawForTest`).
 * Onları da kapsasaydı bu test kuralı değil gürültüyü zorunlu kılardı.
 *
 * ## Bir fonksiyon "çağrılıyor" sayılır
 *
 *   - adı kendi dosyasında tanımından **başka bir yerde** geçiyorsa
 *     (dosya içi yardımcı; tanımın altında da olabilir, üstünde de), **veya**
 *   - test olmayan başka bir kaynak dosyada geçiyorsa.
 *
 * Test dosyaları **çağıran sayılmaz** — kusurun tanımı zaten "testi var,
 * çağıranı yok".
 */

const istemciKoku = path.resolve(import.meta.dirname, "..");

/**
 * Yorumları söker.
 *
 * ⚠️ Bu gerekli, süs değil: bu testin ilk hali `restoreStudent`'ı "çağrılıyor"
 * saydı çünkü adı `EducationPlatform.tsx`'te **yalnızca bir yorumda** geçiyordu.
 * Bir yorum çağıran değildir; tam tersine, ölü bir fonksiyonun en sık bulunduğu
 * yer onu anlatan yorumdur. K-23 mutasyonu (bağlantıyı geri alma) bu zaafı
 * gösterdi ve testin kendisi düzeltildi.
 */
function yorumlariSok(icerik: string): string {
  return icerik
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");
}

/** `client/src` altındaki test olmayan tüm TypeScript kaynaklarını toplar. */
function kaynakDosyalar(kok: string): string[] {
  const bulunan: string[] = [];
  for (const girdi of readdirSync(kok, { withFileTypes: true })) {
    const tamYol = path.join(kok, girdi.name);
    if (girdi.isDirectory()) {
      bulunan.push(...kaynakDosyalar(tamYol));
      continue;
    }
    if (!/\.tsx?$/.test(girdi.name)) continue;
    if (/\.(test|spec)\.tsx?$/.test(girdi.name)) continue;
    bulunan.push(tamYol);
  }
  return bulunan;
}

/**
 * Kabul edilmiş ölü yüzey. Buraya bir satır eklemek bir **karar**dır: nerede
 * kayıtlı olduğunu ve kimin sahiplendiğini yazmadan ekleme.
 */
const KABUL_EDILMIS_OLU = new Map<string, string>([
  // 2026-10-12: tek satır olan `lib/documents.ts` silindi, tablosu da göç
  // 20261028000000 ile düşürüldü (#148). Liste boş; boş kalması hedeftir.
]);

/**
 * Bir dosyanın hangi adları hangi modülden içe aktardığını çıkarır.
 * Dönen her giriş: [çözümlenmiş modül yolu, içe aktarılan ad].
 */
function iceAktarmalar(yol: string, icerik: string): [string, string][] {
  const cikan: [string, string][] = [];
  const desen = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  for (const eslesme of icerik.matchAll(desen)) {
    const modul = cozumle(yol, eslesme[2]);
    if (!modul) continue;
    for (const ham of eslesme[1].split(",")) {
      const ad = ham
        .replace(/^\s*type\s+/, "")
        .trim()
        .split(/\s+as\s+/)[0];
      if (ad) cikan.push([modul, ad]);
    }
  }
  return cikan;
}

/** `@/x/y` ve `./y` biçimlerini uzantısız mutlak yola çevirir. */
function cozumle(kaynakDosya: string, belirtec: string): string | null {
  if (belirtec.startsWith("@/")) {
    return path.join(istemciKoku, belirtec.slice(2));
  }
  if (belirtec.startsWith(".")) {
    return path.resolve(path.dirname(kaynakDosya), belirtec);
  }
  return null;
}

/** Uzantıyı atarak karşılaştırılabilir bir anahtar üretir. */
function anahtarla(yol: string): string {
  return yol.replace(/[.](ts|tsx)$/, "");
}

/**
 * Bir dosyanın hangi adlarla içe aktarılabileceğini döner.
 *
 * ⚠️ `index.ts` İKİ ADLA aranır: kendi yolu **ve bulunduğu dizin**. Çünkü
 * `import { x } from "@/realtime"` bir dizin importudur ve derleyici onu
 * `realtime/index.ts`'e çözer — bu testin ilk hali çözmüyordu ve
 * `client/src/realtime/index.ts`'in **kullanılan** re-export'larını "sahipsiz"
 * gösterdi (ölçüldü: sekiz yanlış pozitif, biri gerçekten çağrılan
 * `useOrganizationChannel`).
 */
function olasiAnahtarlar(yol: string): string[] {
  const kendi = anahtarla(yol);
  if (/^index[.](ts|tsx)$/.test(path.basename(yol))) {
    return [kendi, anahtarla(path.dirname(yol))];
  }
  return [kendi];
}

describe("servis katmanında ölü ihraç kalmaz (v1.4 ara denetimi)", () => {
  const dosyalar = kaynakDosyalar(istemciKoku);
  const icerikler = new Map(
    dosyalar.map(yol => [yol, yorumlariSok(readFileSync(yol, "utf8"))])
  );

  it("her `export async function` en az bir yerden çağrılıyor", () => {
    const cagiransiz: string[] = [];

    for (const [yol, icerik] of icerikler) {
      const goreceli = path
        .relative(istemciKoku, yol)
        .split(path.sep)
        .join("/");
      if (KABUL_EDILMIS_OLU.has(goreceli)) continue;

      for (const eslesme of icerik.matchAll(/export async function (\w+)/g)) {
        const ad = eslesme[1];
        // ⚠️ Sayma ve arama AYRI regex'ler. `/g` bayraklı bir regex `.test()`
        // çağrıları arasında `lastIndex` taşır; tek bir örneği yeniden
        // kullanmak dosyaların yarısını "geçmiyor" gösteriyordu (ölçüldü: 87
        // yanlış pozitif).
        const sayma = new RegExp(String.raw`\b${ad}\b`, "g");
        const arama = new RegExp(String.raw`\b${ad}\b`);

        // Kendi dosyasında tanım dışında bir kez daha geçiyorsa kullanılıyor.
        if ((icerik.match(sayma) ?? []).length > 1) continue;

        // Ya da test olmayan başka bir kaynakta geçiyorsa.
        const baskaDosyada = [...icerikler].some(
          ([digerYol, digerIcerik]) =>
            digerYol !== yol && arama.test(digerIcerik)
        );
        if (baskaDosyada) continue;

        cagiransiz.push(`${ad} :: ${goreceli}`);
      }
    }

    // Hata mesajı "false !== true" değil, hangi fonksiyon olduğunu söylesin.
    expect(cagiransiz).toEqual([]);
  });

  it("kabul edilmiş ölü yüzey hâlâ ölü — kullanılmaya başlandıysa listeden çıkmalı", () => {
    // Muafiyet listesi bir kez yazılıp unutulan bir şey olmasın: muaf tutulan
    // dosya canlandığında bu iddia kırmızıya döner ve satırın silinmesini
    // ister. Aksi halde liste, gerçek kuralı sessizce yiyen bir çöplük olur.
    for (const [goreceli] of KABUL_EDILMIS_OLU) {
      const yol = path.join(istemciKoku, goreceli);
      const ad = path.basename(goreceli, path.extname(goreceli));
      const iceAktaran = [...icerikler].filter(
        ([digerYol, icerik]) =>
          digerYol !== yol && new RegExp(`["'][^"']*${ad}["']`).test(icerik)
      );
      expect(iceAktaran.map(([y]) => y)).toEqual([]);
    }
  });

  it("bir re-export'u o modülden içe aktaran biri vardır", () => {
    // ⚠️ Yukarıdaki iddianın kör noktası. `export { x } from "./y"` bir
    // fonksiyon TANIMI değil, dolayısıyla `export async function` taraması onu
    // hiç görmez — ve "x'in bir çağıranı var mı" sorusu da yanlış soru: çağıran
    // olabilir ama onu ASIL modülden alıyor olabilir. Doğru soru şu: bu adı
    // BU modülden içe aktaran biri var mı?
    //
    // Kaynak: v1.4-09. `memberService.ts` "geriye dönük uyumluluk için"
    // `loadOrganizationBranches`'ı yeniden ihraç etti; tek tüketici onu zaten
    // `branchService`'ten alıyordu. Aynı aileden ikinci vaka (v1.4-10'da
    // `popover.tsx`'e çağıranı olmayan bir `portal` prop'u eklenmişti) — bir
    // kural iki kez elle yakalandıysa kapıya taşınır (**K-24**).
    const istenenler = new Set<string>();
    for (const [yol, icerik] of icerikler) {
      for (const [modul, ad] of iceAktarmalar(yol, icerik)) {
        istenenler.add(`${anahtarla(modul)}::${ad}`);
      }
    }

    const sahipsiz: string[] = [];
    for (const [yol, icerik] of icerikler) {
      const desen = /export\s*\{([^}]*)\}\s*from\s*["'][^"']+["']/g;
      for (const eslesme of icerik.matchAll(desen)) {
        for (const ham of eslesme[1].split(",")) {
          const ad = ham
            .replace(/^\s*type\s+/, "")
            .trim()
            .split(/\s+as\s+/)[0];
          if (!ad) continue;
          if (olasiAnahtarlar(yol).some(k => istenenler.has(`${k}::${ad}`)))
            continue;
          sahipsiz.push(
            `${ad} :: ${path.relative(istemciKoku, yol).split(path.sep).join("/")}`
          );
        }
      }
    }

    expect(sahipsiz).toEqual([]);
  });

  it("`from` içermeyen bir yeniden ihraç da sahipsiz kalmaz", () => {
    // ⚠️ Yukarıdaki iddianın KENDİ kör noktası ve ölçülerek bulundu (v1.4-16).
    // Deseni `export { x } from "./y"` arıyor. Ama aynı şey iki satırda da
    // yazılabiliyor:
    //
    //   import { type AttendanceWeek } from "./reportService";
    //   export type { AttendanceWeek };
    //
    // İkincisinde `from` yok, dolayısıyla desen onu hiç görmüyordu.
    // `educationQueries.ts` tam bunu yaptı; tek tüketici tipleri zaten
    // `reportService`'ten alıyordu. **Aynı kuralın üçüncü vakası** — ve bir
    // kuralın yeni bir yazım biçimi, yeni bir kural değildir (**K-24**).
    //
    // Yerel olarak TANIMLANMIŞ bir adın `export { x }` ile ihraç edilmesi
    // normaldir ve buraya girmez: ayrım, adın bu dosyaya **başka bir modülden
    // içe aktarılmış** olmasıdır.
    const istenenler = new Set<string>();
    for (const [yol, icerik] of icerikler) {
      for (const [modul, ad] of iceAktarmalar(yol, icerik)) {
        istenenler.add(`${anahtarla(modul)}::${ad}`);
      }
    }

    const sahipsiz: string[] = [];
    for (const [yol, icerik] of icerikler) {
      const iceAktarilanlar = new Set(
        iceAktarmalar(yol, icerik).map(([, ad]) => ad)
      );
      const desen = /export\s+(?:type\s+)?\{([^}]*)\}\s*;/g;
      for (const eslesme of icerik.matchAll(desen)) {
        for (const ham of eslesme[1].split(",")) {
          const ad = ham
            .replace(/^\s*type\s+/, "")
            .trim()
            .split(/\s+as\s+/)[0];
          if (!ad) continue;
          if (!iceAktarilanlar.has(ad)) continue;
          if (olasiAnahtarlar(yol).some(k => istenenler.has(`${k}::${ad}`)))
            continue;
          sahipsiz.push(
            `${ad} :: ${path.relative(istemciKoku, yol).split(path.sep).join("/")}`
          );
        }
      }
    }

    expect(sahipsiz).toEqual([]);
  });
});

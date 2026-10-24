import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Her Edge Function'ın saatlik sınırı açıkça yazılıdır (2026-10-25, ana plan 2.8).
 *
 * Sınırlar `internal_begin_function_call` içindeki `case` listesinde yaşar.
 * Listede olmayan bir fonksiyon sessizce sınırsız kalmaz, varsayılan 10/saat'e
 * düşer (K-04). Ama varsayılan bir emniyet ağıdır, karar değildir: 2.8
 * gözden geçirmesinde `recovery-email`'in sınırı hiç yazılmadan varsayılana
 * düştüğü görüldü. Değer doğruydu; doğru olduğunu söyleyen bir karar yoktu.
 *
 * Bu test iki şeyi zorlar:
 *   1. Oturumla çağrılan her fonksiyon ortak kapıdan (`beginFunctionCall`)
 *      geçer.
 *   2. Kapıya verilen her ad, kapının en son tanımında açık bir sınırla
 *      geçer.
 *
 * Bilinçli muafiyet: `request-password-reset` oturumsuz çağrılır (kapı
 * çağıranın kimliğine göre sayar). Onun sınırı GoTrue ve fonksiyonun kendi
 * hesap başına kontrolündedir; genel sınırı ana plan 2.13'tür.
 */

const depoKoku = path.resolve(import.meta.dirname, "..", "..", "..");
const fonksiyonlarKoku = path.join(depoKoku, "supabase", "functions");
const gocKoku = path.join(depoKoku, "supabase", "migrations");

const KAPIDAN_MUAF: Record<string, string> = {
  "request-password-reset": "oturumsuz; genel sınır ana plan 2.13",
};

function fonksiyonDizinleri(): string[] {
  return readdirSync(fonksiyonlarKoku, { withFileTypes: true })
    .filter(giris => giris.isDirectory() && !giris.name.startsWith("_"))
    .map(giris => giris.name)
    .sort();
}

/** Kapının en son tanımındaki açık sınırlar: ad → saatlik adet. */
function kapidakiSinirlar(): Map<string, number> {
  const dosyalar = readdirSync(gocKoku)
    .filter(ad => ad.endsWith(".sql"))
    .sort();
  let govde: string | null = null;
  for (const ad of dosyalar) {
    const metin = readFileSync(path.join(gocKoku, ad), "utf8");
    const bas = metin.search(
      /create or replace function public\.internal_begin_function_call\s*\(/i
    );
    if (bas === -1) continue;
    // Sınır listesi gövdenin başında; sonraki bir tanım aynı biçimde
    // `when '…' then <sayı>` taşımıyor.
    govde = metin.slice(bas, bas + 6000);
  }
  expect(govde, "kapının tanımı göçlerde bulunamadı").not.toBeNull();
  const sinirlar = new Map<string, number>();
  for (const eslesme of govde!.matchAll(/when\s+'([a-z-]+)'\s+then\s+(\d+)/g)) {
    sinirlar.set(eslesme[1], Number(eslesme[2]));
  }
  return sinirlar;
}

/** `beginFunctionCall(istemci, "ad", …)` çağrılarındaki adlar. */
function kapiyaVerilenAdlar(kaynak: string): string[] {
  return [
    ...kaynak.matchAll(/beginFunctionCall\(\s*[A-Za-z_]+\s*,\s*"([a-z-]+)"/g),
  ].map(eslesme => eslesme[1]);
}

describe("Edge Function hız sınırları açıkça yazılıdır (ana plan 2.8)", () => {
  const sinirlar = kapidakiSinirlar();

  it("kapının sınır listesi okunabildi", () => {
    // Ayrıştırma bozulursa aşağıdakiler boş küme üzerinde yeşil geçerdi.
    expect(sinirlar.size).toBeGreaterThan(5);
    expect(sinirlar.get("create-member")).toBeGreaterThan(0);
  });

  for (const ad of fonksiyonDizinleri()) {
    it(`${ad}: kapıdan geçer ve sınırı yazılıdır`, () => {
      const kaynak = readFileSync(
        path.join(fonksiyonlarKoku, ad, "index.ts"),
        "utf8"
      );
      const adlar = kapiyaVerilenAdlar(kaynak);

      if (ad in KAPIDAN_MUAF) {
        expect(adlar, `${ad} muaf listesinde ama kapıyı çağırıyor`).toEqual([]);
        return;
      }

      expect(
        adlar,
        `${ad} ortak kapıdan (beginFunctionCall) geçmiyor`
      ).not.toEqual([]);
      for (const kapiAdi of adlar) {
        expect(
          sinirlar.has(kapiAdi),
          `"${kapiAdi}" için internal_begin_function_call'da açık sınır yok (varsayılana düşüyor)`
        ).toBe(true);
      }
    });
  }
});

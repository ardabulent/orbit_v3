import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCRUB_RULES } from "../../../client/src/errorReporting/scrubErrorText";

/**
 * Kişisel veri ayıklama kurallarının ikizliği (2026-10-23, ana plan 1.1, **K-19**).
 *
 * Kural iki yerde çalışır: istemcide veri yola çıkmasın diye
 * (`scrubErrorText.ts`), sunucuda istemciye güvenilmediği için
 * (`internal_scrub_error_text`). İkisi elle eşit tutuluyordu ve kapısı yoktu;
 * biri genişleyip öbürü kalırsa ekran "ayıklanmıştır" derken veri sunucuda
 * ayıklanmadan durur ya da tersi.
 *
 * Bu test, fonksiyonu en son tanımlayan göçteki `regexp_replace` desenlerinin
 * istemcideki `SCRUB_RULES` ile AYNI metinde ve AYNI sırada olmasını ister.
 * Desenlerin iki motorda aynı sonucu verdiğini ise iki taraftaki örnek testler
 * ölçer (`scrubErrorText.test.ts`, `client_error_reports.test.sql`).
 */

const depoKoku = path.resolve(import.meta.dirname, "..", "..", "..");
const migrationKoku = path.join(depoKoku, "supabase", "migrations");

function sonTanim(): { dosya: string; govde: string } {
  const dosyalar = readdirSync(migrationKoku)
    .filter(ad => ad.endsWith(".sql"))
    .sort();
  for (const dosya of dosyalar.reverse()) {
    const metin = readFileSync(path.join(migrationKoku, dosya), "utf8");
    const bas = metin.search(
      /create (or replace )?function public\.internal_scrub_error_text/
    );
    if (bas >= 0) {
      const son = metin.indexOf("$$;", bas);
      return { dosya, govde: metin.slice(bas, son) };
    }
  }
  throw new Error("internal_scrub_error_text tanımı bulunamadı");
}

function sunucuKurallari(govde: string) {
  const kurallar: { pattern: string; replacement: string }[] = [];
  const desen = /'((?:[^']|'')*)',\s*'(\[[^\]]+\])',\s*'g'/g;
  for (const eslesme of govde.matchAll(desen))
    kurallar.push({
      pattern: eslesme[1].replace(/''/g, "'"),
      replacement: eslesme[2],
    });
  return kurallar;
}

describe("kişisel veri ayıklama kuralları istemci ↔ sunucu", () => {
  it("son göçteki desenler istemcideki SCRUB_RULES ile aynı metin ve sırada", () => {
    const { dosya, govde } = sonTanim();
    expect(
      sunucuKurallari(govde),
      `${dosya} ile client/src/errorReporting/scrubErrorText.ts ayrışmış`
    ).toEqual(SCRUB_RULES.map(k => ({ ...k })));
  });

  it("sunucu en az dört kural taşıyor (çıkarıcı boş dönmüyor)", () => {
    expect(sunucuKurallari(sonTanim().govde).length).toBeGreaterThanOrEqual(4);
  });
});

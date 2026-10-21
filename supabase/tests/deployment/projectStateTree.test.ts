import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Klasör ağacı sapma testi (2026-10-21).
 *
 * `.ai/PROJECT_STATE.md` §5 "hangi modül ne yapar" sorusunun tek cevabı ve
 * `AGENTS.md` yeni geliştiriciyi oraya gönderiyor. Ağaç elle tutuluyordu ve
 * dört kez geride kaldı: 2026-09-16'da dokuz, 2026-09-19'da iki, 2026-10-18
 * denetiminde on dört dosya ağaçta yoktu. Her seferinde belgeye bir
 * "sonradan düzeltme" yazıldı; düzeltme notu bir kapı değildir.
 *
 * Kural: veri katmanı klasörlerinin doğrudan altındaki her `.ts`/`.tsx`
 * dosyasının adı (uzantısız) belgede bir kez geçmeli. Açıklama ölçülmez —
 * yalnız varlık. Test dosyaları ve alt klasörler (`components/`, `pages/`
 * altındaki ekranlar) kapsam dışı; onlar ekran, servis değil.
 */

const depoKoku = path.resolve(import.meta.dirname, "..", "..", "..");
const istemciKoku = path.join(depoKoku, "client", "src");
const belge = readFileSync(
  path.join(depoKoku, ".ai", "PROJECT_STATE.md"),
  "utf8"
);

const KLASORLER = [
  "auth",
  "education",
  "organization",
  "audit",
  "communication",
  "realtime",
  "settings",
  "platform",
  "errorReporting",
  "lib",
  "theme",
  "contexts",
  "hooks",
];

function modulDosyalari(klasor: string): string[] {
  return readdirSync(path.join(istemciKoku, klasor), { withFileTypes: true })
    .filter(girdi => girdi.isFile())
    .map(girdi => girdi.name)
    .filter(ad => /\.(ts|tsx)$/.test(ad) && !/\.(test|spec)\./.test(ad));
}

describe("PROJECT_STATE §5 klasör ağacı", () => {
  it.each(KLASORLER)("%s/ altındaki her modül belgede geçer", klasor => {
    const eksik = modulDosyalari(klasor).filter(
      ad => !belge.includes(ad.replace(/\.(ts|tsx)$/, ""))
    );
    expect(
      eksik,
      `Bu dosyaları .ai/PROJECT_STATE.md §5 ağacına ekleyin (tek satır açıklamayla): ${eksik.join(", ")}`
    ).toEqual([]);
  });

  it("listelenen klasörlerin hepsi gerçekten var ve boş değil", () => {
    for (const klasor of KLASORLER)
      expect(modulDosyalari(klasor).length, klasor).toBeGreaterThan(0);
  });
});

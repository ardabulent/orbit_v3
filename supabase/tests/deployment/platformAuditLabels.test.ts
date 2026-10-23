import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLATFORM_ACTION_LABELS,
  platformActionDetail,
} from "../../../client/src/platform/platformAuditLabels";

/**
 * Platform denetim kodlarının Türkçe karşılığı (2026-10-23, ana plan 1.6).
 *
 * Test turu B13: kurum silme reddedildiğinde yazılan
 * "platform.organization_delete_refused" kodunun etiketi yoktu; operatör
 * panelinde ham kod olarak görünüyordu. Kodu yazan SQL/Edge ile ekranı
 * okuyan etiket listesi ayrı yerlerde ve aralarında kapı yoktu (K-19).
 *
 * Bu test göçlerde ve Edge Function'larda geçen her `platform.<kod>`
 * dizgisinin `platformAuditLabels.ts`'te bir karşılığı olmasını ister.
 */

const depoKoku = path.resolve(import.meta.dirname, "..", "..", "..");

function dosyalar(kok: string, uzanti: string): string[] {
  return readdirSync(kok).flatMap(ad => {
    const tam = path.join(kok, ad);
    if (statSync(tam).isDirectory()) return dosyalar(tam, uzanti);
    return ad.endsWith(uzanti) ? [tam] : [];
  });
}

function yazilanKodlar(): string[] {
  const kaynaklar = [
    ...dosyalar(path.join(depoKoku, "supabase", "migrations"), ".sql"),
    ...dosyalar(path.join(depoKoku, "supabase", "functions"), ".ts"),
  ];
  const kodlar = new Set<string>();
  for (const dosya of kaynaklar) {
    const metin = readFileSync(dosya, "utf8");
    for (const eslesme of metin.matchAll(/['"](platform\.[a-z_]+)['"]/g))
      kodlar.add(eslesme[1]);
  }
  return [...kodlar].sort();
}

describe("platform denetim kodları", () => {
  it("yazılan her platform.* kodunun Türkçe etiketi var", () => {
    const eksik = yazilanKodlar().filter(kod => !PLATFORM_ACTION_LABELS[kod]);
    expect(
      eksik,
      `client/src/platform/platformAuditLabels.ts'e ekleyin: ${eksik.join(", ")}`
    ).toEqual([]);
  });

  it("tarayıcı en az bilinen dört kodu buluyor (desen boş dönmüyor)", () => {
    expect(yazilanKodlar().length).toBeGreaterThanOrEqual(4);
  });
});

describe("gece temizliğinin ayrıntısı", () => {
  it("yalnız sıfırdan büyük sayıları Türkçe yazar", () => {
    expect(
      platformActionDetail("platform.retention_purged", {
        messages: 12,
        message_notifications: 3,
        conversations: 0,
        client_error_reports: 1,
        email_deliveries: 0,
      })
    ).toBe("12 mesaj, 3 mesaj bildirimi, 1 ekran hata kaydı");
  });

  it("başka olayda ayrıntı çizmez", () => {
    expect(
      platformActionDetail("platform.organization_created", { messages: 1 })
    ).toBeNull();
  });
});

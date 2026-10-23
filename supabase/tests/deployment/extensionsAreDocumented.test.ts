import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Göçle açılan eklentiler ve zamanlanmış işler belgede adıyla geçer
 * (2026-10-23, kayıt denetimi).
 *
 * `PROJECT_STATE.md` §4'ün yığın listesi iki kez eskidi (2026-09-16 ve
 * 2026-10-23); ikincisinde #496 Supabase'in varsayılan eklentilerini
 * "göçle açılan" diye yazmıştı. Elle tutulan liste kapıya bağlanmadıkça
 * eskiyor (K-08). Bu test göçlerdeki her `create extension` ve her
 * `cron.schedule('<ad>'` için adın §4'te geçmesini ister.
 */

const kok = path.resolve(import.meta.dirname, "..", "..", "..");
const goclerKlasoru = path.join(kok, "supabase", "migrations");

function goclerdeGecenler(desen: RegExp): string[] {
  const adlar = new Set<string>();
  for (const dosya of readdirSync(goclerKlasoru)) {
    if (!dosya.endsWith(".sql")) continue;
    const metin = readFileSync(path.join(goclerKlasoru, dosya), "utf8");
    for (const eslesme of metin.matchAll(desen)) adlar.add(eslesme[1]);
  }
  return [...adlar].sort();
}

function yiginBolumu(): string {
  const belge = readFileSync(path.join(kok, ".ai", "PROJECT_STATE.md"), "utf8");
  const bas = belge.indexOf("## 4. Teknoloji Yığını");
  const son = belge.indexOf("\n## 5.", bas);
  expect(bas, "PROJECT_STATE §4 başlığı bulunamadı").toBeGreaterThan(-1);
  return belge.slice(bas, son === -1 ? undefined : son);
}

describe("eklenti ve zamanlanmış iş kaydı", () => {
  it("göçle açılan her eklenti PROJECT_STATE §4'te adıyla geçer", () => {
    const eklentiler = goclerdeGecenler(
      /create\s+extension\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_-]+)"?/gi
    ).filter(ad => ad !== "pgtap");
    expect(eklentiler).toContain("pg_cron");
    const bolum = yiginBolumu();
    const eksik = eklentiler.filter(ad => !bolum.includes(`\`${ad}\``));
    expect(eksik, `PROJECT_STATE §4'e ekleyin: ${eksik.join(", ")}`).toEqual(
      []
    );
  });

  it("her zamanlanmış iş PROJECT_STATE §4'te adıyla geçer", () => {
    const isler = goclerdeGecenler(/cron\.schedule\(\s*'([^']+)'/g);
    expect(isler).toContain("orbit-saklama-temizligi");
    const bolum = yiginBolumu();
    const eksik = isler.filter(ad => !bolum.includes(`\`${ad}\``));
    expect(eksik, `PROJECT_STATE §4'e ekleyin: ${eksik.join(", ")}`).toEqual(
      []
    );
  });
});

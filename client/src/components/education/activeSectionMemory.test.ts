import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTION,
  readActiveSection,
  writeActiveSection,
} from "./activeSectionMemory";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("açık sekme belleği", () => {
  it("yenilemede aynı sekme açılır", () => {
    const s = memory();
    writeActiveSection(s, "u1", "Raporlar");
    expect(readActiveSection(s, "u1", "admin")).toBe("Raporlar");
  });

  it("başka kullanıcının sekmesi okunmaz (ortak bilgisayar)", () => {
    const s = memory();
    writeActiveSection(s, "u1", "Raporlar");
    expect(readActiveSection(s, "u2", "admin")).toBe(DEFAULT_SECTION);
  });

  it("rolün menüsünde olmayan sekme saklıysa Genel Bakış açılır", () => {
    const s = memory();
    writeActiveSection(s, "u1", "Kayıt ve Ödemeler");
    expect(readActiveSection(s, "u1", "teacher")).toBe(DEFAULT_SECTION);
  });

  it("bellek yoksa ya da kullanıcı yoksa Genel Bakış", () => {
    expect(readActiveSection(undefined, "u1", "admin")).toBe(DEFAULT_SECTION);
    expect(readActiveSection(memory(), "", "admin")).toBe(DEFAULT_SECTION);
  });

  it("bozuk bellek uygulamayı düşürmez", () => {
    const bozuk = {
      getItem: () => {
        throw new Error("erişim yok");
      },
    };
    expect(readActiveSection(bozuk, "u1", "admin")).toBe(DEFAULT_SECTION);
  });
});

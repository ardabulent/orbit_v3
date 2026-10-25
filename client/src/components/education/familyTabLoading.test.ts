import { describe, expect, it } from "vitest";
import { shouldLoadForTab } from "./familyTabLoading";

describe("shouldLoadForTab", () => {
  it("personel Genel Bakış'ta kurum listelerini okumaz (ana plan 5.2)", () => {
    expect(shouldLoadForTab("admin", "Genel Bakış", ["Ödevler"])).toBe(false);
    expect(shouldLoadForTab("teacher", "Genel Bakış", ["Ödevler"])).toBe(false);
  });

  it("personel listeyi kendi sekmelerinden birinde okur", () => {
    const staff = ["Öğrenciler", "Yoklama", "Ödevler"] as const;
    expect(shouldLoadForTab("admin", "Yoklama", ["Ödevler"], staff)).toBe(true);
    expect(shouldLoadForTab("teacher", "Ödevler", ["Ödevler"], staff)).toBe(
      true
    );
    expect(shouldLoadForTab("admin", "Sınavlar", ["Ödevler"], staff)).toBe(
      false
    );
  });

  it("personel sekmeleri öğrenci ve veliyi genişletmez", () => {
    const staff = ["Öğrenciler", "Yoklama", "Ödevler"] as const;
    expect(shouldLoadForTab("parent", "Yoklama", ["Ödevler"], staff)).toBe(
      false
    );
  });

  it("listeyi kullanan sekme rolün menüsünde yoksa hiç okunmaz", () => {
    expect(
      shouldLoadForTab("teacher", "Kayıt ve Ödemeler", ["Kayıt ve Ödemeler"])
    ).toBe(false);
  });

  it("öğrenci ve veli Genel Bakış'ta kurum listelerini okumaz", () => {
    expect(shouldLoadForTab("student", "Genel Bakış", ["Ödevler"])).toBe(false);
    expect(
      shouldLoadForTab("parent", "Genel Bakış", ["Kayıt ve Ödemeler"])
    ).toBe(false);
  });

  it("öğrenci ve veli, listeyi gösteren sekme açıkken okur", () => {
    expect(shouldLoadForTab("student", "Ödevler", ["Ödevler"])).toBe(true);
    expect(
      shouldLoadForTab("parent", "Kayıt ve Ödemeler", ["Kayıt ve Ödemeler"])
    ).toBe(true);
  });
});

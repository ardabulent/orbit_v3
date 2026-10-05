import { describe, expect, it } from "vitest";
import { shouldLoadForTab } from "./familyTabLoading";

describe("shouldLoadForTab", () => {
  it("personel için her sekmede okur (davranış değişmedi)", () => {
    expect(shouldLoadForTab("admin", "Genel Bakış", ["Ödevler"])).toBe(true);
    expect(shouldLoadForTab("teacher", "Genel Bakış", ["Ödevler"])).toBe(true);
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

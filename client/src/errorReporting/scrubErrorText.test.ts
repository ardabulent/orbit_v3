import { describe, expect, it } from "vitest";
import { scrubErrorText, scrubPath } from "./scrubErrorText";

describe("scrubErrorText", () => {
  it("e-postayı ve uzun sayıları ayıklar", () => {
    expect(
      scrubErrorText(
        "Ayşe ayse.koc@example.test için 78018106 kaydı, tel 05321234567",
        500
      )
    ).toBe("Ayşe [e-posta] için [sayı] kaydı, tel [sayı]");
  });

  // Test turu B6 (2026-10-18): bunların hepsi ayıklanmadan kayda düşüyordu.
  it.each([
    ["0532 111 22 33", "[sayı]"],
    ["+90 (532) 111-22-33", "[sayı]"],
    ["532-111-2233", "[sayı]"],
    ["0 532 111 22 33", "0 [sayı]"],
    ["(0532) 111 22 33", "[sayı]"],
    ["0212.555.12.34", "[sayı]"],
    ["TC 123-456-789-01 bulunamadı", "TC [sayı] bulunamadı"],
    ["TC 123 456 789 01", "TC [sayı]"],
    ["TR33 0006 1005 1978 6457 8413 26", "[iban]"],
    ["tr330006100519786457841326", "[iban]"],
  ])("ayraçlı kişisel numarayı ayıklar: %s", (girdi, beklenen) => {
    expect(scrubErrorText(girdi, 500)).toBe(beklenen);
  });

  it("kısa sayılara dokunmaz (satır, sütun, durum kodu, sürüm, saat)", () => {
    expect(
      scrubErrorText("app.js:120:45 HTTP 403 vite 8.3.5 saat 09:00", 500)
    ).toBe("app.js:120:45 HTTP 403 vite 8.3.5 saat 09:00");
  });

  it("tarih de ayıklanır — doğum tarihi olabilir, bilerek", () => {
    expect(scrubErrorText("tarih 2026-10-23 geçersiz", 500)).toBe(
      "tarih [sayı] geçersiz"
    );
  });

  it("uzunluğu keser", () => {
    expect(scrubErrorText("a".repeat(600), 500)).toHaveLength(500);
  });
});

describe("scrubPath", () => {
  it("sorgu ve parçayı atar", () => {
    expect(scrubPath("/ogrenciler?ara=Ayşe#detay")).toBe("/ogrenciler");
  });
});

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

  it("kısa sayılara dokunmaz (satır, sütun, durum kodu)", () => {
    expect(scrubErrorText("app.js:120:45 HTTP 403", 500)).toBe(
      "app.js:120:45 HTTP 403"
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

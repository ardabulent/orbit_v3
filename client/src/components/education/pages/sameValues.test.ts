import { describe, expect, it } from "vitest";
import { sameValues } from "./examSections";

describe("sameValues (canlı güncellemenin yankısı uyarı sayılmaz)", () => {
  it("aynı puanlar aynıdır; boş ve olmayan anahtar ayırt edilmez", () => {
    expect(sameValues({ a: "80", b: "" }, { a: "80" })).toBe(true);
  });

  it("bir puan değiştiyse farklıdır", () => {
    expect(sameValues({ a: "80" }, { a: "85" })).toBe(false);
    expect(sameValues({ a: "80" }, { a: "80", b: "70" })).toBe(false);
  });

  it("doğru/yanlış hücrelerini değerleriyle karşılaştırır", () => {
    expect(
      sameValues(
        { "s|d": { correct: "10", wrong: "2" } },
        { "s|d": { correct: "10", wrong: "2" } }
      )
    ).toBe(true);
    expect(
      sameValues(
        { "s|d": { correct: "10", wrong: "2" } },
        { "s|d": { correct: "11", wrong: "2" } }
      )
    ).toBe(false);
  });

  it("içi boşaltılmış hücre ile hiç olmayan hücre aynıdır", () => {
    expect(sameValues({ "s|d": { correct: "", wrong: "" } }, {})).toBe(true);
  });
});

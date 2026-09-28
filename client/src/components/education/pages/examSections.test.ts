import { describe, expect, it } from "vitest";
import { netOf } from "@/education/examNetService";
import {
  choiceOf,
  penaltyOf,
  totalQuestions,
  validateSections,
} from "./examSections";

describe("netOf (ekran önizlemesi, veritabanıyla aynı formül)", () => {
  it("YKS: 4 yanlış 1 doğruyu götürür", () => {
    expect(netOf(30, 8, 4)).toBe(28);
    expect(netOf(20, 10, 4)).toBe(17.5);
  });
  it("LGS: 3 yanlış; iki basamağa yuvarlanır", () => {
    expect(netOf(32, 4, 3)).toBe(30.67);
  });
  it("net eksiye düşebilir", () => {
    expect(netOf(1, 8, 4)).toBe(-1);
  });
});

describe("puanlama seçimi", () => {
  it("tek puan ↔ kural", () => {
    expect(penaltyOf("score")).toBeNull();
    expect(penaltyOf("3")).toBe(3);
    expect(choiceOf(null)).toBe("score");
    expect(choiceOf(4)).toBe("4");
    expect(choiceOf(3)).toBe("3");
  });
});

describe("validateSections", () => {
  const ok = { name: "Türkçe", questionCount: 40 };
  it("geçerli liste", () => {
    expect(
      validateSections([ok, { name: "Matematik", questionCount: 40 }])
    ).toBeNull();
    expect(totalQuestions([ok, { name: "Fen", questionCount: 20 }])).toBe(60);
  });
  it("boş liste, adsız ders, tekrar ve soru sayısı reddedilir", () => {
    expect(validateSections([])).toMatch(/en az bir ders/);
    expect(validateSections([{ name: " ", questionCount: 10 }])).toMatch(/adı/);
    expect(
      validateSections([ok, { name: "TÜRKÇE", questionCount: 5 }])
    ).toMatch(/iki kez/);
    expect(validateSections([{ name: "Fen", questionCount: 0 }])).toMatch(
      /1 ile 200/
    );
  });
});

import { describe, expect, it } from "vitest";
import { netOf } from "@/education/examNetService";
import {
  clearedSavedCells,
  clearedSavedScores,
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

describe("kaydedilmiş sonuç boşaltılamaz (2026-10-03, v1.5-23)", () => {
  const saved = {
    "s1|mat": { correct: "20", wrong: "4" },
    "s2|mat": { correct: "15", wrong: "0" },
  };

  it("kayıtlı hücre boşaltılınca yakalanır", () => {
    expect(
      clearedSavedCells(saved, {
        "s1|mat": { correct: "", wrong: " " },
        "s2|mat": { correct: "16", wrong: "0" },
      })
    ).toEqual(["s1|mat"]);
  });

  it("silinen hücre anahtarı da boşaltılmış sayılır", () => {
    expect(clearedSavedCells(saved, { "s2|mat": saved["s2|mat"] })).toEqual([
      "s1|mat",
    ]);
  });

  it("yeni hücreyi boş bırakmak ya da değeri değiştirmek serbest", () => {
    expect(
      clearedSavedCells(saved, {
        ...saved,
        "s3|mat": { correct: "", wrong: "" },
        "s1|mat": { correct: "0", wrong: "0" },
      })
    ).toEqual([]);
  });
});

describe("kayıtlı puan silinemez (2026-10-05)", () => {
  it("kayıtlı puanı boşaltılan öğrenci yakalanır, yeni boş puan serbest", () => {
    expect(
      clearedSavedScores(
        { s1: "72.5", s2: "", s3: "40" },
        { s1: " ", s2: "", s3: "41" }
      )
    ).toEqual(["s1"]);
  });
});

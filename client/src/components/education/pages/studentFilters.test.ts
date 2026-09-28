import { describe, expect, it } from "vitest";
import type { Student } from "../types";
import {
  countByFilter,
  formatScore,
  matchesStudentFilter,
} from "./studentFilters";

const base: Student = {
  id: "s",
  name: "Öğrenci",
  group: "12-A",
  branch: "Merkez",
  parent: "Veli",
  hasAccount: true,
  payment: "Güncel",
};

const students: Student[] = [
  { ...base, id: "tam" },
  { ...base, id: "sinifsiz", group: null },
  { ...base, id: "velisiz", parent: null },
  { ...base, id: "hesapsiz", hasAccount: false },
  { ...base, id: "gecikmis", payment: "Takip gerekli" },
  // Demo verisinde hesap ve ödeme bilinmiyor: süzgeçlere sessizce girmez.
  { ...base, id: "bilinmiyor", hasAccount: undefined, payment: undefined },
];

describe("öğrenci hızlı süzgeçleri", () => {
  it("her süzgeç yalnız kendi durumundaki öğrenciyi seçer", () => {
    const pick = (filter: Parameters<typeof matchesStudentFilter>[1]) =>
      students.filter(s => matchesStudentFilter(s, filter)).map(s => s.id);

    expect(pick("no-class")).toEqual(["sinifsiz"]);
    expect(pick("no-guardian")).toEqual(["velisiz"]);
    expect(pick("no-account")).toEqual(["hesapsiz"]);
    expect(pick("payment-overdue")).toEqual(["gecikmis"]);
    expect(pick("all")).toHaveLength(students.length);
  });

  it("bilinmeyen hesap ya da ödeme 'yok' veya 'gecikmiş' sayılmaz", () => {
    const unknown = students.find(s => s.id === "bilinmiyor")!;
    expect(matchesStudentFilter(unknown, "no-account")).toBe(false);
    expect(matchesStudentFilter(unknown, "payment-overdue")).toBe(false);
  });

  it("sayılar süzgeçlerle aynı tanımdan gelir", () => {
    expect(countByFilter(students)).toEqual({
      all: 6,
      "no-class": 1,
      "no-guardian": 1,
      "no-account": 1,
      "payment-overdue": 1,
    });
  });

  it("puan Türkçe ondalıkla yazılır", () => {
    expect(formatScore(87.5)).toBe("87,5");
    expect(formatScore(120)).toBe("120");
  });
});

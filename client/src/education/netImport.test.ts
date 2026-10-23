import { describe, expect, it } from "vitest";
import {
  buildNetImport,
  guessNetMapping,
  netColumnLabels,
  netMappingProblem,
  sameStudentNumber,
} from "./netImport";
import type { ExamSection } from "./examNetService";

const section = (id: string, name: string, questionCount: number) =>
  ({
    id,
    examId: "e1",
    subjectId: null,
    name,
    questionCount,
    position: 0,
  }) as ExamSection;

const SECTIONS = [
  section("tr", "Türkçe", 40),
  section("mat", "Temel Matematik", 40),
];

// Yayınevi çıktısına benzer: üstte okul adı, iki satırlı başlık.
const TABLE = [
  ["IŞIK AKADEMİ TYT DENEME 3", "", "", "", "", "", "", ""],
  ["", "", "TÜRKÇE", "", "", "MATEMATİK", "", ""],
  ["Sıra No", "Öğrenci No", "D", "Y", "N", "D", "Y", "N"],
  ["1", "1001", "30", "6", "28.5", "20", "8", "18"],
  ["2", "01002", "35", "", "35", "", "", ""],
  ["3", "9999", "10", "10", "7.5", "10", "10", "7.5"],
  ["4", "1003", "35", "5", "", "41", "0", ""],
  ["5", "1004", "otuz", "2", "", "1", "1", ""],
  ["6", "1005", "20", "0", "", "20", "0", ""],
  ["7", "1001", "1", "1", "", "1", "1", ""],
];

const STUDENTS = [
  { studentId: "s1", studentName: "Ayşe", studentCode: "1001" },
  { studentId: "s2", studentName: "Mehmet", studentCode: "1002" },
  { studentId: "s3", studentName: "Zeynep", studentCode: "1003" },
  { studentId: "s4", studentName: "Can", studentCode: "1004" },
  { studentId: "s5", studentName: "Elif", studentCode: "1005" },
];

describe("netImport (deneme sonucu dosyadan, v1.5-16)", () => {
  it("iki satırlı başlıkta üstteki ders adı alt başlıkla birleşir", () => {
    expect(netColumnLabels(TABLE, 2).slice(0, 7)).toEqual([
      "Sıra No",
      "Öğrenci No",
      "TÜRKÇE D",
      "TÜRKÇE Y",
      "TÜRKÇE N",
      "MATEMATİK D",
      "MATEMATİK Y",
    ]);
  });

  it("başlık satırını, numara sütununu ve derslerin D/Y sütunlarını tahmin eder", () => {
    const mapping = guessNetMapping(TABLE, SECTIONS);
    expect(mapping.headerRow).toBe(2);
    expect(mapping.numberColumn).toBe(1); // "Sıra No" değil
    expect(mapping.sections.tr).toEqual({ correct: 2, wrong: 3 });
    // "Temel Matematik" ↔ "MATEMATİK": genel kelime "temel" atlanır.
    expect(mapping.sections.mat).toEqual({ correct: 5, wrong: 6 });
    expect(netMappingProblem(mapping, SECTIONS)).toBeNull();
  });

  it("öğrenciyi numarayla eşleştirir, sorunları satır numarasıyla söyler", () => {
    const mapping = guessNetMapping(TABLE, SECTIONS);
    const result = buildNetImport({
      table: TABLE,
      mapping,
      sections: SECTIONS,
      students: STUDENTS,
      absentStudentIds: new Set(["s5"]),
    });

    expect(result.cells["s1|tr"]).toEqual({ correct: "30", wrong: "6" });
    expect(result.cells["s1|mat"]).toEqual({ correct: "20", wrong: "8" });
    // Baştaki sıfır önemsiz; boş yanlış 0 olur; boş ders girilmemiş kalır.
    expect(result.cells["s2|tr"]).toEqual({ correct: "35", wrong: "0" });
    expect(result.cells["s2|mat"]).toBeUndefined();
    // Sorunlu ders atlanır, aynı satırın geçerli dersi alınır.
    expect(result.cells["s3|tr"]).toEqual({ correct: "35", wrong: "5" });
    expect(result.cells["s3|mat"]).toBeUndefined();
    expect(result.cells["s4|tr"]).toBeUndefined();

    expect(result.unknown).toEqual([{ row: 6, number: "9999", name: "" }]);
    expect(result.absent).toEqual(["Elif"]);
    expect(result.problems.map(p => p.row)).toEqual([7, 8, 10]);
    expect(result.problems[0].message).toContain("40 soruyu aşıyor");
    expect(result.problems[2].message).toContain("ikinci kez");
    expect(result.matchedStudents).toBe(4);
  });

  // 1.3 (test turu, 2026-10-18): "kurumda yok" ile "başka sınıfta" ayrı söylenir.
  it("sınavın dışında görülebilen öğrenciye ait numarayı 'başka sınıfta' diye ayırır", () => {
    const result = buildNetImport({
      table: TABLE,
      mapping: guessNetMapping(TABLE, SECTIONS),
      sections: SECTIONS,
      students: STUDENTS,
      absentStudentIds: new Set(),
      otherStudents: [
        { code: "1001", name: "Ayşe", group: "12-A" },
        { code: "09999", name: "Kaan Er", group: "11-B" },
      ],
    });
    expect(result.unknown).toEqual([
      {
        row: 6,
        number: "9999",
        name: "",
        elsewhere: { name: "Kaan Er", group: "11-B" },
      },
    ]);
  });

  it("numara sütunu yoksa aktarılamaz", () => {
    const mapping = guessNetMapping([["Ad", "D", "Y"]], SECTIONS);
    expect(netMappingProblem(mapping, SECTIONS)).toContain("numarası");
  });

  it("numara karşılaştırması", () => {
    expect(sameStudentNumber("0123", "123")).toBe(true);
    expect(sameStudentNumber("A-12", "A-12")).toBe(true);
    expect(sameStudentNumber("12", "")).toBe(false);
  });
});

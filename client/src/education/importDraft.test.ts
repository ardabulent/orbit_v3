import { describe, expect, it } from "vitest";
import { chooseSheet, prepareImport, startDraft } from "./importDraft";
import {
  applyClassMap,
  fixAllCaps,
  mostlyAllCaps,
  suggestClass,
  turkishNameKey,
} from "./importNormalize";

const ORBIT_CLASSES = ["12-A Sayısal", "12-B Eşit Ağırlık", "11-A Sayısal"];

describe("sınıf adı önerisi (2026-10-02)", () => {
  it("harf farkı gözetmeden tam eşleşme", () => {
    expect(suggestClass("12-a sayisal", ["12-A Sayısal"])).toBeNull();
    expect(suggestClass("12-A SAYISAL", ORBIT_CLASSES)).toBe("12-A Sayısal");
  });

  it("boşluk ve tire farkı yok sayılır", () => {
    expect(suggestClass("12 A Sayısal", ORBIT_CLASSES)).toBe("12-A Sayısal");
  });

  it("kısa ad tek bir sınıfın başıysa önerilir", () => {
    expect(suggestClass("12A", ORBIT_CLASSES)).toBe("12-A Sayısal");
    expect(suggestClass("11a", ORBIT_CLASSES)).toBe("11-A Sayısal");
  });

  it("iki aday varsa öneri yapılmaz; kullanıcı seçer", () => {
    expect(
      suggestClass("12A", ["12-A Sayısal", "12-A Eşit Ağırlık"])
    ).toBeNull();
    expect(suggestClass("10-C", ORBIT_CLASSES)).toBeNull();
  });

  it("seçim satırlara uygulanır; sınıfsız seçimi sınıfı boşaltır", () => {
    const rows = [
      {
        full_name: "A",
        student_number: "",
        class_name: "12a",
        guardian_name: "",
        guardian_phone: "",
      },
      {
        full_name: "B",
        student_number: "",
        class_name: "Hazırlık",
        guardian_name: "",
        guardian_phone: "",
      },
    ];
    const mapped = applyClassMap(rows, {
      [turkishNameKey("12A")]: "12-A Sayısal",
      [turkishNameKey("Hazırlık")]: "",
    });
    expect(mapped.map(r => r.class_name)).toEqual(["12-A Sayısal", ""]);
  });
});

describe("büyük harfli adlar", () => {
  it("Türkçe kuralıyla düzeltilir", () => {
    expect(fixAllCaps("AYŞE NUR KOÇ-YILMAZ")).toBe("Ayşe Nur Koç-Yılmaz");
    expect(fixAllCaps("İLKER IŞIK")).toBe("İlker Işık");
    expect(fixAllCaps("ÖZGE O'NEİL")).toBe("Özge O'Neil");
  });

  it("karışık yazım korunur", () => {
    expect(fixAllCaps("Ayşe McAdam")).toBe("Ayşe McAdam");
  });

  it("adların çoğu büyük harfse düzeltme önerilir", () => {
    expect(mostlyAllCaps(["AYŞE KOÇ", "ALİ ER", "Can Ak"])).toBe(true);
    expect(mostlyAllCaps(["Ayşe Koç", "ALİ ER"])).toBe(false);
  });
});

describe("aktarım taslağı", () => {
  const sheet = (name: string, rows: string[][]) => ({ name, table: rows });

  it("her sınıf ayrı sayfada: sayfa adı sınıf olur ve eşlenir", () => {
    const draft = startDraft("liste.xlsx", [
      sheet("12A", [
        ["Adı Soyadı", "No"],
        ["AYŞE KOÇ", "1"],
      ]),
      sheet("11A", [
        ["Adı Soyadı", "No"],
        ["ALİ ER", "2"],
        ["CAN AK", "3"],
      ]),
    ]);
    expect(draft.sheetAsClass).toBe(true);
    const prepared = prepareImport(draft, ORBIT_CLASSES);
    expect(prepared.unresolvedClasses).toEqual([]);
    expect(prepared.fixCaps).toBe(true);
    expect(prepared.rows.map(r => [r.full_name, r.class_name])).toEqual([
      ["Ayşe Koç", "12-A Sayısal"],
      ["Ali Er", "11-A Sayısal"],
      ["Can Ak", "11-A Sayısal"],
    ]);
    expect(prepared.rowLabels).toEqual([
      "12A · 2. satır",
      "11A · 2. satır",
      "11A · 3. satır",
    ]);
  });

  it("Excel'in kendi sayfa adları sınıf sayılmaz", () => {
    const draft = startDraft("liste.xlsx", [
      sheet("Sayfa1", [["Ad Soyad"], ["A"]]),
      sheet("Sayfa2", [["Ad Soyad"], ["B"]]),
    ]);
    expect(draft.sheetAsClass).toBe(false);
  });

  it("tanınmayan sınıf seçilene kadar bekler, seçilince çözülür", () => {
    const draft = startDraft("liste.csv", [
      sheet("liste.csv", [
        ["Ad Soyad", "Sınıf"],
        ["Selin", "10-C"],
      ]),
    ]);
    expect(prepareImport(draft, ORBIT_CLASSES).unresolvedClasses).toEqual([
      "10-C",
    ]);
    const chosen = {
      ...draft,
      classChoices: { [turkishNameKey("10-C")]: "" },
    };
    const prepared = prepareImport(chosen, ORBIT_CLASSES);
    expect(prepared.unresolvedClasses).toEqual([]);
    expect(prepared.rows[0].class_name).toBe("");
  });

  it("tek sayfa seçilince başlık ve sütunlar o sayfaya göre kurulur", () => {
    const draft = startDraft("liste.xlsx", [
      sheet("Kapak", [["Kurum"]]),
      sheet("Öğrenciler", [["Liste"], ["Ad Soyad", "Okul No"], ["Selin", "9"]]),
    ]);
    const second = chooseSheet(draft, 1);
    expect(second.headerRow).toBe(1);
    expect(second.mapping.student_number).toBe(1);
    expect(prepareImport(second, ORBIT_CLASSES).rows).toHaveLength(1);
  });

  it("numara sütunu varsa kayıtlıları atlama varsayılan olarak açık", () => {
    expect(
      startDraft("a.csv", [sheet("a.csv", [["Ad Soyad", "No"]])]).skipExisting
    ).toBe(true);
    expect(
      startDraft("a.csv", [sheet("a.csv", [["Ad Soyad"]])]).skipExisting
    ).toBe(false);
  });
});

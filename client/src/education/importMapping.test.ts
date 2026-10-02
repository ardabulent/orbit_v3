import path from "node:path";
import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { cellToText, decodeCsv } from "./importFile";
import { splitCsv } from "./studentImport";
import {
  buildImportRows,
  columnLetter,
  detectHeaderRow,
  EMPTY_MAPPING,
  guessMapping,
  mappingProblem,
  restoreLeadingZero,
} from "./importMapping";

describe("sütun eşleme (2026-10-01)", () => {
  it("kurumların kendi başlıkları tanınır, sıra önemsizdir", () => {
    expect(
      guessMapping(["Sıra", "Okul No", "Adı", "Soyadı", "Şube", "Veli GSM"])
    ).toEqual({
      full_name: 2,
      last_name: 3,
      student_number: 1,
      class_name: 4,
      guardian_name: null,
      guardian_phone: 5,
    });
  });

  it("noktalama ve büyük harf fark etmez", () => {
    expect(guessMapping(["ÖĞRENCİ NO:", "AD SOYAD", "Veli Adı"])).toEqual({
      ...EMPTY_MAPPING,
      student_number: 0,
      full_name: 1,
      guardian_name: 2,
    });
  });

  it("üstte okul adı ve tarih olsa da başlık satırı bulunur", () => {
    const table = [
      ["Işık Akademi 2026-2027 öğrenci listesi"],
      ["01.10.2026"],
      ["Numara", "Ad Soyad", "Sınıf"],
      ["1001", "Selin Koç", "12-A"],
    ];
    expect(detectHeaderRow(table)).toBe(2);
  });

  it("hiçbir başlık tanınmazsa ilk satır seçilir", () => {
    expect(
      detectHeaderRow([
        ["x", "y"],
        ["a", "b"],
      ])
    ).toBe(0);
  });

  it("ad ve soyad birleşir, boş satır atlanır, dosya satır numarası korunur", () => {
    const table = [
      ["Liste"],
      ["Adı", "Soyadı", "Veli Tel"],
      ["Selin", "Koç", "5321234567"],
      ["", "", ""],
      ["Ali", "Er", "0532 111 22 33"],
    ];
    const built = buildImportRows(table, 1, guessMapping(table[1]));
    expect(built.rows.map(r => [r.full_name, r.guardian_phone])).toEqual([
      ["Selin Koç", "05321234567"],
      ["Ali Er", "0532 111 22 33"],
    ]);
    expect(built.lineNumbers).toEqual([3, 5]);
  });

  it("Excel'in düşürdüğü baştaki 0 yalnız cep numarasına geri eklenir", () => {
    expect(restoreLeadingZero("5321234567")).toBe("05321234567");
    expect(restoreLeadingZero("2125551234")).toBe("2125551234");
    expect(restoreLeadingZero("0532 123 45 67")).toBe("0532 123 45 67");
  });

  it("Ad Soyad seçilmeden ya da aynı sütun iki alana verilince devam edilmez", () => {
    expect(mappingProblem(EMPTY_MAPPING)).toContain("Ad Soyad");
    expect(
      mappingProblem({ ...EMPTY_MAPPING, full_name: 0, guardian_name: 0 })
    ).toContain("iki alana");
    expect(mappingProblem({ ...EMPTY_MAPPING, full_name: 0 })).toBeNull();
  });

  it("sütun harfleri Excel gibi", () => {
    expect([0, 25, 26, 27].map(columnLetter)).toEqual(["A", "Z", "AA", "AB"]);
  });
});

describe("dosya okuma", () => {
  it("aradaki boş satır numaralandırmada yerinde kalır, sondakiler atılır", () => {
    const table = splitCsv(
      ["Okul adı", "", "Ad Soyad", "Selin Koç", "", "", ""].join("\n")
    );
    expect(table).toEqual([["Okul adı"], [""], ["Ad Soyad"], ["Selin Koç"]]);
    const header = detectHeaderRow(table);
    expect(header).toBe(2);
    expect(
      buildImportRows(table, header, guessMapping(table[header])).lineNumbers
    ).toEqual([4]);
  });

  it("Türkçe Excel'in ANSI CSV'si (Windows-1254) bozulmadan okunur", () => {
    // "Öğrenci" Windows-1254'te: Ö=0xD6 ğ=0xF0
    const bytes = new Uint8Array([0xd6, 0xf0, 0x72, 0x65, 0x6e, 0x63, 0x69]);
    expect(decodeCsv(bytes.buffer)).toBe("Öğrenci");
  });

  it("UTF-8 CSV olduğu gibi okunur", () => {
    const bytes = new TextEncoder().encode("Öğrenci;Sınıf");
    expect(decodeCsv(bytes.buffer as ArrayBuffer)).toBe("Öğrenci;Sınıf");
  });

  it("Excel hücreleri metne çevrilir; tarih gün.ay.yıl", () => {
    expect(cellToText(new Date(Date.UTC(2010, 4, 9)))).toBe("09.05.2010");
    expect(cellToText(null)).toBe("");
    expect(cellToText(" 1001 ")).toBe("1001");
    expect(cellToText(true)).toBe("Evet");
  });

  it("Excel şablonu okunur ve başlıkları kendiliğinden eşlenir", async () => {
    const file = path.resolve(
      import.meta.dirname,
      "../../public/sablonlar/orbit-ogrenci-sablonu.xlsx"
    );
    const sheet = await readSheet(file, 1, { parseNumber: raw => raw });
    const table = sheet.map(row => row.map(cellToText));
    const header = detectHeaderRow(table);
    const mapping = guessMapping(table[header]);
    expect(mappingProblem(mapping)).toBeNull();
    expect(mapping).toEqual({
      full_name: 0,
      last_name: null,
      student_number: 1,
      class_name: 2,
      guardian_name: 3,
      guardian_phone: 4,
    });
    expect(buildImportRows(table, header, mapping).rows).toEqual([
      {
        full_name: "Örnek Öğrenci",
        student_number: "1001",
        class_name: "12-A",
        guardian_name: "Örnek Veli",
        guardian_phone: "0500 000 00 00",
      },
    ]);
  });
});

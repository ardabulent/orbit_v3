import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { buildXlsx, columnName, crc32, uniqueSheetNames } from "./xlsxWriter";

describe("xlsxWriter", () => {
  it("üretilen dosya depodaki okuyucuyla geri okunur: sayfalar, Türkçe metin, sayılar", async () => {
    const bytes = buildXlsx([
      {
        name: "Öğrenciler",
        rows: [
          ["Ad soyad", "Numara", "Not"],
          ["Çağrı Işık", 1042, 57.75],
          ['=HYPERLINK("x")', null, -2.5],
          ['Ali & "Veli" <ok>', "007", ""],
        ],
      },
      { name: "Ödemeler", rows: [["Tutar"], [1500]] },
    ]);

    const sheets = await readXlsxFile(Buffer.from(bytes));
    expect(sheets.map(s => s.sheet)).toEqual(["Öğrenciler", "Ödemeler"]);
    expect(sheets[0].data).toEqual([
      ["Ad soyad", "Numara", "Not"],
      ["Çağrı Işık", 1042, 57.75],
      ['=HYPERLINK("x")', null, -2.5],
      ['Ali & "Veli" <ok>', "007", null],
    ]);
    expect(sheets[1].data).toEqual([["Tutar"], [1500]]);
  });

  it("formül yazmaz: '=' ile başlayan değer metin hücresidir", () => {
    const xml = new TextDecoder().decode(
      buildXlsx([{ name: "A", rows: [["=1+1"]] }])
    );
    expect(xml).not.toContain("<f>");
    expect(xml).toContain('t="inlineStr"');
  });

  it("sayfa adlarını Excel kurallarına uydurur", () => {
    expect(
      uniqueSheetNames(["Yoklama", "yoklama", "a/b*c", "", "x".repeat(40)])
    ).toEqual(["Yoklama", "yoklama (2)", "a b c", "Sayfa 4", "x".repeat(31)]);
  });

  it("sütun adları", () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnName)).toEqual([
      "A",
      "Z",
      "AA",
      "AZ",
      "BA",
      "ZZ",
      "AAA",
    ]);
  });

  it("CRC32 bilinen değer", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

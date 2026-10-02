import type { ImportSheet } from "./importMapping";
import {
  dropTrailingEmptyRows,
  IMPORT_MAX_BYTES,
  splitCsv,
} from "./studentImport";

/**
 * Aktarım dosyasını tabloya çevirir (2026-10-01): Excel (.xlsx) ya da CSV.
 *
 * - **.xlsx** `read-excel-file` ile tarayıcıda okunur; paket yalnız bu adımda
 *   yüklenir (ana pakete girmez). Sayılar ham metin olarak alınır: "1001"
 *   "1001.0" olmaz, uzun numaralar yuvarlanmaz.
 * - **.xlsx en çok 300 KB.** `fflate` zip içindeki 320.000 bayttan büyük bir
 *   parçayı `blob:` web worker ile açar; üretimin CSP'si (`script-src 'self'`)
 *   bu işçiyi engeller ve dosya sessizce okunamaz. Dosyanın tamamı 300 KB'ın
 *   altındaysa hiçbir parça eşiği aşamaz, işçi hiç açılmaz. 500 öğrencilik bir
 *   liste 20–40 KB'tır; CSP'yi gevşetmek yerine sınır seçildi (2026-10-01).
 * - **Bütün sayfalar okunur** (2026-10-02): kurumlarda her sınıf çoğu zaman
 *   ayrı bir sayfadır. Boş sayfalar atılır.
 * - **.xls** (eski Excel) okunamaz; kullanıcıya .xlsx olarak kaydetmesi söylenir.
 * - **CSV** önce UTF-8 okunur; içinde bozuk karakter (U+FFFD) çıkarsa Türkçe
 *   Excel'in "CSV (virgülle ayrılmış)" seçeneğinin yazdığı Windows-1254
 *   kodlamasıyla yeniden çözülür ("Öğrenci" → "�renci" tuzağı).
 *
 * Dosya sunucuya gönderilmez; yalnız çözülmüş satırlar `import_students`'a gider.
 */

export type ReadTableResult =
  { ok: true; sheets: ImportSheet[] } | { ok: false; message: string };

const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel hücresini metne çevirir; tarih gün.ay.yıl olur. */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return `${pad(value.getUTCDate())}.${pad(value.getUTCMonth() + 1)}.${value.getUTCFullYear()}`;
  }
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return String(value).trim();
}

/** CSV baytlarını metne çevirir: UTF-8, olmazsa Windows-1254. */
export function decodeCsv(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes(REPLACEMENT_CHAR)) return utf8;
  return new TextDecoder("windows-1254").decode(bytes);
}

/** Bkz. dosya başı: fflate'in işçi eşiğinin (320.000 bayt) altında kalır. */
const XLSX_MAX_BYTES = 300 * 1024;

const extensionOf = (name: string) =>
  name.toLocaleLowerCase("tr").split(".").pop() ?? "";

export async function readImportTable(file: File): Promise<ReadTableResult> {
  if (file.size > IMPORT_MAX_BYTES) {
    return { ok: false, message: "Dosya 1 MB'tan büyük olamaz." };
  }

  const extension = extensionOf(file.name);
  if (extension === "xls") {
    return {
      ok: false,
      message:
        "Eski Excel biçimi (.xls) okunamıyor. Excel'de Dosya → Farklı Kaydet → “Excel Çalışma Kitabı (.xlsx)” seçip yeniden yükleyin.",
    };
  }

  let sheets: ImportSheet[];
  if (extension === "xlsx") {
    if (file.size > XLSX_MAX_BYTES) {
      return {
        ok: false,
        message:
          "Excel dosyası 300 KB'tan büyük. Yalnız öğrenci sütunlarını bırakıp yeniden kaydedin ya da CSV olarak kaydedip yükleyin.",
      };
    }
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const all = await readXlsxFile(file, {
        parseNumber: (raw: string) => raw,
      });
      sheets = all.map(({ sheet, data }) => ({
        name: sheet,
        table: dropTrailingEmptyRows(data.map(row => row.map(cellToText))),
      }));
    } catch {
      return {
        ok: false,
        message:
          "Excel dosyası okunamadı. Dosya bozuk ya da parola korumalı olabilir; Excel'de açıp yeniden kaydetmeyi deneyin.",
      };
    }
  } else if (extension === "csv" || extension === "txt") {
    sheets = [
      { name: file.name, table: splitCsv(decodeCsv(await file.arrayBuffer())) },
    ];
  } else {
    return {
      ok: false,
      message: "Yalnız Excel (.xlsx) ve CSV (.csv) dosyaları yüklenebilir.",
    };
  }

  const filled = sheets.filter(sheet => sheet.table.length > 0);
  if (filled.length === 0) return { ok: false, message: "Dosya boş." };
  return { ok: true, sheets: filled };
}

/**
 * Excel'in Türkçe ayarında doğrudan açılan CSV (2026-10-24'te
 * `reportCsv.ts`'ten ortak yere taşındı; kurallar aynı):
 *
 *  - Ayırıcı ";" — Türkçe Excel virgülü ondalık sayar.
 *  - Ondalık virgül; ölçülmeyen değer boş hücre, 0 değil (K-22).
 *  - Başta UTF-8 BOM — yoksa Excel "ı, ş, ğ"yi bozar.
 *  - Kullanıcı girdisi metin "=", "+", "-", "@" ile başlarsa başına tek
 *    tırnak konur: Excel onu formül sanar (CSV enjeksiyonu). Yalnız metin
 *    hücresine uygulanır — negatif sayı "-2,5" bozulmamalı.
 */

export type CsvCell = string | number | null | undefined;

const BOM = String.fromCharCode(0xfeff);

export function toTurkishCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map(row =>
    row.map(value => escapeCell(cellText(value))).join(";")
  );
  return BOM + lines.join("\r\n") + "\r\n";
}

function cellText(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  }
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

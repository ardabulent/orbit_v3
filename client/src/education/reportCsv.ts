import type { ClassComparisonRow } from "./reportService";

/**
 * Sınıf karşılaştırmasını Excel'in Türkçe ayarında doğrudan açılan CSV'ye
 * çevirir: ayırıcı ";" (Türkçe Excel virgülü ondalık sayar), ondalık virgül,
 * başta UTF-8 BOM (yoksa Excel "ı, ş, ğ"yi bozar). Ölçülmeyen değer boş
 * hücredir, 0 değil (K-22).
 */
export function classComparisonCsv(rows: ClassComparisonRow[]): string {
  const header = [
    "Sınıf",
    "Öğrenci",
    "Devam %",
    "Ödev tamamlama %",
    "Net deneme sayısı",
    "Ortalama net",
  ];
  const lines = rows.map(row =>
    [
      textCell(row.className),
      String(row.studentCount),
      numberCell(row.attendancePercent),
      numberCell(row.homeworkPercent),
      numberCell(row.netExamCount),
      numberCell(row.netAverage),
    ]
      .map(escapeCell)
      .join(";")
  );
  return BOM + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}

const BOM = String.fromCharCode(0xfeff);

function numberCell(value: number | undefined): string {
  return value === undefined ? "" : String(value).replace(".", ",");
}

// Sınıf adı kullanıcı girdisidir: "=", "+", "-", "@" ile başlarsa Excel onu
// formül sanar (CSV enjeksiyonu), başına tek tırnak konur. Yalnız metin
// hücresine uygulanır — negatif net "-2,5" bir sayıdır, bozulmamalı.
function textCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

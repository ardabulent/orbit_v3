import { toTurkishCsv } from "@/lib/turkishCsv";
import type { ClassComparisonRow } from "./reportService";

/**
 * Sınıf karşılaştırmasını Excel'in Türkçe ayarında doğrudan açılan CSV'ye
 * çevirir. Biçim kuralları (";" ayırıcı, ondalık virgül, BOM, CSV
 * enjeksiyonu koruması) `lib/turkishCsv.ts`'te. Ölçülmeyen değer boş
 * hücredir, 0 değil (K-22).
 */
export function classComparisonCsv(rows: ClassComparisonRow[]): string {
  return toTurkishCsv(
    [
      "Sınıf",
      "Öğrenci",
      "Devam %",
      "Ödev tamamlama %",
      "Net deneme sayısı",
      "Ortalama net",
    ],
    rows.map(row => [
      row.className,
      row.studentCount,
      row.attendancePercent,
      row.homeworkPercent,
      row.netExamCount,
      row.netAverage,
    ])
  );
}

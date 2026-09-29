import { calculateAttendancePercentage } from "./attendanceService";
import type { AttentionStudent } from "./reportService";

const net = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

/**
 * Dikkat listesindeki bir öğrencinin nedenleri, ekranda okunacak haliyle.
 * Yalnız veritabanının kaldırdığı bayraklar yazılır; devam yüzdesi tek
 * formülden gelir (K-06).
 */
export function attentionReasons(row: AttentionStudent): string[] {
  const reasons: string[] = [];
  if (
    row.lowAttendance &&
    row.lessonCount !== undefined &&
    row.attendedCount !== undefined
  ) {
    const percent = calculateAttendancePercentage({
      present: row.attendedCount,
      late: 0,
      absent: row.lessonCount - row.attendedCount,
    });
    reasons.push(
      `Devam %${percent} (${row.attendedCount}/${row.lessonCount} ders)`
    );
  }
  if (
    row.lowHomework &&
    row.homeworkExpected !== undefined &&
    row.homeworkSubmitted !== undefined
  ) {
    reasons.push(`Ödev ${row.homeworkSubmitted}/${row.homeworkExpected}`);
  }
  if (
    row.netDrop &&
    row.previousNet !== undefined &&
    row.lastNet !== undefined
  ) {
    reasons.push(`Net ${net(row.previousNet)} → ${net(row.lastNet)}`);
  }
  if (
    row.belowAverage &&
    row.lastNet !== undefined &&
    row.classAverage !== undefined
  ) {
    reasons.push(
      `Son deneme ${net(row.lastNet)} · sınıf ort. ${net(row.classAverage)}`
    );
  }
  return reasons;
}

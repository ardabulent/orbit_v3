import {
  calculateAttendancePercentage,
  type StudentAttendanceRecord,
} from "@/education/attendanceService";

/**
 * Öğrencinin yoklama kayıtlarının özeti: durum sayıları, devam yüzdesi
 * (DECISION_LOG 2026-09-08 formülü) ve katıldı dışındaki kayıtlar.
 */
export function summarizeRecords(records: StudentAttendanceRecord[]) {
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const record of records) counts[record.status] += 1;
  return {
    counts,
    percentage: calculateAttendancePercentage(counts),
    exceptions: records.filter(r => r.status !== "present"),
  };
}

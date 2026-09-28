import { describe, expect, it } from "vitest";
import type { StudentAttendanceRecord } from "@/education/attendanceService";
import { summarizeRecords } from "./attendanceRecords";

const record = (
  id: string,
  status: StudentAttendanceRecord["status"]
): StudentAttendanceRecord => ({
  id,
  status,
  sessionDate: "2026-09-28",
  startsAt: "09:00:00",
  subjectName: "Matematik",
  className: "12-A",
});

describe("summarizeRecords", () => {
  it("devam yüzdesi DECISION_LOG formülüyle: geç devam sayılır, izinli hesaba girmez", () => {
    const summary = summarizeRecords([
      record("1", "present"),
      record("2", "present"),
      record("3", "late"),
      record("4", "absent"),
      record("5", "excused"),
    ]);
    expect(summary.counts).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
    });
    // (2 + 1) / (2 + 1 + 1) = %75
    expect(summary.percentage).toBe(75);
    // Listede yalnız katılmadığı/geç kaldığı/izinli olduğu dersler.
    expect(summary.exceptions.map(r => r.id)).toEqual(["3", "4", "5"]);
  });

  it("yalnız izinli kayıt varsa yüzde uydurulmaz", () => {
    expect(summarizeRecords([record("1", "excused")]).percentage).toBe(
      undefined
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  CODE_DEFAULT_LIMITS,
  TRACKING_METRICS,
  resolveLimits,
} from "./trackingMetrics";
import type { TrackingStudentRow } from "./trackingTypes";

const row = (over: Partial<TrackingStudentRow> = {}): TrackingStudentRow => ({
  studentId: "s1",
  studentName: "Ali",
  classNames: "12-A",
  lessonCount: 20,
  presentCount: 12,
  lateCount: 1,
  absentCount: 7,
  excusedCount: 2,
  absenceStreak: 3,
  examExpected: 3,
  examMissed: 1,
  lastNet: 38,
  previousNet: 30,
  netAvg3: 34,
  classAvgLast: 36,
  subjectNets: [
    {
      subjectId: "mat",
      subjectName: "Matematik",
      avgNet: 21.5,
      classAvg: 20.72,
      examCount: 2,
    },
  ],
  homeworkExpected: 4,
  homeworkSubmitted: 1,
  ...over,
});

describe("trackingMetrics", () => {
  it("devam yüzdesi izinliyi saymaz ve yuvarlanır", () => {
    expect(TRACKING_METRICS.attendance_pct.value(row())).toBe(65);
    expect(TRACKING_METRICS.attendance_pct.detail(row())).toBe(
      "Devam %65 · 13/20 ders"
    );
  });

  it("beşten az derste devam ve geç kalma ölçülmez", () => {
    const az = row({ lessonCount: 4, presentCount: 4, absentCount: 0 });
    expect(TRACKING_METRICS.attendance_pct.value(az)).toBeUndefined();
    expect(TRACKING_METRICS.late_count.value(az)).toBeUndefined();
  });

  it("üst üste devamsızlık en az bir ders ister", () => {
    expect(TRACKING_METRICS.absence_streak.value(row())).toBe(3);
    expect(
      TRACKING_METRICS.absence_streak.value(
        row({ lessonCount: 0, absenceStreak: 0 })
      )
    ).toBeUndefined();
    expect(TRACKING_METRICS.absence_streak.detail(row())).toBe(
      "Son 3 derse gelmedi"
    );
  });

  it("net eğilimi son ile önceki farkıdır; tek denemede yok", () => {
    expect(TRACKING_METRICS.net_trend.value(row())).toBe(8);
    expect(TRACKING_METRICS.net_trend.detail(row())).toBe("30 → 38 (+8)");
    expect(
      TRACKING_METRICS.net_trend.value(row({ previousNet: undefined }))
    ).toBeUndefined();
  });

  it("ders neti seçilen dersten okunur", () => {
    expect(TRACKING_METRICS.subject_net.value(row(), "mat")).toBe(21.5);
    expect(TRACKING_METRICS.subject_net.value(row(), "fiz")).toBeUndefined();
    expect(TRACKING_METRICS.subject_net.value(row())).toBeUndefined();
    expect(TRACKING_METRICS.subject_net.detail(row(), "mat")).toBe(
      "Matematik 21,5 net · sınıf 20,7"
    );
  });

  it("ödev en az üç bitmiş ödev ister", () => {
    expect(TRACKING_METRICS.homework_pct.value(row())).toBe(25);
    expect(
      TRACKING_METRICS.homework_pct.value(row({ homeworkExpected: 2 }))
    ).toBeUndefined();
  });

  it("girilmeyen deneme en az bir beklenen deneme ister", () => {
    expect(TRACKING_METRICS.exam_missed.value(row())).toBe(1);
    expect(TRACKING_METRICS.exam_missed.detail(row())).toBe(
      "Girmediği deneme: 1 / 3"
    );
    expect(
      TRACKING_METRICS.exam_missed.value(
        row({ examExpected: 0, examMissed: 0 })
      )
    ).toBeUndefined();
  });

  it("sınırlar kişisel > kurum > kod sırasıyla çözülür", () => {
    const limits = resolveLimits(
      {
        attendance_pct: { risk: 70, safe: 85 },
        homework_pct: { risk: 50, safe: 70 },
      },
      { attendance_pct: { risk: 60, safe: 75 } }
    );
    expect(limits.attendance_pct).toEqual({ risk: 60, safe: 75 });
    expect(limits.homework_pct).toEqual({ risk: 50, safe: 70 });
    expect(limits.late_count).toEqual(CODE_DEFAULT_LIMITS.late_count);
    expect(limits.net_avg).toBeNull();
  });
});

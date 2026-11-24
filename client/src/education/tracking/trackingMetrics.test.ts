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
  targets: [],
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

describe("en az veri (karar 2026-11-24: yeterli veri yoksa hesaplanmaz)", () => {
  it("beşten az derste üst üste devamsızlık ölçülmez ve neden yazılır", () => {
    const az = row({ lessonCount: 3, absenceStreak: 3 });
    expect(TRACKING_METRICS.absence_streak.value(az)).toBeUndefined();
    expect(TRACKING_METRICS.absence_streak.detail(az)).toBe(
      "Yetersiz veri: 3 ders, en az 5 gerekir"
    );
    expect(TRACKING_METRICS.late_count.detail(az)).toBe(
      "Yetersiz veri: 3 ders, en az 5 gerekir"
    );
  });

  it("tek denemeyle toplam net ve eğilim hesaplanmaz", () => {
    const tek = row({ previousNet: undefined, netAvg3: 38 });
    expect(TRACKING_METRICS.net_avg.value(tek)).toBeUndefined();
    expect(TRACKING_METRICS.net_avg.detail(tek)).toBe(
      "Yetersiz veri: 1 deneme, en az 2 gerekir"
    );
    expect(TRACKING_METRICS.net_trend.detail(tek)).toBe(
      "Yetersiz veri: 1 deneme, en az 2 gerekir"
    );
    const hic = row({
      lastNet: undefined,
      previousNet: undefined,
      netAvg3: undefined,
    });
    expect(TRACKING_METRICS.net_avg.detail(hic)).toBe(
      "Yetersiz veri: 0 deneme, en az 2 gerekir"
    );
  });

  it("derste tek deneme varsa ders neti hesaplanmaz", () => {
    const tek = row({
      subjectNets: [
        {
          subjectId: "mat",
          subjectName: "Matematik",
          avgNet: 20,
          examCount: 1,
        },
      ],
    });
    expect(TRACKING_METRICS.subject_net.value(tek, "mat")).toBeUndefined();
    expect(TRACKING_METRICS.subject_net.detail(tek, "mat")).toBe(
      "Yetersiz veri: 1 deneme, en az 2 gerekir"
    );
  });

  it("tek beklenen denemede girilmeyen deneme ölçülmez", () => {
    const tek = row({ examExpected: 1, examMissed: 1 });
    expect(TRACKING_METRICS.exam_missed.value(tek)).toBeUndefined();
    expect(TRACKING_METRICS.exam_missed.detail(tek)).toBe(
      "Yetersiz veri: 1 deneme, en az 2 gerekir"
    );
  });
});

describe("hedefe uzaklık (4.10b)", () => {
  const hedefli = row({
    targets: [{ targetNet: 45 }, { subjectId: "mat", targetNet: 25 }],
  });

  it("toplam hedef son üç denemenin ortalamasıyla karşılaştırılır", () => {
    expect(TRACKING_METRICS.target_gap.value(hedefli)).toBe(11);
    expect(TRACKING_METRICS.target_gap.detail(hedefli)).toBe(
      "Toplam hedef 45 · ort. 34 · 11 net uzak"
    );
  });

  it("ders seçiliyse o dersin hedefi kullanılır", () => {
    expect(TRACKING_METRICS.target_gap.value(hedefli, "mat")).toBe(3.5);
    expect(TRACKING_METRICS.target_gap.detail(hedefli, "mat")).toBe(
      "Matematik hedef 25 · ort. 21,5 · 3,5 net uzak"
    );
  });

  it("hedefin üstündeki öğrenci hedefte sayılır", () => {
    const ustte = row({ targets: [{ targetNet: 30 }] });
    expect(TRACKING_METRICS.target_gap.value(ustte)).toBe(-4);
    expect(TRACKING_METRICS.target_gap.detail(ustte)).toBe(
      "Toplam hedef 30 · ort. 34 · hedefte"
    );
  });

  it("hedef yoksa ölçüt uygulanmaz; tek denemede yetersiz veri", () => {
    expect(TRACKING_METRICS.target_gap.appliesTo?.(row())).toBe(false);
    expect(TRACKING_METRICS.target_gap.detail(row())).toBe("Hedef girilmemiş");
    const tek = row({ targets: [{ targetNet: 45 }], previousNet: undefined });
    expect(TRACKING_METRICS.target_gap.value(tek)).toBeUndefined();
    expect(TRACKING_METRICS.target_gap.detail(tek)).toBe(
      "Yetersiz veri: 1 deneme, en az 2 gerekir"
    );
  });
});

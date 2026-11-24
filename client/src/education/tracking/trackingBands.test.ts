import { describe, expect, it } from "vitest";
import {
  bandFor,
  evaluateOverall,
  rankRows,
  validateLimits,
} from "./trackingBands";
import { resolveLimits } from "./trackingMetrics";
import type { TrackingStudentRow } from "./trackingTypes";

const row = (
  id: string,
  over: Partial<TrackingStudentRow> = {}
): TrackingStudentRow => ({
  studentId: id,
  studentName: id,
  classNames: "12-A",
  lessonCount: 10,
  presentCount: 10,
  lateCount: 0,
  absentCount: 0,
  excusedCount: 0,
  absenceStreak: 0,
  examExpected: 2,
  examMissed: 0,
  lastNet: 50,
  previousNet: 50,
  netAvg3: 50,
  subjectNets: [],
  homeworkExpected: 4,
  homeworkSubmitted: 4,
  ...over,
});

const attendance = (id: string, present: number, absent: number) =>
  row(id, {
    lessonCount: present + absent,
    presentCount: present,
    absentCount: absent,
  });

describe("validateLimits", () => {
  it("yüksek olan iyi ölçütte riskli güvenliyi geçemez", () => {
    expect(validateLimits("higher_better", { risk: 80, safe: 90 })).toBeNull();
    expect(validateLimits("higher_better", { risk: 80, safe: 80 })).toBeNull();
    expect(validateLimits("higher_better", { risk: 90, safe: 80 })).toBe(
      "Riskli sınırı güvenli sınırından büyük olamaz."
    );
  });

  it("düşük olan iyi ölçütte riskli güvenliden küçük olamaz", () => {
    expect(validateLimits("lower_better", { risk: 3, safe: 1 })).toBeNull();
    expect(validateLimits("lower_better", { risk: 1, safe: 3 })).toBe(
      "Riskli sınırı güvenli sınırından küçük olamaz."
    );
  });

  it("sayı olmayan sınırı reddeder", () => {
    expect(validateLimits("higher_better", { risk: Number.NaN, safe: 1 })).toBe(
      "Sınırlar sayı olmalı."
    );
  });
});

describe("bandFor", () => {
  const limits = { risk: 80, safe: 90 };

  it("sınırın kendisi bir üst banda düşer", () => {
    expect(bandFor(79, "higher_better", limits)).toBe("risk");
    expect(bandFor(80, "higher_better", limits)).toBe("medium");
    expect(bandFor(89, "higher_better", limits)).toBe("medium");
    expect(bandFor(90, "higher_better", limits)).toBe("safe");
  });

  it("düşük olan iyi ölçütte ayna kural", () => {
    const late = { risk: 3, safe: 1 };
    expect(bandFor(4, "lower_better", late)).toBe("risk");
    expect(bandFor(3, "lower_better", late)).toBe("medium");
    expect(bandFor(2, "lower_better", late)).toBe("medium");
    expect(bandFor(1, "lower_better", late)).toBe("safe");
    expect(bandFor(0, "lower_better", late)).toBe("safe");
  });

  it("veri yoksa yetersiz, sınır yoksa ya da bozuksa bantsız", () => {
    expect(bandFor(undefined, "higher_better", limits)).toBe("insufficient");
    expect(bandFor(50, "higher_better", null)).toBe("unbanded");
    expect(bandFor(50, "higher_better", { risk: 90, safe: 80 })).toBe(
      "unbanded"
    );
  });
});

describe("evaluateOverall", () => {
  const limits = resolveLimits({}, {});

  it("riskli ve orta ölçütleri sayar", () => {
    // devam %70 (riskli), ödev %75 (orta: 60 ≤ 75 < 80)
    const r = row("a", {
      lessonCount: 10,
      presentCount: 7,
      absentCount: 3,
      homeworkExpected: 4,
      homeworkSubmitted: 3,
    });
    const overall = evaluateOverall(r, limits);
    expect(overall.risk).toBe(1);
    expect(overall.medium).toBe(1);
    expect(overall.band).toBe("risk");
    expect(overall.riskLabels).toEqual(["Devam"]);
  });

  it("hiçbir ölçüt ölçülemiyorsa yetersiz veri", () => {
    const r = row("a", {
      lessonCount: 0,
      presentCount: 0,
      examExpected: 0,
      lastNet: undefined,
      previousNet: undefined,
      netAvg3: undefined,
      homeworkExpected: 0,
      homeworkSubmitted: 0,
    });
    expect(evaluateOverall(r, limits).band).toBe("insufficient");
  });
});

describe("rankRows", () => {
  const limits = resolveLimits({}, {});

  it("varsayılan sıra riskliden güvenliye, bant içinde en kötü önce, yetersiz en sonda", () => {
    const rows = [
      attendance("guvenli", 10, 0), // %100
      attendance("orta", 17, 3), // %85
      attendance("riskli-az", 7, 3), // %70
      attendance("yetersiz", 2, 1), // 3 ders
      attendance("riskli-cok", 5, 5), // %50
    ];
    const ranked = rankRows(rows, {
      criterion: "attendance_pct",
      limits,
      sort: { key: "criticality", dir: "desc" },
    });
    expect(ranked.map(r => r.row.studentId)).toEqual([
      "riskli-cok",
      "riskli-az",
      "orta",
      "guvenli",
      "yetersiz",
    ]);
    expect(ranked.map(r => r.band)).toEqual([
      "risk",
      "risk",
      "medium",
      "safe",
      "insufficient",
    ]);
  });

  it("yön tersine dönünce güvenli önce gelir ama yetersiz yine sonda", () => {
    const rows = [
      attendance("riskli", 5, 5),
      attendance("guvenli", 10, 0),
      attendance("yetersiz", 1, 1),
    ];
    const ranked = rankRows(rows, {
      criterion: "attendance_pct",
      limits,
      sort: { key: "criticality", dir: "asc" },
    });
    expect(ranked.map(r => r.row.studentId)).toEqual([
      "guvenli",
      "riskli",
      "yetersiz",
    ]);
  });

  it("düşük olan iyi ölçütte en yüksek değer en kritik", () => {
    const rows = [
      row("iki", { absenceStreak: 2 }),
      row("bes", { absenceStreak: 5 }),
      row("dort", { absenceStreak: 4 }),
    ];
    const ranked = rankRows(rows, {
      criterion: "absence_streak",
      limits,
      sort: { key: "criticality", dir: "desc" },
    });
    expect(ranked.map(r => r.row.studentId)).toEqual(["bes", "dort", "iki"]);
  });

  it("değere ve ada göre sıralanabilir", () => {
    const rows = [
      attendance("Çağla", 9, 1),
      attendance("Ayşe", 5, 5),
      attendance("Ömer", 7, 3),
    ];
    const byValue = rankRows(rows, {
      criterion: "attendance_pct",
      limits,
      sort: { key: "value", dir: "desc" },
    });
    expect(byValue.map(r => r.row.studentId)).toEqual([
      "Çağla",
      "Ömer",
      "Ayşe",
    ]);
    const byName = rankRows(rows, {
      criterion: "attendance_pct",
      limits,
      sort: { key: "name", dir: "asc" },
    });
    expect(byName.map(r => r.row.studentId)).toEqual(["Ayşe", "Çağla", "Ömer"]);
  });

  it("genel durumda önce riskli sayısı, eşitlikte orta sayısı", () => {
    const rows = [
      // bir riskli (devam %50)
      attendance("bir-riskli", 5, 5),
      // bir riskli + bir orta (ödev %75)
      row("bir-riskli-bir-orta", {
        lessonCount: 10,
        presentCount: 5,
        absentCount: 5,
        homeworkSubmitted: 3,
      }),
      // iki riskli (devam %50, ödev %25)
      row("iki-riskli", {
        lessonCount: 10,
        presentCount: 5,
        absentCount: 5,
        homeworkSubmitted: 1,
      }),
    ];
    const ranked = rankRows(rows, {
      criterion: "overall",
      limits,
      sort: { key: "criticality", dir: "desc" },
    });
    expect(ranked.map(r => r.row.studentId)).toEqual([
      "iki-riskli",
      "bir-riskli-bir-orta",
      "bir-riskli",
    ]);
  });
});

describe("genel durumda eksik veri", () => {
  it("ölçülemeyen ölçütler gerekçede yazılır, bant onlarsız hesaplanır", () => {
    const limits = resolveLimits({}, {});
    const r = row("a", {
      lessonCount: 10,
      presentCount: 5,
      absentCount: 5,
      homeworkExpected: 1,
      homeworkSubmitted: 1,
      examExpected: 1,
      previousNet: undefined,
    });
    const [ranked] = rankRows([r], {
      criterion: "overall",
      limits,
      sort: { key: "criticality", dir: "desc" },
    });
    expect(ranked.band).toBe("risk");
    expect(ranked.detail).toBe(
      "Devam riskli · Yetersiz veri: Toplam net, Net eğilimi, Girilmeyen deneme, Ödev"
    );
  });

  it("hiçbir ölçüt ölçülemiyorsa bunu söyler", () => {
    const limits = resolveLimits({}, {});
    const [ranked] = rankRows(
      [
        row("a", {
          lessonCount: 2,
          presentCount: 2,
          examExpected: 0,
          lastNet: undefined,
          previousNet: undefined,
          netAvg3: undefined,
          homeworkExpected: 0,
          homeworkSubmitted: 0,
        }),
      ],
      {
        criterion: "overall",
        limits,
        sort: { key: "criticality", dir: "desc" },
      }
    );
    expect(ranked.band).toBe("insufficient");
    expect(ranked.detail).toBe(
      "Yetersiz veri: hiçbir ölçüt için yeterli kayıt yok"
    );
  });
});

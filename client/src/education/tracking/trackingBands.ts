import {
  METRIC_KEYS,
  TRACKING_METRICS,
  type Criterion,
  type Direction,
  type Limits,
  type LimitsByMetric,
} from "./trackingMetrics";
import type { TrackingStudentRow } from "./trackingTypes";

/**
 * Bant, genel durum ve sıralama (karar 2026-11-24). Saf fonksiyonlar: aynı
 * satırlar ve sınırlar her zaman aynı listeyi verir; ekran sınır değişince
 * veritabanına gitmeden yeniden hesaplar.
 *
 * Bantlar:
 *   risk / medium / safe — iki sınıra göre
 *   unbanded             — ölçülebildi ama sınır yok ya da bozuk
 *   insufficient         — en az veri karşılanmadı; ASLA "güvenli" sayılmaz
 */
export type Band = "risk" | "medium" | "safe" | "unbanded" | "insufficient";

export function validateLimits(
  direction: Direction,
  limits: Limits
): string | null {
  if (!Number.isFinite(limits.risk) || !Number.isFinite(limits.safe)) {
    return "Sınırlar sayı olmalı.";
  }
  if (direction === "higher_better" && limits.risk > limits.safe) {
    return "Riskli sınırı güvenli sınırından büyük olamaz.";
  }
  if (direction === "lower_better" && limits.risk < limits.safe) {
    return "Riskli sınırı güvenli sınırından küçük olamaz.";
  }
  return null;
}

/** Sınırın kendisi bir üst (daha iyi) banda düşer: 80 yazılınca %80 orta. */
export function bandFor(
  value: number | undefined,
  direction: Direction,
  limits: Limits | null
): Band {
  if (value === undefined) return "insufficient";
  if (!limits || validateLimits(direction, limits)) return "unbanded";
  if (direction === "higher_better") {
    if (value < limits.risk) return "risk";
    if (value < limits.safe) return "medium";
    return "safe";
  }
  if (value > limits.risk) return "risk";
  if (value > limits.safe) return "medium";
  return "safe";
}

export type OverallResult = {
  risk: number;
  medium: number;
  safe: number;
  evaluated: number;
  band: Band;
  riskLabels: string[];
  mediumLabels: string[];
  /** En az veriyi karşılamadığı için değerlendirilmeyen ölçütler. */
  insufficientLabels: string[];
};

/**
 * Genel durum: sınırı olan her ölçüt değerlendirilir; ders neti yalnız ders
 * seçiliyse. Sıra önce riskli, eşitlikte orta ölçüt sayısıdır (ağırlık yok).
 */
export function evaluateOverall(
  row: TrackingStudentRow,
  limits: LimitsByMetric,
  subjectId?: string
): OverallResult {
  const result: OverallResult = {
    risk: 0,
    medium: 0,
    safe: 0,
    evaluated: 0,
    band: "insufficient",
    riskLabels: [],
    mediumLabels: [],
    insufficientLabels: [],
  };
  for (const key of METRIC_KEYS) {
    const metric = TRACKING_METRICS[key];
    if (metric.needsSubject && !subjectId) continue;
    const band = bandFor(
      metric.value(row, subjectId),
      metric.direction,
      limits[key]
    );
    if (band === "risk") {
      result.risk += 1;
      result.riskLabels.push(metric.shortLabel);
    } else if (band === "medium") {
      result.medium += 1;
      result.mediumLabels.push(metric.shortLabel);
    } else if (band === "safe") {
      result.safe += 1;
    } else {
      if (band === "insufficient") {
        result.insufficientLabels.push(metric.shortLabel);
      }
      continue;
    }
    result.evaluated += 1;
  }
  result.band =
    result.evaluated === 0
      ? "insufficient"
      : result.risk > 0
        ? "risk"
        : result.medium > 0
          ? "medium"
          : "safe";
  return result;
}

export type SortKey = "criticality" | "value" | "name";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

export type RankedRow = {
  row: TrackingStudentRow;
  band: Band;
  /** Seçili ölçütün değeri; genel durumda `undefined`. */
  value?: number;
  detail: string;
  overall: OverallResult;
};

const BAND_ORDER: Record<Band, number> = {
  risk: 0,
  medium: 1,
  safe: 2,
  unbanded: 3,
  insufficient: 4,
};

const byName = (a: RankedRow, b: RankedRow) =>
  a.row.studentName.localeCompare(b.row.studentName, "tr") ||
  a.row.studentId.localeCompare(b.row.studentId);

export function rankRows(
  rows: TrackingStudentRow[],
  options: {
    criterion: Criterion;
    subjectId?: string;
    limits: LimitsByMetric;
    sort: SortState;
  }
): RankedRow[] {
  const { criterion, subjectId, limits, sort } = options;
  const metric = criterion === "overall" ? null : TRACKING_METRICS[criterion];

  const ranked: RankedRow[] = rows.map(row => {
    const overall = evaluateOverall(row, limits, subjectId);
    if (!metric) {
      const reasons = [
        ...overall.riskLabels.map(label => `${label} riskli`),
        ...overall.mediumLabels.map(label => `${label} orta`),
      ];
      const missing =
        overall.insufficientLabels.length > 0
          ? `Yetersiz veri: ${overall.insufficientLabels.join(", ")}`
          : "";
      return {
        row,
        band: overall.band,
        detail:
          overall.evaluated === 0
            ? "Yetersiz veri: hiçbir ölçüt için yeterli kayıt yok"
            : [
                reasons.length > 0
                  ? reasons.join(" · ")
                  : `${overall.evaluated} ölçütte güvenli`,
                missing,
              ]
                .filter(Boolean)
                .join(" · "),
        overall,
      };
    }
    const value = metric.value(row, subjectId);
    return {
      row,
      band: bandFor(value, metric.direction, limits[metric.key]),
      value,
      detail: metric.detail(row, subjectId),
      overall,
    };
  });

  // "Kötü önce" karşılaştırması: bant içinde en kritik satır en başta.
  const worseFirst = (a: RankedRow, b: RankedRow) => {
    if (!metric) {
      return (
        b.overall.risk - a.overall.risk || b.overall.medium - a.overall.medium
      );
    }
    if (a.value === undefined || b.value === undefined) return 0;
    return metric.direction === "higher_better"
      ? a.value - b.value
      : b.value - a.value;
  };

  const sign = sort.dir === "desc" ? 1 : -1;

  return ranked.sort((a, b) => {
    // Yetersiz veri her sıralamada en sonda kalır.
    const aLast = a.band === "insufficient" ? 1 : 0;
    const bLast = b.band === "insufficient" ? 1 : 0;
    if (aLast !== bLast) return aLast - bLast;

    if (sort.key === "name") {
      return sort.dir === "asc" ? byName(a, b) : byName(b, a);
    }

    if (sort.key === "value") {
      const av = metric ? a.value : a.overall.risk * 100 + a.overall.medium;
      const bv = metric ? b.value : b.overall.risk * 100 + b.overall.medium;
      if (av === undefined || bv === undefined) {
        if (av !== bv) return av === undefined ? 1 : -1;
        return byName(a, b);
      }
      return (sort.dir === "desc" ? bv - av : av - bv) || byName(a, b);
    }

    // criticality: desc = en kritik önce
    const band = BAND_ORDER[a.band] - BAND_ORDER[b.band];
    if (band !== 0) return sign * band;
    return sign * worseFirst(a, b) || byName(a, b);
  });
}

/** Bant başına öğrenci sayısı (sınıf profili). */
export function bandCounts(ranked: RankedRow[]): Record<Band, number> {
  const counts: Record<Band, number> = {
    risk: 0,
    medium: 0,
    safe: 0,
    unbanded: 0,
    insufficient: 0,
  };
  for (const item of ranked) counts[item.band] += 1;
  return counts;
}

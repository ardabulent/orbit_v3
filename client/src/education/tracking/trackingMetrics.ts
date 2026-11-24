import { calculateAttendancePercentage } from "../attendanceService";
import type { TrackingStudentRow } from "./trackingTypes";

/**
 * Takip sekmesinin ölçütleri (karar 2026-11-24).
 *
 * Her ölçütün yönü SABİTTİR; kullanıcı yalnız iki sınırı (riskli, güvenli)
 * yazar. `value` ölçülemiyorsa (en az veri karşılanmadıysa) `undefined`
 * döner ve öğrenci "Yetersiz veri" sayılır — "güvenli" değil.
 *
 * Anahtar listesi veritabanındaki `tracking_threshold_defaults_metric_check`
 * ve `_direction_check` kısıtlarıyla aynıdır; biri değişirse öteki de değişir.
 */

export const METRIC_KEYS = [
  "attendance_pct",
  "late_count",
  "absence_streak",
  "net_avg",
  "subject_net",
  "net_trend",
  "exam_missed",
  "homework_pct",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];
export type Criterion = MetricKey | "overall";
export type Direction = "higher_better" | "lower_better";
export type Limits = { risk: number; safe: number };
export type LimitsByMetric = Record<MetricKey, Limits | null>;

export type MetricDefinition = {
  key: MetricKey;
  /** Seçicide görünen ad. */
  label: string;
  /** Genel durum gerekçesinde görünen kısa ad. */
  shortLabel: string;
  unit: "%" | "net" | "adet";
  direction: Direction;
  /** Ders seçilmeden ölçülemeyen ölçüt. */
  needsSubject?: boolean;
  value: (row: TrackingStudentRow, subjectId?: string) => number | undefined;
  detail: (row: TrackingStudentRow, subjectId?: string) => string;
};

const MIN_LESSONS = 5;
const MIN_HOMEWORK = 3;

const formatNet = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

const signed = (value: number) =>
  value > 0 ? `+${formatNet(value)}` : formatNet(value);

const round2 = (value: number) => Math.round(value * 100) / 100;

const attendancePercent = (row: TrackingStudentRow) =>
  row.lessonCount >= MIN_LESSONS
    ? calculateAttendancePercentage({
        present: row.presentCount,
        late: row.lateCount,
        absent: row.absentCount,
      })
    : undefined;

const subjectOf = (row: TrackingStudentRow, subjectId?: string) =>
  subjectId ? row.subjectNets.find(s => s.subjectId === subjectId) : undefined;

export const TRACKING_METRICS: Record<MetricKey, MetricDefinition> = {
  attendance_pct: {
    key: "attendance_pct",
    label: "Devam yüzdesi",
    shortLabel: "Devam",
    unit: "%",
    direction: "higher_better",
    value: attendancePercent,
    detail: row => {
      const percent = attendancePercent(row);
      const attended = row.presentCount + row.lateCount;
      return percent === undefined
        ? `${row.lessonCount} ders · en az ${MIN_LESSONS} ders gerekir`
        : `Devam %${percent} · ${attended}/${row.lessonCount} ders`;
    },
  },
  late_count: {
    key: "late_count",
    label: "Geç kalma sayısı",
    shortLabel: "Geç kalma",
    unit: "adet",
    direction: "lower_better",
    value: row => (row.lessonCount >= MIN_LESSONS ? row.lateCount : undefined),
    detail: row => `${row.lateCount} geç kalma · ${row.lessonCount} ders`,
  },
  absence_streak: {
    key: "absence_streak",
    label: "Üst üste devamsızlık",
    shortLabel: "Üst üste devamsızlık",
    unit: "adet",
    direction: "lower_better",
    value: row => (row.lessonCount >= 1 ? row.absenceStreak : undefined),
    detail: row =>
      row.lessonCount === 0
        ? "Bu aralıkta ders yok"
        : row.absenceStreak === 0
          ? "Son derse geldi"
          : `Son ${row.absenceStreak} derse gelmedi`,
  },
  net_avg: {
    key: "net_avg",
    label: "Toplam net (son 3 deneme)",
    shortLabel: "Net",
    unit: "net",
    direction: "higher_better",
    value: row => row.netAvg3,
    detail: row =>
      row.netAvg3 === undefined
        ? "Bu aralıkta deneme sonucu yok"
        : `Son 3 deneme ort. ${formatNet(row.netAvg3)} net` +
          (row.classAvgLast !== undefined
            ? ` · sınıf ${formatNet(row.classAvgLast)}`
            : ""),
  },
  subject_net: {
    key: "subject_net",
    label: "Ders neti",
    shortLabel: "Ders neti",
    unit: "net",
    direction: "higher_better",
    needsSubject: true,
    value: (row, subjectId) => subjectOf(row, subjectId)?.avgNet,
    detail: (row, subjectId) => {
      const subject = subjectOf(row, subjectId);
      if (!subject) return "Bu derste sonuç yok";
      return (
        `${subject.subjectName} ${formatNet(subject.avgNet)} net` +
        (subject.classAvg !== undefined
          ? ` · sınıf ${formatNet(subject.classAvg)}`
          : "")
      );
    },
  },
  net_trend: {
    key: "net_trend",
    label: "Net eğilimi (son − önceki)",
    shortLabel: "Net düşüşü",
    unit: "net",
    direction: "higher_better",
    value: row =>
      row.lastNet !== undefined && row.previousNet !== undefined
        ? round2(row.lastNet - row.previousNet)
        : undefined,
    detail: row =>
      row.lastNet !== undefined && row.previousNet !== undefined
        ? `${formatNet(row.previousNet)} → ${formatNet(row.lastNet)} (${signed(
            round2(row.lastNet - row.previousNet)
          )})`
        : "En az iki deneme gerekir",
  },
  exam_missed: {
    key: "exam_missed",
    label: "Girilmeyen deneme",
    shortLabel: "Girilmeyen deneme",
    unit: "adet",
    direction: "lower_better",
    value: row => (row.examExpected >= 1 ? row.examMissed : undefined),
    detail: row =>
      row.examExpected === 0
        ? "Bu aralıkta deneme yok"
        : `Girmediği deneme: ${row.examMissed} / ${row.examExpected}`,
  },
  homework_pct: {
    key: "homework_pct",
    label: "Ödev teslim yüzdesi",
    shortLabel: "Ödev",
    unit: "%",
    direction: "higher_better",
    value: row =>
      row.homeworkExpected >= MIN_HOMEWORK
        ? Math.round((row.homeworkSubmitted / row.homeworkExpected) * 100)
        : undefined,
    detail: row =>
      row.homeworkExpected >= MIN_HOMEWORK
        ? `Ödev %${Math.round(
            (row.homeworkSubmitted / row.homeworkExpected) * 100
          )} · ${row.homeworkSubmitted}/${row.homeworkExpected}`
        : `${row.homeworkExpected} bitmiş ödev · en az ${MIN_HOMEWORK} gerekir`,
  },
};

/**
 * Kod varsayılanları (tasarım §3). Net ölçütlerinde kurumdan kuruma çok
 * değiştiği için varsayılan yok (`null`): kullanıcı ya da kurum girer.
 */
export const CODE_DEFAULT_LIMITS: LimitsByMetric = {
  attendance_pct: { risk: 80, safe: 90 },
  late_count: { risk: 3, safe: 1 },
  absence_streak: { risk: 3, safe: 1 },
  net_avg: null,
  subject_net: null,
  net_trend: { risk: -5, safe: 0 },
  exam_missed: { risk: 2, safe: 1 },
  homework_pct: { risk: 60, safe: 80 },
};

/** Kişisel seçim > kurum varsayılanı > kod varsayılanı. */
export function resolveLimits(
  institution: Partial<Record<MetricKey, Limits>>,
  personal: Partial<Record<MetricKey, Limits>>
): LimitsByMetric {
  const resolved = { ...CODE_DEFAULT_LIMITS };
  for (const key of METRIC_KEYS) {
    resolved[key] =
      personal[key] ?? institution[key] ?? CODE_DEFAULT_LIMITS[key];
  }
  return resolved;
}

export const isMetricKey = (value: unknown): value is MetricKey =>
  typeof value === "string" &&
  (METRIC_KEYS as readonly string[]).includes(value);

import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";
import type { ReportWeeks } from "./reportService";
import {
  isMetricKey,
  type Limits,
  type MetricKey,
} from "./tracking/trackingMetrics";
import type {
  TrackingStudentRow,
  TrackingSubjectNet,
} from "./tracking/trackingTypes";

/**
 * Takip sekmesi servis katmanı (2026-11-24).
 *
 * - `tracking_student_metrics`: öğrenci başına HAM sayılar. Kim hangi
 *   öğrenciyi görür veritabanında kararlaştırılır; bant ve sıra istemcide.
 * - `tracking_threshold_defaults`: kurum varsayılan sınırları. Yazma yetkisi
 *   (yalnız tam yönetici) RLS'te; ekrandaki düğme yalnız kullanıcı deneyimi.
 */

export type TrackingScope = {
  weeks: ReportWeeks;
  classId?: string;
  studentId?: string;
};

function translateTrackingError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  if (code === "42501") {
    return "Bu işlem için yetkiniz bulunmuyor.";
  }
  if (code === "23514") {
    return "Sınırlar ölçütün yönüne uymuyor: riskli sınırı güvenli sınırını geçemez.";
  }
  return (
    userFacingErrorText(error) || "Takip verileri yüklenirken bir hata oluştu."
  );
}

const toNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toCount = (value: unknown): number => toNumber(value) ?? 0;

function parseSubjectNets(value: unknown): TrackingSubjectNet[] {
  if (!Array.isArray(value)) return [];
  const subjects: TrackingSubjectNet[] = [];
  for (const item of value as Record<string, unknown>[]) {
    const subjectId =
      typeof item?.subject_id === "string" ? item.subject_id : "";
    const subjectName =
      typeof item?.subject_name === "string" ? item.subject_name.trim() : "";
    const avgNet = toNumber(item?.avg_net);
    if (!subjectId || !subjectName || avgNet === undefined) continue;
    subjects.push({
      subjectId,
      subjectName,
      avgNet,
      classAvg: toNumber(item.class_avg),
      examCount: toCount(item.exam_count),
    });
  }
  return subjects;
}

type MetricsRow = Record<string, unknown>;

export function mapTrackingRow(row: MetricsRow): TrackingStudentRow | null {
  const studentId = typeof row.student_id === "string" ? row.student_id : "";
  const studentName =
    typeof row.student_name === "string" ? row.student_name.trim() : "";
  if (!studentId || !studentName) return null;
  return {
    studentId,
    studentName,
    classNames: typeof row.class_names === "string" ? row.class_names : "",
    lessonCount: toCount(row.lesson_count),
    presentCount: toCount(row.present_count),
    lateCount: toCount(row.late_count),
    absentCount: toCount(row.absent_count),
    excusedCount: toCount(row.excused_count),
    absenceStreak: toCount(row.absence_streak),
    examExpected: toCount(row.exam_expected),
    examMissed: toCount(row.exam_missed),
    lastNet: toNumber(row.last_net),
    previousNet: toNumber(row.previous_net),
    netAvg3: toNumber(row.net_avg3),
    classAvgLast: toNumber(row.class_avg_last),
    subjectNets: parseSubjectNets(row.subject_nets),
    homeworkExpected: toCount(row.homework_expected),
    homeworkSubmitted: toCount(row.homework_submitted),
  };
}

export async function loadTrackingMetrics(
  scope: TrackingScope
): Promise<TrackingStudentRow[]> {
  const { data, error } = await supabase.rpc("tracking_student_metrics", {
    p_weeks: scope.weeks,
    p_class_id: scope.classId ?? null,
    p_student_id: scope.studentId ?? null,
  });
  if (error) {
    throw new Error(translateTrackingError(error));
  }
  const rows: TrackingStudentRow[] = [];
  for (const raw of (data ?? []) as MetricsRow[]) {
    const row = mapTrackingRow(raw);
    if (row) rows.push(row);
  }
  return rows;
}

export type TrackingDefaults = Partial<Record<MetricKey, Limits>>;

export async function loadTrackingDefaults(
  organizationId: string
): Promise<TrackingDefaults> {
  const { data, error } = await supabase
    .from("tracking_threshold_defaults")
    .select("metric, risk_limit, safe_limit")
    .eq("organization_id", organizationId);
  if (error) {
    throw new Error(translateTrackingError(error));
  }
  const defaults: TrackingDefaults = {};
  for (const row of (data ?? []) as MetricsRow[]) {
    const risk = toNumber(row.risk_limit);
    const safe = toNumber(row.safe_limit);
    if (isMetricKey(row.metric) && risk !== undefined && safe !== undefined) {
      defaults[row.metric] = { risk, safe };
    }
  }
  return defaults;
}

/** Bütün ölçütler tek istekte; "son değiştiren" alanını veritabanı doldurur. */
export async function saveTrackingDefaults(
  organizationId: string,
  limits: TrackingDefaults
): Promise<void> {
  const rows = Object.entries(limits)
    .filter(
      (entry): entry is [MetricKey, Limits] =>
        isMetricKey(entry[0]) && !!entry[1]
    )
    .map(([metric, value]) => ({
      organization_id: organizationId,
      metric,
      risk_limit: value.risk,
      safe_limit: value.safe,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("tracking_threshold_defaults")
    .upsert(rows, { onConflict: "organization_id,metric" });
  if (error) {
    throw new Error(translateTrackingError(error));
  }
}

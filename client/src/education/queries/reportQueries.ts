// Raporlar ekranının sorguları.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  loadAttendanceWeeks,
  loadExamAverages,
  loadHomeworkWeeks,
  loadAttentionStudents,
  loadClassComparison,
  type AttentionStudent,
  DEFAULT_REPORT_RANGE,
  type ClassComparisonRow,
  type ReportWeeks,
  type AttendanceWeek,
  type ReportRange,
  type ExamAverage,
  type HomeworkWeek,
} from "../reportService";
import { educationKeys } from "./educationKeys";

export type UseReportAttendanceWeeksOptions = {
  organizationId?: string;
  enabled?: boolean;
  range?: ReportRange;
};

/**
 * Devam görünümü için son 4 takvim haftasının verilerini getiren React Query hook'u (v1.4-16 · #278).
 */
export function useReportAttendanceWeeks(
  options?: UseReportAttendanceWeeksOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);
  const range = options?.range ?? DEFAULT_REPORT_RANGE;

  return useQuery<AttendanceWeek[] | null, Error>({
    queryKey: organizationId
      ? educationKeys.reportAttendanceWeeks(organizationId, range)
      : ([
          "education",
          "reportAttendanceWeeks",
          { organizationId: "" },
        ] as const),
    queryFn: () => loadAttendanceWeeks(range),
    enabled: isEnabled,
  });
}

export type UseReportExamAveragesOptions = {
  organizationId?: string;
  enabled?: boolean;
  range?: ReportRange;
};

/**
 * Deneme gelişimi için son 0-4 sınavın ortalamasını getiren React Query hook'u (v1.4-16 · #278).
 */
export function useReportExamAverages(options?: UseReportExamAveragesOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);
  const range = options?.range ?? DEFAULT_REPORT_RANGE;

  return useQuery<ExamAverage[] | null, Error>({
    queryKey: organizationId
      ? educationKeys.reportExamAverages(organizationId, range)
      : (["education", "reportExamAverages", { organizationId: "" }] as const),
    queryFn: () => loadExamAverages(range),
    enabled: isEnabled,
  });
}

export type UseReportHomeworkWeeksOptions = {
  organizationId?: string;
  enabled?: boolean;
  range?: ReportRange;
};

/**
 * Ödev tamamlama için son 4 takvim haftasının teslim oranını getiren React Query hook'u (v1.4-16 · #278).
 */
export function useReportHomeworkWeeks(
  options?: UseReportHomeworkWeeksOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);
  const range = options?.range ?? DEFAULT_REPORT_RANGE;

  return useQuery<HomeworkWeek[] | null, Error>({
    queryKey: organizationId
      ? educationKeys.reportHomeworkWeeks(organizationId, range)
      : (["education", "reportHomeworkWeeks", { organizationId: "" }] as const),
    queryFn: () => loadHomeworkWeeks(range),
    enabled: isEnabled,
  });
}

/**
 * Sınıf karşılaştırması (`report_class_comparison`, 2026-09-29). Sınıf
 * süzgecinden bağımsızdır: tablo her zaman bütün görünür sınıfları gösterir.
 */
export function useReportClassComparison(options: {
  weeks: ReportWeeks;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  const isEnabled = (options.enabled ?? true) && Boolean(organizationId);

  return useQuery<ClassComparisonRow[], Error>({
    queryKey: educationKeys.reportClassComparison(
      organizationId ?? "",
      options.weeks
    ),
    queryFn: () => loadClassComparison(options.weeks),
    enabled: isEnabled,
  });
}

/** Dikkat listesi (`report_attention_students`, 2026-09-29). */
export function useReportAttentionStudents(options: {
  weeks: ReportWeeks;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  const isEnabled = (options.enabled ?? true) && Boolean(organizationId);

  return useQuery<AttentionStudent[], Error>({
    queryKey: educationKeys.reportAttentionStudents(
      organizationId ?? "",
      options.weeks
    ),
    queryFn: () => loadAttentionStudents(options.weeks),
    enabled: isEnabled,
  });
}

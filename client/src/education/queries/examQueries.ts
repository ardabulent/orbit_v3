// Sınavlar: son sınav, sınav listesi, öğrencinin sınavları.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { loadLatestExam, type LatestExamResult } from "../examService";
import { loadExams, type ExamListResult } from "../examNetService";
import {
  loadStudentExams,
  type StudentExamOverview,
} from "../studentExamService";
import { educationKeys } from "./educationKeys";

export type UseLatestExamOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Aktif kurumun en son aktif sınavını getiren React Query hook'u (v1.3-01 · D parçası, #249, #270).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useLatestExam(options?: UseLatestExamOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<LatestExamResult, Error>({
    queryKey: organizationId
      ? educationKeys.exam(organizationId)
      : (["education", "exam", { organizationId: "" }] as const),
    queryFn: () => loadLatestExam(organizationId!),
    enabled: isEnabled,
  });
}

/** Sınavlar listesi, girilmiş sonuç sayısı ve ortalamasıyla. */
export function useExams(options?: {
  classId?: string | null;
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<ExamListResult, Error>({
    queryKey: educationKeys.examList(organizationId ?? "", options?.classId),
    queryFn: () =>
      loadExams(organizationId as string, { classId: options?.classId }),
    enabled: isEnabled,
  });
}

/** Öğrencinin yaklaşan sınavları ve sonuçları (öğrenci/veli görünümü). */
export function useStudentExams(options: {
  studentId: string | null;
  today: string;
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options.organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options.enabled ?? true) &&
    Boolean(organizationId) &&
    Boolean(options.studentId);

  return useQuery<StudentExamOverview, Error>({
    queryKey: educationKeys.studentExams(
      organizationId ?? "",
      options.studentId ?? "",
      options.today
    ),
    queryFn: () =>
      loadStudentExams(
        organizationId as string,
        options.studentId as string,
        options.today
      ),
    enabled: isEnabled,
  });
}

// Ödevler ve öğrencinin ödev bağlamı.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  HOMEWORK_TOTAL_CAP,
  loadHomework,
  type HomeworkListResult,
} from "../homeworkService";
import {
  loadStudentHomeworkContext,
  type StudentHomeworkContext,
} from "../studentHomeworkService";
import { educationKeys } from "./educationKeys";

export type UseHomeworkOptions = {
  organizationId?: string;
  limit?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun ödevlerini getiren React Query hook'u (v1.4-05 · #273).
 */
export function useHomework(options?: UseHomeworkOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? HOMEWORK_TOTAL_CAP;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<HomeworkListResult, Error>({
    queryKey: organizationId
      ? educationKeys.homework(organizationId)
      : (["education", "homework", { organizationId: "" }] as const),
    queryFn: () => loadHomework(organizationId!, { limit }),
    enabled: isEnabled,
  });
}

/** Öğrencinin sınıfları ve teslim aldığı ödevler (öğrenci/veli görünümü). */
export function useStudentHomeworkContext(options: {
  studentId: string | null;
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

  return useQuery<StudentHomeworkContext, Error>({
    queryKey: educationKeys.studentHomework(
      organizationId ?? "",
      options.studentId ?? ""
    ),
    queryFn: () =>
      loadStudentHomeworkContext(
        organizationId as string,
        options.studentId as string
      ),
    enabled: isEnabled,
  });
}

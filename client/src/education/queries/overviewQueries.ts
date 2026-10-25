// Genel Bakış sorguları (dört rol) ve bugünün dersleri.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  loadAdminOverviewCounts,
  loadMyLessonsToday,
  loadStudentLessonsToday,
  loadStudentOverdueInstallments,
  loadStudentOverview,
  loadStudentUpcomingHomework,
  loadTeacherOverviewCounts,
  loadTodayLessons,
  type AdminOverviewCounts,
  type StudentOverview,
  type TeacherOverviewCounts,
  type UpcomingHomework,
  type TodayLesson,
} from "../overviewService";
import { educationKeys } from "./educationKeys";

export type UseOverviewOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Yönetici Genel Bakış sayıları (`admin_overview_counts`).
 *
 * `staleTime: 0` bilinçli: bu ekran "şu an neye bakmalısın" diyor ve başka
 * sekmede alınan yoklama ya da eklenen öğrenci, sekmeye dönüldüğünde görünmeli.
 * Sayım tek satırlık ucuz bir sorgu; genel bir dakikalık bayatlama burada
 * yanlış bir "yoklama alınmadı" uyarısını ekranda tutardı.
 */
export function useAdminOverview(options?: UseOverviewOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<AdminOverviewCounts | null, Error>({
    queryKey: organizationId
      ? educationKeys.adminOverview(organizationId)
      : (["education", "adminOverview", { organizationId: "" }] as const),
    queryFn: () => loadAdminOverviewCounts(organizationId as string),
    enabled: isEnabled,
    staleTime: 0,
  });
}

/** Bugünün dersleri ve sınıfların günlük yoklama durumu (`today_lessons`). */
export function useTodayLessons(options?: UseOverviewOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<TodayLesson[], Error>({
    queryKey: organizationId
      ? educationKeys.todayLessons(organizationId)
      : (["education", "todayLessons", { organizationId: "" }] as const),
    queryFn: () => loadTodayLessons(organizationId as string),
    enabled: isEnabled,
    staleTime: 0,
  });
}

/** Öğretmen Genel Bakış sayıları. `staleTime: 0` — gerekçe `useAdminOverview`'da. */
export function useTeacherOverview(options?: UseOverviewOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<TeacherOverviewCounts | null, Error>({
    queryKey: organizationId
      ? educationKeys.teacherOverview(organizationId)
      : (["education", "teacherOverview", { organizationId: "" }] as const),
    queryFn: () => loadTeacherOverviewCounts(organizationId as string),
    enabled: isEnabled,
    staleTime: 0,
  });
}

/** Öğretmenin bugünkü dersleri (`my_lessons_today`). */
export function useMyLessonsToday(options?: UseOverviewOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<TodayLesson[], Error>({
    queryKey: organizationId
      ? educationKeys.myLessonsToday(organizationId)
      : (["education", "myLessonsToday", { organizationId: "" }] as const),
    queryFn: () => loadMyLessonsToday(organizationId as string),
    enabled: isEnabled,
    staleTime: 0,
  });
}

export type UseStudentOverviewOptions = {
  studentId: string | null | undefined;
  enabled?: boolean;
};

/**
 * Bir öğrencinin Genel Bakış verisi. Öğrenci kendi kimliğiyle, veli çocuğunun
 * kimliğiyle çağırır. Anahtar kurumu da taşır (K-19): aynı öğrenci kimliği
 * iki kurumda olamaz ama kurum değişince önbellek yine de ayrışmalı.
 */
function useStudentScopedQuery<T>(
  resource:
    | "studentOverview"
    | "studentUpcomingHomework"
    | "studentLessonsToday"
    | "studentOverdueInstallments",
  load: (studentId: string) => Promise<T>,
  options: UseStudentOverviewOptions
) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  const studentId = options.studentId;
  const isEnabled =
    (options.enabled ?? true) && Boolean(organizationId) && Boolean(studentId);

  return useQuery<T, Error>({
    queryKey:
      organizationId && studentId
        ? educationKeys[resource](organizationId, studentId)
        : (["education", resource, { organizationId: "" }] as const),
    queryFn: () => load(studentId as string),
    enabled: isEnabled,
    staleTime: 0,
  });
}

export function useStudentOverview(options: UseStudentOverviewOptions) {
  return useStudentScopedQuery<StudentOverview | null>(
    "studentOverview",
    loadStudentOverview,
    options
  );
}

export function useStudentUpcomingHomework(options: UseStudentOverviewOptions) {
  return useStudentScopedQuery<UpcomingHomework[]>(
    "studentUpcomingHomework",
    loadStudentUpcomingHomework,
    options
  );
}

export function useStudentLessonsToday(options: UseStudentOverviewOptions) {
  return useStudentScopedQuery<TodayLesson[]>(
    "studentLessonsToday",
    loadStudentLessonsToday,
    options
  );
}

export function useStudentOverdueInstallments(
  options: UseStudentOverviewOptions
) {
  return useStudentScopedQuery<number | null>(
    "studentOverdueInstallments",
    loadStudentOverdueInstallments,
    options
  );
}

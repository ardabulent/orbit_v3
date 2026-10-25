// Kurum listeleri: öğrenci, sınıf, ders, öğretmen ataması, veli, derslik, arşiv.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  STUDENT_TOTAL_CAP,
  loadStudents,
  type StudentListResult,
} from "../studentService";
import {
  DEFAULT_CLASS_LIMIT,
  loadClasses,
  loadClassEnrollments,
  type ClassListResult,
} from "../classService";
import type { ClassEnrollmentItem } from "@/components/education/types";
import { loadSubjects, type SubjectListResult } from "../subjectService";
import {
  loadClassTeachers,
  type ClassTeacherListResult,
} from "../classTeacherService";
import {
  GUARDIAN_TOTAL_CAP,
  loadGuardians,
  loadStudentGuardianLinks,
  type GuardianListResult,
  type StudentGuardianLink,
} from "../guardianService";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { loadArchive, type ArchiveListing } from "../archiveService";
import { loadRooms, type Room } from "../roomService";
import { educationKeys } from "./educationKeys";

export type UseStudentsOptions = {
  organizationId?: string;
  limit?: number;
  search?: string;
  debounceMs?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun öğrencilerini getiren React Query hook'u.
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useStudents(options?: UseStudentsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? STUDENT_TOTAL_CAP;
  const debouncedSearch = useDebouncedValue(
    options?.search,
    options?.debounceMs ?? 300
  );
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<StudentListResult, Error>({
    queryKey: organizationId
      ? educationKeys.students(organizationId, debouncedSearch)
      : (["education", "students", { organizationId: "" }] as const),
    queryFn: () =>
      loadStudents(organizationId ?? "", {
        limit,
        search: debouncedSearch,
        // Ödeme ekranı yalnız yönetici ve velide var.
        includePayments:
          identity?.membership?.role === "admin" ||
          identity?.membership?.role === "parent",
      }),
    enabled: isEnabled,
  });
}

export type UseClassesOptions = {
  organizationId?: string;
  limit?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun sınıflarını getiren React Query hook'u.
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useClasses(options?: UseClassesOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? DEFAULT_CLASS_LIMIT;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<ClassListResult, Error>({
    queryKey: organizationId
      ? educationKeys.classes(organizationId)
      : (["education", "classes", { organizationId: "" }] as const),
    queryFn: () => loadClasses(organizationId ?? "", { limit }),
    enabled: isEnabled,
  });
}

export type UseClassEnrollmentsOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Belirli bir sınıfın aktif öğrenci kayıtlarını getiren React Query hook'u (v1.4-02).
 */
export function useClassEnrollments(
  classId: string,
  options?: UseClassEnrollmentsOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(classId);

  return useQuery<ClassEnrollmentItem[], Error>({
    queryKey:
      organizationId && classId
        ? educationKeys.classEnrollments(organizationId, classId)
        : ([
            "education",
            "classEnrollments",
            { organizationId: "", classId: "" },
          ] as const),
    queryFn: () => loadClassEnrollments(organizationId ?? "", classId),
    enabled: isEnabled,
  });
}

export type UseSubjectsOptions = {
  organizationId?: string;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun derslerini getiren React Query hook'u.
 */
export function useSubjects(options?: UseSubjectsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<SubjectListResult, Error>({
    queryKey: organizationId
      ? educationKeys.subjects(organizationId, {
          includeArchived: options?.includeArchived,
        })
      : (["education", "subjects", { organizationId: "" }] as const),
    queryFn: () =>
      loadSubjects(organizationId!, {
        includeArchived: options?.includeArchived,
        limit: options?.limit,
      }),
    enabled: isEnabled,
  });
}

export type UseClassTeachersOptions = {
  organizationId?: string;
  limit?: number;
  includeArchived?: boolean;
  enabled?: boolean;
};

/**
 * Sınıfın öğretmen atamalarını getiren React Query hook'u.
 */
export function useClassTeachers(
  classId: string,
  options?: UseClassTeachersOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(classId);

  return useQuery<ClassTeacherListResult, Error>({
    queryKey: organizationId
      ? educationKeys.classTeachers(organizationId, classId)
      : ([
          "education",
          "classTeachers",
          { organizationId: "", classId },
        ] as const),
    queryFn: () =>
      loadClassTeachers(organizationId!, classId, {
        limit: options?.limit,
        includeArchived: options?.includeArchived,
      }),
    enabled: isEnabled,
  });
}

export type UseGuardiansOptions = {
  organizationId?: string;
  limit?: number;
  search?: string;
  debounceMs?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun velilerini getiren React Query hook'u (v1.4-10 · #275).
 */
export function useGuardians(options?: UseGuardiansOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? GUARDIAN_TOTAL_CAP;
  const debouncedSearch = useDebouncedValue(
    options?.search,
    options?.debounceMs ?? 300
  );
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<GuardianListResult, Error>({
    queryKey: organizationId
      ? educationKeys.guardians(organizationId, debouncedSearch)
      : (["education", "guardians", { organizationId: "" }] as const),
    queryFn: () =>
      loadGuardians(organizationId ?? "", {
        limit,
        search: debouncedSearch,
      }),
    enabled: isEnabled,
  });
}

export type UseStudentGuardiansOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Bir öğrencinin aktif veli bağlarını getiren React Query hook'u (v1.4-10 · #275).
 */
export function useStudentGuardians(
  studentId: string,
  options?: UseStudentGuardiansOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(studentId);

  return useQuery<StudentGuardianLink[], Error>({
    queryKey: organizationId
      ? educationKeys.studentGuardians(organizationId, studentId)
      : ([
          "education",
          "studentGuardians",
          { organizationId: "", studentId },
        ] as const),
    queryFn: () => loadStudentGuardianLinks(organizationId!, studentId),
    enabled: isEnabled,
  });
}

/**
 * Arşivdeki öğrenci, sınıf, veli ve sınavlar (2026-10-12, B20). Yalnız
 * Ayarlar → Arşiv açıkken okunur.
 */
export function useArchive(options?: { enabled?: boolean }) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<ArchiveListing, Error>({
    queryKey: educationKeys.archive(organizationId ?? ""),
    queryFn: () => loadArchive(organizationId as string),
    enabled: isEnabled,
  });
}

/** Kurumun derslikleri (2026-10-12, v1.5-15). */
export function useRooms(options?: {
  includeArchived?: boolean;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  const includeArchived = options?.includeArchived ?? false;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<Room[], Error>({
    queryKey: educationKeys.rooms(organizationId ?? "", includeArchived),
    queryFn: () => loadRooms(organizationId as string, { includeArchived }),
    enabled: isEnabled,
  });
}

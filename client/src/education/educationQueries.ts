import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  DEFAULT_STUDENT_LIMIT,
  loadStudents,
  type StudentListResult,
} from "./studentService";
import {
  DEFAULT_CLASS_LIMIT,
  loadClasses,
  loadClassEnrollments,
  type ClassListResult,
} from "./classService";
import type { ClassEnrollmentItem } from "@/components/education/types";
import {
  DEFAULT_SCHEDULE_LIMIT,
  loadSchedule,
  type ScheduleListResult,
} from "./scheduleService";
import {
  loadAttendanceHistory,
  loadLatestAttendanceSession,
  loadStudentAttendanceRecords,
  type AttendanceHistoryResult,
  type StudentAttendanceRecord,
  type LatestAttendanceSessionResult,
} from "./attendanceService";
import { loadLatestExam, type LatestExamResult } from "./examService";
import {
  loadPaymentOverviewCounts,
  loadPayments,
  loadPlanInstallments,
  loadInstallmentsForPlans,
  type PaymentListResult,
  type PaymentOverviewCounts,
  type Installment,
} from "./paymentService";
import {
  DEFAULT_HOMEWORK_LIMIT,
  loadHomework,
  type HomeworkListResult,
} from "./homeworkService";
import { loadSubjects, type SubjectListResult } from "./subjectService";
import { loadExams, type ExamListResult } from "./examNetService";
import {
  loadStudentHomeworkContext,
  type StudentHomeworkContext,
} from "./studentHomeworkService";
import {
  loadStudentExams,
  type StudentExamOverview,
} from "./studentExamService";
import {
  loadSubstitutes,
  type SubstituteListResult,
} from "./substituteService";
import {
  loadClassTeachers,
  type ClassTeacherListResult,
} from "./classTeacherService";
import {
  DEFAULT_GUARDIAN_LIMIT,
  loadGuardians,
  loadStudentGuardianLinks,
  type GuardianListResult,
  type StudentGuardianLink,
} from "./guardianService";
import {
  DEFAULT_FEED_LIMIT,
  loadFeedPosts,
  type FeedPostListResult,
} from "./feedService";
import {
  DEFAULT_DAY_PLAN_LIMIT,
  loadTasks,
  loadCalendarEvents,
  type TaskListResult,
  type CalendarEventListResult,
} from "./dayPlanService";
import {
  loadAttendanceWeeks,
  loadExamAverages,
  loadHomeworkWeeks,
  loadClassComparison,
  DEFAULT_REPORT_RANGE,
  type ClassComparisonRow,
  type ReportWeeks,
  type AttendanceWeek,
  type ReportRange,
  type ExamAverage,
  type HomeworkWeek,
} from "./reportService";

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
} from "./overviewService";

import { useDebouncedValue } from "@/lib/useDebouncedValue";

/**
 * Eğitim alanı sorgu anahtarları (v1.3-01 · A, B, C, D ve E parçaları, **K-19** / mimari kararlar).
 *
 * **Anahtar sözleşmesi:** `[alan, kaynak, kapsam]`
 *
 * Kapsam HER ZAMAN aktif kurumu taşır. Bu bir kod düzeni tercihi değil,
 * **izolasyon kuralıdır**: kurum kimliği anahtarda yoksa, iki kuruma da erişimi
 * olan bir kullanıcı kurum değiştirdiğinde React Query önceki kurumun satırlarını
 * önbellekten (cache) servis eder ve RLS bunu engelleyemez — çünkü istek
 * sunucuya hiç gitmez.
 *
 * Anahtar üreticisi `organizationId: string` parametresini zorunlu kılarak
 * kurumsuz anahtar oluşturulmasını derleme zamanında (TypeScript) engeller.
 */
export const educationKeys = {
  all: ["education"] as const,
  students: (organizationId: string, search?: string) => {
    const trimmed = search?.trim();
    return trimmed
      ? ([
          "education",
          "students",
          { organizationId, search: trimmed },
        ] as const)
      : (["education", "students", { organizationId }] as const);
  },
  classes: (organizationId: string) =>
    ["education", "classes", { organizationId }] as const,
  classEnrollments: (organizationId: string, classId: string) =>
    ["education", "classEnrollments", { organizationId, classId }] as const,
  schedule: (organizationId: string) =>
    ["education", "schedule", { organizationId }] as const,
  studentAttendance: (
    organizationId: string,
    studentId: string,
    since: string
  ) =>
    [
      "education",
      "studentAttendance",
      { organizationId, studentId, since },
    ] as const,
  attendanceHistory: (
    organizationId: string,
    options?: { since?: string; classId?: string | null }
  ) =>
    [
      "education",
      "attendanceHistory",
      {
        organizationId,
        since: options?.since ?? null,
        classId: options?.classId ?? null,
      },
    ] as const,
  attendance: (organizationId: string) =>
    ["education", "attendance", { organizationId }] as const,
  attendanceSheet: (organizationId: string, sessionId: string) =>
    ["education", "attendanceSheet", { organizationId, sessionId }] as const,
  exam: (organizationId: string) =>
    ["education", "exam", { organizationId }] as const,
  exams: (organizationId: string) =>
    ["education", "exams", { organizationId }] as const,
  examSheet: (organizationId: string, examId: string) =>
    ["education", "examSheet", { organizationId, examId }] as const,
  payments: (
    organizationId: string,
    options?: { studentId?: string; search?: string }
  ) => {
    return options
      ? (["education", "payments", { organizationId, ...options }] as const)
      : (["education", "payments", { organizationId }] as const);
  },
  planInstallments: (organizationId: string, planId?: string) => {
    return planId
      ? (["education", "planInstallments", { organizationId, planId }] as const)
      : (["education", "planInstallments", { organizationId }] as const);
  },
  paymentOverview: (organizationId: string) =>
    ["education", "paymentOverview", { organizationId }] as const,
  adminOverview: (organizationId: string) =>
    ["education", "adminOverview", { organizationId }] as const,
  todayLessons: (organizationId: string) =>
    ["education", "todayLessons", { organizationId }] as const,
  teacherOverview: (organizationId: string) =>
    ["education", "teacherOverview", { organizationId }] as const,
  myLessonsToday: (organizationId: string) =>
    ["education", "myLessonsToday", { organizationId }] as const,
  studentOverview: (organizationId: string, studentId: string) =>
    ["education", "studentOverview", { organizationId, studentId }] as const,
  studentUpcomingHomework: (organizationId: string, studentId: string) =>
    [
      "education",
      "studentUpcomingHomework",
      { organizationId, studentId },
    ] as const,
  studentOverdueInstallments: (organizationId: string, studentId: string) =>
    [
      "education",
      "studentOverdueInstallments",
      { organizationId, studentId },
    ] as const,
  studentLessonsToday: (organizationId: string, studentId: string) =>
    [
      "education",
      "studentLessonsToday",
      { organizationId, studentId },
    ] as const,
  homework: (organizationId: string) =>
    ["education", "homework", { organizationId }] as const,
  studentHomework: (organizationId: string, studentId: string) =>
    ["education", "studentHomework", { organizationId, studentId }] as const,
  studentExams: (organizationId: string, studentId: string, today: string) =>
    [
      "education",
      "studentExams",
      { organizationId, studentId, today },
    ] as const,
  examList: (organizationId: string, classId?: string | null) =>
    [
      "education",
      "examList",
      { organizationId, classId: classId ?? null },
    ] as const,
  substitutes: (organizationId: string) =>
    ["education", "substitutes", { organizationId }] as const,
  subjects: (
    organizationId: string,
    options?: { includeArchived?: boolean }
  ) => {
    return options?.includeArchived
      ? ([
          "education",
          "subjects",
          { organizationId, includeArchived: true },
        ] as const)
      : (["education", "subjects", { organizationId }] as const);
  },
  classTeachers: (organizationId: string, classId?: string) => {
    return classId
      ? (["education", "classTeachers", { organizationId, classId }] as const)
      : (["education", "classTeachers", { organizationId }] as const);
  },
  guardians: (organizationId: string, search?: string) => {
    const trimmed = search?.trim();
    return trimmed
      ? ([
          "education",
          "guardians",
          { organizationId, search: trimmed },
        ] as const)
      : (["education", "guardians", { organizationId }] as const);
  },
  studentGuardians: (organizationId: string, studentId?: string) => {
    return studentId
      ? ([
          "education",
          "studentGuardians",
          { organizationId, studentId },
        ] as const)
      : (["education", "studentGuardians", { organizationId }] as const);
  },
  // B16 / C-08: boş alanlar anahtara YAZILMAZ. React Query kısmi eşlemede
  // nesne alanlarını tek tek karşılaştırır; `feed(org)` ile geçersiz kılmak
  // `{ includeArchived: undefined }` taşısaydı listenin
  // `{ includeArchived: false }` anahtarıyla eşleşmez ve pano paylaşımdan
  // sonra yenilenmezdi (ölçüldü: 2026-09-19 ilk kullanım turu).
  feed: (
    organizationId: string,
    options?: { classId?: string | null; includeArchived?: boolean }
  ) => {
    const scope: {
      organizationId: string;
      classId?: string | null;
      includeArchived?: boolean;
    } = { organizationId };
    if (options?.classId !== undefined) scope.classId = options.classId;
    if (options?.includeArchived !== undefined)
      scope.includeArchived = options.includeArchived;
    return ["education", "feed", scope] as const;
  },
  tasks: (
    organizationId: string,
    membershipId: string,
    options?: { includeArchived?: boolean }
  ) => {
    return [
      "education",
      "tasks",
      {
        organizationId,
        membershipId,
        includeArchived: options?.includeArchived,
      },
    ] as const;
  },
  calendarEvents: (
    organizationId: string,
    membershipId: string,
    options?: { includeArchived?: boolean }
  ) => {
    return [
      "education",
      "calendarEvents",
      {
        organizationId,
        membershipId,
        includeArchived: options?.includeArchived,
      },
    ] as const;
  },
  reportAttendanceWeeks: (organizationId: string, range: ReportRange) =>
    [
      "education",
      "reportAttendanceWeeks",
      { organizationId, weeks: range.weeks, classId: range.classId },
    ] as const,
  reportExamAverages: (organizationId: string, range: ReportRange) =>
    [
      "education",
      "reportExamAverages",
      { organizationId, weeks: range.weeks, classId: range.classId },
    ] as const,
  reportClassComparison: (organizationId: string, weeks: ReportWeeks) =>
    ["education", "reportClassComparison", { organizationId, weeks }] as const,
  reportHomeworkWeeks: (organizationId: string, range: ReportRange) =>
    [
      "education",
      "reportHomeworkWeeks",
      { organizationId, weeks: range.weeks, classId: range.classId },
    ] as const,
};

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
  const limit = options?.limit ?? DEFAULT_STUDENT_LIMIT;
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

export type UseScheduleOptions = {
  organizationId?: string;
  limit?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun ders programını getiren React Query hook'u (v1.3-01 · B parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useSchedule(options?: UseScheduleOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? DEFAULT_SCHEDULE_LIMIT;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<ScheduleListResult, Error>({
    queryKey: organizationId
      ? educationKeys.schedule(organizationId)
      : (["education", "schedule", { organizationId: "" }] as const),
    queryFn: () => loadSchedule(organizationId!, limit),
    enabled: isEnabled,
  });
}

export type UseLatestAttendanceSessionOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Aktif kurumun en son yoklama oturumunu getiren React Query hook'u (v1.3-01 · C parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useLatestAttendanceSession(
  options?: UseLatestAttendanceSessionOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<LatestAttendanceSessionResult, Error>({
    queryKey: organizationId
      ? educationKeys.attendance(organizationId)
      : (["education", "attendance", { organizationId: "" }] as const),
    queryFn: () => loadLatestAttendanceSession(organizationId!),
    enabled: isEnabled,
  });
}

export type UseAttendanceSheetOptions = {
  organizationId?: string;
  enabled?: boolean;
};

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

export type UseExamsOptions = {
  organizationId?: string;
  enabled?: boolean;
};

export type UseExamSheetOptions = {
  organizationId?: string;
  enabled?: boolean;
};

export type UsePaymentsOptions = {
  organizationId?: string;
  limit?: number;
  studentId?: string;
  search?: string;
  enabled?: boolean;
};

/**
 * Aktif kurumun ödeme planlarını getiren React Query hook'u (v1.3-01 · E parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePayments(options?: UsePaymentsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<PaymentListResult, Error>({
    queryKey: organizationId
      ? educationKeys.payments(organizationId, {
          studentId: options?.studentId,
          search: options?.search,
        })
      : (["education", "payments", { organizationId: "" }] as const),
    queryFn: () =>
      loadPayments(organizationId!, {
        limit: options?.limit,
        studentId: options?.studentId,
        search: options?.search,
      }),
    enabled: isEnabled,
  });
}

export type UsePaymentOverviewOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Aktif kurumun ödeme genel bakış sayılarını getiren React Query hook'u (v1.3-01 · E parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePaymentOverview(options?: UsePaymentOverviewOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<PaymentOverviewCounts | null, Error>({
    queryKey: organizationId
      ? educationKeys.paymentOverview(organizationId)
      : (["education", "paymentOverview", { organizationId: "" }] as const),
    queryFn: () => loadPaymentOverviewCounts(),
    enabled: isEnabled,
  });
}

/** Birden çok planın taksitleri tek sorguda (veli ödeme görünümü). */
export function usePlansInstallments(options: {
  planIds: string[];
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options.organizationId ?? identity?.membership?.organizationId;
  const ids = [...options.planIds].sort();
  const isEnabled =
    (options.enabled ?? true) && Boolean(organizationId) && ids.length > 0;

  return useQuery<Map<string, Installment[]>, Error>({
    queryKey: [
      "education",
      "planInstallments",
      { organizationId: organizationId ?? "", planIds: ids },
    ] as const,
    queryFn: () => loadInstallmentsForPlans(organizationId as string, ids),
    enabled: isEnabled,
  });
}

export type UsePlanInstallmentsOptions = {
  organizationId?: string;
  planId?: string;
  enabled?: boolean;
};

/**
 * Bir ödeme planına ait aktif taksitleri getiren React Query hook'u (v1.4-06 · #277).
 */
export function usePlanInstallments(options?: UsePlanInstallmentsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const planId = options?.planId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(planId);

  return useQuery<Installment[], Error>({
    queryKey:
      organizationId && planId
        ? educationKeys.planInstallments(organizationId, planId)
        : (["education", "planInstallments", { organizationId: "" }] as const),
    queryFn: () => loadPlanInstallments(organizationId!, planId!),
    enabled: isEnabled,
  });
}

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
  const limit = options?.limit ?? DEFAULT_HOMEWORK_LIMIT;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<HomeworkListResult, Error>({
    queryKey: organizationId
      ? educationKeys.homework(organizationId)
      : (["education", "homework", { organizationId: "" }] as const),
    queryFn: () => loadHomework(organizationId!, { limit }),
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

/**
 * Kurumun iptal edilmemiş vekillikleri. Yönetici hepsini, öğretmen yalnız
 * kendisinin vekil ya da izinli olduğu satırları görür (RLS).
 */
export function useSubstitutes(options?: {
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<SubstituteListResult, Error>({
    queryKey: organizationId
      ? educationKeys.substitutes(organizationId)
      : (["education", "substitutes", { organizationId: "" }] as const),
    queryFn: () => loadSubstitutes(organizationId!),
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
  const limit = options?.limit ?? DEFAULT_GUARDIAN_LIMIT;
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

export type UseFeedPostsOptions = {
  organizationId?: string;
  classId?: string | null;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun günlük akış duyurularını getiren React Query hook'u (#288).
 */
export function useFeedPosts(options?: UseFeedPostsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? DEFAULT_FEED_LIMIT;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<FeedPostListResult, Error>({
    queryKey: organizationId
      ? educationKeys.feed(organizationId, {
          classId: options?.classId,
          includeArchived: options?.includeArchived,
        })
      : (["education", "feed", { organizationId: "" }] as const),
    queryFn: () =>
      loadFeedPosts(organizationId!, {
        classId: options?.classId,
        includeArchived: options?.includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}

export type UseTasksOptions = {
  organizationId?: string;
  membershipId?: string;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

export function useTasks(options?: UseTasksOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const membershipId =
    options?.membershipId ?? identity?.membership?.membershipId;
  const limit = options?.limit ?? DEFAULT_DAY_PLAN_LIMIT;
  const isEnabled =
    (options?.enabled ?? true) &&
    Boolean(organizationId) &&
    Boolean(membershipId);

  return useQuery<TaskListResult, Error>({
    queryKey:
      organizationId && membershipId
        ? educationKeys.tasks(organizationId, membershipId, {
            includeArchived: options?.includeArchived,
          })
        : ([
            "education",
            "tasks",
            { organizationId: "", membershipId: "" },
          ] as const),
    queryFn: () =>
      loadTasks(organizationId!, membershipId!, {
        includeArchived: options?.includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}

export type UseCalendarEventsOptions = {
  organizationId?: string;
  membershipId?: string;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

export function useCalendarEvents(options?: UseCalendarEventsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const membershipId =
    options?.membershipId ?? identity?.membership?.membershipId;
  const limit = options?.limit ?? DEFAULT_DAY_PLAN_LIMIT;
  const isEnabled =
    (options?.enabled ?? true) &&
    Boolean(organizationId) &&
    Boolean(membershipId);

  return useQuery<CalendarEventListResult, Error>({
    queryKey:
      organizationId && membershipId
        ? educationKeys.calendarEvents(organizationId, membershipId, {
            includeArchived: options?.includeArchived,
          })
        : ([
            "education",
            "calendarEvents",
            { organizationId: "", membershipId: "" },
          ] as const),
    queryFn: () =>
      loadCalendarEvents(organizationId!, membershipId!, {
        includeArchived: options?.includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}

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
/** Bir öğrencinin `since`'ten bu yana yoklama kayıtları (Genel Bakış). */
export function useStudentAttendanceRecords(options: {
  studentId: string;
  since: string;
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

  return useQuery<StudentAttendanceRecord[], Error>({
    queryKey: educationKeys.studentAttendance(
      organizationId ?? "",
      options.studentId,
      options.since
    ),
    queryFn: () =>
      loadStudentAttendanceRecords(
        organizationId as string,
        options.studentId,
        options.since
      ),
    enabled: isEnabled,
  });
}

/** Geçmiş yoklama oturumları, durum sayılarıyla (Yoklama · Geçmiş). */
export function useAttendanceHistory(options: {
  since: string;
  classId?: string | null;
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options.enabled ?? true) && Boolean(organizationId);

  return useQuery<AttendanceHistoryResult, Error>({
    queryKey: educationKeys.attendanceHistory(organizationId ?? "", {
      since: options.since,
      classId: options.classId,
    }),
    queryFn: () =>
      loadAttendanceHistory(organizationId as string, {
        since: options.since,
        classId: options.classId,
      }),
    enabled: isEnabled,
    staleTime: 0,
  });
}

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

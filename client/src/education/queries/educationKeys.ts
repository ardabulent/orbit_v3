// Eğitim alanının sorgu anahtarları.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import type { ReportWeeks, ReportRange } from "../reportService";

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
  scheduleTemplates: (organizationId: string) =>
    ["education", "scheduleTemplates", { organizationId }] as const,
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
  rooms: (organizationId: string, includeArchived = false) =>
    includeArchived
      ? (["education", "rooms", { organizationId, includeArchived }] as const)
      : (["education", "rooms", { organizationId }] as const),
  archive: (organizationId: string) =>
    ["education", "archive", { organizationId }] as const,
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
  reportAttentionStudents: (organizationId: string, weeks: ReportWeeks) =>
    [
      "education",
      "reportAttentionStudents",
      { organizationId, weeks },
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

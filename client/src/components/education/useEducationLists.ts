import { useMemo } from "react";
import { isDemoMode } from "@/auth/runtime";
import {
  useCalendarNotices,
  useClasses,
  useExams,
  useGuardians,
  useHomework,
  useLatestExam,
  useMyLessonsToday,
  usePaymentOverview,
  usePayments,
  usePlansInstallments,
  useReportAttendanceWeeks,
  useReportAttentionStudents,
  useReportClassComparison,
  useReportExamAverages,
  useReportHomeworkWeeks,
  useSchedule,
  useStudentGuardians,
  useStudents,
  useSubstitutes,
  useTodayLessons,
} from "@/education/educationQueries";
import type { ReportRange } from "@/education/reportService";
import { getOrbitToday } from "@/education/trDate";
import { linkableMembers } from "@/organization/linkableMembers";
import { useSettingsMembers } from "@/settings/settingsQueries";
import {
  buildPaymentStats,
  classes,
  paymentOverviewStats,
  paymentRows,
  schedule,
  students,
} from "./educationData";
import { shouldLoadForTab } from "./familyTabLoading";
import type { useGuardianChildState } from "./guardianChild/guardianChildState";
import { buildClassSummaries } from "./pages/classSummaries";
import type { ScheduleCover } from "./pages/scheduleGrid";
import { buildSubjectUsage } from "./pages/subjectUsage";
import { currentCoverByAbsent } from "./pages/substitutePeriods";
import { filterStudentsForRole } from "./scopeFilters";
import type { Homework, Role, Section } from "./types";

/**
 * Kurum panelinin okuduğu bütün listeler ve onlardan türeyenler. Her sorgu
 * yalnız onu kullanan sekme (ya da panel) açıkken çalışır; demoda sorgu
 * çalışmaz, liste demo verisinden gelir. `EducationPlatform`'dan bölündü
 * (2026-10-25, ana plan 5.3); sorgular, koşulları ve türetmeler aynı.
 */
export function useEducationLists({
  role,
  active,
  query,
  guardianQuery,
  reportRange,
  selectedStudentId,
  hasSelectedClass,
  guardianChild,
  demoHomework,
}: {
  role: Role;
  active: Section;
  /** Öğrenci listesinin arama kutusu. */
  query: string;
  guardianQuery: string;
  reportRange: ReportRange;
  /** Açık öğrenci paneli: velileri ve veli bağları onun için okunur. */
  selectedStudentId: string | undefined;
  /** Açık sınıf paneli: bugünün dersleri onun için okunur. */
  hasSelectedClass: boolean;
  guardianChild: ReturnType<typeof useGuardianChildState>;
  /** Demoda ödev listesi tarayıcıda tutulur (`demoStorage`). */
  demoHomework: Homework[];
}) {
  // Kurum listeleri yalnız onları kullanan sekmede okunur (öğrenci/veli
  // 2026-10-05, personel 2026-10-25 · ana plan 5.2). İkinci dizi personelin
  // sekmeleri; listeyi sekme dışında kullanan paneller de orada sayılır.
  const loadsFor = (
    tabs: readonly Section[],
    staffTabs: readonly Section[] = tabs
  ) => shouldLoadForTab(role, active, tabs, staffTabs);
  const studentsQuery = useStudents({
    search: query,
    enabled:
      !isDemoMode &&
      loadsFor(
        ["Ödevler"],
        // Sınıflar: sınıf paneli öğrenci açar; Kayıt ve Ödemeler: plan
        // formunun öğrenci listesi; Raporlar ve Yoklama: ad eşlemesi.
        [
          "Öğrenciler",
          "Raporlar",
          "Yoklama",
          "Ödevler",
          "Sınıflar",
          "Kayıt ve Ödemeler",
        ]
      ),
  });
  const membersQuery = useSettingsMembers({
    // Öğrenciler: hesap bağlama listeleri; Ders Programı: vekil adları.
    enabled:
      role === "admin" &&
      !isDemoMode &&
      (active === "Öğrenciler" || active === "Ders Programı"),
  });
  const studentMembers = useMemo(
    () => linkableMembers(membersQuery.data ?? [], "student"),
    [membersQuery.data]
  );

  const parentMembers = useMemo(
    () => linkableMembers(membersQuery.data ?? [], "parent"),
    [membersQuery.data]
  );

  const guardiansQuery = useGuardians({
    search: guardianQuery,
    // Öğrenci paneli Raporlar ve Sınıflar'dan da açılır ve veli bağlar.
    enabled:
      role === "admin" &&
      !isDemoMode &&
      (active === "Öğrenciler" || Boolean(selectedStudentId)),
  });

  const studentGuardiansQuery = useStudentGuardians(selectedStudentId ?? "", {
    enabled: Boolean(selectedStudentId) && !isDemoMode,
  });

  const classesQuery = useClasses({
    enabled:
      !isDemoMode &&
      loadsFor(
        [
          "Ders Programı",
          "Sınavlar",
          "Ödevler",
          "İletişim",
          "Kayıt ve Ödemeler",
        ],
        [
          "Ders Programı",
          "Sınavlar",
          "Ödevler",
          "İletişim",
          "Kayıt ve Ödemeler",
          "Sınıflar",
          "Yoklama",
          "Raporlar",
          // Takvimdeki sınavlar öğretmenin sınıflarıyla süzülür.
          "Gün Planı",
        ]
      ),
  });
  const scheduleQuery = useSchedule({
    enabled:
      !isDemoMode &&
      loadsFor(
        ["Ders Programı"],
        // Sınıflar: sınıf özetleri ve sınıf panelindeki dersler.
        ["Ders Programı", "Gün Planı", "Yoklama", "Sınıflar"]
      ),
  });
  const examQuery = useLatestExam({
    enabled: !isDemoMode && loadsFor(["Sınavlar"]),
  });
  // Sınavlar listesi (C-07) — yönetici ve öğretmen.
  const isStaffRole = role === "admin" || role === "teacher";
  const examListQuery = useExams({
    enabled:
      !isDemoMode &&
      isStaffRole &&
      (active === "Sınavlar" || active === "Gün Planı"),
  });
  const examPageQuery = isStaffRole ? examListQuery : examQuery;
  const paymentsQuery = usePayments({
    enabled: !isDemoMode && loadsFor(["Kayıt ve Ödemeler"]),
  });
  const paymentOverviewQuery = usePaymentOverview({
    enabled: !isDemoMode && loadsFor(["Kayıt ve Ödemeler"]),
  });
  const homeworkQuery = useHomework({
    enabled: !isDemoMode && loadsFor(["Ödevler"]),
  });
  const reportAttendanceQuery = useReportAttendanceWeeks({
    enabled: !isDemoMode && active === "Raporlar",
    range: reportRange,
  });
  const reportExamQuery = useReportExamAverages({
    enabled: !isDemoMode && active === "Raporlar",
    range: reportRange,
  });
  const reportAttentionQuery = useReportAttentionStudents({
    enabled: !isDemoMode && active === "Raporlar",
    weeks: reportRange.weeks,
  });
  const reportComparisonQuery = useReportClassComparison({
    enabled: !isDemoMode && active === "Raporlar",
    weeks: reportRange.weeks,
  });
  const reportHomeworkQuery = useReportHomeworkWeeks({
    enabled: !isDemoMode && active === "Raporlar",
    range: reportRange,
  });

  const activeStudents = useMemo(() => {
    if (isDemoMode) {
      return students;
    }
    return studentsQuery.data?.rows ?? [];
  }, [studentsQuery.data?.rows]);

  const activeClasses = useMemo(() => {
    if (isDemoMode) {
      return classes;
    }
    return classesQuery.data?.rows ?? [];
  }, [classesQuery.data?.rows]);

  // Gün Planı takvimi: yönetici bütün sınavları, öğretmen okuttuğu
  // sınıfların (activeClasses RLS ile daraltılmış) ve kurum geneli sınavları.
  const calendarNoticesQuery = useCalendarNotices({
    enabled: !isDemoMode && active === "Gün Planı",
  });
  const calendarExams = useMemo(() => {
    const visibleClassIds = new Set(activeClasses.map(c => c.id));
    return (examListQuery.data?.rows ?? [])
      .filter(
        exam =>
          role === "admin" ||
          exam.classId === null ||
          visibleClassIds.has(exam.classId)
      )
      .map(exam => ({
        id: exam.id,
        name: exam.name,
        examDate: exam.examDate,
        className: exam.className,
      }));
  }, [examListQuery.data, activeClasses, role]);

  const activeSchedule = useMemo(() => {
    if (isDemoMode) {
      return schedule;
    }
    const rows = scheduleQuery.data?.rows ?? [];
    // Veli: yalnız seçili çocuğun sınıfları; iki çocuğun dersi karışmaz.
    if (guardianChild.active) {
      const classIds = guardianChild.classIds;
      return classIds
        ? rows.filter(item => item.classId && classIds.has(item.classId))
        : [];
    }
    return rows;
  }, [scheduleQuery.data?.rows, guardianChild.active, guardianChild.classIds]);

  const todayLessonsForClasses = useTodayLessons({
    enabled:
      !isDemoMode &&
      (active === "Sınıflar" ||
        hasSelectedClass ||
        (active === "Yoklama" && role === "admin")),
  });
  // Yoklama · Bugün: öğretmen yalnız kendi derslerini (vekillik dahil) görür.
  const myLessonsForAttendance = useMyLessonsToday({
    enabled: !isDemoMode && active === "Yoklama" && role !== "admin",
  });
  const attendanceLessonsQuery =
    role === "admin" ? todayLessonsForClasses : myLessonsForAttendance;
  const classSummaries = useMemo(
    () =>
      buildClassSummaries(activeSchedule, todayLessonsForClasses.data ?? []),
    [activeSchedule, todayLessonsForClasses.data]
  );
  const subjectUsage = useMemo(
    () => buildSubjectUsage(activeSchedule),
    [activeSchedule]
  );
  // Ders programında "Vekil: …" — yalnız yönetici (öğretmen başkalarının
  // izin kaydını görmez, RLS).
  const substitutesQuery = useSubstitutes({
    enabled: !isDemoMode && role === "admin" && active === "Ders Programı",
  });
  const scheduleCovers = useMemo(() => {
    const names = new Map(
      (membersQuery.data ?? []).map(m => [m.membershipId, m.displayName])
    );
    const covers = new Map<string, ScheduleCover>();
    for (const [absentId, row] of currentCoverByAbsent(
      substitutesQuery.data?.rows ?? [],
      getOrbitToday()
    )) {
      covers.set(absentId, {
        substitute: names.get(row.substituteMembershipId) || "vekil",
        endsOn: row.endsOn,
      });
    }
    return covers;
  }, [substitutesQuery.data, membersQuery.data]);

  // Veli ödeme görünümü: planlarının taksitleri tek sorguda (2026-09-29).
  const parentInstallmentsQuery = usePlansInstallments({
    planIds: (paymentsQuery.data?.rows ?? []).map(row => row.id),
    enabled: !isDemoMode && role === "parent" && active === "Kayıt ve Ödemeler",
  });

  const activePayments = useMemo(() => {
    if (isDemoMode) {
      return paymentRows;
    }
    const rows = paymentsQuery.data?.rows ?? [];
    // Veli: yalnız seçili çocuğun planları.
    if (guardianChild.active) {
      const childId = guardianChild.child?.id;
      return childId ? rows.filter(row => row.studentId === childId) : [];
    }
    return rows;
  }, [paymentsQuery.data?.rows, guardianChild.active, guardianChild.child]);

  const activePaymentOverviewStats = useMemo(() => {
    if (isDemoMode) {
      return paymentOverviewStats;
    }
    return buildPaymentStats(paymentOverviewQuery.data ?? null);
  }, [paymentOverviewQuery.data]);

  const activeHomework = useMemo(() => {
    if (isDemoMode) {
      return demoHomework;
    }
    return homeworkQuery.data?.rows ?? [];
  }, [demoHomework, homeworkQuery.data?.rows]);

  const activeGuardians = useMemo(() => {
    if (isDemoMode) {
      return [];
    }
    return guardiansQuery.data?.rows ?? [];
  }, [guardiansQuery.data?.rows]);

  const visibleStudents = useMemo(() => {
    const roleStudents = filterStudentsForRole(
      activeStudents,
      role,
      isDemoMode
    );
    if (isDemoMode) {
      return roleStudents.filter(student => {
        const searchTarget = [student.name, student.code, student.group]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr");
        return searchTarget.includes(query.toLocaleLowerCase("tr"));
      });
    }
    return roleStudents;
  }, [activeStudents, role, query]);

  return {
    studentsQuery,
    studentMembers,
    parentMembers,
    guardiansQuery,
    studentGuardiansQuery,
    classesQuery,
    scheduleQuery,
    examQuery,
    examListQuery,
    examPageQuery,
    paymentsQuery,
    paymentOverviewQuery,
    homeworkQuery,
    reportAttendanceQuery,
    reportExamQuery,
    reportAttentionQuery,
    reportComparisonQuery,
    reportHomeworkQuery,
    activeStudents,
    activeClasses,
    calendarNoticesQuery,
    calendarExams,
    activeSchedule,
    attendanceLessonsQuery,
    classSummaries,
    subjectUsage,
    scheduleCovers,
    parentInstallmentsQuery,
    activePayments,
    activePaymentOverviewStats,
    activeHomework,
    activeGuardians,
    visibleStudents,
  };
}

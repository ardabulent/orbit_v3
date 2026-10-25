import {
  AssessmentsPage,
  AttendancePage,
  ClassesPage,
  CommunicationsPage,
  DayPlanPage,
  HomeworkPage,
  PaymentsPage,
  AuditLogPage,
  ReportsPage,
  SchedulePage,
  SettingsPage,
  StudentsPage,
} from "./lazyPages";
import ErrorBoundary from "@/components/ErrorBoundary";
import { readActiveSection, writeActiveSection } from "./activeSectionMemory";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { clearDemoData, readDemoData, writeDemoData } from "@/lib/demoStorage";
import { isDemoMode } from "@/auth/runtime";
import { availableEducationSections } from "@/components/educationAccess";
import { shouldConfirmLeaving } from "./navigationGuards";
import { AdminDashboard } from "./dashboards/AdminDashboard";
import { ClassDetail } from "./ClassDetail";
import { summaryFor } from "./pages/classSummaries";
import type { StudentFilter } from "./pages/studentFilters";
import { ParentDashboard } from "./dashboards/ParentDashboard";
import { StudentDashboard } from "./dashboards/StudentDashboard";
import { TeacherDashboard } from "./dashboards/TeacherDashboard";
import {
  dayPlanTasksByRole,
  initialAttendances,
  initialHomework,
} from "./educationData";
import { educationKeys } from "@/education/educationQueries";
import {
  DEFAULT_REPORT_RANGE,
  type ReportRange,
} from "@/education/reportService";
import { useAuth } from "@/auth/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { GUARDIAN_TOTAL_CAP, type Guardian } from "@/education/guardianService";
import { HOMEWORK_TOTAL_CAP } from "@/education/homeworkService";
import { StudentFormDialog } from "./pages/StudentFormDialog";
import { NewStudentDialog } from "./pages/NewStudentDialog";
import { GuardianFormDialog } from "./pages/GuardianFormDialog";
import { ClassFormDialog } from "./pages/ClassFormDialog";
import { ClassEnrollmentDialog } from "./pages/ClassEnrollmentDialog";
import { ClassTeachersDialog } from "./pages/ClassTeachersDialog";
import { PaymentPlanEditorDialog } from "./pages/PaymentPlanEditorDialog";
import { PaymentPlanDetailDialog } from "./pages/PaymentPlanDetailDialog";
import { useOrganizationChannel } from "@/realtime/useOrganizationChannel";
import { ConnectionBanner } from "@/realtime/ConnectionBanner";
import { useUserChannel } from "@/realtime/useUserChannel";
import { STUDENT_TOTAL_CAP } from "@/education/studentService";
import { DEFAULT_CLASS_LIMIT } from "@/education/classService";
import { SCHEDULE_TOTAL_CAP } from "@/education/scheduleService";
import { PAYMENT_TOTAL_CAP } from "@/education/paymentService";
import { allNav } from "./navigation";
import { BottomNav } from "./BottomNav";
import { useApplyOrbitTheme } from "@/theme/orbitTheme";
import { roleMeta } from "./roleMeta";
import { ChildSwitcher } from "./guardianChild/ChildSwitcher";
import {
  GuardianChildContext,
  useGuardianChildState,
} from "./guardianChild/guardianChildState";
import { StudentDetail } from "./StudentDetail";
import { EducationSidebar } from "./EducationSidebar";
import { EducationTopBar } from "./EducationTopBar";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { useRecordActions } from "./useRecordActions";
import { useEducationLists } from "./useEducationLists";
import type {
  AttendanceState,
  ClassGroup,
  DayPlanRole,
  DayPlanTask,
  Homework,
  Role,
  Section,
  Student,
} from "./types";

export function EducationPlatform({
  onLogout,
  initialRole = "admin",
  displayName,
  organizationName,
  branchName,
  canSwitchRole = true,
  onRoleChange,
  canAccessPlatform = false,
}: {
  onLogout: () => void | Promise<void>;
  initialRole?: Role;
  displayName?: string;
  organizationName?: string;
  branchName?: string | null;
  canSwitchRole?: boolean;
  onRoleChange?: (role: Role) => void;
  /** Kullanıcı platform operatörü mü. Menüdeki platform bağlantısını yönetir. */
  canAccessPlatform?: boolean;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const { identity } = useAuth();
  // Açık sekme sayfa yenilemede korunur (C-01, 2026-10-11).
  const tabMemory =
    typeof window !== "undefined" && !isDemoMode
      ? window.sessionStorage
      : undefined;
  const [active, setActive] = useState<Section>(() =>
    readActiveSection(tabMemory, identity?.userId, initialRole)
  );
  useEffect(() => {
    writeActiveSection(tabMemory, identity?.userId, active);
  }, [tabMemory, identity?.userId, active]);
  const [mobileNav, setMobileNav] = useState(false);
  // Masaüstünde menüyü simge şeridine indirir. Mobilde anlamı yok; orada menü
  // zaten çekmece olarak açılıp kapanıyor.
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  /**
   * Yalnız hangi öğrencinin açık olduğunu tutar. Panelin gösterdiği öğrenci
   * aşağıda listenin GÜNCEL satırından türetilir (`selectedStudent`).
   *
   * Eskiden tıklandığı andaki kopya gösteriliyordu: hesap ya da veli
   * bağlandıktan sonra liste tazelense bile panel "Hesap bağlı değil" demeye
   * devam ediyordu (ROADMAP §4.23 C-03).
   */
  const [selectedStudentSnapshot, setSelectedStudentSnapshot] =
    useState<Student | null>(null);
  const [attendances, setAttendances] = useState<
    Record<string, AttendanceState>
  >(() => readDemoData("attendances", initialAttendances));
  const [dayPlanTasks, setDayPlanTasks] = useState<
    Record<DayPlanRole, DayPlanTask[]>
  >(() => readDemoData("dayPlanTasks", dayPlanTasksByRole));
  const [homework, setHomework] = useState<Homework[]>(() =>
    readDemoData("homework", initialHomework)
  );
  const [message, setMessage] = useState("");
  const currentDisplayName = displayName ?? "";
  const navItems = allNav.filter(item =>
    availableEducationSections(role).includes(item.label)
  );
  // Koyu tema yalnız kurum panelinde uygulanır (2026-10-15, #135).
  useApplyOrbitTheme(true);
  // Öğrenci ve veliye telefonda alt gezinme çubuğu (2026-10-15).
  const hasBottomNav = role === "student" || role === "parent";

  const organizationId = identity?.membership?.organizationId ?? "";
  // Velinin seçili çocuğu: üst çubukta seçilir, bütün veli sekmeleri okur
  // (karar 2026-09-27, uygulama 2026-10-02).
  const guardianChild = useGuardianChildState({
    enabled: role === "parent" && !isDemoMode,
    userId: identity?.userId ?? "",
  });
  const queryClient = useQueryClient();
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  /** "Yeni öğrenci" tek akışı; `StudentFormDialog` yalnız düzenleme için. */
  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [studentForEdit, setStudentForEdit] = useState<Student | null>(null);
  const [classFormOpen, setClassFormOpen] = useState(false);
  /** Açık sınıf detay paneli; sınıf listenin güncel satırından okunur. */
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [reportRange, setReportRange] =
    useState<ReportRange>(DEFAULT_REPORT_RANGE);
  const [classForEdit, setClassForEdit] = useState<ClassGroup | null>(null);
  const [classEnrollmentOpen, setClassEnrollmentOpen] = useState(false);
  const [classForEnrollment, setClassForEnrollment] =
    useState<ClassGroup | null>(null);
  const [classTeachersOpen, setClassTeachersOpen] = useState(false);
  const [classForTeachers, setClassForTeachers] = useState<ClassGroup | null>(
    null
  );
  const [paymentPlanFormOpen, setPaymentPlanFormOpen] = useState(false);
  const [paymentPlanForEdit, setPaymentPlanForEdit] = useState<{
    id: string;
    studentId: string;
    name: string;
    totalAmount: number;
  } | null>(null);
  const [paymentPlanDetailOpen, setPaymentPlanDetailOpen] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<{
    id: string;
    studentId?: string;
    studentName?: string;
    name: string;
    totalAmount?: number;
  } | null>(null);

  // Kaydedilmemiş veri koruması (v1.4-03 Revizyon 1 & v1.4-04 #270)
  const [isAttendanceDirty, setIsAttendanceDirty] = useState(false);
  const [isExamDirty, setIsExamDirty] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(
    null
  );

  const requestConfirmLeave = (action: () => void) => {
    setPendingNavAction(() => action);
    setConfirmDialogOpen(true);
  };

  const {
    handleArchiveStudent,
    handleArchiveClass,
    handleLinkStudentAccount,
    handleUnlinkStudentAccount,
    handleArchiveGuardian,
    handleLinkGuardianAccount,
    handleUnlinkGuardianAccount,
    handleLinkGuardianToStudent,
    handleUnlinkGuardianFromStudent,
  } = useRecordActions({
    organizationId,
    selectedStudentId: selectedStudentSnapshot?.id,
  });

  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianFormOpen, setGuardianFormOpen] = useState(false);
  const [guardianForEdit, setGuardianForEdit] = useState<Guardian | null>(null);

  const {
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
  } = useEducationLists({
    role,
    active,
    query,
    guardianQuery,
    reportRange,
    selectedStudentId: selectedStudentSnapshot?.id,
    hasSelectedClass: Boolean(selectedClassId),
    guardianChild,
    demoHomework: homework,
  });

  // Aktif kurumun Realtime kanalına tekil abonelik (v1.3-05).
  // Demo modunda devre dışıdır; canlı modda arka plandaki veri değişikliklerini dinler.
  const organizationChannel = useOrganizationChannel();
  // Kişiye özel bildirim ve mesaj kanalı (2026-10-12).
  useUserChannel();

  // Liste tazelenince panel de tazelenir (C-03). Öğrenci arama yüzünden
  // listeden düştüyse son bilinen hâli gösterilir; boş panel çizilmez.
  const selectedStudent = useMemo(() => {
    if (!selectedStudentSnapshot) return null;
    return (
      activeStudents.find(item => item.id === selectedStudentSnapshot.id) ??
      selectedStudentSnapshot
    );
  }, [activeStudents, selectedStudentSnapshot]);

  const selectedClass = selectedClassId
    ? (activeClasses.find(c => c.id === selectedClassId) ?? null)
    : null;

  useEffect(() => {
    writeDemoData("attendances", attendances);
  }, [attendances]);

  useEffect(() => {
    writeDemoData("dayPlanTasks", dayPlanTasks);
  }, [dayPlanTasks]);

  useEffect(() => {
    writeDemoData("homework", homework);
  }, [homework]);

  const resetDemoData = () => {
    clearDemoData("attendances");
    // Otomasyon sekmesi kaldırıldı (v1.5-10); eski demo kaydı yine silinir.
    clearDemoData("automations");
    clearDemoData("dayPlanTasks");
    clearDemoData("homework");
    setAttendances(initialAttendances);
    setDayPlanTasks(dayPlanTasksByRole);
    setHomework(initialHomework);
    toast.success("Demo verileri sıfırlandı", {
      description:
        "Yoklama, gün planı ve ödev verileri ilk demo durumuna döndürüldü.",
    });
  };

  const isCurrentSectionDirty =
    active === "Yoklama"
      ? isAttendanceDirty
      : active === "Sınavlar"
        ? isExamDirty
        : false;

  const changeRole = (nextRole: Role) => {
    if (!canSwitchRole) return;
    if (shouldConfirmLeaving(active, "Genel Bakış", isCurrentSectionDirty)) {
      requestConfirmLeave(() => {
        setIsAttendanceDirty(false);
        setIsExamDirty(false);
        setRole(nextRole);
        onRoleChange?.(nextRole);
        setActive("Genel Bakış");
        setMobileNav(false);
      });
      return;
    }
    setRole(nextRole);
    onRoleChange?.(nextRole);
    setActive("Genel Bakış");
    setMobileNav(false);
    toast.success(`${roleMeta[nextRole].label} görünümü açıldı`, {
      description: "Demo rol önizlemesi yerel olarak değiştirildi.",
    });
  };

  /**
   * Genel Bakış'ın "sınıfsız / velisiz" satırından gelişte öğrenci listesinin
   * açılacağı süzgeç. Başka bir gezinmede temizlenir; kenar menüsünden
   * Öğrenciler'e gelen kişi süzgeçsiz liste görür.
   */
  const [studentFilterPreset, setStudentFilterPreset] =
    useState<StudentFilter | null>(null);

  const navigate = (section: Section) => {
    setStudentFilterPreset(null);
    if (shouldConfirmLeaving(active, section, isCurrentSectionDirty)) {
      requestConfirmLeave(() => {
        setIsAttendanceDirty(false);
        setIsExamDirty(false);
        setActive(section);
        setMobileNav(false);
      });
      return;
    }
    setActive(section);
    setMobileNav(false);
  };

  const renderDashboard = () => {
    if (role === "teacher") return <TeacherDashboard onNavigate={navigate} />;
    if (role === "student") return <StudentDashboard onNavigate={navigate} />;
    if (role === "parent") return <ParentDashboard onNavigate={navigate} />;
    return (
      <AdminDashboard
        onNavigate={navigate}
        onOpenStudents={filter => {
          navigate("Öğrenciler");
          setStudentFilterPreset(filter);
        }}
      />
    );
  };

  const renderPage = () => {
    if (active === "Genel Bakış") return renderDashboard();
    if (active === "Gün Planı") {
      // "Gün Planı" is only exposed to admin/teacher in `allNav`, and
      // `changeRole` resets `active` to "Genel Bakış" on every role switch,
      // so this branch is unreachable for student/parent.
      const dayPlanRole = role as DayPlanRole;
      return (
        <DayPlanPage
          role={dayPlanRole}
          tasks={dayPlanTasks[dayPlanRole]}
          setTasks={updater =>
            setDayPlanTasks(current => ({
              ...current,
              [dayPlanRole]:
                typeof updater === "function"
                  ? (updater as (prev: DayPlanTask[]) => DayPlanTask[])(
                      current[dayPlanRole]
                    )
                  : updater,
            }))
          }
          isDemo={isDemoMode}
          organizationId={organizationId}
          membershipId={identity?.membership?.membershipId}
          schedule={activeSchedule}
          exams={calendarExams}
          notices={calendarNoticesQuery.data ?? []}
        />
      );
    }
    if (active === "Öğrenciler")
      return (
        <StudentsPage
          // Süzgeç her gelişte yeniden uygulansın diye liste yeniden kurulur.
          key={studentFilterPreset ?? "all"}
          initialFilter={studentFilterPreset ?? "all"}
          role={role}
          students={visibleStudents}
          query={query}
          onQuery={setQuery}
          onSelect={setSelectedStudentSnapshot}
          isLoading={!isDemoMode && studentsQuery.isLoading}
          error={!isDemoMode ? studentsQuery.error : null}
          onRetry={!isDemoMode ? () => void studentsQuery.refetch() : undefined}
          truncated={!isDemoMode && Boolean(studentsQuery.data?.truncated)}
          limit={STUDENT_TOTAL_CAP}
          linkableMembers={studentMembers}
          onEdit={student => {
            if (isDemoMode) {
              toast.info("Öğrenciyi düzenle", {
                description:
                  "Demo modunda öğrenci düzenleme işlemi devre dışıdır.",
              });
              return;
            }
            setStudentForEdit(student);
            setStudentFormOpen(true);
          }}
          onArchive={!isDemoMode ? handleArchiveStudent : undefined}
          onLinkAccount={!isDemoMode ? handleLinkStudentAccount : undefined}
          onUnlinkAccount={!isDemoMode ? handleUnlinkStudentAccount : undefined}
          onAdd={() => {
            if (isDemoMode) {
              toast.info("Yeni öğrenci", {
                description:
                  "Demo MVP’de öğrenci kayıt formu bir sonraki iterasyonda kalıcı veri modeline bağlanacak.",
              });
              return;
            }
            setNewStudentOpen(true);
          }}
          guardians={activeGuardians}
          guardianQuery={guardianQuery}
          onGuardianQuery={setGuardianQuery}
          onAddGuardian={() => {
            if (isDemoMode) {
              toast.info("Yeni veli", {
                description: "Demo modunda veli kaydı devre dışıdır.",
              });
              return;
            }
            setGuardianForEdit(null);
            setGuardianFormOpen(true);
          }}
          onEditGuardian={guardian => {
            if (isDemoMode) {
              toast.info("Veliyi düzenle", {
                description: "Demo modunda veli düzenleme devre dışıdır.",
              });
              return;
            }
            setGuardianForEdit(guardian);
            setGuardianFormOpen(true);
          }}
          onArchiveGuardian={!isDemoMode ? handleArchiveGuardian : undefined}
          onLinkGuardianAccount={
            !isDemoMode ? handleLinkGuardianAccount : undefined
          }
          onUnlinkGuardianAccount={
            !isDemoMode ? handleUnlinkGuardianAccount : undefined
          }
          linkableParentMembers={parentMembers}
          isGuardiansLoading={!isDemoMode && guardiansQuery.isLoading}
          guardiansError={!isDemoMode ? guardiansQuery.error : null}
          onGuardiansRetry={
            !isDemoMode ? () => void guardiansQuery.refetch() : undefined
          }
          guardiansTruncated={
            !isDemoMode && Boolean(guardiansQuery.data?.truncated)
          }
          guardiansLimit={GUARDIAN_TOTAL_CAP}
        />
      );
    if (active === "Sınıflar")
      return (
        <ClassesPage
          role={role}
          classes={activeClasses}
          isLoading={!isDemoMode && classesQuery.isLoading}
          error={!isDemoMode ? classesQuery.error : null}
          onRetry={!isDemoMode ? () => void classesQuery.refetch() : undefined}
          truncated={!isDemoMode && Boolean(classesQuery.data?.truncated)}
          limit={DEFAULT_CLASS_LIMIT}
          onAdd={() => {
            if (isDemoMode) {
              toast.info("Demo modunda sınıf ekleme kapalı.");
              return;
            }
            setClassForEdit(null);
            setClassFormOpen(true);
          }}
          onOpen={cls => setSelectedClassId(cls.id)}
          summaries={classSummaries}
          subjectUsage={subjectUsage}
        />
      );
    if (active === "Ders Programı")
      return (
        <SchedulePage
          role={role}
          schedule={activeSchedule}
          isLoading={
            !isDemoMode && (scheduleQuery.isLoading || guardianChild.isLoading)
          }
          error={!isDemoMode ? scheduleQuery.error : null}
          onRetry={!isDemoMode ? () => void scheduleQuery.refetch() : undefined}
          truncated={!isDemoMode && Boolean(scheduleQuery.data?.truncated)}
          limit={SCHEDULE_TOTAL_CAP}
          organizationId={organizationId}
          classes={activeClasses}
          covers={scheduleCovers}
        />
      );
    if (active === "Yoklama")
      return (
        <AttendancePage
          role={role}
          students={activeStudents}
          classes={activeClasses}
          attendances={attendances}
          setAttendances={setAttendances}
          schedule={activeSchedule}
          lessons={attendanceLessonsQuery.data ?? []}
          isLoading={!isDemoMode && attendanceLessonsQuery.isLoading}
          error={!isDemoMode ? attendanceLessonsQuery.error : null}
          onRetry={
            !isDemoMode
              ? () => void attendanceLessonsQuery.refetch()
              : undefined
          }
          organizationId={organizationId}
          onNavigate={navigate}
          onDirtyChange={setIsAttendanceDirty}
          onRequestConfirm={requestConfirmLeave}
          isDemo={isDemoMode}
          onSaved={async () => {
            setIsAttendanceDirty(false);
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: educationKeys.attendance(organizationId),
              }),
              queryClient.invalidateQueries({
                queryKey: ["education", "attendanceSheet"],
              }),
              // Ders başına "alındı" rozetleri ve Genel Bakış sayıları.
              queryClient.invalidateQueries({
                queryKey: ["education", "attendanceHistory"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["education", "studentAttendance"],
              }),
              queryClient.invalidateQueries({
                queryKey: educationKeys.todayLessons(organizationId),
              }),
              queryClient.invalidateQueries({
                queryKey: educationKeys.myLessonsToday(organizationId),
              }),
              queryClient.invalidateQueries({
                queryKey: educationKeys.adminOverview(organizationId),
              }),
              queryClient.invalidateQueries({
                queryKey: educationKeys.teacherOverview(organizationId),
              }),
              queryClient.invalidateQueries({
                queryKey: educationKeys.students(organizationId),
              }),
            ]);
          }}
        />
      );
    if (active === "Sınavlar")
      return (
        <AssessmentsPage
          role={role}
          onNavigate={navigate}
          exam={!isDemoMode ? (examQuery.data?.exam ?? null) : undefined}
          exams={examListQuery.data?.rows ?? []}
          examsTruncated={Boolean(examListQuery.data?.truncated)}
          isLoading={!isDemoMode && examPageQuery.isLoading}
          error={!isDemoMode ? examPageQuery.error : null}
          onRetry={!isDemoMode ? () => void examPageQuery.refetch() : undefined}
          organizationId={organizationId}
          classes={activeClasses}
          onDirtyChange={setIsExamDirty}
          onRequestConfirm={requestConfirmLeave}
          isDemo={isDemoMode}
          onSaved={async () => {
            setIsExamDirty(false);
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: educationKeys.exam(organizationId),
              }),
              queryClient.invalidateQueries({
                queryKey: ["education", "examSheet"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["education", "exams"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["education", "examList"],
              }),
              queryClient.invalidateQueries({
                queryKey: educationKeys.students(organizationId),
              }),
            ]);
          }}
        />
      );
    if (active === "Ödevler")
      return (
        <HomeworkPage
          role={role}
          students={
            role === "student" || role === "parent" ? activeStudents : []
          }
          homework={activeHomework}
          isLoading={!isDemoMode && homeworkQuery.isLoading}
          error={homeworkQuery.error}
          onRetry={() => homeworkQuery.refetch()}
          truncated={!isDemoMode && Boolean(homeworkQuery.data?.truncated)}
          limit={HOMEWORK_TOTAL_CAP}
          organizationId={organizationId}
          classes={activeClasses}
          onSaved={async () => {
            await queryClient.invalidateQueries({
              queryKey: educationKeys.homework(organizationId),
            });
          }}
          isDemo={isDemoMode}
          setHomework={setHomework}
        />
      );
    if (active === "İletişim")
      return (
        <CommunicationsPage
          role={role}
          message={message}
          setMessage={setMessage}
          organizationId={organizationId}
          classes={activeClasses}
        />
      );
    if (active === "Kayıt ve Ödemeler")
      return (
        <PaymentsPage
          role={role}
          paymentRows={activePayments}
          overviewStats={activePaymentOverviewStats}
          isLoading={
            !isDemoMode &&
            (paymentsQuery.isLoading || paymentOverviewQuery.isLoading)
          }
          error={
            !isDemoMode
              ? paymentsQuery.error || paymentOverviewQuery.error
              : null
          }
          onRetry={
            !isDemoMode
              ? () => {
                  void paymentsQuery.refetch();
                  void paymentOverviewQuery.refetch();
                }
              : undefined
          }
          truncated={!isDemoMode && Boolean(paymentsQuery.data?.truncated)}
          limit={PAYMENT_TOTAL_CAP}
          installments={parentInstallmentsQuery.data}
          installmentsError={parentInstallmentsQuery.isError}
          onAddPlan={() => {
            setPaymentPlanForEdit(null);
            setPaymentPlanFormOpen(true);
          }}
          onSelectPlan={item => {
            setSelectedPaymentPlan({
              id: item.id || "",
              studentId: item.studentId,
              studentName: item.student,
              name: item.plan,
              totalAmount: item.totalAmount,
            });
            setPaymentPlanDetailOpen(true);
          }}
        />
      );
    if (active === "Raporlar")
      return (
        <ReportsPage
          role={role}
          attendanceWeeks={reportAttendanceQuery.data}
          examAverages={reportExamQuery.data}
          homeworkWeeks={reportHomeworkQuery.data}
          range={reportRange}
          onRangeChange={setReportRange}
          classes={activeClasses}
          comparison={{
            rows: reportComparisonQuery.data,
            isLoading: reportComparisonQuery.isLoading,
            error: reportComparisonQuery.error,
          }}
          attention={{
            rows: reportAttentionQuery.data,
            isLoading: reportAttentionQuery.isLoading,
            error: reportAttentionQuery.error,
          }}
          onOpenStudent={studentId => {
            const student = activeStudents.find(s => s.id === studentId);
            if (student) setSelectedStudentSnapshot(student);
          }}
          isLoading={
            !isDemoMode &&
            (reportAttendanceQuery.isLoading ||
              reportExamQuery.isLoading ||
              reportHomeworkQuery.isLoading)
          }
          error={
            !isDemoMode
              ? reportAttendanceQuery.error ||
                reportExamQuery.error ||
                reportHomeworkQuery.error
              : null
          }
          onRetry={
            !isDemoMode
              ? () => {
                  void reportAttendanceQuery.refetch();
                  void reportExamQuery.refetch();
                  void reportHomeworkQuery.refetch();
                }
              : undefined
          }
        />
      );
    if (active === "Denetim Kaydı") return <AuditLogPage />;
    return <SettingsPage role={role} onResetDemoData={resetDemoData} />;
  };

  return (
    <GuardianChildContext.Provider value={guardianChild}>
      <div className="min-h-screen bg-[#f6f8fc] dark:bg-[#0b1120] text-slate-900">
        <div className="flex min-h-screen">
          <EducationSidebar
            role={role}
            displayName={currentDisplayName}
            navItems={navItems}
            active={active}
            mobileNav={mobileNav}
            navCollapsed={navCollapsed}
            onCloseMobileNav={() => setMobileNav(false)}
            onNavigate={navigate}
            canAccessPlatform={canAccessPlatform}
            onLogout={onLogout}
          />
          {/* `overflow-x-clip` (2026-10-15): geniş bir tablo içeriği taşırsa
              bütün sayfa yana kaymaz — üst çubuk ve kenar çubuğu düğmesi
              yerinde kalır, tablo kendi kutusunda kayar. `hidden` değil
              `clip`: kaydırma kabı oluşturmaz, yapışkan üst çubuk çalışır. */}
          <main className="min-w-0 flex-1 overflow-x-clip">
            <ConnectionBanner channelStatus={organizationChannel.status} />
            <EducationTopBar
              role={role}
              displayName={currentDisplayName}
              organizationName={organizationName}
              branchName={branchName}
              navCollapsed={navCollapsed}
              onOpenMobileNav={() => setMobileNav(true)}
              onToggleNavCollapsed={() => setNavCollapsed(value => !value)}
              onNavigate={navigate}
              canSwitchRole={canSwitchRole}
              onChangeRole={changeRole}
            />
            <div className="sm:hidden">
              <ChildSwitcher variant="compact" />
            </div>
            <div
              className={`mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${hasBottomNav ? "pb-24 lg:pb-8" : ""}`}
            >
              {/* Sekme değişince sınır sıfırlanır; çökme yalnız o sekmeyi kapatır. */}
              <ErrorBoundary key={active} variant="section">
                <Suspense
                  fallback={
                    <div
                      role="status"
                      className="mx-auto mt-16 text-center text-[12px] font-semibold text-slate-400"
                    >
                      Yükleniyor…
                    </div>
                  }
                >
                  {renderPage()}
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
        {hasBottomNav ? (
          <BottomNav
            role={role}
            active={active}
            available={navItems.map(item => item.label)}
            onNavigate={navigate}
            onOpenMenu={() => setMobileNav(true)}
          />
        ) : null}
        {selectedClass ? (
          <ClassDetail
            cls={selectedClass}
            role={role}
            summary={summaryFor(classSummaries, selectedClass.id)}
            lessons={activeSchedule.filter(l => l.classId === selectedClass.id)}
            onClose={() => setSelectedClassId(null)}
            onOpenStudent={studentId => {
              const student = activeStudents.find(s => s.id === studentId);
              if (!student) return;
              setSelectedClassId(null);
              setSelectedStudentSnapshot(student);
            }}
            onManageEnrollments={
              !isDemoMode
                ? cls => {
                    setClassForEnrollment(cls);
                    setClassEnrollmentOpen(true);
                  }
                : undefined
            }
            onManageTeachers={
              !isDemoMode && role === "admin"
                ? cls => {
                    setClassForTeachers(cls);
                    setClassTeachersOpen(true);
                  }
                : undefined
            }
            onEdit={
              !isDemoMode
                ? cls => {
                    setClassForEdit(cls);
                    setClassFormOpen(true);
                  }
                : undefined
            }
            onArchive={
              !isDemoMode
                ? cls => {
                    setSelectedClassId(null);
                    void handleArchiveClass(cls);
                  }
                : undefined
            }
          />
        ) : null}
        {selectedStudent ? (
          <StudentDetail
            student={selectedStudent}
            onClose={() => setSelectedStudentSnapshot(null)}
            role={role}
            studentGuardians={
              !isDemoMode ? (studentGuardiansQuery.data ?? []) : undefined
            }
            availableGuardians={
              !isDemoMode
                ? (guardiansQuery.data?.rows ?? []).filter(
                    g =>
                      !(studentGuardiansQuery.data ?? []).some(
                        link => link.guardianId === g.id
                      )
                  )
                : []
            }
            onLinkGuardian={
              role === "admin" && !isDemoMode
                ? handleLinkGuardianToStudent
                : undefined
            }
            onUnlinkGuardian={
              role === "admin" && !isDemoMode
                ? handleUnlinkGuardianFromStudent
                : undefined
            }
          />
        ) : null}
        {!isDemoMode && (
          <>
            <NewStudentDialog
              open={newStudentOpen}
              onOpenChange={setNewStudentOpen}
              organizationId={organizationId}
            />
            <StudentFormDialog
              open={studentFormOpen}
              onOpenChange={setStudentFormOpen}
              organizationId={organizationId}
              student={studentForEdit}
              onDone={() => setStudentForEdit(null)}
            />
            <GuardianFormDialog
              open={guardianFormOpen}
              onOpenChange={setGuardianFormOpen}
              organizationId={organizationId}
              guardian={guardianForEdit}
              onDone={() => setGuardianForEdit(null)}
            />
            <ClassFormDialog
              open={classFormOpen}
              onOpenChange={setClassFormOpen}
              organizationId={organizationId}
              classData={classForEdit}
              onDone={() => setClassForEdit(null)}
            />
            {classForEnrollment && (
              <ClassEnrollmentDialog
                open={classEnrollmentOpen}
                onOpenChange={setClassEnrollmentOpen}
                organizationId={organizationId}
                classData={classForEnrollment}
              />
            )}
            {classForTeachers && (
              <ClassTeachersDialog
                open={classTeachersOpen}
                onOpenChange={setClassTeachersOpen}
                organizationId={organizationId}
                classData={classForTeachers}
              />
            )}
            <PaymentPlanEditorDialog
              open={paymentPlanFormOpen}
              onOpenChange={setPaymentPlanFormOpen}
              organizationId={organizationId}
              students={activeStudents.map(s => ({ id: s.id, name: s.name }))}
              plan={paymentPlanForEdit}
              onDone={() => setPaymentPlanForEdit(null)}
            />
            {selectedPaymentPlan && (
              <PaymentPlanDetailDialog
                open={paymentPlanDetailOpen}
                onOpenChange={setPaymentPlanDetailOpen}
                organizationId={organizationId}
                role={role}
                plan={selectedPaymentPlan}
                onEditPlan={plan => {
                  setPaymentPlanForEdit(plan);
                  setPaymentPlanFormOpen(true);
                }}
                onPlanArchived={() => setSelectedPaymentPlan(null)}
              />
            )}
          </>
        )}
        <UnsavedChangesDialog
          open={confirmDialogOpen}
          onOpenChange={setConfirmDialogOpen}
          onCancel={() => {
            setConfirmDialogOpen(false);
            setPendingNavAction(null);
          }}
          onConfirm={() => {
            setIsAttendanceDirty(false);
            setIsExamDirty(false);
            setConfirmDialogOpen(false);
            if (pendingNavAction) {
              const action = pendingNavAction;
              setPendingNavAction(null);
              action();
            }
          }}
        />
      </div>
    </GuardianChildContext.Provider>
  );
}

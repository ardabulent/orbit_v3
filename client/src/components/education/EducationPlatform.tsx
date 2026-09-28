import { useEffect, useMemo, useState } from "react";
import { OrbitMark } from "@/components/OrbitMark";
import { LogOut, Menu, PanelLeft, ShieldCheck, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { AccountSwitchMenu } from "@/components/auth/AccountSwitchMenu";
import { clearDemoData, readDemoData, writeDemoData } from "@/lib/demoStorage";
import { isDemoMode } from "@/auth/runtime";
import { availableEducationSections } from "@/components/educationAccess";
import { filterStudentsForRole } from "./scopeFilters";
import { shouldConfirmLeaving } from "./navigationGuards";
import { AdminDashboard } from "./dashboards/AdminDashboard";
import { ClassDetail } from "./ClassDetail";
import { buildClassSummaries, summaryFor } from "./pages/classSummaries";
import { buildSubjectUsage } from "./pages/subjectUsage";
import { currentCoverByAbsent } from "./pages/substitutePeriods";
import type { ScheduleCover } from "./pages/scheduleGrid";
import { getOrbitToday } from "@/education/trDate";
import type { StudentFilter } from "./pages/studentFilters";
import { ParentDashboard } from "./dashboards/ParentDashboard";
import { StudentDashboard } from "./dashboards/StudentDashboard";
import { TeacherDashboard } from "./dashboards/TeacherDashboard";
import {
  classes,
  dayPlanTasksByRole,
  initialAttendances,
  initialAutomations,
  initialHomework,
  paymentOverviewStats,
  paymentRows,
  schedule,
  students,
  buildPaymentStats,
} from "./educationData";
import {
  useClasses,
  useGuardians,
  useHomework,
  useLatestExam,
  usePaymentOverview,
  usePayments,
  useReportAttendanceWeeks,
  useReportExamAverages,
  useReportHomeworkWeeks,
  useSchedule,
  useStudentGuardians,
  useStudents,
  useExams,
  useMyLessonsToday,
  useSubstitutes,
  useTodayLessons,
  educationKeys,
} from "@/education/educationQueries";
import { useAuth } from "@/auth/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useSettingsMembers } from "@/settings/settingsQueries";
import {
  archiveStudent,
  restoreStudent,
  linkStudentAccount,
  unlinkStudentAccount,
} from "@/education/studentService";
import {
  archiveGuardian,
  restoreGuardian,
  linkGuardianAccount,
  unlinkGuardianAccount,
  linkStudentGuardian,
  unlinkStudentGuardian,
  restoreStudentGuardianLink,
  translateGuardianError,
  DEFAULT_GUARDIAN_LIMIT,
  type Guardian,
} from "@/education/guardianService";
import { DEFAULT_HOMEWORK_LIMIT } from "@/education/homeworkService";
import { StudentFormDialog } from "./pages/StudentFormDialog";
import { NewStudentDialog } from "./pages/NewStudentDialog";
import { GuardianFormDialog } from "./pages/GuardianFormDialog";
import { ClassFormDialog } from "./pages/ClassFormDialog";
import { ClassEnrollmentDialog } from "./pages/ClassEnrollmentDialog";
import { ClassTeachersDialog } from "./pages/ClassTeachersDialog";
import { PaymentPlanFormDialog } from "./pages/PaymentPlanFormDialog";
import { PaymentPlanDetailDialog } from "./pages/PaymentPlanDetailDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrganizationChannel } from "@/realtime/useOrganizationChannel";
import { DEFAULT_STUDENT_LIMIT } from "@/education/studentService";
import {
  archiveClass,
  restoreClass,
  DEFAULT_CLASS_LIMIT,
} from "@/education/classService";
import { DEFAULT_SCHEDULE_LIMIT } from "@/education/scheduleService";
import { DEFAULT_PAYMENT_LIMIT } from "@/education/paymentService";
import { allNav } from "./navigation";
import { roleMeta } from "./roleMeta";
import { AssessmentsPage } from "./pages/AssessmentsPage";
import { AttendancePage } from "./pages/AttendancePage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { ClassesPage } from "./pages/ClassesPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { DayPlanPage } from "./pages/DayPlanPage";
import { HomeworkPage } from "./pages/HomeworkPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetail } from "./StudentDetail";
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

// Başlık grubun İÇERİĞİNİ adlandırır. Tek bir koşul yetmiyor çünkü aynı grup
// her rolde farklı maddeler taşıyor; `role !== "admin"` fırçası öğretmende
// Raporlar'ı, velide Ödemeler'i "hesap ayarı" gibi göstermişti (#147).
//
// Açık eşleme bilinçli: bir rolün madde listesi değişirse başlığının da
// gözden geçirilmesi gerekir ve bu, buraya bakmayı zorunlu kılar.
const secondaryGroupTitle: Record<Role, string> = {
  admin: "Kurum yönetimi",
  teacher: "Raporlar ve Ayarlar",
  student: "Hesap ve Ayarlar",
  parent: "Ödemeler ve Ayarlar",
};

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
  const [active, setActive] = useState<Section>("Genel Bakış");
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
  const [automations, setAutomations] = useState(() =>
    readDemoData("automations", initialAutomations)
  );
  const [dayPlanTasks, setDayPlanTasks] = useState<
    Record<DayPlanRole, DayPlanTask[]>
  >(() => readDemoData("dayPlanTasks", dayPlanTasksByRole));
  const [homework, setHomework] = useState<Homework[]>(() =>
    readDemoData("homework", initialHomework)
  );
  const [message, setMessage] = useState("");
  const meta = roleMeta[role];
  const currentDisplayName = displayName ?? "";
  const navItems = allNav.filter(item =>
    availableEducationSections(role).includes(item.label)
  );

  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const queryClient = useQueryClient();
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  /** "Yeni öğrenci" tek akışı; `StudentFormDialog` yalnız düzenleme için. */
  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [studentForEdit, setStudentForEdit] = useState<Student | null>(null);
  const [classFormOpen, setClassFormOpen] = useState(false);
  /** Açık sınıf detay paneli; sınıf listenin güncel satırından okunur. */
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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

  const studentsQuery = useStudents({ search: query, enabled: !isDemoMode });
  const membersQuery = useSettingsMembers({
    enabled: role === "admin" && !isDemoMode,
  });
  const studentMembers = useMemo(
    () => (membersQuery.data ?? []).filter(m => m.role === "student"),
    [membersQuery.data]
  );

  const handleArchiveStudent = async (student: Student) => {
    try {
      await archiveStudent(student.id);
      // v1.4 ara denetimi: `restoreStudent` yazıldığı günden beri çağıransızdı.
      // Arşivlenmiş öğrenciyi listeleyen bir ekran yok (`loadStudents`
      // `archived_at is null` süzüyor), dolayısıyla geri almanın tek
      // gözlenebilir yeri kullanıcının işlemi yaptığı an. Desen uydurma değil:
      // v1.4-10'da veli bağı koparma tam olarak böyle geri alınıyor.
      toast.success("Öğrenci arşivlendi", {
        description: `${student.name} arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreStudent(student.id)
              .then(async () => {
                toast.success("Öğrenci geri yüklendi", {
                  description: `${student.name} arşivden çıkarıldı.`,
                });
                await queryClient.invalidateQueries({
                  queryKey: educationKeys.students(organizationId),
                });
              })
              .catch(err => {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : "Öğrenci geri yüklenemedi."
                );
              });
          },
        },
      });
      await queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Öğrenci arşivlenemedi."
      );
    }
  };

  const handleArchiveClass = async (cls: ClassGroup) => {
    // Onay penceresi YOK ve bu öğrenci arşivlemesiyle aynı gerekçeye dayanıyor:
    // arşivleme geri alınabilir bir işlem. Ayrıca `window.confirm` bu depoda
    // hiç kullanılmıyor — tarayıcıyı bloklar, tasarım diline uymaz ve test
    // edilemez. Onay gerekseydi yeri `components/ui/alert-dialog.tsx` olurdu.
    try {
      await archiveClass(cls.id);
      toast.success("Sınıf arşivlendi", {
        description: `${cls.name} arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreClass(cls.id)
              .then(async () => {
                toast.success("Sınıf geri yüklendi", {
                  description: `${cls.name} arşivden çıkarıldı.`,
                });
                await queryClient.invalidateQueries({
                  queryKey: educationKeys.classes(organizationId),
                });
              })
              .catch(err => {
                toast.error(
                  err instanceof Error ? err.message : "Sınıf geri yüklenemedi."
                );
              });
          },
        },
      });
      await queryClient.invalidateQueries({
        queryKey: educationKeys.classes(organizationId),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sınıf arşivlenemedi.");
    }
  };

  const handleLinkStudentAccount = async (
    studentId: string,
    membershipId: string
  ) => {
    await linkStudentAccount(studentId, membershipId);
    toast.success("Hesap bağlandı", {
      description: "Öğrenciye giriş hesabı bağlandı.",
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["settings", "members", { organizationId }],
      }),
    ]);
  };

  const handleUnlinkStudentAccount = async (studentId: string) => {
    await unlinkStudentAccount(studentId);
    toast.success("Hesap bağı çözüldü", {
      description: "Öğrencinin giriş hesabı bağı kaldırıldı.",
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: educationKeys.students(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["settings", "members", { organizationId }],
      }),
    ]);
  };

  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianFormOpen, setGuardianFormOpen] = useState(false);
  const [guardianForEdit, setGuardianForEdit] = useState<Guardian | null>(null);

  const parentMembers = useMemo(
    () => (membersQuery.data ?? []).filter(m => m.role === "parent"),
    [membersQuery.data]
  );

  const guardiansQuery = useGuardians({
    search: guardianQuery,
    enabled: role === "admin" && !isDemoMode,
  });

  const studentGuardiansQuery = useStudentGuardians(
    selectedStudentSnapshot?.id ?? "",
    {
      enabled: Boolean(selectedStudentSnapshot?.id) && !isDemoMode,
    }
  );

  const handleArchiveGuardian = async (guardian: Guardian) => {
    try {
      await archiveGuardian(organizationId, guardian.id);
      toast.success("Veli arşivlendi", {
        description: `${guardian.fullName} arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreGuardian(organizationId, guardian.id)
              .then(async () => {
                toast.success("Veli geri yüklendi");
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.guardians(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translateGuardianError(err));
              });
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleLinkGuardianAccount = async (
    guardianId: string,
    membershipId: string
  ) => {
    try {
      await linkGuardianAccount(guardianId, membershipId);
      toast.success("Hesap bağlandı", {
        description: "Veliye giriş hesabı bağlandı.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["settings", "members", { organizationId }],
        }),
        queryClient.invalidateQueries({
          // Öğrenci detayındaki velinin hesap rozeti bu sorgudan gelir (C-03).
          queryKey: educationKeys.studentGuardians(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleUnlinkGuardianAccount = async (guardianId: string) => {
    try {
      await unlinkGuardianAccount(guardianId);
      toast.success("Hesap bağı çözüldü", {
        description: "Velinin giriş hesabı bağı kaldırıldı.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["settings", "members", { organizationId }],
        }),
        queryClient.invalidateQueries({
          // Öğrenci detayındaki velinin hesap rozeti bu sorgudan gelir (C-03).
          queryKey: educationKeys.studentGuardians(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleLinkGuardianToStudent = async (
    studentId: string,
    guardianId: string
  ) => {
    try {
      await linkStudentGuardian(organizationId, studentId, guardianId);
      toast.success("Veli bağlandı", {
        description: "Öğrenciye veli kaydı bağlandı.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.studentGuardians(organizationId, studentId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const handleUnlinkGuardianFromStudent = async (
    linkId: string,
    guardianName: string
  ) => {
    try {
      await unlinkStudentGuardian(organizationId, linkId);
      toast.success("Veli bağı koparıldı", {
        description: `${guardianName} velisinin öğrenci bağı kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreStudentGuardianLink(organizationId, linkId)
              .then(async () => {
                toast.success("Veli bağı geri yüklendi");
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.studentGuardians(
                      organizationId,
                      selectedStudentSnapshot?.id
                    ),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.guardians(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translateGuardianError(err));
              });
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.studentGuardians(
            organizationId,
            selectedStudentSnapshot?.id
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.guardians(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translateGuardianError(err));
    }
  };

  const classesQuery = useClasses({ enabled: !isDemoMode });
  const scheduleQuery = useSchedule({ enabled: !isDemoMode });
  const examQuery = useLatestExam({ enabled: !isDemoMode });
  // Sınavlar listesi (C-07) — yönetici ve öğretmen.
  const isStaffRole = role === "admin" || role === "teacher";
  const examListQuery = useExams({
    enabled: !isDemoMode && isStaffRole && active === "Sınavlar",
  });
  const examPageQuery = isStaffRole ? examListQuery : examQuery;
  const paymentsQuery = usePayments({ enabled: !isDemoMode });
  const paymentOverviewQuery = usePaymentOverview({ enabled: !isDemoMode });
  const homeworkQuery = useHomework({ enabled: !isDemoMode });
  const reportAttendanceQuery = useReportAttendanceWeeks({
    enabled: !isDemoMode,
  });
  const reportExamQuery = useReportExamAverages({
    enabled: !isDemoMode,
  });
  const reportHomeworkQuery = useReportHomeworkWeeks({
    enabled: !isDemoMode,
  });

  // Aktif kurumun Realtime kanalına tekil abonelik (v1.3-05).
  // Demo modunda devre dışıdır; canlı modda arka plandaki veri değişikliklerini dinler.
  useOrganizationChannel();

  const activeStudents = useMemo(() => {
    if (isDemoMode) {
      return students;
    }
    return studentsQuery.data?.rows ?? [];
  }, [studentsQuery.data?.rows]);

  // Liste tazelenince panel de tazelenir (C-03). Öğrenci arama yüzünden
  // listeden düştüyse son bilinen hâli gösterilir; boş panel çizilmez.
  const selectedStudent = useMemo(() => {
    if (!selectedStudentSnapshot) return null;
    return (
      activeStudents.find(item => item.id === selectedStudentSnapshot.id) ??
      selectedStudentSnapshot
    );
  }, [activeStudents, selectedStudentSnapshot]);

  const activeClasses = useMemo(() => {
    if (isDemoMode) {
      return classes;
    }
    return classesQuery.data?.rows ?? [];
  }, [classesQuery.data?.rows]);

  const activeSchedule = useMemo(() => {
    if (isDemoMode) {
      return schedule;
    }
    return scheduleQuery.data?.rows ?? [];
  }, [scheduleQuery.data?.rows]);

  const todayLessonsForClasses = useTodayLessons({
    enabled:
      !isDemoMode &&
      (active === "Sınıflar" ||
        Boolean(selectedClassId) ||
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
  const selectedClass = selectedClassId
    ? (activeClasses.find(c => c.id === selectedClassId) ?? null)
    : null;

  const activePayments = useMemo(() => {
    if (isDemoMode) {
      return paymentRows;
    }
    return paymentsQuery.data?.rows ?? [];
  }, [paymentsQuery.data?.rows]);

  const activePaymentOverviewStats = useMemo(() => {
    if (isDemoMode) {
      return paymentOverviewStats;
    }
    return buildPaymentStats(paymentOverviewQuery.data ?? null);
  }, [paymentOverviewQuery.data]);

  const activeHomework = useMemo(() => {
    if (isDemoMode) {
      return homework;
    }
    return homeworkQuery.data?.rows ?? [];
  }, [homework, homeworkQuery.data?.rows]);

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

  useEffect(() => {
    writeDemoData("attendances", attendances);
  }, [attendances]);

  useEffect(() => {
    writeDemoData("automations", automations);
  }, [automations]);

  useEffect(() => {
    writeDemoData("dayPlanTasks", dayPlanTasks);
  }, [dayPlanTasks]);

  useEffect(() => {
    writeDemoData("homework", homework);
  }, [homework]);

  const resetDemoData = () => {
    clearDemoData("attendances");
    clearDemoData("automations");
    clearDemoData("dayPlanTasks");
    clearDemoData("homework");
    setAttendances(initialAttendances);
    setAutomations(initialAutomations);
    setDayPlanTasks(dayPlanTasksByRole);
    setHomework(initialHomework);
    toast.success("Demo verileri sıfırlandı", {
      description:
        "Yoklama, otomasyon, gün planı ve ödev verileri ilk demo durumuna döndürüldü.",
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
          limit={DEFAULT_STUDENT_LIMIT}
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
          guardiansLimit={DEFAULT_GUARDIAN_LIMIT}
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
          isLoading={!isDemoMode && scheduleQuery.isLoading}
          error={!isDemoMode ? scheduleQuery.error : null}
          onRetry={!isDemoMode ? () => void scheduleQuery.refetch() : undefined}
          truncated={!isDemoMode && Boolean(scheduleQuery.data?.truncated)}
          limit={DEFAULT_SCHEDULE_LIMIT}
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
          homework={activeHomework}
          isLoading={!isDemoMode && homeworkQuery.isLoading}
          error={homeworkQuery.error}
          onRetry={() => homeworkQuery.refetch()}
          truncated={!isDemoMode && Boolean(homeworkQuery.data?.truncated)}
          limit={DEFAULT_HOMEWORK_LIMIT}
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
          limit={DEFAULT_PAYMENT_LIMIT}
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
    if (active === "Otomasyonlar")
      return (
        <AutomationsPage
          automations={automations}
          setAutomations={setAutomations}
        />
      );
    if (active === "Raporlar")
      return (
        <ReportsPage
          role={role}
          attendanceWeeks={reportAttendanceQuery.data}
          examAverages={reportExamQuery.data}
          homeworkWeeks={reportHomeworkQuery.data}
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
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-slate-200 bg-white px-3 py-4 transition-all lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"} ${navCollapsed ? "lg:w-[74px] lg:px-2" : "lg:w-[258px]"}`}
        >
          <div className="mb-7 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 p-1.5 shadow-[0_6px_14px_rgba(15,23,42,.12)]">
                <OrbitMark inverted className="h-full w-full object-contain" />
              </span>
              <div className={navCollapsed ? "lg:hidden" : ""}>
                <p className="font-orbit text-[18px] font-extrabold tracking-[-.055em] text-slate-900">
                  ORBIT
                </p>
                <p className="-mt-0.5 text-[9px] font-bold uppercase tracking-[.13em] text-slate-400">
                  Education
                </p>
              </div>
            </div>
            <button
              onClick={() => setMobileNav(false)}
              aria-label="Menüyü kapat"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            className={`mb-5 rounded-xl border border-blue-100 bg-blue-50/65 px-3 py-3 ${navCollapsed ? "lg:hidden" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-lg ${meta.color}`}
              >
                <meta.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold text-slate-800">
                  {currentDisplayName}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                  {meta.label}
                </p>
              </div>
            </div>
          </div>
          {/*
            `flex-1 overflow-y-auto` olmadan menü, ekran yüksekliğini aşınca
            kesiliyordu ve kaydırılamıyordu: `lg:h-screen` yüksekliği sabitliyor
            ama taşan içeriğe ne yapılacağını söylemiyor. Küçük dizüstü
            ekranlarda alttaki maddelere hiç ulaşılamıyordu.
          */}
          <nav className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
            {(["Ana çalışma alanı", "Kurum yönetimi"] as const).map(group => {
              const groupItems = navItems.filter(item => item.group === group);
              if (groupItems.length === 0) return null;

              const groupTitle =
                group === "Kurum yönetimi" ? secondaryGroupTitle[role] : group;

              return (
                <div
                  key={group}
                  className={
                    group === "Kurum yönetimi" ? "mt-6 space-y-1" : "space-y-1"
                  }
                >
                  <p
                    className={`mb-2 px-3 text-[9px] font-extrabold uppercase tracking-[.14em] text-slate-400 ${navCollapsed ? "lg:hidden" : ""}`}
                  >
                    {groupTitle}
                  </p>
                  {groupItems.map(item => {
                    const Icon = item.icon;
                    const selected = active === item.label;
                    return (
                      <button
                        key={item.label}
                        onClick={() => navigate(item.label)}
                        // Şerit hâlindeyken etiket gizlendiği için erişilebilir
                        // ad ve fare üzerinde ipucu `title` ile korunuyor.
                        title={navCollapsed ? item.label : undefined}
                        className={`flex h-9 w-full items-center gap-3 rounded-lg text-left text-[12px] font-semibold transition ${navCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"} ${selected ? "bg-slate-900 text-white shadow-[0_7px_14px_rgba(15,23,42,.10)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${selected ? "text-white" : "text-slate-400"}`}
                        />
                        <span
                          className={`flex-1 ${navCollapsed ? "lg:hidden" : ""}`}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="mt-auto space-y-1 border-t border-slate-100 pt-4">
            {/*
              Platform paneline giden tek görünür yol. Bağlantı yokken operatör
              panele ancak adresi elle yazarak ulaşabiliyordu; kurucu ekip
              üyeleri hem kurum üyesi hem operatör olduğu için girişte doğrudan
              dershane paneline düşüyor ve panelin var olduğunu göremiyordu.
              Yalnızca gerçekten operatör olana gösterilir.
            */}
            {canAccessPlatform ? (
              <Link
                href="/platform"
                title={navCollapsed ? "Platform yönetimi" : undefined}
                className={`flex h-9 w-full items-center gap-3 rounded-lg text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 ${navCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"}`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                <span className={navCollapsed ? "lg:hidden" : ""}>
                  Platform yönetimi
                </span>
              </Link>
            ) : null}
            <button
              onClick={onLogout}
              title={navCollapsed ? "Çıkış Yap" : undefined}
              className={`flex h-9 w-full items-center gap-3 rounded-lg text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 ${navCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"}`}
            >
              <LogOut className="h-4 w-4 shrink-0 text-slate-400" />
              <span className={navCollapsed ? "lg:hidden" : ""}>Çıkış Yap</span>
            </button>
          </div>
        </aside>
        {mobileNav ? (
          <button
            aria-label="Menüyü kapat"
            onClick={() => setMobileNav(false)}
            className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
          />
        ) : null}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-[#f6f8fc]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNav(true)}
                aria-label="Menüyü aç"
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              {/*
                Masaüstünde menü daraltma. Mobildeki düğmeden ayrı: orada menü
                çekmece olarak açılıp kapanıyor, burada simge şeridine iniyor.
                Tek düğmeyle iki davranışı yönetmek, ekran genişliğini JS'te
                okumayı gerektirirdi.
              */}
              <button
                onClick={() => setNavCollapsed(value => !value)}
                aria-label={navCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
                aria-pressed={navCollapsed}
                title={navCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
                className="hidden h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:grid"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">
                  {meta.description}
                </p>
                {/* Akademik dönem burada yazılıydı ve hiçbir yerden gelmiyordu:
                    ne `organizations` tablosunda ne kimlikte böyle bir alan var.
                    Her kuruma aynı dönemi söylüyordu. Kurum adı da artık
                    korumalı; çözülemediğinde başlık boş kalır, yarım kalmış bir
                    ayıraç bırakmaz. */}
                <p className="text-[10px] text-slate-400">
                  {[branchName, organizationName].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Zil kaldırıldı (v1.5-22): noktası her zaman yanıyordu ve her
                  kullanıcıya aynı sabit cümleyi gösteriyordu ("2 otomasyon, 1
                  yoklama ve 3 iletişim bildirimi var"). Bildirim altyapısı yok;
                  olmayan bir şeyi sayı olarak göstermek K-03. Altyapı kurulunca
                  geri gelir. */}
              <AccountSwitchMenu />
              {canSwitchRole ? (
                <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:flex">
                  {(Object.keys(roleMeta) as Role[]).map(itemRole => (
                    <button
                      key={itemRole}
                      onClick={() => changeRole(itemRole)}
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${role === itemRole ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      {roleMeta[itemRole].short}
                    </button>
                  ))}
                </div>
              ) : null}
              {canSwitchRole ? (
                <button
                  onClick={() => {
                    const next =
                      role === "parent"
                        ? "admin"
                        : (Object.keys(roleMeta) as Role[])[
                            (Object.keys(roleMeta) as Role[]).indexOf(role) + 1
                          ];
                    changeRole(next);
                  }}
                  aria-label="Demo rolünü değiştir"
                  className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-[11px] font-extrabold text-white sm:hidden"
                >
                  {currentDisplayName
                    ? currentDisplayName
                        .split(" ")
                        .filter(Boolean)
                        .map(word => word[0])
                        .join("")
                    : "O"}
                </button>
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-[11px] font-extrabold text-white">
                  {currentDisplayName
                    ? currentDisplayName
                        .split(" ")
                        .filter(Boolean)
                        .map(word => word[0])
                        .join("")
                    : "O"}
                </span>
              )}
            </div>
          </header>
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {renderPage()}
          </div>
        </main>
      </div>
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
          <PaymentPlanFormDialog
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
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydedilmemiş Değişiklikler</AlertDialogTitle>
            <AlertDialogDescription>
              Kaydedilmemiş değişiklikleriniz var. Sayfadan ayrılırsanız bu
              değişiklikler kaybolacak. Devam etmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmDialogOpen(false);
                setPendingNavAction(null);
              }}
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsAttendanceDirty(false);
                setIsExamDirty(false);
                setConfirmDialogOpen(false);
                if (pendingNavAction) {
                  const action = pendingNavAction;
                  setPendingNavAction(null);
                  action();
                }
              }}
            >
              Devam Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

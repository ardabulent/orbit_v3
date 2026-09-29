import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { isDemoMode } from "@/auth/runtime";
import {
  formatCurrency,
  type PaymentOverviewCounts,
} from "@/education/paymentService";
import {
  adminAutomationActivities as demoAdminAutomationActivities,
  adminFollowUpNote as demoAdminFollowUpNote,
  adminOverviewHeader as demoAdminOverviewHeader,
  attendanceLessonInfo as demoAttendanceLessonInfo,
  classes as demoClasses,
  dayPlanEventsByRole as demoDayPlanEventsByRole,
  dayPlanTasksByRole as demoDayPlanTasksByRole,
  demoActiveConversation,
  demoAdminOverviewStatValues,
  demoAssessmentFollowUp,
  demoAssessmentHeaderInfo,
  demoAssessmentSubjects,
  demoCommunicationsList,
  demoParentOverviewStatValues,
  demoPaymentOverviewStatValues,
  demoStudentOverviewStatValues,
  demoTeacherOverviewStatValues,
  initialAttendances as demoInitialAttendances,
  initialAutomations as demoInitialAutomations,
  initialHomework as demoInitialHomework,
  organizationMembers as demoOrganizationMembers,
  parentCommunicationItems as demoParentCommunicationItems,
  parentProgressSummary as demoParentProgressSummary,
  paymentRows as demoPaymentRows,
  schedule as demoSchedule,
  studentActionSteps as demoStudentActionSteps,
  students as demoStudents,
  studentWeeklyNote as demoStudentWeeklyNote,
  teacherFollowUpItems as demoTeacherFollowUpItems,
} from "./demoData";
import type {
  OverviewStat,
  OverviewStatTemplate,
  OverviewStatValue,
} from "./demoData";
export type {
  ActiveConversation,
  AdminFollowUpNote,
  AdminOverviewHeader,
  AssessmentFollowUp,
  AssessmentHeaderInfo,
  AssessmentSubject,
  AttendanceLessonInfo,
  AutomationActivity,
  CommunicationItem,
  ConversationMessage,
  OverviewStat,
  OverviewStatTemplate,
  OverviewStatValue,
  ParentCommunicationItem,
  ParentProgressSummary,
  ReportActionItem,
  StudentActionStep,
  StudentWeeklyNote,
  TeacherFollowUpItem,
} from "./demoData";

/**
 * Eğitim ekranlarının veri kaynağı.
 *
 * v1.3-01 (A, B ve C parçaları) ile `classes`, `students`, `schedule` ve `attendance` gerçek servislere bağlandı
 * (`studentService`, `classService`, `scheduleService`, `attendanceService`). Bu ihraçlar demo modu ve henüz servise
 * bağlanmamış bileşenler için geriye dönük uyumluluk sağlar.
 */
export const classes = isDemoMode ? demoClasses : [];
export const dayPlanEventsByRole = isDemoMode
  ? demoDayPlanEventsByRole
  : { admin: [], teacher: [] };
export const paymentRows = isDemoMode ? demoPaymentRows : [];
export const schedule = isDemoMode ? demoSchedule : [];
export const students = isDemoMode ? demoStudents : [];
export const organizationMembers = isDemoMode ? demoOrganizationMembers : [];

export const initialAttendances = isDemoMode ? demoInitialAttendances : {};
export const initialAutomations = isDemoMode ? demoInitialAutomations : [];
export const initialHomework = isDemoMode ? demoInitialHomework : [];
export const dayPlanTasksByRole = isDemoMode
  ? demoDayPlanTasksByRole
  : { admin: [], teacher: [] };

export const adminOverviewHeader = isDemoMode
  ? demoAdminOverviewHeader
  : {
      subtitle:
        "Aday kayıtları, dersler, yoklamalar ve veli takipleri tek çalışma alanında toplanır.",
    };

export const adminOverviewStatTemplates: OverviewStatTemplate[] = [
  {
    key: "active-students",
    label: "Aktif öğrenci",
    icon: Users,
    emptyValue: "0",
    emptyDetail: "0 sınıfta kayıtlı",
  },
  {
    key: "today-attendance",
    label: "Bugünkü devam",
    icon: ClipboardCheck,
    tone: "green",
    emptyValue: "—",
    emptyDetail: "0 yoklama tamamlandı",
  },
  {
    key: "follow-up",
    label: "Takip gerekli",
    icon: CircleAlert,
    tone: "amber",
    emptyValue: "0",
    emptyDetail: "Akademik veya devam sinyali",
  },
  {
    key: "upcoming-payment",
    label: "Yaklaşan tahsilat",
    icon: WalletCards,
    tone: "violet",
    emptyValue: "₺0",
    emptyDetail: "Bu hafta vadesi gelen taksit yok",
  },
  {
    key: "active-automations",
    label: "Çalışan otomasyon",
    icon: Sparkles,
    tone: "blue",
    emptyValue: "0",
    emptyDetail: "Son 24 saatte 0 işlem",
  },
];

export const teacherOverviewStatTemplates: OverviewStatTemplate[] = [
  {
    key: "today-lessons",
    label: "Bugünkü ders",
    icon: CalendarDays,
    emptyValue: "0",
    emptyDetail: "İlk ders —",
  },
  {
    key: "class-average",
    label: "Sınıf ortalaması",
    icon: BarChart3,
    tone: "violet",
    emptyValue: "—",
    emptyDetail: "Değerlendirilmiş deneme yok",
  },
  {
    key: "pending-homework",
    label: "Teslim bekleyen",
    icon: BookOpen,
    tone: "amber",
    emptyValue: "0",
    emptyDetail: "Teslim bekleyen ödev yok",
  },
  {
    key: "follow-up-recommendation",
    label: "Takip önerisi",
    icon: CircleAlert,
    tone: "rose",
    emptyValue: "0",
    emptyDetail: "Rehberlik görüşmesi",
  },
];

export const studentOverviewStatTemplates: OverviewStatTemplate[] = [
  {
    key: "today-lessons",
    label: "Bugünkü ders",
    icon: CalendarDays,
    emptyValue: "0",
    emptyDetail: "İlk ders —",
  },
  {
    key: "completed-homework",
    label: "Tamamlanan ödev",
    icon: Check,
    tone: "green",
    emptyValue: "0/0",
    emptyDetail: "Bu hafta",
  },
  {
    key: "last-exam",
    label: "Son deneme",
    icon: BarChart3,
    tone: "violet",
    emptyValue: "—",
    emptyDetail: "Gelişim sinyali yok",
  },
  {
    key: "attendance",
    label: "Devam",
    icon: ClipboardCheck,
    tone: "blue",
    emptyValue: "—",
    emptyDetail: "Bu dönem",
  },
];

export const parentOverviewStatTemplates: OverviewStatTemplate[] = [
  {
    key: "attendance",
    label: "Devam",
    icon: ClipboardCheck,
    tone: "green",
    emptyValue: "—",
    emptyDetail: "Bu dönem",
  },
  {
    key: "last-exam",
    label: "Son deneme",
    icon: BarChart3,
    tone: "violet",
    emptyValue: "—",
    emptyDetail: "Gelişim sinyali yok",
  },
  {
    key: "upcoming-lesson",
    label: "Yaklaşan ders",
    icon: CalendarDays,
    emptyValue: "—",
    emptyDetail: "Planlanan ders yok",
  },
  {
    key: "payment-plan",
    label: "Ödeme planı",
    icon: WalletCards,
    tone: "green",
    emptyValue: "—",
    emptyDetail: "Vadesi gelen taksit yok",
  },
];

export const paymentOverviewStatTemplates: OverviewStatTemplate[] = [
  {
    key: "monthly-collection",
    label: "Bu ay tahsilat",
    icon: WalletCards,
    tone: "green",
    emptyValue: "₺0",
    emptyDetail: "Vadesi gelen taksit yok",
  },
  {
    key: "upcoming-installments",
    label: "Yaklaşan taksit",
    icon: Clock3,
    tone: "amber",
    emptyValue: "0",
    emptyDetail: "Önümüzdeki 7 gün",
  },
  {
    key: "follow-up-payments",
    label: "Takip gereken",
    icon: CircleAlert,
    tone: "rose",
    emptyValue: "0",
    emptyDetail: "Takip gereken ödeme yok",
  },
];

export function buildStatCards(
  templates: OverviewStatTemplate[],
  demoValues: Record<string, OverviewStatValue> | null
): OverviewStat[] {
  return templates.map(tmpl => {
    const demo = demoValues?.[tmpl.key];
    return {
      label: tmpl.label,
      value: demo ? demo.value : tmpl.emptyValue,
      detail:
        demo && demo.detail !== undefined ? demo.detail : tmpl.emptyDetail,
      icon: tmpl.icon,
      tone: tmpl.tone,
    };
  });
}

/**
 * Ödeme genel bakış sayılarını şablonlarla eşleyerek yönetici kartlarına dönüştürür (v1.3-01e · 3.E).
 *
 * counts null ise (yetkisiz çağırana satır dönmemesi veya taksit olmaması) boş dizi döner ve kartlar çizilmez (K-22).
 * Üretimde "Planlanan tahsilatın %82'si" gibi tanımsız alt metinler üretilmez, şablonun emptyDetail'i kullanılır (#239, K-03).
 */
export function buildPaymentStats(
  counts: PaymentOverviewCounts | null
): OverviewStat[] {
  if (!counts) {
    return [];
  }

  // 2026-09-29: alt metin sayının ne olduğunu söyler; "…yok" yalnız sayı
  // gerçekten sıfırken. Eskiden şablonun boş metni gerçek sayıyla birlikte
  // basılıyordu: "2 · Takip gereken ödeme yok" gibi kendiyle çelişen kartlar
  // (K-03). Uydurulmuş bir oran ("%82") hâlâ üretilmez.
  return paymentOverviewStatTemplates.map(tmpl => {
    let value = tmpl.emptyValue;
    let detail = tmpl.emptyDetail;
    if (tmpl.key === "monthly-collection") {
      value = formatCurrency(counts.collectedThisMonth);
      detail =
        counts.collectedThisMonth > 0
          ? "Bu ay ödenen taksitler"
          : "Bu ay henüz ödeme yok";
    } else if (tmpl.key === "upcoming-installments") {
      value = String(counts.upcomingCount);
      detail = "Önümüzdeki 7 gün";
    } else if (tmpl.key === "follow-up-payments") {
      value = String(counts.overdueCount);
      detail =
        counts.overdueCount > 0
          ? "Vadesi geçmiş, ödenmemiş taksit"
          : tmpl.emptyDetail;
    }

    return {
      label: tmpl.label,
      value,
      detail,
      icon: tmpl.icon,
      tone: tmpl.tone,
    };
  });
}

export const adminOverviewStats = buildStatCards(
  adminOverviewStatTemplates,
  isDemoMode ? demoAdminOverviewStatValues : null
);
export const adminFollowUpNote = isDemoMode ? demoAdminFollowUpNote : null;
export const adminAutomationActivities = isDemoMode
  ? demoAdminAutomationActivities
  : [];

export const teacherOverviewStats = buildStatCards(
  teacherOverviewStatTemplates,
  isDemoMode ? demoTeacherOverviewStatValues : null
);
export const teacherFollowUpItems = isDemoMode ? demoTeacherFollowUpItems : [];

export const studentOverviewStats = buildStatCards(
  studentOverviewStatTemplates,
  isDemoMode ? demoStudentOverviewStatValues : null
);
export const studentActionSteps = isDemoMode ? demoStudentActionSteps : [];
export const studentWeeklyNote = isDemoMode ? demoStudentWeeklyNote : null;

export const parentOverviewStats = buildStatCards(
  parentOverviewStatTemplates,
  isDemoMode ? demoParentOverviewStatValues : null
);
export const parentProgressSummary = isDemoMode
  ? demoParentProgressSummary
  : null;
export const parentCommunicationItems = isDemoMode
  ? demoParentCommunicationItems
  : [];

export const attendanceLessonInfo = isDemoMode
  ? demoAttendanceLessonInfo
  : null;

export const paymentOverviewStats = buildStatCards(
  paymentOverviewStatTemplates,
  isDemoMode ? demoPaymentOverviewStatValues : null
);

export const assessmentHeaderInfo = isDemoMode
  ? demoAssessmentHeaderInfo
  : null;
export const assessmentSubjects = isDemoMode ? demoAssessmentSubjects : [];
export const assessmentFollowUp = isDemoMode ? demoAssessmentFollowUp : null;

export const communicationsList = isDemoMode ? demoCommunicationsList : [];
export const activeConversation = isDemoMode ? demoActiveConversation : null;

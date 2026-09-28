import {
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Megaphone,
  UserPlus,
  Users,
} from "lucide-react";
import { isDemoMode } from "@/auth/runtime";
import {
  useAdminOverview,
  usePaymentOverview,
  useTodayLessons,
} from "@/education/educationQueries";
import type { AdminOverviewCounts } from "@/education/overviewService";
import { ErrorState, StatCard } from "../shared";
import type { Section } from "../types";
import type { StudentFilter } from "../pages/studentFilters";
import {
  AttentionPanel,
  DemoNotice,
  LessonsPanel,
  OverviewHeader,
  QuickActions,
  StatsSkeleton,
  type AttentionItem,
  type QuickAction,
} from "./overviewParts";

/**
 * Yönetici Genel Bakış.
 *
 * Eskiden bütün kartlarını demo modülünden alıyordu ve gerçek modda her şeye
 * sıfır diyordu (ROADMAP §4.23 B3). Artık iki veritabanı fonksiyonuna bağlı
 * (`admin_overview_counts`, `today_lessons`) ve ölçülmemiş hiçbir cümle
 * kurmuyor: "Sistemler çalışıyor" gibi bir rozet, arkasında ölçüm yoksa
 * yalnız süstür (**K-03**).
 *
 * Ekranın işi sayı sergilemek değil, **yöneticiye bugün neye bakması
 * gerektiğini söylemek**. Bu yüzden ağırlık "Dikkat isteyenler" listesinde;
 * her satır sorunun çözüleceği sekmeye götürüyor.
 */

const ADMIN_ACTIONS: QuickAction[] = [
  { label: "Yoklama al", target: "Yoklama", icon: ClipboardCheck },
  { label: "Öğrenci ekle", target: "Öğrenciler", icon: UserPlus },
  { label: "Duyuru yaz", target: "İletişim", icon: Megaphone },
  { label: "Ödeme kaydet", target: "Kayıt ve Ödemeler", icon: CreditCard },
];

export function AdminDashboard({
  onNavigate,
  onOpenStudents,
}: {
  onNavigate: (section: Section) => void;
  onOpenStudents?: (filter: StudentFilter) => void;
}) {
  const overviewQuery = useAdminOverview({ enabled: !isDemoMode });
  const lessonsQuery = useTodayLessons({ enabled: !isDemoMode });
  const paymentQuery = usePaymentOverview({ enabled: !isDemoMode });
  const overdueInstallments = paymentQuery.data?.overdueCount ?? null;

  return (
    <>
      <OverviewHeader
        eyebrow="Kurum genel bakış"
        title="Bugün kurumda neler var?"
        description="Dikkat isteyen durumlar, bugünün dersleri ve yoklama durumu."
      />
      {isDemoMode ? (
        <DemoNotice />
      ) : (
        <>
          {overviewQuery.isPending ? (
            <StatsSkeleton />
          ) : overviewQuery.isError || !overviewQuery.data ? (
            <ErrorState
              className="mt-5"
              message="Kurum sayıları alınamadı."
              onRetry={() => void overviewQuery.refetch()}
            />
          ) : (
            <AdminStats
              counts={overviewQuery.data}
              overdueInstallments={overdueInstallments}
            />
          )}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <AttentionPanel
              items={
                overviewQuery.data
                  ? adminAttentionItems(overviewQuery.data, overdueInstallments)
                  : null
              }
              isPending={overviewQuery.isPending}
              isError={overviewQuery.isError}
              onNavigate={onNavigate}
              onOpenStudents={onOpenStudents}
            />
            <QuickActions actions={ADMIN_ACTIONS} onNavigate={onNavigate} />
          </div>
          <LessonsPanel
            title="Bugünün dersleri"
            emptyTitle="Bugün programda ders yok"
            lessons={lessonsQuery.data}
            isPending={lessonsQuery.isPending}
            isError={lessonsQuery.isError}
            onRetry={() => void lessonsQuery.refetch()}
            showTeacher
            onNavigate={onNavigate}
          />
        </>
      )}
    </>
  );
}

function AdminStats({
  counts,
  overdueInstallments,
}: {
  counts: AdminOverviewCounts;
  overdueInstallments: number | null;
}) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Aktif öğrenci"
        value={String(counts.activeStudents)}
        icon={Users}
        tone="blue"
      />
      <StatCard
        label="Aktif sınıf"
        value={String(counts.activeClasses)}
        icon={GraduationCap}
        tone="violet"
      />
      <StatCard
        label="Bugünkü ders"
        value={String(counts.lessonsToday)}
        icon={CalendarClock}
        tone="green"
      />
      <StatCard
        label="Vadesi geçmiş taksit"
        // Ödeme sayısı alınamadıysa sıfır yazılmaz; "—" bilinmediğini söyler.
        value={overdueInstallments === null ? "—" : String(overdueInstallments)}
        icon={CreditCard}
        tone={overdueInstallments ? "rose" : "amber"}
      />
    </div>
  );
}

function adminAttentionItems(
  counts: AdminOverviewCounts,
  overdueInstallments: number | null
): AttentionItem[] {
  const items: AttentionItem[] = [
    {
      count: counts.lessonsMissingAttendanceToday,
      label: "dersin bugünkü yoklaması alınmadı",
      hint: "Yoklama her ders için ayrı alınır",
      target: "Yoklama",
    },
    {
      count: counts.studentsWithoutClass,
      label: "öğrenci hiçbir sınıfa kayıtlı değil",
      hint: "Sınıfa atanmayan öğrenci programda görünmez",
      target: "Öğrenciler",
      studentFilter: "no-class",
    },
    {
      count: counts.studentsWithoutGuardian,
      label: "öğrencinin velisi bağlanmamış",
      hint: "Veli bildirim ve duyuru alamaz",
      target: "Öğrenciler",
      studentFilter: "no-guardian",
    },
  ];
  // Ödeme sayısı ayrı sorgudan gelir; alınamadıysa (`null`) satır çizilmez.
  if (overdueInstallments !== null) {
    items.push({
      count: overdueInstallments,
      label: "taksitin vadesi geçti",
      hint: "Ödenmemiş ve son günü geçmiş",
      target: "Kayıt ve Ödemeler",
    });
  }
  return items;
}

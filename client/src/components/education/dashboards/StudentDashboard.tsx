import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Megaphone,
  NotebookPen,
  Trophy,
  UserX,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import {
  useStudentLessonsToday,
  useStudentOverview,
  useStudentUpcomingHomework,
  useStudents,
} from "@/education/educationQueries";
import type { StudentOverview } from "@/education/overviewService";
import { formatTrDate } from "@/education/trDate";
import { EmptyState, ErrorState, StatCard } from "../shared";
import type { Section } from "../types";
import {
  AttentionPanel,
  DemoNotice,
  HomeworkPanel,
  LessonsPanel,
  OverviewHeader,
  QuickActions,
  StatsSkeleton,
  type AttentionItem,
  type QuickAction,
} from "./overviewParts";

/**
 * Öğrenci Genel Bakış.
 *
 * Eskiden kartları, "Sıradaki adımlar"ı ve "haftalık not"u demo modülünden
 * alıyordu ve başlığı, kimse bir plan hazırlamamışken "bugün planınız hazır"
 * diyordu (**K-03**). Artık `student_overview_counts`,
 * `student_upcoming_homework` ve `student_lessons_today`'e bağlı
 * (`20261003000000`).
 *
 * Fonksiyonlar öğrenci kimliği alıyor; veli ekranı aynılarını çocuğun
 * kimliğiyle çağıracak. Öğrencinin kendi kaydı öğrenci listesinden gelir —
 * RLS o listeyi öğrenciye yalnız kendisi olarak döndürür.
 */

const STUDENT_ACTIONS: QuickAction[] = [
  { label: "Ders programım", target: "Ders Programı", icon: CalendarDays },
  { label: "Ödevlerim", target: "Ödevler", icon: NotebookPen },
  { label: "Sınavlarım", target: "Sınavlar", icon: Trophy },
  { label: "Duyurular", target: "İletişim", icon: Megaphone },
];

export function StudentDashboard({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const { identity } = useAuth();
  const firstName = identity?.displayName?.trim()
    ? identity.displayName.trim().split(" ")[0]
    : null;

  return (
    <>
      <OverviewHeader
        eyebrow="Kişisel çalışma alanı"
        title={firstName ? `Merhaba ${firstName}` : "Merhaba"}
        description="Bugünkü derslerin, yaklaşan ödevlerin ve son durumun."
      />
      {isDemoMode ? (
        <DemoNotice />
      ) : (
        <StudentOverviewBody onNavigate={onNavigate} />
      )}
    </>
  );
}

function StudentOverviewBody({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const studentsQuery = useStudents();
  const studentId = studentsQuery.data?.rows[0]?.id ?? null;
  const overviewQuery = useStudentOverview({ studentId });
  const lessonsQuery = useStudentLessonsToday({ studentId });
  const homeworkQuery = useStudentUpcomingHomework({ studentId });

  if (studentsQuery.isPending) return <StatsSkeleton />;
  if (studentsQuery.isError) {
    return (
      <ErrorState
        className="mt-5"
        message="Öğrenci kaydınız alınamadı."
        onRetry={() => void studentsQuery.refetch()}
      />
    );
  }
  if (!studentId) {
    // Hesap var ama bir öğrenci kaydına bağlı değil. Sayı uydurulmaz.
    return (
      <div className="mt-5">
        <EmptyState
          title="Hesabınız bir öğrenci kaydına bağlı değil"
          description="Kurumunuzun yöneticisi hesabınızı öğrenci kaydınıza bağladığında bilgileriniz burada görünür."
        />
      </div>
    );
  }

  return (
    <>
      {overviewQuery.isPending ? (
        <StatsSkeleton />
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <ErrorState
          className="mt-5"
          message="Sayılar alınamadı."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : (
        <StudentStats overview={overviewQuery.data} />
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <AttentionPanel
          items={
            overviewQuery.data
              ? studentAttentionItems(overviewQuery.data)
              : null
          }
          isPending={overviewQuery.isPending}
          isError={overviewQuery.isError}
          onNavigate={onNavigate}
        />
        <QuickActions actions={STUDENT_ACTIONS} onNavigate={onNavigate} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <LessonsPanel
          title="Bugünkü derslerim"
          emptyTitle="Bugün programda dersin yok"
          lessons={lessonsQuery.data}
          isPending={lessonsQuery.isPending}
          isError={lessonsQuery.isError}
          onRetry={() => void lessonsQuery.refetch()}
          showTeacher
          showAttendance={false}
          onNavigate={onNavigate}
        />
        <div className="xl:mt-6">
          <HomeworkPanel
            homework={homeworkQuery.data}
            isPending={homeworkQuery.isPending}
            isError={homeworkQuery.isError}
            onRetry={() => void homeworkQuery.refetch()}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </>
  );
}

function StudentStats({ overview }: { overview: StudentOverview }) {
  const exam = overview.latestExam;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Bugünkü ders"
        value={String(overview.lessonsToday)}
        icon={CalendarClock}
        tone="green"
      />
      <StatCard
        label="Bu hafta teslim"
        value={String(overview.homeworkDueThisWeek)}
        detail="Önümüzdeki 7 gün"
        icon={ClipboardList}
        tone="violet"
      />
      <StatCard
        label="Devamsızlık"
        value={`${overview.absentCount} gün`}
        detail={
          overview.lateCount > 0
            ? `${overview.lateCount} kez geç kaldı`
            : undefined
        }
        icon={UserX}
        tone={overview.absentCount > 0 ? "amber" : "blue"}
      />
      <StatCard
        label="Son sınav"
        // Sonuç yoksa puan uydurulmaz; "—" henüz sınav olmadığını söyler.
        value={
          exam
            ? exam.maxScore
              ? `${formatScore(exam.score)} / ${formatScore(exam.maxScore)}`
              : formatScore(exam.score)
            : "—"
        }
        detail={exam ? `${exam.name} · ${formatTrDate(exam.date)}` : undefined}
        icon={Trophy}
        tone="blue"
      />
    </div>
  );
}

function studentAttentionItems(overview: StudentOverview): AttentionItem[] {
  return [
    {
      count: overview.homeworkDueSoon,
      label: "ödevin teslimi bugün ya da yarın",
      hint: "Teslim tarihi yaklaşan ödevler",
      target: "Ödevler",
    },
    {
      count: overview.homeworkMissed,
      label: "ödev getirilmedi olarak işaretlendi",
      hint: "Öğretmenin kontrolünü bitirdiği ödevler",
      target: "Ödevler",
    },
  ];
}

/** Puan Türkçe ondalıkla yazılır: 87,5 — 87.5 değil. */
function formatScore(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

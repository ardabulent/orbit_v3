import { CalendarClock, ClipboardList, Trophy, UserX } from "lucide-react";
import {
  useStudentLessonsToday,
  useStudentOverview,
  useStudentUpcomingHomework,
} from "@/education/educationQueries";
import type { StudentOverview } from "@/education/overviewService";
import { formatTrDate } from "@/education/trDate";
import { ErrorState, StatCard } from "../shared";
import type { Section } from "../types";
import {
  AttentionPanel,
  HomeworkPanel,
  LessonsPanel,
  QuickActions,
  StatsSkeleton,
  type AttentionItem,
  type QuickAction,
} from "./overviewParts";

/**
 * Bir öğrencinin Genel Bakış gövdesi — öğrenci kendisi için, veli seçili
 * çocuğu için aynı gövdeyi çizer. Sayılar tek yerden gelir
 * (`student_overview_counts` ve eşleri, `20261003000000`); iki ekran ayrı
 * yazılsaydı biri düzeltilip diğeri eskirdi (**K-06**).
 *
 * Rol farkı yalnız dışarıdan verilenlerde: hızlı işlemler, ders başlığı ve
 * velinin ödeme satırı gibi ek dikkat satırları.
 */
export function StudentOverviewSections({
  studentId,
  actions,
  lessonsTitle,
  emptyLessonsTitle,
  extraAttention,
  onNavigate,
}: {
  studentId: string;
  actions: QuickAction[];
  lessonsTitle: string;
  emptyLessonsTitle: string;
  /** Rolün eklediği dikkat satırları (veli: vadesi geçmiş taksit). */
  extraAttention?: AttentionItem[];
  onNavigate: (section: Section) => void;
}) {
  const overviewQuery = useStudentOverview({ studentId });
  const lessonsQuery = useStudentLessonsToday({ studentId });
  const homeworkQuery = useStudentUpcomingHomework({ studentId });

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
              ? [
                  ...studentAttentionItems(overviewQuery.data),
                  ...(extraAttention ?? []),
                ]
              : null
          }
          isPending={overviewQuery.isPending}
          isError={overviewQuery.isError}
          onNavigate={onNavigate}
        />
        <QuickActions actions={actions} onNavigate={onNavigate} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <LessonsPanel
          title={lessonsTitle}
          emptyTitle={emptyLessonsTitle}
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

export function StudentStats({
  overview,
  className = "mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
}: {
  overview: StudentOverview;
  /** Dar yerlerde (öğrenci profili paneli) ızgara iki sütuna iner. */
  className?: string;
}) {
  const exam = overview.latestExam;
  return (
    <div className={className}>
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

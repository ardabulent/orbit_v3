import {
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Megaphone,
  NotebookPen,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import {
  useMyLessonsToday,
  useTeacherOverview,
} from "@/education/educationQueries";
import type { TeacherOverviewCounts } from "@/education/overviewService";
import { ErrorState, StatCard } from "../shared";
import type { Section } from "../types";
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
 * Öğretmen Genel Bakış.
 *
 * Eskiden kartları ve "Takip önerileri" demo modülünden geliyordu; "Bugünün
 * dersleri" haftanın gününe bakmadan bütün programı listeliyor ve her satıra
 * "Yoklama ders başlangıcında açılacak" yazıyordu — böyle bir otomatik
 * açılma yok (**K-03**). Artık `teacher_overview_counts` ve
 * `my_lessons_today`'e bağlı (`20261002000000`).
 *
 * Öğretmen yalnız **kendi** derslerini görür (karar 2026-09-27); sınıfının
 * başka öğretmenlere ait dersleri bu listede yok.
 */

const TEACHER_ACTIONS: QuickAction[] = [
  { label: "Yoklama al", target: "Yoklama", icon: ClipboardCheck },
  { label: "Ödev ver", target: "Ödevler", icon: NotebookPen },
  { label: "Duyuru yaz", target: "İletişim", icon: Megaphone },
  { label: "Sınav sonucu gir", target: "Sınavlar", icon: Trophy },
];

export function TeacherDashboard({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const { identity } = useAuth();
  const firstName = identity?.displayName?.trim()
    ? identity.displayName.trim().split(" ")[0]
    : null;
  const overviewQuery = useTeacherOverview({ enabled: !isDemoMode });
  const lessonsQuery = useMyLessonsToday({ enabled: !isDemoMode });

  return (
    <>
      <OverviewHeader
        eyebrow="Öğretmen çalışma alanı"
        title={
          firstName
            ? `Merhaba ${firstName}, bugün sizi neler bekliyor?`
            : "Bugün sizi neler bekliyor?"
        }
        description="Bugünkü dersleriniz, yoklama durumu ve kontrol bekleyen ödevler."
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
              message="Sayılar alınamadı."
              onRetry={() => void overviewQuery.refetch()}
            />
          ) : (
            <TeacherStats counts={overviewQuery.data} />
          )}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <AttentionPanel
              items={
                overviewQuery.data
                  ? teacherAttentionItems(overviewQuery.data)
                  : null
              }
              isPending={overviewQuery.isPending}
              isError={overviewQuery.isError}
              onNavigate={onNavigate}
            />
            <QuickActions actions={TEACHER_ACTIONS} onNavigate={onNavigate} />
          </div>
          <LessonsPanel
            title="Bugünkü derslerim"
            emptyTitle="Bugün programda dersiniz yok"
            lessons={lessonsQuery.data}
            isPending={lessonsQuery.isPending}
            isError={lessonsQuery.isError}
            onRetry={() => void lessonsQuery.refetch()}
            showTeacher={false}
            onNavigate={onNavigate}
          />
        </>
      )}
    </>
  );
}

function TeacherStats({ counts }: { counts: TeacherOverviewCounts }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Sınıflarım"
        value={String(counts.myClasses)}
        icon={GraduationCap}
        tone="violet"
      />
      <StatCard
        label="Öğrencilerim"
        value={String(counts.myStudents)}
        icon={Users}
        tone="blue"
      />
      <StatCard
        label="Bugünkü dersim"
        value={String(counts.myLessonsToday)}
        icon={CalendarClock}
        tone="green"
      />
      <StatCard
        label="Kontrol bekleyen ödev"
        value={String(counts.homeworkAwaitingMarking)}
        icon={ClipboardList}
        tone={counts.homeworkAwaitingMarking ? "rose" : "amber"}
      />
    </div>
  );
}

function teacherAttentionItems(counts: TeacherOverviewCounts): AttentionItem[] {
  return [
    {
      count: counts.classesMissingAttendanceToday,
      label: "sınıfın bugünkü yoklaması alınmadı",
      hint: "Bugün dersiniz olan sınıflar",
      target: "Yoklama",
    },
    {
      count: counts.homeworkAwaitingMarking,
      label: "ödevin teslim kontrolü bekliyor",
      hint: "Teslim tarihi geçti, işaretleme bitirilmedi",
      target: "Ödevler",
    },
  ];
}

import { CalendarDays, Megaphone, NotebookPen, Trophy } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { useStudents } from "@/education/educationQueries";
import { EmptyState, ErrorState } from "../shared";
import type { Section } from "../types";
import {
  DemoNotice,
  OverviewHeader,
  StatsSkeleton,
  type QuickAction,
} from "./overviewParts";
import { StudentOverviewSections } from "./StudentOverviewSections";

/**
 * Öğrenci Genel Bakış.
 *
 * Eskiden kartları, "Sıradaki adımlar"ı ve "haftalık not"u demo modülünden
 * alıyordu ve başlığı, kimse bir plan hazırlamamışken "bugün planınız hazır"
 * diyordu (**K-03**). Gövde `StudentOverviewSections`'ta; veli aynı gövdeyi
 * çocuğu için çizer.
 *
 * Öğrencinin kendi kaydı öğrenci listesinden gelir — RLS o listeyi öğrenciye
 * yalnız kendisi olarak döndürür.
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
    <StudentOverviewSections
      studentId={studentId}
      actions={STUDENT_ACTIONS}
      lessonsTitle="Bugünkü derslerim"
      emptyLessonsTitle="Bugün programda dersin yok"
      onNavigate={onNavigate}
    />
  );
}

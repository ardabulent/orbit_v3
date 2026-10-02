import { CalendarDays, CreditCard, NotebookPen, Trophy } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { useStudentOverdueInstallments } from "@/education/educationQueries";
import { EmptyState, ErrorState } from "../shared";
import type { Section, Student } from "../types";
import {
  DemoNotice,
  OverviewHeader,
  StatsSkeleton,
  type AttentionItem,
  type QuickAction,
} from "./overviewParts";
import { useGuardianChild } from "../guardianChild/guardianChildState";
import { StudentOverviewSections } from "./StudentOverviewSections";

/**
 * Veli Genel Bakış.
 *
 * Eskiden kartları, "Son gelişim özeti" ve iletişim listesi demo modülünden
 * geliyordu; başlığı kimse bir şey hazırlamamışken "haftalık takip özeti
 * hazır" diyordu (**K-03**).
 *
 * Veli, çocuğu için öğrencinin gördüğü gövdenin aynısını görür
 * (`StudentOverviewSections`) ve tek bir satır fazlası: vadesi geçmiş taksit.
 * Birden fazla çocuk varsa ekran üst çubukta seçili çocuğu gösterir (karar
 * 2026-09-27; seçici 2026-10-02'de buradan üst çubuğa taşındı ve bütün veli
 * sekmeleri için ortak oldu — `guardianChild/`).
 */

const PARENT_ACTIONS: QuickAction[] = [
  { label: "Ders programı", target: "Ders Programı", icon: CalendarDays },
  { label: "Ödevler", target: "Ödevler", icon: NotebookPen },
  { label: "Sınavlar", target: "Sınavlar", icon: Trophy },
  { label: "Ödemeler", target: "Kayıt ve Ödemeler", icon: CreditCard },
];

export function ParentDashboard({
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
        eyebrow="Veli takip alanı"
        title={firstName ? `Merhaba ${firstName}` : "Merhaba"}
        description="Çocuğunuzun bugünkü dersleri, ödevleri, devamı ve ödeme durumu."
      />
      {isDemoMode ? (
        <DemoNotice />
      ) : (
        <ParentOverviewBody onNavigate={onNavigate} />
      )}
    </>
  );
}

function ParentOverviewBody({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const { children, child, isLoading, isError, retry } = useGuardianChild();

  if (isLoading && !child) return <StatsSkeleton />;
  if (isError && !child) {
    return (
      <ErrorState
        className="mt-5"
        message="Öğrenci bilgileri alınamadı."
        onRetry={retry}
      />
    );
  }
  if (!child) {
    return (
      <div className="mt-5">
        <EmptyState
          title="Hesabınıza bağlı bir öğrenci yok"
          description="Kurumunuzun yöneticisi sizi çocuğunuzun kaydına bağladığında bilgileri burada görünür."
        />
      </div>
    );
  }

  return (
    <ChildOverview
      key={child.id}
      child={child}
      showName={children.length > 1}
      onNavigate={onNavigate}
    />
  );
}

function ChildOverview({
  child,
  showName,
  onNavigate,
}: {
  child: Student;
  showName: boolean;
  onNavigate: (section: Section) => void;
}) {
  const overdueQuery = useStudentOverdueInstallments({ studentId: child.id });
  // Ödeme bilinmiyorsa (plan yok, hata) satır eklenmez; sıfır uydurulmaz.
  const extraAttention: AttentionItem[] =
    typeof overdueQuery.data === "number"
      ? [
          {
            count: overdueQuery.data,
            label: "taksitin vadesi geçti",
            hint: "Ödenmemiş ve son günü geçmiş",
            target: "Kayıt ve Ödemeler",
          },
        ]
      : [];
  const firstName = child.name.trim().split(" ")[0];

  return (
    <StudentOverviewSections
      studentId={child.id}
      actions={PARENT_ACTIONS}
      lessonsTitle={
        showName ? `${firstName} · bugünkü dersler` : "Bugünkü dersleri"
      }
      emptyLessonsTitle="Bugün programda ders yok"
      extraAttention={extraAttention}
      onNavigate={onNavigate}
    />
  );
}

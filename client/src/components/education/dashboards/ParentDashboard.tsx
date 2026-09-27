import { useState } from "react";
import { CalendarDays, CreditCard, NotebookPen, Trophy } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import {
  useStudentOverdueInstallments,
  useStudents,
} from "@/education/educationQueries";
import { EmptyState, ErrorState } from "../shared";
import type { Section, Student } from "../types";
import {
  DemoNotice,
  OverviewHeader,
  StatsSkeleton,
  type AttentionItem,
  type QuickAction,
} from "./overviewParts";
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
 * Birden fazla çocuk varsa üstte adlarıyla bir seçici çıkar, ekran seçili
 * çocuğu gösterir (karar 2026-09-27). Çocuk listesi öğrenci listesinden gelir
 * — RLS o listeyi veliye yalnız bağlı olduğu öğrenciler olarak döndürür.
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
  const studentsQuery = useStudents();
  const children = studentsQuery.data?.rows ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Seçim listede yoksa (ilk açılış, kurum değişimi) ilk çocuğa düşülür.
  const child =
    children.find(candidate => candidate.id === selectedId) ??
    children[0] ??
    null;

  if (studentsQuery.isPending) return <StatsSkeleton />;
  if (studentsQuery.isError) {
    return (
      <ErrorState
        className="mt-5"
        message="Öğrenci bilgileri alınamadı."
        onRetry={() => void studentsQuery.refetch()}
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
    <>
      {children.length > 1 ? (
        <ChildPicker
          childrenList={children}
          selectedId={child.id}
          onSelect={setSelectedId}
        />
      ) : null}
      <ChildOverview
        key={child.id}
        child={child}
        showName={children.length > 1}
        onNavigate={onNavigate}
      />
    </>
  );
}

function ChildPicker({
  childrenList,
  selectedId,
  onSelect,
}: {
  childrenList: Student[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Çocuk seçimi"
      className="mt-5 flex flex-wrap gap-2"
    >
      {childrenList.map(candidate => {
        const selected = candidate.id === selectedId;
        return (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(candidate.id)}
            className={`rounded-full px-4 py-2 transition ${
              selected
                ? "bg-slate-900 text-white shadow-[0_4px_12px_rgba(15,23,42,.12)]"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <span className="text-[12px] font-bold">{candidate.name}</span>
          </button>
        );
      })}
    </div>
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

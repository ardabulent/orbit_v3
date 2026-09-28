import { ChevronRight, School } from "lucide-react";
import { isDemoMode } from "@/auth/runtime";
import { filterClassesForRole } from "../scopeFilters";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from "../shared";
import type { ClassGroup, Role } from "../types";
import { summaryFor, type ClassSummary } from "./classSummaries";
import { TodayAttendanceBadge } from "./TodayAttendanceBadge";

/**
 * Sınıflar listesi.
 *
 * Kart artık tıklanabilir ve sınıf detay panelini açar (karar 2026-09-28);
 * öğrenci ekleme, öğretmen atama, düzenleme ve arşivleme o panelde. Eskiden
 * karttaki "Detay" düğmesi yalnız Öğrenciler sekmesine gidiyordu ve liste
 * o sınıfa süzülmüyordu.
 *
 * Karttaki özet (haftalık ders, dersler ve öğretmenleri, bugünkü yoklama)
 * ders programından ve bugünün derslerinden türetilir (`classSummaries`).
 */
export function ClassesPage({
  role,
  classes: classList,
  isLoading = false,
  error = null,
  onRetry,
  truncated = false,
  limit,
  onAdd,
  onOpen,
  summaries = new Map(),
}: {
  role: Role;
  classes: ClassGroup[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  truncated?: boolean;
  /** Üst sınırın tek kaynağı servistedir; bant onu tekrar etmez, gösterir (K-06). */
  limit?: number;
  onAdd?: () => void;
  onOpen: (cls: ClassGroup) => void;
  /** Platformdan gelir (`buildClassSummaries`); panel de aynısını kullanır. */
  summaries?: Map<string, ClassSummary>;
}) {
  const shown = filterClassesForRole(classList, role, isDemoMode);
  return (
    <>
      <PageHeader
        eyebrow="Akademik organizasyon"
        title="Sınıflar ve gruplar"
        description="Sınıfların öğrencilerini, derslerini ve bugünkü yoklamasını izleyin. Ayrıntı için sınıfa tıklayın."
        action={role === "admin" ? "Yeni sınıf" : undefined}
        onAction={role === "admin" ? onAdd : undefined}
      />
      {truncated ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800">
          Liste üst sınıra ({limit} kayıt) ulaştı.
        </div>
      ) : null}
      {isLoading ? (
        <TableSkeleton rows={4} columns={3} className="mt-6" />
      ) : error ? (
        <ErrorState
          className="mt-6"
          title="Sınıflar görüntülenemedi"
          message={error.message}
          onRetry={onRetry}
        />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.length === 0 ? (
            <EmptyState title="Gösterilecek sınıf yok" />
          ) : null}
          {shown.map(group => (
            <ClassCard
              key={group.id}
              group={group}
              summary={summaryFor(summaries, group.id)}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ClassCard({
  group,
  summary,
  onOpen,
}: {
  group: ClassGroup;
  summary: ClassSummary;
  onOpen: (cls: ClassGroup) => void;
}) {
  const hasCapacity = group.capacity !== null && group.capacity !== undefined;
  const isFull = hasCapacity && group.studentCount >= (group.capacity ?? 0);
  const fill = hasCapacity
    ? Math.min(
        100,
        Math.round((group.studentCount / (group.capacity || 1)) * 100)
      )
    : null;
  const shownSubjects = summary.subjects.slice(0, 3);
  const moreSubjects = summary.subjects.length - shownSubjects.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(group)}
      aria-label={`${group.name} sınıf detayını aç`}
      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_4px_16px_rgba(15,23,42,.025)] transition hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(15,23,42,.06)]"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <School className="h-5 w-5" />
        </span>
        <span className="flex flex-wrap justify-end gap-1.5">
          {isFull ? <Badge tone="amber">Kontenjan dolu</Badge> : null}
          <TodayAttendanceBadge today={summary.today} />
        </span>
      </span>
      <span className="mt-4 block font-display text-[18px] font-extrabold tracking-[-.035em] text-slate-900">
        {group.name}
      </span>
      <span className="mt-1 block text-[11px] text-slate-500">
        {[group.branch, group.program].filter(Boolean).join(" · ") || "—"}
      </span>

      <span className="mt-4 block text-[11px] text-slate-500">
        Rehber:{" "}
        <span className="font-bold text-slate-700">
          {group.mentor ?? "atanmadı"}
        </span>
      </span>

      <span className="mt-3 block">
        <span className="flex justify-between text-[11px]">
          <span className="text-slate-400">Öğrenci</span>
          <span className="font-bold text-slate-700">
            {hasCapacity
              ? `${group.studentCount}/${group.capacity}`
              : group.studentCount}
          </span>
        </span>
        {fill !== null ? (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
            <span
              style={{ width: `${fill}%` }}
              className={`block h-full rounded-full ${isFull ? "bg-amber-400" : "bg-blue-500"}`}
            />
          </span>
        ) : null}
      </span>

      <span className="mt-4 flex flex-wrap gap-1.5">
        {shownSubjects.length === 0 ? (
          <span className="text-[11px] text-slate-400">Ders programı boş</span>
        ) : (
          shownSubjects.map(subject => (
            <Badge key={`${subject.title}-${subject.teacher}`} tone="blue">
              {subject.teacher
                ? `${subject.title} · ${subject.teacher}`
                : subject.title}
            </Badge>
          ))
        )}
        {moreSubjects > 0 ? <Badge tone="slate">+{moreSubjects}</Badge> : null}
      </span>

      <span className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
        <span className="text-slate-500">
          Haftada {summary.weeklyLessons} ders
        </span>
        <span className="flex items-center gap-1 font-bold text-blue-600">
          Ayrıntılar <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

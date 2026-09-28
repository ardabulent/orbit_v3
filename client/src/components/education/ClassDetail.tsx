import { X } from "lucide-react";
import {
  useClassEnrollments,
  useClassTeachers,
} from "@/education/educationQueries";
import { Badge, CardSkeleton, ErrorState } from "./shared";
import type { ClassGroup, Role, ScheduleItem } from "./types";
import { TodayAttendanceBadge } from "./pages/TodayAttendanceBadge";
import type { ClassSummary } from "./pages/classSummaries";

/**
 * Sınıf detayı — sağdan açılan panel (karar 2026-09-28; öğrenci profiliyle
 * aynı düzen).
 *
 * Kartta sıkışan işlemler buraya taşındı: öğrenci ekleme, öğretmen atama,
 * düzenleme, arşivleme. Öğretmen paneli açar ama yalnız okur.
 *
 * Program bölümü ders programından gelir ve iki rolde aynıdır. Öğretmen
 * atamaları (`class_teachers`) yalnız yöneticide gösterilir: öğretmen o
 * tabloda yalnız kendi atamasını görebiliyor, eksik bir liste yanıltırdı.
 */
export function ClassDetail({
  cls,
  role,
  summary,
  lessons,
  onClose,
  onOpenStudent,
  onManageEnrollments,
  onManageTeachers,
  onEdit,
  onArchive,
}: {
  cls: ClassGroup;
  role: Role;
  summary: ClassSummary;
  /** Bu sınıfın ders programı satırları. */
  lessons: ScheduleItem[];
  onClose: () => void;
  onOpenStudent?: (studentId: string) => void;
  onManageEnrollments?: (cls: ClassGroup) => void;
  onManageTeachers?: (cls: ClassGroup) => void;
  onEdit?: (cls: ClassGroup) => void;
  onArchive?: (cls: ClassGroup) => void;
}) {
  const isAdmin = role === "admin";
  const enrollmentsQuery = useClassEnrollments(cls.id);
  const teachersQuery = useClassTeachers(cls.id, { enabled: isAdmin });

  const hasCapacity = cls.capacity !== null && cls.capacity !== undefined;
  const sortedLessons = [...lessons].sort(
    (a, b) =>
      (a.dayOfWeek ?? 8) - (b.dayOfWeek ?? 8) ||
      (a.time ?? "").localeCompare(b.time ?? "")
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${cls.name} sınıf detayı`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Sınıf detayını kapat"
        className="absolute inset-0"
      />
      <aside className="relative h-full w-full max-w-[520px] overflow-y-auto bg-white p-6 shadow-2xl sm:rounded-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-blue-600">
          Sınıf
        </p>
        <h2 className="mt-1 pr-10 font-display text-[22px] font-extrabold tracking-[-.04em] text-slate-900">
          {cls.name}
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">
          {[
            cls.branch,
            cls.program,
            cls.mentor ? `Rehber: ${cls.mentor}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="slate">
            {hasCapacity
              ? `${cls.studentCount}/${cls.capacity} öğrenci`
              : `${cls.studentCount} öğrenci`}
          </Badge>
          <Badge tone="slate">Haftada {summary.weeklyLessons} ders</Badge>
          <TodayAttendanceBadge today={summary.today} />
        </div>

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {onManageEnrollments ? (
              <PanelAction onClick={() => onManageEnrollments(cls)}>
                Öğrenci ekle / çıkar
              </PanelAction>
            ) : null}
            {onManageTeachers ? (
              <PanelAction onClick={() => onManageTeachers(cls)}>
                Öğretmen ata
              </PanelAction>
            ) : null}
            {onEdit ? (
              <PanelAction onClick={() => onEdit(cls)}>Düzenle</PanelAction>
            ) : null}
            {onArchive ? (
              <PanelAction tone="rose" onClick={() => onArchive(cls)}>
                Arşivle
              </PanelAction>
            ) : null}
          </div>
        ) : null}

        <Section title="Öğrenciler">
          {enrollmentsQuery.isPending ? (
            <CardSkeleton />
          ) : enrollmentsQuery.isError ? (
            <ErrorState
              message="Öğrenci listesi alınamadı."
              onRetry={() => void enrollmentsQuery.refetch()}
            />
          ) : (enrollmentsQuery.data ?? []).length === 0 ? (
            <Empty>Bu sınıfta henüz öğrenci yok.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(enrollmentsQuery.data ?? []).map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenStudent?.(item.studentId)}
                    disabled={!onOpenStudent}
                    className="flex w-full items-center justify-between py-2 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="text-[12px] font-semibold text-slate-800">
                      {item.studentName ?? "adı okunamadı"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.studentNumber ?? ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Haftalık program">
          {sortedLessons.length === 0 ? (
            <Empty>Bu sınıfın ders programı boş.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedLessons.map((lesson, index) => (
                <li
                  key={lesson.id ?? `${lesson.day}-${lesson.time}-${index}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="w-24 shrink-0 text-[11px] font-bold text-slate-500">
                    {lesson.day} {lesson.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-800">
                    {lesson.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {lesson.teacher ?? "Öğretmensiz"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {isAdmin ? (
          <Section title="Öğretmen atamaları">
            {teachersQuery.isPending ? (
              <CardSkeleton />
            ) : teachersQuery.isError ? (
              <ErrorState
                message="Öğretmen atamaları alınamadı."
                onRetry={() => void teachersQuery.refetch()}
              />
            ) : (teachersQuery.data?.rows ?? []).length === 0 ? (
              <Empty>Bu sınıfa henüz öğretmen atanmadı.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(teachersQuery.data?.rows ?? []).map(item => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-[12px] font-semibold text-slate-800">
                      {item.subjectName ?? "Ders"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {item.teacherName ?? "adı okunamadı"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 p-4">
      <h3 className="mb-2 text-[12px] font-extrabold text-slate-800">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-400">{children}</p>;
}

function PanelAction({
  children,
  onClick,
  tone = "slate",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "slate" | "rose";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 transition ${
        tone === "rose"
          ? "border-rose-200 text-rose-600 hover:bg-rose-50"
          : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="text-[11px] font-bold">{children}</span>
    </button>
  );
}

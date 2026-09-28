import { CalendarClock } from "lucide-react";
import { useStudentExams } from "@/education/educationQueries";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import { addDaysIso } from "../pages/attendanceSheet";
import { Badge, CardSkeleton, ErrorState } from "../shared";
import type { Section } from "../types";

/** Panelin ileriye baktığı gün sayısı. */
const DAYS_AHEAD = 14;

/**
 * Öğrenci ve velinin Genel Bakış'ında önümüzdeki 14 günün sınavları
 * (karar 2026-09-28). Sınav yoksa panel hiç çizilmez — boş bir kutu
 * dikkat istemez.
 */
export function UpcomingExamsPanel({
  studentId,
  onNavigate,
}: {
  studentId: string;
  onNavigate: (section: Section) => void;
}) {
  const today = getOrbitToday();
  const until = addDaysIso(today, DAYS_AHEAD);
  const query = useStudentExams({ studentId, today });

  if (query.isPending) return <CardSkeleton className="mt-6" />;
  if (query.isError)
    return (
      <ErrorState
        className="mt-6"
        message="Yaklaşan sınavlar alınamadı."
        onRetry={() => void query.refetch()}
      />
    );

  const soon = query.data.upcoming.filter(exam => exam.examDate <= until);
  if (soon.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
            Yaklaşan sınavlar
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Önümüzdeki {DAYS_AHEAD} gün
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("Sınavlar")}
          className="text-blue-600"
        >
          <span className="text-[11px] font-bold">Sınavlara git</span>
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {soon.map(exam => (
          <li
            key={exam.id}
            className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3"
          >
            <CalendarClock className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-slate-800">
                {exam.name}
              </span>
              <span className="block text-[11px] text-slate-500">
                {formatTrDate(exam.examDate)}
              </span>
            </span>
            {exam.examDate === today ? <Badge tone="amber">Bugün</Badge> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

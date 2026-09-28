import { BookOpen } from "lucide-react";
import type { TodayLesson } from "@/education/overviewService";
import { Badge, CardSkeleton, EmptyState, ErrorState } from "../shared";

/**
 * Yoklama · Bugün: günün dersleri ve her birinin yoklaması (ders başına,
 * `20261006000000`). Derse tıklamak o dersin yoklamasını açar — sınıf ve
 * tarih seçmeye gerek kalmaz.
 *
 * Öğretmen kendi derslerini (vekillik dahil, `my_lessons_today`), yönetici
 * kurumun bütün derslerini (`today_lessons`) görür; listeyi sayfa verir.
 */
export function AttendanceToday({
  lessons,
  isLoading,
  error,
  onRetry,
  showTeacher,
  canOpen,
  onOpen,
}: {
  lessons: TodayLesson[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  showTeacher: boolean;
  /** Program satırı bulunamayan ders açılamaz (`targetFromLesson`). */
  canOpen: (lesson: TodayLesson) => boolean;
  onOpen: (lesson: TodayLesson) => void;
}) {
  if (isLoading) return <CardSkeleton />;
  if (error)
    return (
      <ErrorState
        title="Yoklama bilgileri görüntülenemedi"
        message={error.message}
        onRetry={onRetry}
      />
    );
  if (lessons.length === 0)
    return (
      <EmptyState
        title="Bugün programda ders yok"
        description="Başka bir günün yoklaması için Geçmiş sekmesini kullanın."
      />
    );

  const known = lessons.filter(l => l.attendanceTaken !== null);
  const taken = known.filter(l => l.attendanceTaken).length;

  return (
    <div>
      <p className="mb-3 text-[12px] text-slate-500">
        {taken === known.length && known.length > 0
          ? "Bugünkü derslerin hepsinin yoklaması alındı."
          : `${known.length} dersten ${taken} tanesinin yoklaması alındı.`}
      </p>
      <ul className="space-y-2">
        {lessons.map(lesson => {
          const openable = lesson.attendanceTaken !== null && canOpen(lesson);
          const details = [
            showTeacher || lesson.isSubstitute ? lesson.teacher : null,
            lesson.room,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={lesson.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center"
            >
              <span className="w-24 text-[11px] font-extrabold tabular-nums text-slate-500">
                {lesson.endTime
                  ? `${lesson.time}–${lesson.endTime}`
                  : lesson.time}
              </span>
              <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 sm:grid">
                <BookOpen className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-slate-800">
                  {lesson.title}{" "}
                  <span className="font-medium text-slate-400">
                    · {lesson.className}
                  </span>
                </p>
                {details ? (
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {details}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {lesson.isSubstitute ? (
                  <Badge tone="violet">Vekil</Badge>
                ) : null}
                {lesson.attendanceTaken === true ? (
                  <Badge tone="green">Alındı</Badge>
                ) : lesson.attendanceTaken === false ? (
                  <Badge tone="amber">Bekliyor</Badge>
                ) : null}
                {openable ? (
                  <button
                    type="button"
                    onClick={() => onOpen(lesson)}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      lesson.attendanceTaken
                        ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-[11px] font-bold">
                      {lesson.attendanceTaken ? "Düzenle" : "Yoklama al"}
                    </span>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

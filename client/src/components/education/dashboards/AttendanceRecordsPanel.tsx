import type { StudentAttendanceRecord } from "@/education/attendanceService";
import { useStudentAttendanceRecords } from "@/education/educationQueries";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import { addDaysIso } from "../pages/attendanceSheet";
import { Badge, CardSkeleton, EmptyState, ErrorState } from "../shared";
import { summarizeRecords } from "./attendanceRecords";

/** Panelin kapsadığı gün sayısı. */
const ATTENDANCE_PANEL_DAYS = 30;
/** Listede gösterilen en yeni gelmedi/geç/izinli kaydı. */
const SHOWN = 8;

const LABEL = {
  present: "Katıldı",
  late: "Geç kaldı",
  absent: "Gelmedi",
  excused: "İzinli",
} as const;

const TONE = {
  present: "green",
  late: "amber",
  absent: "rose",
  excused: "blue",
} as const;

/**
 * Öğrenci ve velinin Genel Bakış'ında devam durumu (karar 2026-09-28):
 * son 30 günün ders yoklamaları, devam yüzdesi ve gelmediği / geç kaldığı /
 * izinli olduğu dersler. Yoklama ders başına alındığı için sayılar derstir,
 * gün değil.
 */
export function AttendanceRecordsPanel({ studentId }: { studentId: string }) {
  const today = getOrbitToday();
  const query = useStudentAttendanceRecords({
    studentId,
    since: addDaysIso(today, -ATTENDANCE_PANEL_DAYS),
  });

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
            Devam durumu
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Son {ATTENDANCE_PANEL_DAYS} gün · yoklama her ders için ayrı alınır
          </p>
        </div>
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <CardSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="Devam bilgisi alınamadı."
            onRetry={() => void query.refetch()}
          />
        ) : query.data.length === 0 ? (
          <EmptyState
            title="Bu dönemde yoklama kaydı yok"
            description="Derslerde yoklama alındıkça burada görünür."
          />
        ) : (
          <AttendanceSummary records={query.data} />
        )}
      </div>
    </section>
  );
}

function AttendanceSummary({
  records,
}: {
  records: StudentAttendanceRecord[];
}) {
  const { counts, percentage, exceptions } = summarizeRecords(records);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {percentage !== undefined ? (
          <span className="mr-2 font-display text-[26px] font-extrabold tracking-[-.04em] text-slate-900">
            %{percentage}
            <span className="ml-1 text-[11px] font-semibold tracking-normal text-slate-500">
              devam
            </span>
          </span>
        ) : null}
        <Badge tone="green">{counts.present} katıldı</Badge>
        {counts.late > 0 ? (
          <Badge tone="amber">{counts.late} geç kaldı</Badge>
        ) : null}
        {counts.absent > 0 ? (
          <Badge tone="rose">{counts.absent} gelmedi</Badge>
        ) : null}
        {counts.excused > 0 ? (
          <Badge tone="blue">{counts.excused} izinli</Badge>
        ) : null}
      </div>

      {exceptions.length === 0 ? (
        <p className="mt-4 text-[12px] font-semibold text-emerald-700">
          Bu dönemde bütün derslere katıldı.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {exceptions.slice(0, SHOWN).map(record => (
            <li
              key={record.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-slate-800">
                  {record.subjectName ??
                    (record.startsAt ? "Ders" : "Günlük yoklama")}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {formatTrDate(record.sessionDate)}
                  {record.startsAt ? ` · ${record.startsAt.slice(0, 5)}` : ""}
                </span>
              </span>
              <Badge tone={TONE[record.status]}>{LABEL[record.status]}</Badge>
            </li>
          ))}
          {exceptions.length > SHOWN ? (
            <li className="py-2 text-[11px] text-slate-400">
              +{exceptions.length - SHOWN} kayıt daha
            </li>
          ) : null}
        </ul>
      )}
    </>
  );
}

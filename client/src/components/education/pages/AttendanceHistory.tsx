import { useState } from "react";
import { useAttendanceHistory } from "@/education/educationQueries";
import type { AttendanceHistoryRow } from "@/education/attendanceService";
import { formatTrDate } from "@/education/trDate";
import { Badge, CardSkeleton, EmptyState, ErrorState } from "../shared";
import type { ScheduleItem } from "../types";
import {
  addDaysIso,
  lessonsOnDate,
  targetFromEntry,
  targetFromHistory,
  type AttendanceTarget,
} from "./attendanceSheet";

/** Geçmiş listesinin kapsadığı gün sayısı. */
const HISTORY_DAYS = 30;

const SELECT =
  "h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800";

/**
 * Yoklama · Geçmiş: son 30 günün oturumları (sınıfa göre süzülebilir) ve
 * başka bir günün yoklamasını alma. Satıra tıklamak o oturumu düzeltmek
 * için açar. Ders başına: başka günün yoklaması da o günün programındaki
 * bir derse bağlanır; günlük oturum bu ekrandan açılmaz.
 */
export function AttendanceHistory({
  today,
  classes,
  schedule,
  onOpen,
}: {
  today: string;
  classes: { id: string; name: string }[];
  schedule: ScheduleItem[];
  onOpen: (target: AttendanceTarget) => void;
}) {
  const [classId, setClassId] = useState("");
  const [pickedClassId, setOtherClassId] = useState("");
  // Sınıf listesi sonradan yüklenirse ilk sınıf seçili gelir.
  const otherClassId = pickedClassId || classes[0]?.id || "";
  const [otherDate, setOtherDate] = useState(addDaysIso(today, -1));
  const [otherEntryId, setOtherEntryId] = useState("");

  const historyQuery = useAttendanceHistory({
    since: addDaysIso(today, -HISTORY_DAYS),
    classId: classId || null,
  });

  const otherLessons = otherClassId
    ? lessonsOnDate(schedule, otherClassId, otherDate)
    : [];
  const otherClassName =
    classes.find(c => c.id === otherClassId)?.name ?? "Sınıf";
  const selectedEntry =
    otherLessons.find(l => l.id === otherEntryId) ?? otherLessons[0];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h3 className="text-[12px] font-extrabold text-slate-800">
          Başka bir günün yoklaması
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Unutulan bir dersin yoklamasını sonradan alın.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-[11px] font-bold text-slate-500">
            Sınıf
            <select
              value={otherClassId}
              onChange={e => {
                setOtherClassId(e.target.value);
                setOtherEntryId("");
              }}
              className={SELECT}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-bold text-slate-500">
            Tarih
            <input
              type="date"
              value={otherDate}
              max={today}
              onChange={e => {
                setOtherDate(e.target.value);
                setOtherEntryId("");
              }}
              className={SELECT}
            />
          </label>
          <label className="grid gap-1 text-[11px] font-bold text-slate-500">
            Ders
            <select
              value={selectedEntry?.id ?? ""}
              onChange={e => setOtherEntryId(e.target.value)}
              disabled={otherLessons.length === 0}
              className={SELECT}
            >
              {otherLessons.length === 0 ? (
                <option value="">O gün programda ders yok</option>
              ) : (
                otherLessons.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.time} · {l.title}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedEntry || !otherDate || otherDate > today}
            onClick={() => {
              const target = selectedEntry
                ? targetFromEntry(selectedEntry, otherClassName, otherDate)
                : null;
              if (target) onOpen(target);
            }}
            className="h-9 rounded-lg bg-slate-900 px-4 text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            <span className="text-[12px] font-bold">Yoklamayı aç</span>
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[12px] font-extrabold text-slate-800">
            Son {HISTORY_DAYS} gün
          </h3>
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
            Sınıf
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className={SELECT}
            >
              <option value="">Tümü</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {historyQuery.data?.truncated ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
            Liste üst sınıra ulaştı; sınıf seçerek daraltın.
          </p>
        ) : null}

        {historyQuery.isPending ? (
          <CardSkeleton />
        ) : historyQuery.isError ? (
          <ErrorState
            title="Geçmiş yoklamalar alınamadı"
            message={historyQuery.error.message}
            onRetry={() => void historyQuery.refetch()}
          />
        ) : historyQuery.data.rows.length === 0 ? (
          <EmptyState
            title="Bu dönemde yoklama yok"
            description={`Son ${HISTORY_DAYS} günde alınmış bir yoklama bulunmuyor.`}
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {historyQuery.data.rows.map(row => (
              <li key={row.sessionId}>
                <button
                  type="button"
                  onClick={() => onOpen(targetFromHistory(row))}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-slate-800">
                      {targetFromHistory(row).title} ·{" "}
                      {row.className ?? "Sınıf"}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {formatTrDate(row.sessionDate)}
                      {row.startsAt ? ` · ${row.startsAt.slice(0, 5)}` : ""}
                    </span>
                  </span>
                  <HistoryCounts row={row} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HistoryCounts({ row }: { row: AttendanceHistoryRow }) {
  const { present, late, absent, excused } = row.counts;
  if (present + late + absent + excused === 0) {
    // Açılmış ama kimse işaretlenmemiş: "alındı" sayılmaz (`20261006000000`).
    return <Badge tone="slate">Boş — kimse işaretlenmedi</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge tone="green">{present} katıldı</Badge>
      {late > 0 ? <Badge tone="amber">{late} geç</Badge> : null}
      {absent > 0 ? <Badge tone="rose">{absent} gelmedi</Badge> : null}
      {excused > 0 ? <Badge tone="blue">{excused} izinli</Badge> : null}
    </span>
  );
}

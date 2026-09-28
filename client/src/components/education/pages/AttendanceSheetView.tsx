import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
  ATTENDANCE_STATES,
  attendanceStateToDbStatus,
  getAttendanceTone,
} from "@/education/attendanceStatus";
import {
  loadAttendanceSheet,
  openAttendanceSession,
  saveAttendance,
  translateAttendanceError,
  type AttendanceEntryInput,
  type AttendanceSheet,
} from "@/education/attendanceService";
import { Badge, CardSkeleton, EmptyState, ErrorState } from "../shared";
import type { Section } from "../types";
import {
  attendanceTargetLabel,
  countStatuses,
  describeCounts,
  markRemainingPresent,
  type AttendanceTarget,
  type StatusMap,
} from "./attendanceSheet";

/**
 * Bir dersin yoklama listesi (karar 2026-09-28).
 *
 * Açılınca o dersin oturumunu bulur ya da açar (sınıf + gün + ders + saat),
 * öğrencileri yükler. Kimse önceden işaretli gelmez (K-03); "Hepsi var"
 * işaretlenmemiş herkesi "Katıldı" yapar, seçilmiş durumlara dokunmaz.
 * Boş kalan oturum "alındı" sayılmaz (`20261006000000`), yani yalnız bakıp
 * çıkmak yanlış bir "alındı" üretmez.
 */
export function AttendanceSheetView({
  organizationId,
  target,
  onBack,
  onSaved,
  onDirtyChange,
  onRequestConfirm,
  onNavigate,
}: {
  organizationId: string;
  target: AttendanceTarget;
  onBack: () => void;
  onSaved?: () => Promise<void> | void;
  onDirtyChange?: (isDirty: boolean) => void;
  onRequestConfirm?: (action: () => void) => void;
  onNavigate?: (section: Section) => void;
}) {
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [initial, setInitial] = useState<StatusMap>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Bileşen hedef başına yeniden kurulur (anahtar); ilk durum zaten boş.
    // Yeniden deneme durumu sıfırlamayı düğmede yapar.
    let ignore = false;
    (async () => {
      try {
        const { id } = await openAttendanceSession({
          organizationId,
          classId: target.classId,
          sessionDate: target.sessionDate,
          subjectId: target.subjectId,
          startsAt: target.startsAt,
        });
        const loaded = await loadAttendanceSheet(organizationId, id);
        if (ignore) return;
        const map: StatusMap = {};
        for (const student of loaded.students) {
          map[student.studentId] = student.status ?? null;
        }
        setSheet(loaded);
        setStatuses(map);
        setInitial(map);
      } catch (err: unknown) {
        if (!ignore) setLoadError(translateAttendanceError(err));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [
    organizationId,
    target.classId,
    target.sessionDate,
    target.subjectId,
    target.startsAt,
    reloadKey,
  ]);

  const studentIds = useMemo(
    () => sheet?.students.map(s => s.studentId) ?? [],
    [sheet]
  );
  const isDirty = studentIds.some(id => statuses[id] !== initial[id]);
  const counts = countStatuses(studentIds, statuses);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty && onRequestConfirm) {
      onRequestConfirm(onBack);
      return;
    }
    onBack();
  };

  const handleSave = async () => {
    if (!sheet) return;
    const entries: AttendanceEntryInput[] = [];
    for (const id of studentIds) {
      const dbStatus = attendanceStateToDbStatus(statuses[id]);
      if (dbStatus) entries.push({ student_id: id, status: dbStatus });
    }
    if (entries.length === 0) {
      toast.info("Önce en az bir öğrenciyi işaretleyin.");
      return;
    }

    setIsSaving(true);
    try {
      const count = await saveAttendance(sheet.session.id, entries);
      toast.success("Yoklama kaydedildi", {
        description: `${count} öğrencinin durumu kaydedildi.`,
      });
      setInitial({ ...statuses });
      onDirtyChange?.(false);
      await onSaved?.();
    } catch (err: unknown) {
      const message = translateAttendanceError(err);
      toast.error("Yoklama kaydedilemedi", {
        description: message,
        action:
          onNavigate && message.includes("Sınıflar ekranından")
            ? { label: "Sınıflar'a git", onClick: () => onNavigate("Sınıflar") }
            : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Listeye dön"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[16px] font-extrabold tracking-[-.03em] text-slate-900">
              {attendanceTargetLabel(target)}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {sheet ? describeCounts(counts) : "Yükleniyor…"}
            </p>
          </div>
        </div>
        {sheet && studentIds.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              setStatuses(current => markRemainingPresent(studentIds, current))
            }
            disabled={counts.unmarked === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" />
            <span className="text-[12px] font-bold">
              {counts.unmarked === studentIds.length
                ? "Hepsi var"
                : "Kalanları var işaretle"}
            </span>
          </button>
        ) : null}
      </div>

      {loadError ? (
        <div className="p-5">
          <ErrorState
            title="Yoklama açılamadı"
            message={loadError}
            onRetry={() => {
              setLoadError(null);
              setReloadKey(k => k + 1);
            }}
          />
        </div>
      ) : !sheet ? (
        <div className="p-5">
          <CardSkeleton />
        </div>
      ) : studentIds.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Bu sınıfta öğrenci yok"
            description="Yoklama alabilmek için sınıfa öğrenci ekleyin."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sheet.students.map(student => {
            const current = statuses[student.studentId] ?? null;
            return (
              <li
                key={student.studentId}
                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-[220px] items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
                    {student.studentName
                      .split(" ")
                      .filter(Boolean)
                      .map(word => word[0])
                      .join("")}
                  </span>
                  <div>
                    <p className="text-[12px] font-extrabold text-slate-800">
                      {student.studentName}
                    </p>
                    {student.studentCode ? (
                      <p className="text-[10px] text-slate-400">
                        {student.studentCode}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ATTENDANCE_STATES.map(state => (
                    <button
                      key={state}
                      type="button"
                      aria-pressed={current === state}
                      onClick={() =>
                        setStatuses(prev => ({
                          ...prev,
                          [student.studentId]:
                            prev[student.studentId] === state ? null : state,
                        }))
                      }
                      className={`rounded-lg px-2.5 py-1.5 transition ${
                        current === state
                          ? "bg-slate-900 text-white shadow-sm"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-[10px] font-bold">{state}</span>
                    </button>
                  ))}
                </div>
                <div className="sm:ml-auto">
                  {current ? (
                    <Badge tone={getAttendanceTone(current)}>{current}</Badge>
                  ) : (
                    <Badge tone="slate">Seçilmedi</Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sheet && studentIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-5 py-4">
          <span
            className={`text-[12px] ${isDirty ? "font-medium text-amber-700" : "text-slate-500"}`}
          >
            {isDirty
              ? "● Kaydedilmemiş değişiklikler var"
              : "Tüm değişiklikler kayıtlı"}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-[13px] font-bold">
              {isSaving ? "Kaydediliyor…" : "Yoklamayı kaydet"}
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Save } from "lucide-react";
import { toast } from "sonner";
import {
  loadExamAverages,
  loadExamSections,
  loadSectionResults,
  netOf,
  saveExamSections,
  saveSectionResults,
  type ExamAverage,
  type ExamSection,
  type SectionResultInput,
} from "@/education/examNetService";
import { translateExamError } from "@/education/examService";
import type { ExamSheetStudent } from "@/education/examService";
import { CardSkeleton, ErrorState } from "../shared";
import { ExamSectionsQuickStart } from "./ExamSectionsQuickStart";
import { clearedSavedCells, sameValues, type ResultCell } from "./examSections";
import { ExamAbsenceControl } from "./ExamAbsenceControl";
import { RemoteChangeNotice } from "./RemoteChangeNotice";
import { NetImportDialog } from "./NetImportDialog";
import { educationKeys } from "@/education/educationQueries";
import {
  loadExamAbsences,
  type ExamAbsence,
} from "@/education/examAbsenceService";

type Cell = ResultCell;
const key = (studentId: string, sectionId: string) =>
  `${studentId}|${sectionId}`;

/** Türkçe ondalık: 28,5 — 28.5 değil. */
function formatNet(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/**
 * Netli sınavın ders ders doğru/yanlış giriş tablosu (karar 2026-09-28).
 *
 * Satır öğrenci, sütun ders; her derste D ve Y. Net anlık gösterilir
 * (önizleme — kaydedilen toplamı veritabanı hesaplar). İkisi de boş hücre
 * "girilmedi"dir ve yazılmaz; biri doluysa diğeri 0 sayılır. Doğru + yanlış
 * soru sayısını aşarsa kaydetmeden önce söylenir (veritabanı da reddeder).
 */
export function NetResultsGrid({
  examId,
  netPenalty,
  students,
  canEdit,
  onSaved,
  onDirtyChange,
  organizationId,
}: {
  examId: string;
  netPenalty: number;
  students: ExamSheetStudent[];
  canEdit: boolean;
  /** Boş denemeye şablondan ders eklemek için (2026-09-30). */
  organizationId?: string;
  onSaved?: () => Promise<void> | void;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const [sections, setSections] = useState<ExamSection[] | null>(null);
  // "Sınava girmedi" işaretleri (2026-10-05): o satırın hücreleri kapalıdır.
  // Sonuçlarla aynı yükleme adımında okunur.
  const [absences, setAbsences] = useState<Map<string, ExamAbsence>>(new Map());
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [initial, setInitial] = useState<Record<string, Cell>>({});
  const [averages, setAverages] = useState<Map<string, ExamAverage>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  // Düzenleme sürerken gelen canlı güncelleme (2026-10-12).
  const [remoteChanged, setRemoteChanged] = useState(false);
  // Deneme sonucunu dosyadan aktarma (v1.5-16, 2026-10-12).
  const [importOpen, setImportOpen] = useState(false);
  const absentIds = useMemo(() => new Set(absences.keys()), [absences]);

  // Sorgu olarak okunur ki ders sonucu, "girmedi" ve ders listesi
  // değişiklikleri (realtimeMapping → examSheet) bu tabloyu da yenilesin.
  const netQuery = useQuery({
    queryKey: [
      ...educationKeys.examSheet(organizationId ?? "", examId),
      "net",
    ] as const,
    queryFn: async () => {
      const [loadedSections, results, avg, loadedAbsences] = await Promise.all([
        loadExamSections(examId),
        loadSectionResults(examId),
        loadExamAverages([examId]),
        loadExamAbsences(organizationId ?? "", examId),
      ]);
      const map: Record<string, Cell> = {};
      for (const r of results) {
        map[key(r.studentId, r.sectionId)] = {
          correct: String(r.correct),
          wrong: String(r.wrong),
        };
      }
      return {
        sections: loadedSections,
        cells: map,
        absences: loadedAbsences,
        averages: avg.get(examId)?.sections ?? new Map<string, ExamAverage>(),
      };
    },
  });
  const loadError = netQuery.error ? translateExamError(netQuery.error) : null;

  const applyLoadedCells = (loadedCells: Record<string, Cell>) => {
    setCells(loadedCells);
    setInitial(loadedCells);
    setRemoteChanged(false);
  };

  const isDirty = useMemo(
    () =>
      Object.keys({ ...cells, ...initial }).some(
        k =>
          (cells[k]?.correct ?? "") !== (initial[k]?.correct ?? "") ||
          (cells[k]?.wrong ?? "") !== (initial[k]?.wrong ?? "")
      ),
    [cells, initial]
  );

  // Gelen veri render sırasında eşitlenir; düzenleme sürüyorsa hücreler
  // ezilmez, yalnız haber verilir.
  const [seenNetData, setSeenNetData] = useState(netQuery.data);
  if (netQuery.data !== seenNetData) {
    setSeenNetData(netQuery.data);
    if (netQuery.data) {
      setSections(netQuery.data.sections);
      setAbsences(netQuery.data.absences);
      setAverages(netQuery.data.averages);
      if (!isDirty) applyLoadedCells(netQuery.data.cells);
      else if (!sameValues(netQuery.data.cells, initial))
        setRemoteChanged(true);
    }
  }

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const setCell = (
    studentId: string,
    sectionId: string,
    patch: Partial<Cell>
  ) =>
    setCells(prev => {
      const k = key(studentId, sectionId);
      const current = prev[k] ?? { correct: "", wrong: "" };
      return { ...prev, [k]: { ...current, ...patch } };
    });

  const parse = (cell: Cell | undefined) => {
    if (!cell || (cell.correct.trim() === "" && cell.wrong.trim() === ""))
      return null;
    return {
      correct: Number(cell.correct || 0),
      wrong: Number(cell.wrong || 0),
    };
  };

  // Kaydedilmiş sonucu boşaltılan hücreler: silinemez, kayıt durur (v1.5-23).
  const cleared = new Set(clearedSavedCells(initial, cells));

  const handleSave = async () => {
    if (!sections) return;
    if (cleared.size > 0) {
      toast.error("Kaydedilmiş bir sonuç silinemez", {
        description:
          "Kırmızı hücrelerin eski sonucu kayıtlı. Doğru ve yanlışı yeniden yazın; öğrenci sınava girmediyse sonucu düzeltmek için yöneticiye başvurun.",
      });
      return;
    }
    const entries: SectionResultInput[] = [];
    for (const student of students) {
      if (absences.has(student.studentId)) continue;
      for (const section of sections) {
        const value = parse(cells[key(student.studentId, section.id)]);
        if (!value) continue;
        if (
          !Number.isInteger(value.correct) ||
          !Number.isInteger(value.wrong) ||
          value.correct < 0 ||
          value.wrong < 0
        ) {
          toast.error(
            `${student.studentName} · ${section.name}: doğru ve yanlış sıfır ya da pozitif tam sayı olmalı.`
          );
          return;
        }
        if (value.correct + value.wrong > section.questionCount) {
          toast.error(
            `${student.studentName} · ${section.name}: doğru + yanlış ${section.questionCount} soruyu aşıyor.`
          );
          return;
        }
        entries.push({
          studentId: student.studentId,
          sectionId: section.id,
          ...value,
        });
      }
    }

    setIsSaving(true);
    try {
      const count = await saveSectionResults(examId, entries);
      toast.success("Netler kaydedildi", {
        description: `${count} ders sonucu güncellendi.`,
      });
      setInitial({ ...cells });
      onDirtyChange?.(false);
      await onSaved?.();
      await netQuery.refetch();
    } catch (err: unknown) {
      toast.error("Netler kaydedilemedi", {
        description: translateExamError(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError)
    return (
      <div className="p-5">
        <ErrorState
          title="Ders sonuçları yüklenemedi"
          message={loadError}
          onRetry={() => void netQuery.refetch()}
        />
      </div>
    );
  if (!sections)
    return (
      <div className="p-5">
        <CardSkeleton />
      </div>
    );
  if (sections.length === 0)
    return (
      <div className="p-6">
        <ExamSectionsQuickStart
          netPenalty={netPenalty}
          canEdit={canEdit && Boolean(organizationId)}
          onApply={async templateSections => {
            await saveExamSections(
              organizationId!,
              examId,
              templateSections,
              []
            );
            setSections(null);
            await netQuery.refetch();
          }}
        />
      </div>
    );

  return (
    <div>
      {canEdit ? (
        <NetImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          sections={sections}
          students={students}
          absentStudentIds={absentIds}
          onApply={(imported, studentCount) => {
            setCells(prev => ({ ...prev, ...imported }));
            toast.success(
              `${studentCount} öğrencinin sonucu tabloya aktarıldı`,
              {
                description:
                  "Henüz kaydedilmedi. Tabloyu kontrol edip “Netleri kaydet”e basın.",
              }
            );
          }}
        />
      ) : null}
      {remoteChanged && isDirty ? (
        <RemoteChangeNotice
          onDiscard={() => {
            if (netQuery.data) applyLoadedCells(netQuery.data.cells);
          }}
        />
      ) : null}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-[11px] text-slate-500">
          D: doğru · Y: yanlış · {netPenalty} yanlış 1 doğruyu götürür · boş
          bırakılan ders girilmemiş sayılır
        </p>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              <span className="text-xs font-bold">Dosyadan aktar</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">
                {isSaving ? "Kaydediliyor…" : "Netleri kaydet"}
              </span>
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500">
              <th className="sticky left-0 bg-slate-50 px-4 py-2">Öğrenci</th>
              {sections.map(section => (
                <th key={section.id} className="px-2 py-2 text-center">
                  {section.name}
                  <span className="block text-[10px] font-medium text-slate-400">
                    {section.questionCount} soru
                  </span>
                </th>
              ))}
              <th className="px-4 py-2 text-right">Toplam net</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => {
              let total = 0;
              let any = false;
              return (
                <tr
                  key={student.studentId}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="sticky left-0 bg-white px-4 py-2">
                    <span className="block text-[12px] font-bold text-slate-800">
                      {student.studentName}
                    </span>
                    {student.studentCode ? (
                      <span className="block text-[10px] text-slate-400">
                        {student.studentCode}
                      </span>
                    ) : null}
                    <ExamAbsenceControl
                      examId={examId}
                      studentId={student.studentId}
                      studentName={student.studentName}
                      absence={absences.get(student.studentId)}
                      canEdit={canEdit}
                      hasResult={sections.some(
                        section =>
                          parse(initial[key(student.studentId, section.id)]) !==
                          null
                      )}
                      onChanged={async () => {
                        await netQuery.refetch();
                        await onSaved?.();
                      }}
                    />
                  </td>
                  {sections.map(section => {
                    const cell = cells[key(student.studentId, section.id)];
                    const value = parse(cell);
                    const over =
                      value !== null &&
                      value.correct + value.wrong > section.questionCount;
                    const net = value
                      ? netOf(value.correct, value.wrong, netPenalty)
                      : null;
                    if (net !== null && !over) {
                      total += net;
                      any = true;
                    }
                    return (
                      <td key={section.id} className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={cell?.correct ?? ""}
                            onChange={e =>
                              setCell(student.studentId, section.id, {
                                correct: e.target.value,
                              })
                            }
                            disabled={
                              !canEdit || absences.has(student.studentId)
                            }
                            placeholder="D"
                            aria-label={`${student.studentName} ${section.name} doğru`}
                            className={`h-8 w-12 rounded-md border px-1 text-center text-xs ${over || cleared.has(key(student.studentId, section.id)) ? "border-rose-400 bg-rose-50" : "border-slate-200"}`}
                          />
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={cell?.wrong ?? ""}
                            onChange={e =>
                              setCell(student.studentId, section.id, {
                                wrong: e.target.value,
                              })
                            }
                            disabled={
                              !canEdit || absences.has(student.studentId)
                            }
                            placeholder="Y"
                            aria-label={`${student.studentName} ${section.name} yanlış`}
                            className={`h-8 w-12 rounded-md border px-1 text-center text-xs ${over || cleared.has(key(student.studentId, section.id)) ? "border-rose-400 bg-rose-50" : "border-slate-200"}`}
                          />
                        </div>
                        <span
                          className={`mt-0.5 block text-center text-[10px] ${over ? "font-bold text-rose-600" : "text-slate-500"}`}
                        >
                          {cleared.has(key(student.studentId, section.id))
                            ? "kayıtlı sonuç boşaltılamaz"
                            : over
                              ? "soru sayısını aşıyor"
                              : net !== null
                                ? `${formatNet(net)} net`
                                : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right text-[13px] font-extrabold tabular-nums text-slate-900">
                    {any ? formatNet(Math.round(total * 100) / 100) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500">
              <td className="sticky left-0 bg-slate-50 px-4 py-2 font-bold">
                Sınıf ortalaması
              </td>
              {sections.map(section => {
                const avg = averages.get(section.id);
                return (
                  <td key={section.id} className="px-2 py-2 text-center">
                    {avg?.average != null
                      ? `${formatNet(avg.average)} net`
                      : avg
                        ? "3 sonuçtan sonra"
                        : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

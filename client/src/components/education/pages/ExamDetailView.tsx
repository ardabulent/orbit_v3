import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, BarChart3, Save } from "lucide-react";
import { toast } from "sonner";
import { isDemoMode } from "@/auth/runtime";
import {
  formatExamSummary,
  loadExamSheet,
  archiveExam,
  saveExamResults,
  translateExamError,
  type LatestExamDetail,
  type ExamSheet,
  type ExamSheetStudent,
  type ExamResultEntryInput,
} from "@/education/examService";
import { students as defaultStudents } from "../educationData";
import {
  Badge,
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
} from "../shared";
import type { ClassGroup, Role, Section } from "../types";
import { ExamFormDialog } from "./ExamFormDialog";
import { NetResultsGrid } from "./NetResultsGrid";

export type ExamDetailViewProps = {
  role: Role;
  onNavigate: (section: Section) => void;
  exam?: LatestExamDetail | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  isDemo?: boolean;
  organizationId?: string;
  classes?: ClassGroup[];
  onDirtyChange?: (isDirty: boolean) => void;
  onRequestConfirm?: (action: () => void) => void;
  onSaved?: () => Promise<void> | void;
  initialSheet?: ExamSheet | null;
  /**
   * Sınav listesinden açıldıysa (yönetici/öğretmen, 2026-09-28): başlık
   * listenin sayfasında durur, burada geri düğmesi çizilir.
   */
  embedded?: boolean;
  onBack?: () => void;
};

/**
 * Tek bir sınavın detayı: başlık (düzenle/arşivle), ortalama ve sonuç
 * girişi. Tek puanlı sınavda puan tablosu, netli sınavda ders ders
 * doğru/yanlış ızgarası (`NetResultsGrid`).
 *
 * Öğrenci ve veli şimdilik bu görünümü son sınav için görür; kendi
 * ekranları ayrı dilimde.
 */
export function ExamDetailView({
  role,
  exam,
  isLoading = false,
  error = null,
  onRetry,
  isDemo = isDemoMode,
  organizationId = "",
  classes = [],
  onDirtyChange,
  onSaved,
  initialSheet,
  embedded = false,
  onBack,
}: ExamDetailViewProps) {
  const activeDemo = isDemoMode && isDemo;
  const isPersonal = role === "student" || role === "parent";
  const canManageExams = role === "admin" || role === "teacher";

  const [activeExam, setActiveExam] = useState<LatestExamDetail | null>(() => {
    if (exam) return exam;
    if (initialSheet?.exam) {
      return {
        id: initialSheet.exam.id,
        name: initialSheet.exam.name,
        examDate: initialSheet.exam.examDate,
        maxScore: initialSheet.exam.maxScore,
        classId: initialSheet.exam.classId,
        className: initialSheet.exam.className,
        participantCount: null,
      };
    }
    if (activeDemo) {
      return {
        id: "demo-exam-1",
        name: "TYT Deneme 06",
        examDate: "2026-08-14",
        maxScore: 100,
        participantCount: 54,
        classId: "demo-class",
        className: "12-A",
      };
    }
    return null;
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  // Doluysa diyalog düzenleme kipinde açılır (v1.4 ara denetimi: v1.4-04
  // `updateExam` ve `archiveExam`'i yazmış ama hiçbir ekrana bağlamamıştı).
  const [examUnderEdit, setExamUnderEdit] = useState<LatestExamDetail | null>(
    null
  );
  const [isArchiving, setIsArchiving] = useState(false);
  const [sheet, setSheet] = useState<ExamSheet | null>(() => {
    if (initialSheet) return initialSheet;
    if (activeDemo) {
      const targetExam = exam;
      const demoStudents: ExamSheetStudent[] = defaultStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        studentCode: s.code,
        score: s.score ?? null,
      }));
      return {
        exam: {
          id: targetExam?.id ?? "demo-exam-1",
          organizationId: "demo-org",
          classId: targetExam?.classId ?? "demo-class",
          className: targetExam?.className ?? "12-A",
          subjectId: null,
          subjectName: null,
          name: targetExam?.name ?? "TYT Deneme 06",
          examDate: targetExam?.examDate ?? "2026-08-14",
          maxScore: targetExam?.maxScore ?? 100,
        },
        students: demoStudents,
      };
    }
    return null;
  });
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<Error | null>(null);
  const [scores, setScores] = useState<Record<string, string>>(() => {
    if (initialSheet) {
      const initial: Record<string, string> = {};
      for (const st of initialSheet.students) {
        initial[st.studentId] =
          st.score !== null && st.score !== undefined ? String(st.score) : "";
      }
      return initial;
    }
    if (activeDemo) {
      const initial: Record<string, string> = {};
      for (const st of defaultStudents) {
        initial[st.id] =
          st.score !== null && st.score !== undefined ? String(st.score) : "";
      }
      return initial;
    }
    return {};
  });
  const [initialScores, setInitialScores] = useState<Record<string, string>>(
    () => {
      if (initialSheet) {
        const initial: Record<string, string> = {};
        for (const st of initialSheet.students) {
          initial[st.studentId] =
            st.score !== null && st.score !== undefined ? String(st.score) : "";
        }
        return initial;
      }
      if (activeDemo) {
        const initial: Record<string, string> = {};
        for (const st of defaultStudents) {
          initial[st.id] =
            st.score !== null && st.score !== undefined ? String(st.score) : "";
        }
        return initial;
      }
      return {};
    }
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (exam && !activeExam) {
      setActiveExam(exam);
    }
  }, [exam, activeExam]);

  // Canlı modda sınav çizelgesi ve öğrencileri yükle
  useEffect(() => {
    if (!activeDemo && organizationId && activeExam?.id) {
      let cancelled = false;
      setIsSheetLoading(true);
      setSheetError(null);

      loadExamSheet(organizationId, activeExam.id)
        .then(loadedSheet => {
          if (cancelled) return;
          setSheet(loadedSheet);
          const initial: Record<string, string> = {};
          for (const st of loadedSheet.students) {
            // Puanı olmayan öğrenci BOŞTUR (0 uydurulmaz - K-03)
            initial[st.studentId] =
              st.score !== null && st.score !== undefined
                ? String(st.score)
                : "";
          }
          setScores(initial);
          setInitialScores(initial);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setSheetError(new Error(translateExamError(err)));
        })
        .finally(() => {
          if (cancelled) return;
          setIsSheetLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [activeDemo, organizationId, activeExam?.id]);

  // Demo modunda örnek öğrenci listesi
  useEffect(() => {
    if (activeDemo && activeExam) {
      const demoStudents: ExamSheetStudent[] = defaultStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        studentCode: s.code,
        score: s.score ?? null,
      }));
      setSheet({
        exam: {
          id: activeExam.id,
          organizationId: "demo-org",
          classId: activeExam.classId ?? "demo-class",
          className: activeExam.className ?? "12-A",
          subjectId: null,
          subjectName: null,
          name: activeExam.name,
          examDate: activeExam.examDate,
          maxScore: activeExam.maxScore,
        },
        students: demoStudents,
      });
      const initial: Record<string, string> = {};
      for (const st of demoStudents) {
        initial[st.studentId] =
          st.score !== null && st.score !== undefined ? String(st.score) : "";
      }
      setScores(initial);
      setInitialScores(initial);
    }
  }, [activeDemo, activeExam]);

  // Kaydedilmemiş değişiklik var mı?
  const isDirty = useMemo(() => {
    return Object.keys(scores).some(
      studentId =>
        (scores[studentId] ?? "") !== (initialScores[studentId] ?? "")
    );
  }, [scores, initialScores]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleScoreChange = (studentId: string, val: string) => {
    setScores(prev => ({
      ...prev,
      [studentId]: val,
    }));
  };

  // Arşivleme geri alınabilir bir iş (archived_at) ama sınav sonuçlarını
  // ekrandan düşürdüğü için onay tostu yerine doğrudan yapılıyor ve sonucu
  // söyleniyor. Sıfır satır etkilenirse servis hata fırlatıyor (K-14).
  const handleArchiveExam = async () => {
    if (!organizationId || !activeExam) return;
    setIsArchiving(true);
    try {
      await archiveExam(organizationId, activeExam.id);
      toast.success("Sınav arşivlendi", {
        description: `"${activeExam.name}" listeden kaldırıldı.`,
      });
      setActiveExam(null);
      setSheet(null);
      onSaved?.();
    } catch (err: unknown) {
      toast.error("Sınav arşivlenemedi", {
        description: translateExamError(err),
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleSave = async () => {
    if (!activeExam) return;

    // Tavan kontrolü (ORB05)
    if (activeExam.maxScore !== null && activeExam.maxScore !== undefined) {
      for (const [studentId, scoreStr] of Object.entries(scores)) {
        if (scoreStr.trim() !== "") {
          const parsed = Number(scoreStr);
          if (!Number.isNaN(parsed) && parsed > activeExam.maxScore) {
            const student = sheet?.students.find(
              s => s.studentId === studentId
            );
            const studentName = student ? `${student.studentName}: ` : "";
            toast.error(
              `${studentName}${translateExamError({ code: "ORB05" })}`
            );
            return;
          }
        }
      }
    }

    const entries: ExamResultEntryInput[] = [];
    for (const [studentId, scoreStr] of Object.entries(scores)) {
      if (scoreStr.trim() !== "") {
        const parsed = Number(scoreStr);
        if (!Number.isNaN(parsed)) {
          entries.push({ studentId, score: parsed });
        }
      }
    }

    if (activeDemo) {
      toast.success("Sınav sonuçları kaydedildi", {
        description: `${entries.length} öğrencinin sonucu kaydedildi (Demo).`,
      });
      setInitialScores({ ...scores });
      onDirtyChange?.(false);
      return;
    }

    setIsSaving(true);
    try {
      const count = await saveExamResults(activeExam.id, entries);
      toast.success("Sınav sonuçları kaydedildi", {
        description: `${count} öğrencinin sonucu kaydedildi.`,
      });
      setInitialScores({ ...scores });
      onDirtyChange?.(false);
      if (onSaved) {
        await onSaved();
      }
    } catch (err: unknown) {
      const msg = translateExamError(err);
      toast.error("Sonuçlar kaydedilemedi", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // #237 / R1: Sınav ortalaması YALNIZ max_score DOLU sınavlarda ve puan girilmişken çizilir.
  // Uygun sınav yoksa veya girilmiş puan yoksa kart HİÇ ÇİZİLMEZ.
  // R1: Etiket 'Sınav ortalaması'dır ('Ders' değil). detail kaç öğrenciyi kapsadığını söyler.
  const averageStat = useMemo(() => {
    if (
      !activeExam ||
      activeExam.maxScore === null ||
      activeExam.maxScore === undefined ||
      activeExam.maxScore <= 0
    ) {
      return null;
    }

    const validScores: number[] = [];
    for (const student of sheet?.students ?? []) {
      const scoreVal = scores[student.studentId];
      if (scoreVal !== undefined && scoreVal.trim() !== "") {
        const num = Number(scoreVal);
        if (!Number.isNaN(num)) {
          validScores.push(num);
        }
      }
    }

    if (validScores.length === 0) {
      return null;
    }

    const count = validScores.length;
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / count;
    const percent = Math.round((avg / activeExam.maxScore) * 100);
    const avgStr = (avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1)).replace(
      ".",
      ","
    );

    return {
      label: "Sınav ortalaması",
      value: `%${percent}`,
      detail: `${count} öğrencinin ortalaması · ${avgStr} / ${activeExam.maxScore} puan`,
      icon: BarChart3,
      tone: "violet" as const,
    };
  }, [activeExam, sheet?.students, scores]);

  return (
    <>
      {embedded ? (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-[12px] font-bold">Sınav listesine dön</span>
        </button>
      ) : (
        <PageHeader
          eyebrow="Ölçme ve değerlendirme"
          title={isPersonal ? "Akademik gelişim" : "Sınavlar ve başarı"}
          description={
            isPersonal
              ? "Son denemeler ve sınav karnesi."
              : "Sınav kayıtları, sınıf bazlı sonuç girişi ve değerlendirme."
          }
          action={canManageExams ? "Yeni sınav" : undefined}
          onAction={
            canManageExams ? () => setCreateDialogOpen(true) : undefined
          }
        />
      )}

      {isLoading ? (
        <CardSkeleton className="mt-6" />
      ) : error ? (
        <ErrorState
          className="mt-6"
          title="Sınav bilgileri görüntülenemedi"
          message={
            error.message || "Sınav bilgileri yüklenirken bir hata oluştu."
          }
          onRetry={onRetry}
        />
      ) : !activeExam ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
          <EmptyState
            title="Henüz sınav kaydı yok"
            description="Kurumda kayıtlı bir sınav oturumu bulunamadı."
          />
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Sınav Başlık Kartı */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[17px] font-extrabold text-slate-900">
                  {activeExam.name}
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatExamSummary(activeExam)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="blue">Kayıtlı Sınav</Badge>
                {canManageExams ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setExamUnderEdit(activeExam);
                        setCreateDialogOpen(true);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      disabled={isArchiving}
                      onClick={() => void handleArchiveExam()}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {isArchiving ? "Arşivleniyor…" : "Arşivle"}
                    </button>
                    {/* C-07: "Yeni sınav" bu sınavın düğmesi gibi duruyordu;
                        yalnız sayfa başlığında. */}
                  </>
                ) : null}
              </div>
            </div>

            {/* #237: Yalnız max_score dolu ve puan varsa çizilen ortalama kartı */}
            {averageStat ? (
              <div className="mt-4 max-w-xs">
                <StatCard
                  label={averageStat.label}
                  value={averageStat.value}
                  detail={averageStat.detail}
                  icon={averageStat.icon}
                  tone={averageStat.tone}
                />
              </div>
            ) : null}
          </section>

          {/* Sınav Sonuçları Tablosu */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="font-display text-[15px] font-extrabold text-slate-900">
                  Sınav Sonuçları
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {sheet?.students.length ?? 0} kayıtlı öğrenci
                </p>
              </div>
              {canManageExams && !isPersonal && !activeExam.netPenalty ? (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!isDirty || isSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? "Kaydediliyor…" : "Sonuçları Kaydet"}
                </button>
              ) : null}
            </div>

            {isSheetLoading ? (
              <div className="p-5">
                <CardSkeleton />
              </div>
            ) : sheetError ? (
              <div className="p-5">
                <ErrorState
                  title="Öğrenci listesi yüklenemedi"
                  message={sheetError.message}
                />
              </div>
            ) : (sheet?.students ?? []).length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Sınıfta öğrenci bulunamadı"
                  description="Bu sınavın sınıfına henüz kayıtlı öğrenci bulunmuyor."
                />
              </div>
            ) : activeExam.netPenalty && !activeDemo ? (
              <NetResultsGrid
                examId={activeExam.id}
                netPenalty={activeExam.netPenalty}
                students={sheet?.students ?? []}
                canEdit={canManageExams && !isPersonal}
                onSaved={onSaved}
                onDirtyChange={onDirtyChange}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400">
                      <th className="px-5 py-3">Öğrenci</th>
                      <th className="px-5 py-3 text-right">Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sheet?.students ?? []).map(student => {
                      const currentVal = scores[student.studentId] ?? "";
                      return (
                        <tr
                          key={student.studentId}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-extrabold text-slate-800">
                              {student.studentName}
                            </p>
                            {student.studentCode ? (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {student.studentCode}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canManageExams && !isPersonal ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="Girilmedi"
                                  value={currentVal}
                                  onChange={e =>
                                    handleScoreChange(
                                      student.studentId,
                                      e.target.value
                                    )
                                  }
                                  className="h-8 w-24 rounded-lg border border-slate-200 px-2.5 text-right text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                                />
                                {/* K-22, #237: maxScore boşken payda KESİNLİKLE gösterilmez */}
                                {activeExam.maxScore !== null &&
                                activeExam.maxScore !== undefined ? (
                                  <span className="text-[11px] font-bold text-slate-400">
                                    / {activeExam.maxScore}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs font-extrabold text-slate-800">
                                {currentVal.trim() !== ""
                                  ? activeExam.maxScore !== null &&
                                    activeExam.maxScore !== undefined
                                    ? `${currentVal} / ${activeExam.maxScore}`
                                    : `${currentVal} puan`
                                  : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {organizationId && classes.length > 0 ? (
        <ExamFormDialog
          open={createDialogOpen}
          onOpenChange={next => {
            setCreateDialogOpen(next);
            if (!next) setExamUnderEdit(null);
          }}
          organizationId={organizationId}
          classes={classes}
          exam={examUnderEdit}
          onDone={savedExam => {
            // Uydurma yok: diyalog kullanıcının yazdığı değerleri geri veriyor.
            // Eskiden burada ad "Yeni Sınav", tarih bugün, tam puan null
            // yazılıyordu — üçü de kullanıcının az önce girdiğinin yerine.
            setActiveExam(savedExam);
            setExamUnderEdit(null);
            onSaved?.();
          }}
        />
      ) : null}
    </>
  );
}

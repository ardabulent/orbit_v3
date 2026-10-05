import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  markExamAbsent,
  restoreExamResult,
  type ExamAbsence,
} from "@/education/examAbsenceService";

const LINK =
  "text-[10px] font-bold underline-offset-2 hover:underline disabled:opacity-50";

/**
 * Bir öğrencinin satırındaki "Sınava girmedi" denetimi (2026-10-05).
 * İşaretliyse rozet + sebep + "Geri al"; değilse "Girmedi" bağlantısı
 * (isteğe bağlı sebep penceresiyle). `canEdit` yalnız kullanıcı deneyimi;
 * yetki veritabanında.
 */
export function ExamAbsenceControl({
  examId,
  studentId,
  studentName,
  absence,
  canEdit,
  hasResult,
  onChanged,
}: {
  examId: string;
  studentId: string;
  studentName: string;
  absence: ExamAbsence | undefined;
  canEdit: boolean;
  /** Kayıtlı bir sonucu var mı (pencere metni için). */
  hasResult: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      setOpen(false);
      setReason("");
      toast.success(done);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  if (absence) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
          Sınava girmedi
        </span>
        {absence.reason ? (
          <span className="text-[10px] text-slate-500">· {absence.reason}</span>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => restoreExamResult({ examId, studentId }),
                `${studentName}: sonuç geri alındı`
              )
            }
            className={`${LINK} text-blue-600`}
          >
            {busy ? "Geri alınıyor…" : "Geri al"}
          </button>
        ) : null}
      </span>
    );
  }

  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${LINK} text-slate-400 hover:text-amber-700`}
      >
        Girmedi
      </button>
      <Dialog open={open} onOpenChange={o => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{studentName} sınava girmedi</DialogTitle>
            <DialogDescription>
              {hasResult
                ? "Kayıtlı sonucu kaldırılır ve saklanır; ortalamaya ve sıralamaya katılmaz. Yanlışlıkla yaptıysanız “Geri al” ile sonuç aynen döner."
                : "Öğrenci bu sınav için “girmedi” olarak görünür; ortalamaya ve sıralamaya katılmaz. “Geri al” ile kaldırabilirsiniz."}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-[11px] font-bold text-slate-600">
            Sebep (isteğe bağlı)
            <input
              value={reason}
              maxLength={200}
              onChange={e => setReason(e.target.value)}
              placeholder="ör. raporlu"
              className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-normal outline-none focus:border-blue-500"
            />
            <span className="text-[10px] font-normal text-slate-400">
              Veli ve öğrenci görür; denetim kaydına yazılmaz.
            </span>
          </label>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => markExamAbsent({ examId, studentId, reason }),
                  `${studentName}: sınava girmedi olarak işaretlendi`
                )
              }
              className="h-9 rounded-lg bg-amber-600 px-4 text-[12px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? "İşaretleniyor…" : "Girmedi olarak işaretle"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

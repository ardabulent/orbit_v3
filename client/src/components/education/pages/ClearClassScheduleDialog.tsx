import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { educationKeys } from "@/education/educationQueries";
import { clearClassSchedule } from "@/education/scheduleTemplateService";

/**
 * Bir sınıfın bütün haftalık programını kaldırma onayı (2026-10-01).
 * Dersler silinmez, arşivlenir; ardından şablon yeniden atanabilir.
 */
export function ClearClassScheduleDialog({
  organizationId,
  classId,
  className,
  lessonCount,
  onClose,
}: {
  organizationId: string;
  classId: string;
  className: string;
  lessonCount: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const removed = await clearClassSchedule(classId);
      onClose();
      toast.success(`${className} programı temizlendi`, {
        description: `${removed} ders kaldırıldı. Şablonlar sekmesinden yeni program atayabilirsiniz.`,
      });
      void queryClient.invalidateQueries({
        queryKey: educationKeys.schedule(organizationId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Program temizlenemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Sınıfın programını temizle</DialogTitle>
          <DialogDescription>
            {className} sınıfının haftalık programındaki {lessonCount} ders
            kaldırılacak. Emin misiniz?
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="h-9 rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Temizleniyor…" : "Programı temizle"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

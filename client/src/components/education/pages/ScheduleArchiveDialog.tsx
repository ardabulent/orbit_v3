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
import { archiveScheduleEntry } from "@/education/scheduleService";
import type { ScheduleItem } from "../types";

/** Program satırını kaldırma onayı — window.confirm KULLANILMAZ. */
export function ScheduleArchiveDialog({
  organizationId,
  entry,
  onClose,
}: {
  organizationId: string;
  entry: ScheduleItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const handleArchiveConfirm = async () => {
    if (!organizationId || !entry.id) return;

    setArchiveLoading(true);
    setArchiveError(null);

    try {
      await archiveScheduleEntry(organizationId, entry.id);
      await queryClient.invalidateQueries({
        queryKey: educationKeys.schedule(organizationId),
      });
      onClose();
      toast.success("Ders programı satırı kaldırıldı", {
        description: "Program satırı başarıyla arşive alındı.",
      });
    } catch (err) {
      setArchiveError(
        err instanceof Error ? err.message : "Program satırı kaldırılamadı."
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Program Satırını Kaldır</DialogTitle>
          <DialogDescription>
            &quot;{entry.title}&quot; ders programı satırını kaldırmak
            istediğinize emin misiniz?
          </DialogDescription>
        </DialogHeader>

        {archiveError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-700 font-medium"
          >
            {archiveError}
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={archiveLoading}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleArchiveConfirm}
            disabled={archiveLoading}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {archiveLoading ? "Kaldırılıyor…" : "Satırı Kaldır"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

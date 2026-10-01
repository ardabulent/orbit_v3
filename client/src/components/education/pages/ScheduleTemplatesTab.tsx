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
import {
  educationKeys,
  useScheduleTemplates,
} from "@/education/educationQueries";
import {
  archiveScheduleTemplate,
  type ScheduleTemplate,
} from "@/education/scheduleTemplateService";
import { formatTrDate, orbitLocalDate } from "@/education/trDate";
import { CardSkeleton, EmptyState, ErrorState } from "../shared";
import { ScheduleTemplateApplyDialog } from "./ScheduleTemplateApplyDialog";
import { ScheduleTemplateEditorDialog } from "./ScheduleTemplateEditorDialog";
import { templateSummary } from "./scheduleTemplateGrid";

const ACTION =
  "h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50";

/**
 * Ders programı şablonları (2026-10-01, yalnız yönetici). Haftalık tablo bir
 * kez çizilir, "Sınıflara ata" ile çok sınıfa kopyalanır. Silmek şablonu
 * arşivler; daha önce atandığı sınıfların programı yerinde kalır.
 */
export function ScheduleTemplatesTab({
  organizationId,
  classes,
  addOpen,
  onAddOpenChange,
}: {
  organizationId: string;
  classes: { id: string; name: string }[];
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const templatesQuery = useScheduleTemplates({ organizationId });
  const [editing, setEditing] = useState<ScheduleTemplate | null>(null);
  const [applying, setApplying] = useState<ScheduleTemplate | null>(null);
  const [removing, setRemoving] = useState<ScheduleTemplate | null>(null);
  const templates = templatesQuery.data ?? [];

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <p className="mb-4 border-b border-slate-100 pb-4 text-[12px] text-slate-500">
        Haftayı bir kez çizin, sonra birden çok sınıfa atayın. Atama bir
        kopyadır: sınıfın programını sonra Program sekmesinden tek tek
        düzeltebilirsiniz.
      </p>

      {templatesQuery.isLoading ? (
        <CardSkeleton />
      ) : templatesQuery.error ? (
        <ErrorState
          title="Şablonlar görüntülenemedi"
          message={templatesQuery.error.message}
          onRetry={() => void templatesQuery.refetch()}
        />
      ) : templates.length === 0 ? (
        <EmptyState
          title="Henüz şablon yok"
          description="“Yeni şablon” ile ilk haftalık programı çizin."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {templates.map(template => (
            <li
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-[13px] font-bold text-slate-900">
                  {template.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {templateSummary(template)} · son değişiklik{" "}
                  {formatTrDate(orbitLocalDate(template.updatedAt))}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApplying(template)}
                  className="h-8 rounded-lg bg-slate-900 px-3 text-[11px] font-bold text-white hover:bg-slate-800"
                >
                  Sınıflara ata
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(template)}
                  className={ACTION}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(template)}
                  className={`${ACTION} text-rose-600 hover:bg-rose-50`}
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen || editing ? (
        <ScheduleTemplateEditorDialog
          organizationId={organizationId}
          template={editing}
          onClose={() => {
            setEditing(null);
            onAddOpenChange(false);
          }}
        />
      ) : null}

      {applying ? (
        <ScheduleTemplateApplyDialog
          organizationId={organizationId}
          template={applying}
          classes={classes}
          onClose={() => setApplying(null)}
        />
      ) : null}

      {removing ? (
        <RemoveTemplateDialog
          organizationId={organizationId}
          template={removing}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </section>
  );
}

function RemoveTemplateDialog({
  organizationId,
  template,
  onClose,
}: {
  organizationId: string;
  template: ScheduleTemplate;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await archiveScheduleTemplate(organizationId, template.id);
      onClose();
      toast.success("Şablon silindi", {
        description: "Atandığı sınıfların programı yerinde duruyor.",
      });
      void queryClient.invalidateQueries({
        queryKey: educationKeys.scheduleTemplates(organizationId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şablon silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Şablonu sil</DialogTitle>
          <DialogDescription>
            “{template.name}” şablonu listeden kaldırılacak. Daha önce bu
            şablonla kurulan sınıf programları değişmez.
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
            {busy ? "Siliniyor…" : "Şablonu sil"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

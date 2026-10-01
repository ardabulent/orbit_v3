import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { educationKeys } from "@/education/educationQueries";
import {
  applyScheduleTemplate,
  type ApplyMode,
  type ApplyResult,
  type ScheduleTemplate,
  type UnassignedReason,
} from "@/education/scheduleTemplateService";
import { DAY_SHORT } from "./scheduleTemplateGrid";

const REASON_LABEL: Record<UnassignedReason, string> = {
  no_teacher: "sınıfta bu dersin öğretmeni tanımlı değil",
  teacher_busy: "öğretmenin bu saatte başka sınıfta dersi var",
};

const BUTTON = "h-9 rounded-lg px-4 text-[12px] font-bold disabled:opacity-50";

/**
 * Şablonu sınıflara atama (2026-10-01). İki adım:
 *
 *   1. Sınıflar ve biçim seçilir → "Ön izle" veritabanında hesaplanır,
 *      HİÇBİR ŞEY yazılmaz.
 *   2. Ön izleme gösterilir. Öğretmensiz (açıkta) kalacak ders varsa kayıttan
 *      önce sorulur: "Açıkta dersler kaldı, yine de atansın mı?" (kullanıcı
 *      isteği). Onaylanınca aynı atama gerçekten yapılır.
 */
export function ScheduleTemplateApplyDialog({
  organizationId,
  template,
  classes,
  onClose,
}: {
  organizationId: string;
  template: ScheduleTemplate;
  classes: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ApplyMode>("replace");
  const [preview, setPreview] = useState<ApplyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setPreview(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = classes.length > 0 && selected.size === classes.length;

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await applyScheduleTemplate({
        templateId: template.id,
        classIds: [...selected],
        mode,
        dryRun,
      });
      if (dryRun) {
        setPreview(result);
        return;
      }
      onClose();
      const added = result.classes.reduce((n, c) => n + c.added, 0);
      toast.success(`${added} ders ${result.classes.length} sınıfa eklendi`, {
        description:
          result.unassigned.length > 0
            ? `${result.unassigned.length} ders öğretmensiz; Program sekmesinde “ders öğretmensiz” etiketinden bulabilirsiniz.`
            : "Bütün derslerin öğretmeni atandı.",
      });
      void queryClient.invalidateQueries({
        queryKey: educationKeys.schedule(organizationId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Atama yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const open = preview?.unassigned ?? [];

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>“{template.name}” şablonunu sınıflara ata</DialogTitle>
          <DialogDescription>
            Şablon seçtiğiniz sınıflara kopyalanır. Sonradan şablonu değiştirmek
            sınıfların programını değiştirmez.
          </DialogDescription>
        </DialogHeader>

        {preview === null ? (
          <>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[11px] font-bold text-slate-600">
                Sınıflar
              </legend>
              {classes.length === 0 ? (
                <p className="text-[12px] text-slate-500">
                  Kurumda henüz sınıf yok.
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(
                          allSelected
                            ? new Set()
                            : new Set(classes.map(c => c.id))
                        )
                      }
                    />
                    Tümünü seç
                  </label>
                  <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-slate-100 p-2">
                    {classes.map(c => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-[12px] text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[11px] font-bold text-slate-600">
                Sınıfta zaten program varsa
              </legend>
              <ModeOption
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                title="Tamamen değiştir"
                hint="Sınıfın mevcut dersleri kaldırılır (arşivlenir), yerine şablon yazılır."
              />
              <ModeOption
                checked={mode === "fill"}
                onChange={() => setMode("fill")}
                title="Yalnız boş saatleri doldur"
                hint="Mevcut derslere dokunulmaz; şablondan yalnız boş saatlere ders eklenir."
              />
            </fieldset>
          </>
        ) : (
          <div className="grid gap-3">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
                  <th className="py-1.5">Sınıf</th>
                  <th className="py-1.5">Eklenecek</th>
                  {mode === "replace" ? (
                    <th className="py-1.5">Kaldırılacak</th>
                  ) : (
                    <th className="py-1.5">Dolu, atlanacak</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.classes.map(c => (
                  <tr key={c.classId}>
                    <td className="py-1.5 font-semibold text-slate-800">
                      {c.className}
                    </td>
                    <td className="py-1.5">{c.added}</td>
                    <td className="py-1.5">
                      {mode === "replace" ? c.archived : c.skipped}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {open.length > 0 ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-3"
              >
                <p className="flex items-center gap-2 text-[12px] font-bold text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Açıkta dersler kaldı: {open.length} ders öğretmensiz
                  eklenecek.
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-amber-900">
                  {open.map((u, i) => (
                    <li key={i}>
                      <span className="font-semibold">
                        {u.className} · {DAY_SHORT[u.dayOfWeek]} {u.startsAt} ·{" "}
                        {u.subjectName}
                      </span>{" "}
                      — {REASON_LABEL[u.reason]}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-amber-800">
                  Bu dersler programa öğretmensiz yazılır; sonra Program
                  sekmesinden öğretmen atayabilirsiniz. Yine de kaydedilsin mi?
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[12px] font-semibold text-emerald-800">
                Bütün derslerin öğretmeni bulundu; çakışma yok.
              </p>
            )}
          </div>
        )}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={preview ? () => setPreview(null) : onClose}
            disabled={busy}
            className={`${BUTTON} border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50`}
          >
            {preview ? "Geri" : "Vazgeç"}
          </button>
          {preview === null ? (
            <button
              type="button"
              onClick={() => run(true)}
              disabled={busy || selected.size === 0}
              className={`${BUTTON} bg-slate-900 text-white hover:bg-slate-800`}
            >
              {busy ? "Hesaplanıyor…" : "Ön izle"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => run(false)}
              disabled={busy}
              className={`${BUTTON} text-white ${
                open.length > 0
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {busy ? "Atanıyor…" : open.length > 0 ? "Yine de ata" : "Ata"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 ${
        checked ? "border-blue-300 bg-blue-50/60" : "border-slate-200"
      }`}
    >
      <input
        type="radio"
        name="apply-mode"
        checked={checked}
        onChange={onChange}
      />
      <span>
        <span className="block text-[12px] font-bold text-slate-800">
          {title}
        </span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

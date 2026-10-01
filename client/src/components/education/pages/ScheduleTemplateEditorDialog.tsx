import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { educationKeys, useSubjects } from "@/education/educationQueries";
import {
  saveScheduleTemplate,
  type ScheduleTemplate,
} from "@/education/scheduleTemplateService";
import type { IsoWeekDay } from "@/education/weekDays";
import {
  cellKey,
  DAY_SHORT,
  editorToSlots,
  nextHour,
  templateToEditor,
  WEEKDAYS_SHOWN,
  type TemplateEditorState,
} from "./scheduleTemplateGrid";

const TIME =
  "h-7 w-[92px] rounded-md border border-slate-200 bg-white px-1 text-[11px] outline-none focus:border-blue-500";

/**
 * Şablon düzenleyici (2026-10-01): satırlar ders saatleri, sütunlar günler,
 * her hücrede bir ders. Öğretmen burada seçilmez — atamada sınıfın
 * ders-öğretmen eşleşmesinden gelir. Pencere her açılışta yeniden kurulur
 * (çağıran yalnız açıkken bağlar), bu yüzden önceki şablonun durumu taşınmaz.
 */
export function ScheduleTemplateEditorDialog({
  organizationId,
  template,
  onClose,
}: {
  organizationId: string;
  template: ScheduleTemplate | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const subjectsQuery = useSubjects({ organizationId });
  const subjects = subjectsQuery.data?.rows ?? [];

  const [name, setName] = useState(template?.name ?? "");
  const [state, setState] = useState<TemplateEditorState>(() =>
    templateToEditor(template)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days: IsoWeekDay[] = state.sunday
    ? [...WEEKDAYS_SHOWN, 7]
    : WEEKDAYS_SHOWN;
  const filled = Object.entries(state.cells).filter(
    ([key, value]) => value && (state.sunday || !key.startsWith("7|"))
  ).length;

  const setCell = (day: IsoWeekDay, hourKey: string, subjectId: string) =>
    setState(s => ({
      ...s,
      cells: { ...s.cells, [cellKey(day, hourKey)]: subjectId },
    }));
  const setHour = (
    key: string,
    patch: { startsAt?: string; endsAt?: string }
  ) =>
    setState(s => ({
      ...s,
      hours: s.hours.map(h => (h.key === key ? { ...h, ...patch } : h)),
    }));
  const removeHour = (key: string) =>
    setState(s => ({
      ...s,
      hours: s.hours.filter(h => h.key !== key),
      cells: Object.fromEntries(
        Object.entries(s.cells).filter(([k]) => !k.endsWith(`|${key}`))
      ),
    }));

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Şablona bir ad verin (ör. 12. sınıf sayısal).");
      return;
    }
    const result = editorToSlots(state);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      await saveScheduleTemplate({
        organizationId,
        templateId: template?.id ?? null,
        name,
        slots: result.slots,
      });
      onClose();
      toast.success(template ? "Şablon güncellendi" : "Şablon kaydedildi", {
        description: template
          ? "Daha önce atandığı sınıfların programı değişmedi; yeniden atayabilirsiniz."
          : "Şimdi “Sınıflara ata” ile sınıflara verebilirsiniz.",
      });
      void queryClient.invalidateQueries({
        queryKey: educationKeys.scheduleTemplates(organizationId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şablon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>
            {template ? "Şablonu düzenle" : "Yeni program şablonu"}
          </DialogTitle>
          <DialogDescription>
            Haftayı bir kez çizin, sonra istediğiniz sınıflara atayın.
            Öğretmenler atamada sınıfın ders öğretmenlerinden gelir.
          </DialogDescription>
        </DialogHeader>

        <label className="grid gap-1 text-[11px] font-bold text-slate-600">
          Şablon adı
          <input
            value={name}
            maxLength={120}
            onChange={e => setName(e.target.value)}
            placeholder="ör. 12. sınıf sayısal"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] outline-none focus:border-blue-500"
          />
        </label>

        {subjects.length === 0 && !subjectsQuery.isLoading ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold text-amber-800">
            Kurumda henüz ders tanımlı değil. Önce Ayarlar → Dersler'den ders
            ekleyin.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
                <th className="px-2 py-2 text-left">Ders saati</th>
                {days.map(day => (
                  <th key={day} className="px-1 py-2 text-left">
                    {DAY_SHORT[day]}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.hours.map(hour => (
                <tr key={hour.key}>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        aria-label="Başlangıç"
                        value={hour.startsAt}
                        onChange={e =>
                          setHour(hour.key, { startsAt: e.target.value })
                        }
                        className={TIME}
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="time"
                        aria-label="Bitiş"
                        value={hour.endsAt}
                        onChange={e =>
                          setHour(hour.key, { endsAt: e.target.value })
                        }
                        className={TIME}
                      />
                    </div>
                  </td>
                  {days.map(day => {
                    const value = state.cells[cellKey(day, hour.key)] ?? "";
                    return (
                      <td key={day} className="px-1 py-1.5">
                        <select
                          aria-label={`${DAY_SHORT[day]} ${hour.startsAt}`}
                          value={value}
                          onChange={e => setCell(day, hour.key, e.target.value)}
                          className={`h-7 w-full min-w-[84px] rounded-md border px-1 text-[11px] outline-none focus:border-blue-500 ${
                            value
                              ? "border-blue-200 bg-blue-50 font-semibold text-blue-800"
                              : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          <option value="">—</option>
                          {subjects.map(subject => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td className="px-1 py-1.5 text-right">
                    <button
                      type="button"
                      aria-label="Ders saatini çıkar"
                      onClick={() => removeHour(hour.key)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() =>
              setState(s => ({ ...s, hours: [...s.hours, nextHour(s.hours)] }))
            }
            className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-blue-600 hover:bg-blue-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-[12px] font-bold">Ders saati ekle</span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={state.sunday}
            onChange={e => setState(s => ({ ...s, sunday: e.target.checked }))}
          />
          Pazar gününü de göster
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold text-slate-500">
            {filled} ders yerleştirildi
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-9 rounded-lg bg-slate-900 px-4 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Kaydediliyor…" : "Şablonu kaydet"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

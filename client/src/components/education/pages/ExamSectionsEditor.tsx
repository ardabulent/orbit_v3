import { Plus, X } from "lucide-react";
import { EXAM_TEMPLATES, type SectionDraft } from "@/education/examNetService";
import { totalQuestions } from "./examSections";

/**
 * Netli sınavın ders bölümleri: hazır şablon (TYT, AYT, LGS) ya da elle.
 * Şablon yalnız başlangıçtır; ad ve soru sayısı düzenlenir. Listeden
 * çıkarılan var olan bölüm kaydedilince arşivlenir, silinmez.
 */
export function ExamSectionsEditor({
  drafts,
  onChange,
  onTemplate,
  disabled,
}: {
  drafts: SectionDraft[];
  onChange: (drafts: SectionDraft[]) => void;
  /** Şablon, kuralı da (YKS 4 / LGS 3) seçer. */
  onTemplate: (penalty: number) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<SectionDraft>) =>
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-600">Şablon:</span>
        {EXAM_TEMPLATES.map(template => (
          <button
            key={template.label}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(
                template.sections.map(s => ({
                  name: s.name,
                  questionCount: s.questionCount,
                }))
              );
              onTemplate(template.penalty);
            }}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="text-[11px] font-semibold text-slate-700">
              {template.label}
            </span>
          </button>
        ))}
      </div>

      <ul className="space-y-1.5">
        {drafts.map((draft, index) => (
          <li key={draft.id ?? `yeni-${index}`} className="flex gap-2">
            <input
              value={draft.name}
              onChange={e => update(index, { name: e.target.value })}
              placeholder="Ders adı"
              aria-label={`${index + 1}. dersin adı`}
              maxLength={80}
              disabled={disabled}
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs"
            />
            <input
              type="number"
              min={1}
              max={200}
              value={draft.questionCount || ""}
              onChange={e =>
                update(index, { questionCount: Number(e.target.value) })
              }
              aria-label={`${draft.name || `${index + 1}. ders`} soru sayısı`}
              disabled={disabled}
              className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => onChange(drafts.filter((_, i) => i !== index))}
              aria-label={`${draft.name || "Dersi"} kaldır`}
              disabled={disabled}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...drafts, { name: "", questionCount: 20 }])}
          className="inline-flex items-center gap-1 text-blue-600 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold">Ders ekle</span>
        </button>
        <span className="text-[11px] text-slate-500">
          Toplam {totalQuestions(drafts)} soru
        </span>
      </div>
    </div>
  );
}

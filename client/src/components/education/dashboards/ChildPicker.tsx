import type { Student } from "../types";

/**
 * Velinin birden çok çocuğu varsa hangisine baktığını seçtiği düğmeler.
 * Genel Bakış ve Sınavlar kullanır (üst çubuğa taşınması planlı).
 */
export function ChildPicker({
  childrenList,
  selectedId,
  onSelect,
}: {
  childrenList: Student[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Çocuk seçimi"
      className="mt-5 flex flex-wrap gap-2"
    >
      {childrenList.map(candidate => {
        const selected = candidate.id === selectedId;
        return (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(candidate.id)}
            className={`rounded-full px-4 py-2 transition ${
              selected
                ? "bg-slate-900 text-white shadow-[0_4px_12px_rgba(15,23,42,.12)]"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <span className="text-[12px] font-bold">{candidate.name}</span>
          </button>
        );
      })}
    </div>
  );
}

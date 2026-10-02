import { UserRound } from "lucide-react";
import { useGuardianChild } from "./guardianChildState";

/**
 * Üst çubuktaki çocuk seçici (2026-10-02). Yalnız birden çok çocuğu olan
 * veliye görünür. Geniş ekranda çocuk adları düğme; telefonda başlığın
 * altında açılır liste (`variant="compact"`), çünkü üst çubukta yer yok.
 */
export function ChildSwitcher({
  variant = "inline",
}: {
  variant?: "inline" | "compact";
}) {
  const { active, children, child, select } = useGuardianChild();
  if (!active || children.length < 2 || !child) return null;

  if (variant === "compact") {
    return (
      <label className="flex items-center gap-2 border-b border-slate-200/80 bg-white/80 px-4 py-2 text-[11px] font-bold text-slate-500 sm:px-6">
        <UserRound className="h-3.5 w-3.5" />
        Öğrenci
        <select
          value={child.id}
          onChange={e => select(e.target.value)}
          aria-label="Takip edilen öğrenci"
          className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-800"
        >
          {children.map(candidate => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Takip edilen öğrenci"
      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"
    >
      {children.map(candidate => {
        const selected = candidate.id === child.id;
        return (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => select(candidate.id)}
            className={`max-w-[160px] truncate rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
              selected
                ? "bg-violet-600 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {candidate.name}
          </button>
        );
      })}
    </div>
  );
}

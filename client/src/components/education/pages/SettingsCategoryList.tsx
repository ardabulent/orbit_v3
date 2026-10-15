import { ChevronRight } from "lucide-react";
import type {
  SettingsCategoryId,
  SettingsCategoryMeta,
} from "./settingsCategories";

export function SettingsCategoryList({
  categories,
  selectedId,
  onSelect,
}: {
  categories: SettingsCategoryMeta[];
  selectedId: SettingsCategoryId;
  onSelect: (id: SettingsCategoryId) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <p className="mb-2 px-2 text-[9px] font-extrabold uppercase tracking-[.14em] text-slate-400">
        Ayar Kategorileri
      </p>
      <div className="space-y-1">
        {categories.map(category => {
          const Icon = category.icon;
          const selected = category.id === selectedId;
          return (
            <button
              key={category.id}
              type="button"
              // Taşma denetimi kategorileri bununla bulur
              // (ops/arayuz/tasma-denetimi.js).
              data-settings-category={category.title}
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(category.id)}
              className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
                selected
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  selected
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold">
                  {category.title}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                  {category.subtitle}
                </span>
              </span>
              {selected ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-blue-400" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  useThemePreference,
  writeThemePreference,
  type ThemePreference,
} from "@/theme/orbitTheme";

type ThemeOptionId = ThemePreference;

const THEME_OPTIONS: {
  id: ThemeOptionId;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    id: "light",
    label: "Açık Tema",
    description: "Gündüz kullanımı için aydınlık ve ferah görünüm.",
    icon: Sun,
  },
  {
    id: "dark",
    label: "Koyu Tema",
    description: "Göz yormayan, düşük ışık ortamlarına uygun koyu görünüm.",
    icon: Moon,
  },
  {
    id: "system",
    label: "Sistem Tercihi",
    description:
      "İşletim sisteminizin açık/koyu mod ayarını otomatik takip eder.",
    icon: Monitor,
  },
];

export function SettingsThemeSection() {
  // 2026-10-15 (#135): koyu tema açıldı. Tercih bu tarayıcıda saklanır ve
  // yalnız kurum panelinde uygulanır (`@/theme/orbitTheme`).
  const currentTheme = useThemePreference();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-extrabold text-slate-900">
          Görünüm ve Tema
        </h2>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        ORBIT arayüzünün renk temasını kişisel tercihinize göre ayarlayın.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map(option => {
          const Icon = option.icon;
          const isSelected = currentTheme === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => writeThemePreference(option.id)}
              aria-pressed={isSelected}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-blue-600 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {isSelected ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-[13px] font-extrabold text-slate-900">
                {option.label}
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
        Seçiminiz bu cihazda saklanır; başka bir cihazda ayrıca seçebilirsiniz.
        Giriş ekranı her zaman kendi görünümünde açılır.
      </p>
    </>
  );
}

import { AlertTriangle, Check, Monitor, Moon, Sun } from "lucide-react";

type ThemeOptionId = "light" | "dark" | "system";

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
  // Arayüz henüz koyu temaya hazır olmadığı için mevcut tema açık olarak
  // kilitlenmiştir; seçenekler tıklanamaz (#135).
  const currentTheme: ThemeOptionId = "light";

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
              disabled
              className={`flex cursor-not-allowed flex-col items-start rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-blue-600 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 bg-white opacity-60"
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
      <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span>
          <strong>Koyu tema henüz hazır değil</strong> — arayüzün tamamı koyu
          görünüme uyarlanmadan bu seçenek açılmayacak. Şu an tüm ekranlar açık
          temada çalışıyor.
        </span>
      </p>
    </>
  );
}

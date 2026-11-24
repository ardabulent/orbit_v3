import { useState } from "react";
import { validateLimits } from "@/education/tracking/trackingBands";
import {
  METRIC_KEYS,
  TRACKING_METRICS,
  type Criterion,
  type Limits,
  type LimitsByMetric,
  type MetricKey,
} from "@/education/tracking/trackingMetrics";

const inputClass =
  "h-9 w-24 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700";
const selectClass =
  "h-9 min-w-44 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700";

const toInput = (value: number | undefined) =>
  value === undefined ? "" : String(value).replace(".", ",");
const fromInput = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));

/**
 * Ölçüt seçimi ve iki sınır (karar 2026-11-24). Yön ölçütte sabittir;
 * kullanıcı yalnız sayıları girer. Bozuk sınırda uyarı gösterilir ve liste
 * o ölçütte bant hesaplamaz ("Sınır yok").
 */
export function TrackingCriteriaPanel({
  criterion,
  onCriterionChange,
  subjectId,
  subjects,
  onSubjectChange,
  limits,
  onLimitsChange,
  onResetLimits,
  canSetDefaults,
  onSaveDefaults,
}: {
  criterion: Criterion;
  onCriterionChange: (criterion: Criterion) => void;
  subjectId?: string;
  subjects: { id: string; name: string }[];
  onSubjectChange: (subjectId: string | undefined) => void;
  limits: LimitsByMetric;
  onLimitsChange: (metric: MetricKey, limits: Limits) => void;
  onResetLimits: () => void;
  /** Yalnız kullanıcı deneyimi: yazma yetkisi RLS'te (tam yönetici). */
  canSetDefaults: boolean;
  onSaveDefaults?: () => Promise<void>;
}) {
  const metric = criterion === "overall" ? null : TRACKING_METRICS[criterion];
  const current = metric ? limits[metric.key] : null;

  const [riskText, setRiskText] = useState(toInput(current?.risk));
  const [safeText, setSafeText] = useState(toInput(current?.safe));
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Kutular ilk değerini bir kez alır; ölçüt değişince ya da "Varsayılana
  // dön"de çağıran bileşen paneli `key` ile yeniden kurar. Yazarken dışarıdan
  // yenilemek "8," gibi yarım bir ondalığı silerdi.

  const draft: Limits = {
    risk: fromInput(riskText),
    safe: fromInput(safeText),
  };
  const bothEmpty = riskText.trim() === "" && safeText.trim() === "";
  const problem =
    metric && !(bothEmpty && !current)
      ? validateLimits(metric.direction, draft)
      : null;

  const commit = (nextRisk: string, nextSafe: string) => {
    if (!metric) return;
    const next = { risk: fromInput(nextRisk), safe: fromInput(nextSafe) };
    if (!validateLimits(metric.direction, next))
      onLimitsChange(metric.key, next);
  };

  const save = async () => {
    if (!onSaveDefaults) return;
    setSaveState({ kind: "saving" });
    try {
      await onSaveDefaults();
      setSaveState({ kind: "saved" });
    } catch (error) {
      setSaveState({
        kind: "error",
        message: error instanceof Error ? error.message : "Kaydedilemedi.",
      });
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[11px] font-bold text-slate-500">
          Neye göre
          <select
            value={criterion}
            onChange={e => onCriterionChange(e.target.value as Criterion)}
            className={selectClass}
          >
            <option value="overall">Genel durum</option>
            {METRIC_KEYS.map(key => (
              <option key={key} value={key}>
                {TRACKING_METRICS[key].label}
              </option>
            ))}
          </select>
        </label>
        {metric?.needsSubject ||
        (criterion === "overall" && subjects.length > 0) ? (
          <label className="grid gap-1 text-[11px] font-bold text-slate-500">
            Ders
            <select
              value={subjectId ?? ""}
              onChange={e => onSubjectChange(e.target.value || undefined)}
              className={selectClass}
            >
              <option value="">
                {metric?.needsSubject ? "Ders seçin" : "Ders neti katılmasın"}
              </option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {metric ? (
          <>
            <label className="grid gap-1 text-[11px] font-bold text-rose-700">
              {metric.direction === "higher_better"
                ? "Riskli: altı"
                : "Riskli: üstü"}
              <input
                inputMode="decimal"
                value={riskText}
                onChange={e => {
                  setRiskText(e.target.value);
                  commit(e.target.value, safeText);
                }}
                className={inputClass}
                aria-label="Riskli sınırı"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-bold text-emerald-700">
              {metric.direction === "higher_better"
                ? "Güvenli: bu ve üstü"
                : "Güvenli: bu ve altı"}
              <input
                inputMode="decimal"
                value={safeText}
                onChange={e => {
                  setSafeText(e.target.value);
                  commit(riskText, e.target.value);
                }}
                className={inputClass}
                aria-label="Güvenli sınırı"
              />
            </label>
          </>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onResetLimits}
            className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Varsayılana dön
          </button>
          {canSetDefaults && onSaveDefaults ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saveState.kind === "saving"}
              className="h-9 rounded-lg bg-slate-900 px-3 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saveState.kind === "saving"
                ? "Kaydediliyor…"
                : "Kurum varsayılanı yap"}
            </button>
          ) : null}
        </div>
      </div>

      {metric ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {bothEmpty && !current
            ? "Sınır girilmedi: liste yalnız değere göre sıralanır, bant gösterilmez."
            : metric.direction === "higher_better"
              ? "Riskli sınırının altı riskli, iki sınır arası orta, güvenli sınırı ve üstü güvenli."
              : "Riskli sınırının üstü riskli, iki sınır arası orta, güvenli sınırı ve altı güvenli."}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          Genel durum, her ölçütün kendi sınırlarını kullanır: önce riskli ölçüt
          sayısına, eşitlikte orta ölçüt sayısına göre sıralanır. Bir ölçütün
          sınırını değiştirmek için onu seçin.
        </p>
      )}
      {problem ? (
        <p role="alert" className="mt-1 text-[11px] font-bold text-rose-600">
          {problem} Liste son geçerli sınırlarla gösteriliyor.
        </p>
      ) : null}
      {criterion === "net_avg" || criterion === "net_trend" ? (
        <p className="mt-1 text-[11px] text-amber-700">
          Sınav türü (TYT/AYT) ayrımı yok: farklı türde denemeler aynı toplam
          nete girer. Karşılaştırmayı ders netiyle yapmak daha güvenlidir.
        </p>
      ) : null}
      {saveState.kind === "saved" ? (
        <p
          role="status"
          className="mt-1 text-[11px] font-bold text-emerald-700"
        >
          Kurum varsayılanı kaydedildi.
        </p>
      ) : saveState.kind === "error" ? (
        <p role="alert" className="mt-1 text-[11px] font-bold text-rose-600">
          {saveState.message}
        </p>
      ) : null}
    </section>
  );
}

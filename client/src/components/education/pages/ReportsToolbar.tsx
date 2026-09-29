import {
  REPORT_WEEK_OPTIONS,
  type ReportRange,
} from "@/education/reportService";

/**
 * Raporların süzgeci (karar 2026-09-29): sınıf ve 4/8/12 hafta. Öğretmenin
 * listesine yalnız kendi sınıfları gelir; bu bir kolaylıktır, sınır değil —
 * başka bir sınıf seçilse de veritabanı süzgeci yalnız daraltır.
 */
export function ReportsToolbar({
  classes,
  range,
  onRangeChange,
  allLabel,
}: {
  classes: { id: string; name: string }[];
  range: ReportRange;
  onRangeChange: (range: ReportRange) => void;
  allLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
      <label className="grid gap-1 text-[11px] font-bold text-slate-500">
        Sınıf
        <select
          value={range.classId ?? ""}
          onChange={e =>
            onRangeChange({ ...range, classId: e.target.value || null })
          }
          className="h-9 min-w-44 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700"
        >
          <option value="">{allLabel}</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div
        role="group"
        aria-label="Rapor aralığı"
        className="flex gap-1 rounded-full border border-slate-200 bg-white p-1"
      >
        {REPORT_WEEK_OPTIONS.map(weeks => {
          const active = range.weeks === weeks;
          return (
            <button
              key={weeks}
              type="button"
              aria-pressed={active}
              onClick={() => onRangeChange({ ...range, weeks })}
              className={`rounded-full px-3 py-1 transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="text-[11px] font-bold">{weeks} hafta</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

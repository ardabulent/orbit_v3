import { memo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type {
  RankedRow,
  SortKey,
  SortState,
} from "@/education/tracking/trackingBands";
import {
  TRACKING_METRICS,
  type Criterion,
} from "@/education/tracking/trackingMetrics";
import { EmptyState } from "../../shared";
import { BandBadge } from "./BandBadge";
import { formatMetricValue } from "./trackingFormat";

/**
 * Takip listesi: varsayılan riskliden güvenliye. Sütun başlığı sıralama
 * ölçütünü değiştirir, ikinci tıklama yönü çevirir. "Yetersiz veri" her
 * sıralamada en sonda ve ayrı başlık altında durur — güvenli sayılmaz.
 */
export function TrackingList({
  ranked,
  criterion,
  sort,
  onSortChange,
  onOpenProfile,
}: {
  ranked: RankedRow[];
  criterion: Criterion;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onOpenProfile: (studentId: string) => void;
}) {
  if (ranked.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Bu kapsamda öğrenci yok"
          description="Seçili sınıfta kayıtlı öğrenci bulunmuyor ya da bu sınıfa erişiminiz yok."
        />
      </div>
    );
  }

  const metric = criterion === "overall" ? null : TRACKING_METRICS[criterion];
  const measured = ranked.filter(item => item.band !== "insufficient");
  const insufficient = ranked.filter(item => item.band === "insufficient");

  const header = (key: SortKey, label: string, className = "") => {
    const active = sort.key === key;
    const nextDir = active
      ? sort.dir === "desc"
        ? "asc"
        : "desc"
      : key === "name"
        ? "asc"
        : "desc";
    return (
      <button
        type="button"
        onClick={() => onSortChange({ key, dir: nextDir })}
        aria-sort={
          active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
        }
        className={`inline-flex items-center gap-1 text-left text-[11px] font-bold uppercase tracking-wide ${
          active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
        } ${className}`}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : null}
      </button>
    );
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_7rem_7rem_minmax(0,2fr)] gap-3 border-b border-slate-100 px-5 py-2.5 md:grid">
        {header("name", "Öğrenci")}
        {header("criticality", "Durum")}
        {header("value", metric ? "Değer" : "Riskli / orta")}
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Gerekçe
        </span>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-4 py-2 md:hidden">
        {header("criticality", "Durum")}
        {header("value", "Değer")}
        {header("name", "Ad")}
      </div>
      <ul className="divide-y divide-slate-100">
        {measured.map(item => (
          <TrackingRow
            key={item.row.studentId}
            item={item}
            criterion={criterion}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </ul>
      {insufficient.length > 0 ? (
        <>
          <p className="border-y border-slate-100 bg-slate-50 px-5 py-2 text-[11px] font-bold text-slate-500">
            Yetersiz veri · {insufficient.length} öğrenci — bu ölçüt için
            yeterli kayıt yok, güvenli sayılmaz
          </p>
          <ul className="divide-y divide-slate-100 opacity-80">
            {insufficient.map(item => (
              <TrackingRow
                key={item.row.studentId}
                item={item}
                criterion={criterion}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

const TrackingRow = memo(function TrackingRow({
  item,
  criterion,
  onOpenProfile,
}: {
  item: RankedRow;
  criterion: Criterion;
  onOpenProfile: (studentId: string) => void;
}) {
  const metric = criterion === "overall" ? null : TRACKING_METRICS[criterion];
  return (
    <li className="grid gap-1.5 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_7rem_7rem_minmax(0,2fr)] md:items-center md:gap-3 md:px-5">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpenProfile(item.row.studentId)}
          className="truncate text-left text-[13px] font-extrabold text-slate-800 hover:text-blue-700"
        >
          {item.row.studentName}
        </button>
        <p className="truncate text-[11px] text-slate-500">
          {item.row.classNames}
        </p>
      </div>
      <div className="flex items-center gap-2 md:block">
        <BandBadge band={item.band} />
        <span className="text-[12px] font-bold text-slate-700 md:hidden">
          {metric
            ? formatMetricValue(metric, item.value)
            : `${item.overall.risk} riskli · ${item.overall.medium} orta`}
        </span>
      </div>
      <span className="hidden text-[13px] font-bold text-slate-800 md:block">
        {metric
          ? formatMetricValue(metric, item.value)
          : `${item.overall.risk} / ${item.overall.medium}`}
      </span>
      <p className="text-[11px] text-slate-600">{item.detail}</p>
    </li>
  );
});

import { useMemo } from "react";
import {
  bandCounts,
  type Band,
  type RankedRow,
} from "@/education/tracking/trackingBands";
import { BAND_META, formatNumber } from "./trackingFormat";

const SHOWN_BANDS: Band[] = [
  "risk",
  "medium",
  "safe",
  "unbanded",
  "insufficient",
];

/**
 * Sınıf profili: seçili ölçütte bant dağılımı ve ders ders ortalama net.
 * Ayrı sorgu yok — listeyle aynı satırlardan hesaplanır.
 */
export function TrackingClassProfile({
  title,
  ranked,
}: {
  title: string;
  ranked: RankedRow[];
}) {
  const counts = bandCounts(ranked);
  const subjects = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; sum: number; count: number }
    >();
    for (const { row } of ranked) {
      for (const subject of row.subjectNets) {
        const entry = totals.get(subject.subjectId) ?? {
          name: subject.subjectName,
          sum: 0,
          count: 0,
        };
        entry.sum += subject.avgNet;
        entry.count += 1;
        totals.set(subject.subjectId, entry);
      }
    }
    return [...totals.entries()]
      .map(([id, entry]) => ({
        id,
        name: entry.name,
        average: entry.sum / entry.count,
        students: entry.count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [ranked]);

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <h2 className="font-display text-[15px] font-extrabold text-slate-900">
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {SHOWN_BANDS.filter(band => counts[band] > 0).map(band => (
          <span
            key={band}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-bold ring-1 ring-inset ${BAND_META[band].className}`}
          >
            {counts[band]} {BAND_META[band].label.toLocaleLowerCase("tr")}
          </span>
        ))}
      </div>
      {subjects.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Ders ders ortalama net
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {subjects.map(subject => (
              <span
                key={subject.id}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700"
              >
                <span className="font-bold">{subject.name}</span>{" "}
                {formatNumber(subject.average)}
                <span className="text-slate-400">
                  {" "}
                  · {subject.students} öğr.
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

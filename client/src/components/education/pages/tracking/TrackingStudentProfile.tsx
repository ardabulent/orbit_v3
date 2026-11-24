import { ArrowLeft } from "lucide-react";
import { bandFor, evaluateOverall } from "@/education/tracking/trackingBands";
import {
  METRIC_KEYS,
  TRACKING_METRICS,
  type LimitsByMetric,
} from "@/education/tracking/trackingMetrics";
import type { TrackingStudentRow } from "@/education/tracking/trackingTypes";
import { BandBadge } from "./BandBadge";
import { formatMetricValue, formatNumber } from "./trackingFormat";

/**
 * Öğrenci profili (Takip içinde): her ölçüt kendi bandıyla, ders ders net
 * tablosu ve öğrenci sayfasına bağlantı. Hedefler (2. dilim) ve notlar
 * (3. dilim) buraya eklenecek.
 */
export function TrackingStudentProfile({
  row,
  limits,
  onBack,
  onOpenStudent,
}: {
  row: TrackingStudentRow;
  limits: LimitsByMetric;
  onBack?: () => void;
  onOpenStudent?: (studentId: string) => void;
}) {
  const overall = evaluateOverall(row, limits);
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Listeye dön
            </button>
          ) : null}
          <h2 className="flex flex-wrap items-center gap-2 font-display text-[17px] font-extrabold text-slate-900">
            {row.studentName}
            <BandBadge band={overall.band} />
          </h2>
          <p className="text-[11px] text-slate-500">{row.classNames}</p>
        </div>
        {onOpenStudent ? (
          <button
            type="button"
            onClick={() => onOpenStudent(row.studentId)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
          >
            Öğrenci sayfasını aç
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_KEYS.filter(key => !TRACKING_METRICS[key].needsSubject).map(
          key => {
            const metric = TRACKING_METRICS[key];
            const value = metric.value(row);
            return (
              <div key={key} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-500">
                    {metric.label}
                  </p>
                  <BandBadge
                    band={bandFor(value, metric.direction, limits[key])}
                  />
                </div>
                <p className="mt-1 text-[18px] font-extrabold text-slate-900">
                  {formatMetricValue(metric, value)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {metric.detail(row)}
                </p>
              </div>
            );
          }
        )}
      </div>

      {row.subjectNets.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-bold">Ders</th>
                <th className="py-2 pr-3 font-bold">Ortalama net</th>
                <th className="py-2 pr-3 font-bold">Sınıf</th>
                <th className="py-2 pr-3 font-bold">Durum</th>
                <th className="py-2 font-bold">Deneme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {row.subjectNets.map(subject => (
                <tr key={subject.subjectId}>
                  <td className="py-2 pr-3 font-bold text-slate-800">
                    {subject.subjectName}
                  </td>
                  <td className="py-2 pr-3">{formatNumber(subject.avgNet)}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {subject.classAvg !== undefined
                      ? formatNumber(subject.classAvg)
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <BandBadge
                      band={bandFor(
                        subject.avgNet,
                        "higher_better",
                        limits.subject_net
                      )}
                    />
                  </td>
                  <td className="py-2 text-slate-500">{subject.examCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-slate-500">
          Bu aralıkta ders ders sonucu girilmiş deneme yok.
        </p>
      )}
    </section>
  );
}

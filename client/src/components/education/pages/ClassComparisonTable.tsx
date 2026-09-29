import { Download } from "lucide-react";
import { classComparisonCsv } from "@/education/reportCsv";
import type { ClassComparisonRow } from "@/education/reportService";
import { EmptyState } from "../shared";

/**
 * Sınıf karşılaştırması (karar 2026-09-29): her sınıf tek satır — devam,
 * ödev tamamlama, net deneme ortalaması. Satıra tıklamak üstteki sınıf
 * süzgecini o sınıfa çevirir. Tablo CSV olarak indirilir.
 */
export function ClassComparisonTable({
  rows,
  weeks,
  selectedClassId,
  onSelectClass,
  today,
  isLoading = false,
  error = null,
}: {
  rows: ClassComparisonRow[] | undefined;
  weeks: number;
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
  today: string;
  isLoading?: boolean;
  error?: Error | null;
}) {
  const download = () => {
    if (!rows) return;
    const blob = new Blob([classComparisonCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orbit-sinif-karsilastirma-${weeks}-hafta-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <h2 className="font-display text-[16px] font-extrabold text-slate-900">
            Sınıf karşılaştırma
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Son {weeks} takvim haftası · satıra tıklayınca kartlar o sınıfa
            geçer
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={!rows || rows.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold">CSV indir</span>
        </button>
      </div>
      {error ? (
        <p role="alert" className="p-4 text-[12px] text-rose-600">
          Karşılaştırma alınamadı: {error.message}
        </p>
      ) : isLoading ? (
        <p role="status" className="p-4 text-[12px] text-slate-400">
          Yükleniyor…
        </p>
      ) : !rows || rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Karşılaştırılacak sınıf yok" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
                <th className="px-5 py-3">Sınıf</th>
                <th className="px-5 py-3">Öğrenci</th>
                <th className="px-5 py-3">Devam</th>
                <th className="px-5 py-3">Ödev tamamlama</th>
                <th className="px-5 py-3">Ortalama net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.classId}
                  className={`border-b border-slate-100 text-[12px] last:border-0 ${
                    row.classId === selectedClassId ? "bg-blue-50/60" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectClass(row.classId)}
                      className="font-extrabold text-slate-800 hover:text-blue-700"
                    >
                      {row.className}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {row.studentCount}
                  </td>
                  <td className="px-5 py-3">
                    <Percent value={row.attendancePercent} />
                  </td>
                  <td className="px-5 py-3">
                    <Percent value={row.homeworkPercent} />
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {row.netAverage !== undefined ? (
                      <>
                        <span className="font-bold">
                          {row.netAverage.toLocaleString("tr-TR", {
                            maximumFractionDigits: 1,
                          })}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-400">
                          · {row.netExamCount} deneme
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Percent({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="w-9 font-bold text-slate-700">%{value}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <span
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          className="block h-full rounded-full bg-blue-500"
        />
      </span>
    </span>
  );
}

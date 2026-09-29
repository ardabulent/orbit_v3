import { AlertTriangle } from "lucide-react";
import { attentionReasons } from "@/education/attentionReasons";
import type { AttentionStudent } from "@/education/reportService";
import { EmptyState } from "../shared";

/**
 * Dikkat listesi (karar 2026-09-29): seçili aralıkta devam < %80, ödev
 * < %60, 5+ net düşüş ya da sınıf ortalamasının 10+ net altı. Liste ve sıra
 * veritabanından gelir (çok nedenli önce); ada tıklamak öğrenci sayfasını
 * açar.
 */
export function AttentionList({
  rows,
  weeks,
  onOpenStudent,
  isLoading = false,
  error = null,
}: {
  rows: AttentionStudent[] | undefined;
  weeks: number;
  onOpenStudent: (studentId: string) => void;
  isLoading?: boolean;
  error?: Error | null;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="border-b border-slate-100 p-4">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-slate-900">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Dikkat listesi
          {rows && rows.length > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
              {rows.length}
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Son {weeks} takvim haftası · devam %80 altı, ödev %60 altı, 5+ net
          düşüş ya da sınıf ortalamasının 10+ net altı
        </p>
      </div>
      {error ? (
        <p role="alert" className="p-4 text-[12px] text-rose-600">
          Dikkat listesi alınamadı: {error.message}
        </p>
      ) : isLoading ? (
        <p role="status" className="p-4 text-[12px] text-slate-400">
          Yükleniyor…
        </p>
      ) : !rows || rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Bu aralıkta dikkat gerektiren öğrenci yok"
            description="Hiçbir öğrenci dört koşuldan birine takılmıyor."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(row => (
            <li
              key={row.studentId}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
            >
              <div>
                <button
                  type="button"
                  onClick={() => onOpenStudent(row.studentId)}
                  className="text-[13px] font-extrabold text-slate-800 hover:text-blue-700"
                >
                  {row.studentName}
                </button>
                <p className="text-[11px] text-slate-500">{row.classNames}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {attentionReasons(row).map(reason => (
                  <span
                    key={reason}
                    className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

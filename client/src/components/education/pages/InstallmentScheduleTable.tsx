import { Lock, Plus, X } from "lucide-react";
import { formatCurrency, type Installment } from "@/education/paymentService";
import type { ScheduleRow } from "@/education/paymentSchedule";
import { formatTrDate, orbitLocalDate } from "@/education/trDate";

const INPUT =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] outline-none focus:border-blue-500";

/**
 * Ödeme planı taksit tablosu (2026-09-30, tek ekran). Ödenmiş taksitler
 * kilitli ve yalnız okunur; ödenmemişlerin tarihi ve tutarı satırda
 * düzeltilir, satır eklenir ya da çıkarılır.
 */
export function InstallmentScheduleTable({
  paid,
  rows,
  onChange,
  disabled = false,
}: {
  paid: Installment[];
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<ScheduleRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
            <th className="px-3 py-2">Sıra</th>
            <th className="px-3 py-2">Vade</th>
            <th className="px-3 py-2">Tutar (₺)</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paid.map(inst => (
            <tr key={inst.id} className="bg-emerald-50/50 text-slate-600">
              <td className="px-3 py-2 font-bold">{inst.sequenceNo}</td>
              <td className="px-3 py-2">{formatTrDate(inst.dueDate)}</td>
              <td className="px-3 py-2 font-bold">
                {formatCurrency(inst.amount)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] text-emerald-700">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Ödendi ·{" "}
                  {inst.paidAt ? formatTrDate(orbitLocalDate(inst.paidAt)) : ""}
                </span>
              </td>
            </tr>
          ))}
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-3 py-1.5 font-bold text-slate-700">
                {paid.length + index + 1}
                {row.isDownPayment ? (
                  <span className="ml-1 text-[10px] font-semibold text-slate-400">
                    peşinat
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="date"
                  aria-label={`${paid.length + index + 1}. taksit vadesi`}
                  value={row.dueDate}
                  disabled={disabled}
                  onChange={e => update(index, { dueDate: e.target.value })}
                  className={INPUT}
                />
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  aria-label={`${paid.length + index + 1}. taksit tutarı`}
                  value={Number.isFinite(row.amount) ? row.amount : ""}
                  disabled={disabled}
                  onChange={e =>
                    update(index, { amount: Number(e.target.value) })
                  }
                  className={INPUT}
                />
              </td>
              <td className="px-3 py-1.5 text-right">
                <button
                  type="button"
                  aria-label="Satırı çıkar"
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...rows,
            {
              dueDate: rows[rows.length - 1]?.dueDate ?? "",
              amount: 0,
            },
          ])
        }
        className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-blue-600 hover:bg-blue-50"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="text-[12px] font-bold">Satır ekle</span>
      </button>
    </div>
  );
}

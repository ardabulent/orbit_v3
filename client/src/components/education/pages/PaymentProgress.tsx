import { formatCurrency } from "@/education/paymentService";
import type { PaymentRow } from "../types";
import { paidPercent } from "./paymentFilters";

/**
 * Planın ödenen/taksite bölünen ilerlemesi. Özet yoksa hiç çizilmez —
 * sıfır ilerleme uydurulmaz (K-03). Taksite bölünen tutar paket
 * tutarından farklıysa ikisi de yazılır.
 */
export function PaymentProgress({ row }: { row: PaymentRow }) {
  const percent = paidPercent(row);
  if (percent === null || row.paidAmount === undefined) {
    return (
      <span className="text-[11px] text-slate-400">
        {row.installmentCount === 0 ? "Taksit girilmemiş" : "—"}
      </span>
    );
  }
  const scheduled = row.scheduledAmount ?? 0;
  return (
    <span className="block min-w-[160px]">
      <span className="flex justify-between text-[11px]">
        <span className="font-bold text-slate-700">
          {formatCurrency(row.paidAmount)}
        </span>
        <span className="text-slate-400">/ {formatCurrency(scheduled)}</span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
        <span
          style={{ width: `${percent}%` }}
          className={`block h-full rounded-full ${percent === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
        />
      </span>
      {scheduled !== row.totalAmount ? (
        <span className="mt-0.5 block text-[10px] text-amber-700">
          Paket {formatCurrency(row.totalAmount)} · taksitlere bölünen{" "}
          {formatCurrency(scheduled)}
        </span>
      ) : null}
    </span>
  );
}

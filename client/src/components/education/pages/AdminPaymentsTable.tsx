import { useState } from "react";
import { Search } from "lucide-react";
import { Badge, EmptyState } from "../shared";
import type { PaymentRow } from "../types";
import {
  PAYMENT_FILTERS,
  isCompleted,
  matchesPaymentFilter,
  matchesPaymentSearch,
  type PaymentFilter,
} from "./paymentFilters";
import { PaymentProgress } from "./PaymentProgress";

/**
 * Yöneticinin ödeme listesi (karar 2026-09-29): süzgeç (tümü / vadesi
 * geçen / bu ay / tamamlanan), öğrenci ya da paket araması, plan başına
 * ödenen/kalan ilerlemesi ve gecikmiş taksit sayısı.
 */
export function AdminPaymentsTable({
  rows,
  today,
  onSelectPlan,
}: {
  rows: PaymentRow[];
  today: string;
  onSelectPlan?: (plan: PaymentRow) => void;
}) {
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [query, setQuery] = useState("");
  const shown = rows.filter(
    row =>
      matchesPaymentFilter(row, filter, today) &&
      matchesPaymentSearch(row, query)
  );

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_FILTERS.map(option => {
            const count = rows.filter(row =>
              matchesPaymentFilter(row, option.value, today)
            ).length;
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-1.5 transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-[11px] font-bold">
                  {option.label} · {count}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Öğrenci ya da paket ara"
            aria-label="Öğrenci ya da paket ara"
            className="h-8 w-56 rounded-lg border border-slate-200 pl-8 pr-2 text-[12px]"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
              <th className="px-5 py-3">Öğrenci</th>
              <th className="px-5 py-3">Kayıt paketi</th>
              <th className="px-5 py-3">Ödenen</th>
              <th className="px-5 py-3">Sonraki taksit</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <EmptyState title="Gösterilecek ödeme kaydı yok" />
                </td>
              </tr>
            ) : null}
            {shown.map(row => (
              <tr
                key={row.id}
                className="border-b border-slate-100 text-[12px] last:border-0"
              >
                <td className="px-5 py-3.5 font-extrabold text-slate-800">
                  {row.student}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{row.plan}</td>
                <td className="px-5 py-3.5">
                  <PaymentProgress row={row} />
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {row.due ? (
                    <>
                      <span className="block font-semibold">{row.due}</span>
                      <span className="block text-[11px] text-slate-500">
                        {row.amount}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge row={row} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  {onSelectPlan ? (
                    <button
                      type="button"
                      onClick={() => onSelectPlan(row)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <span className="text-[11px] font-bold">Detay</span>
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ row }: { row: PaymentRow }) {
  if (row.overdueCount === undefined) return null;
  if (row.overdueCount > 0)
    return <Badge tone="rose">{row.overdueCount} taksit gecikmiş</Badge>;
  if (isCompleted(row)) return <Badge tone="blue">Tamamlandı</Badge>;
  return <Badge tone="green">Güncel</Badge>;
}

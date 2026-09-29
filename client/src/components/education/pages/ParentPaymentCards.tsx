import { formatCurrency, type Installment } from "@/education/paymentService";
import { formatTrDate, orbitLocalDate } from "@/education/trDate";
import { Badge, EmptyState } from "../shared";
import type { PaymentRow } from "../types";
import { installmentStatus } from "./paymentFilters";
import { PaymentProgress } from "./PaymentProgress";

/**
 * Velinin ödeme görünümü (karar 2026-09-29): her plan bir kart — toplam,
 * ödenen, kalan, ilerleme ve bütün taksitler (ödendi tarihiyle / vadesi /
 * gecikti). Taksitler tek sorguda yukarıdan gelir.
 */
export function ParentPaymentCards({
  rows,
  installments,
  installmentsError,
  today,
}: {
  rows: PaymentRow[];
  installments: Map<string, Installment[]>;
  installmentsError?: boolean;
  today: string;
}) {
  if (rows.length === 0)
    return (
      <div className="mt-6">
        <EmptyState title="Gösterilecek ödeme kaydı yok" />
      </div>
    );

  const children = new Set(rows.map(r => r.studentId));
  return (
    <div className="mt-6 space-y-4">
      {rows.map(row => {
        const list = installments.get(row.id) ?? [];
        const remaining =
          row.scheduledAmount !== undefined && row.paidAmount !== undefined
            ? row.scheduledAmount - row.paidAmount
            : null;
        return (
          <article
            key={row.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[16px] font-extrabold tracking-[-.03em] text-slate-900">
                  {row.plan}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {children.size > 1 ? `${row.student} · ` : ""}
                  Paket tutarı {formatCurrency(row.totalAmount)}
                  {remaining !== null
                    ? ` · Kalan ${formatCurrency(remaining)}`
                    : ""}
                </p>
              </div>
              {row.overdueCount ? (
                <Badge tone="rose">{row.overdueCount} taksit gecikmiş</Badge>
              ) : null}
            </div>
            <div className="mt-3 max-w-sm">
              <PaymentProgress row={row} />
            </div>

            {installmentsError ? (
              <p className="mt-4 text-[11px] text-rose-600">
                Taksit listesi alınamadı.
              </p>
            ) : list.length === 0 ? (
              <p className="mt-4 text-[11px] text-slate-400">
                Bu plana henüz taksit girilmemiş.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {list.map(item => {
                  const status = installmentStatus(item, today);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12px]"
                    >
                      <span className="text-slate-600">
                        {item.sequenceNo}. taksit · vadesi{" "}
                        {formatTrDate(item.dueDate)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {formatCurrency(item.amount)}
                        </span>
                        <Badge tone={status.tone}>
                          {status.kind === "paid" && item.paidAt
                            ? `Ödendi · ${formatTrDate(orbitLocalDate(item.paidAt))}`
                            : status.kind === "overdue"
                              ? "Gecikti"
                              : "Bekliyor"}
                        </Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

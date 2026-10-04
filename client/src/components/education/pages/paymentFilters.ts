import type { Installment } from "@/education/paymentService";
import type { PaymentRow } from "../types";
import { matchesSearch } from "@/education/turkishSearch";

/**
 * Kayıt ve Ödemeler ekranının saf yardımcıları (karar 2026-09-29).
 * Sayılar `payment_plan_summaries`'tan gelir; burada yalnız süzülür ve
 * biçimlenir. Özeti olmayan satır (yetki/hata) hiçbir süzgece "tamamlandı"
 * ya da "gecikmiş" diye girmez — bilinmeyen bir durum iddia edilmez (K-03).
 */

export type PaymentFilter = "all" | "overdue" | "thisMonth" | "completed";

export const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "overdue", label: "Vadesi geçen" },
  { value: "thisMonth", label: "Bu ay vadesi gelen" },
  { value: "completed", label: "Tamamlanan" },
];

export function isCompleted(row: PaymentRow): boolean {
  return (
    row.installmentCount !== undefined &&
    row.installmentCount > 0 &&
    row.paidCount === row.installmentCount
  );
}

export function matchesPaymentFilter(
  row: PaymentRow,
  filter: PaymentFilter,
  today: string
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "overdue":
      return (row.overdueCount ?? 0) > 0;
    case "thisMonth": {
      if (!row.nextDueDate) return false;
      const month = today.slice(0, 7);
      return row.nextDueDate.slice(0, 7) === month && row.nextDueDate >= today;
    }
    case "completed":
      return isCompleted(row);
  }
}

/** Öğrenci adı ya da paket adında arar ("isik" → "Işık"; turkishSearch). */
export function matchesPaymentSearch(row: PaymentRow, query: string): boolean {
  return matchesSearch(`${row.student} ${row.plan}`, query);
}

/** Ödenen / taksitlere bölünen oranı (0–100); özet yoksa `null`. */
export function paidPercent(row: PaymentRow): number | null {
  if (row.scheduledAmount === undefined || row.paidAmount === undefined)
    return null;
  if (row.scheduledAmount <= 0) return null;
  return Math.min(
    100,
    Math.round((row.paidAmount / row.scheduledAmount) * 100)
  );
}

export type InstallmentStatus =
  | { kind: "paid"; tone: "green" }
  | { kind: "overdue"; tone: "rose" }
  | { kind: "upcoming"; tone: "slate" };

export function installmentStatus(
  installment: Pick<Installment, "paidAt" | "dueDate">,
  today: string
): InstallmentStatus {
  if (installment.paidAt) return { kind: "paid", tone: "green" };
  if (installment.dueDate < today) return { kind: "overdue", tone: "rose" };
  return { kind: "upcoming", tone: "slate" };
}

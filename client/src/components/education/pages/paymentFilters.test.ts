import { describe, expect, it } from "vitest";
import type { PaymentRow } from "../types";
import {
  installmentStatus,
  isCompleted,
  matchesPaymentFilter,
  matchesPaymentSearch,
  paidPercent,
} from "./paymentFilters";

const TODAY = "2026-09-29";

const row = (over: Partial<PaymentRow>): PaymentRow => ({
  id: "p",
  studentId: "s",
  student: "Selin Koç",
  plan: "YKS Paketi",
  due: "",
  amount: "",
  totalAmount: 30000,
  ...over,
});

describe("matchesPaymentFilter", () => {
  it("vadesi geçen: gecikmiş taksiti olan", () => {
    expect(
      matchesPaymentFilter(row({ overdueCount: 2 }), "overdue", TODAY)
    ).toBe(true);
    expect(
      matchesPaymentFilter(row({ overdueCount: 0 }), "overdue", TODAY)
    ).toBe(false);
  });

  it("bu ay: sıradaki taksit bu ay ve bugün ya da sonra", () => {
    expect(
      matchesPaymentFilter(
        row({ nextDueDate: "2026-09-30" }),
        "thisMonth",
        TODAY
      )
    ).toBe(true);
    // Bu ay ama geçmiş: gecikmiş sayılır, "bu ay vadesi gelen" değil.
    expect(
      matchesPaymentFilter(
        row({ nextDueDate: "2026-09-10" }),
        "thisMonth",
        TODAY
      )
    ).toBe(false);
    expect(
      matchesPaymentFilter(
        row({ nextDueDate: "2026-10-01" }),
        "thisMonth",
        TODAY
      )
    ).toBe(false);
  });

  it("tamamlanan: bütün taksitler ödenmiş; özeti olmayan tamamlanmış sayılmaz", () => {
    expect(isCompleted(row({ installmentCount: 3, paidCount: 3 }))).toBe(true);
    expect(isCompleted(row({ installmentCount: 3, paidCount: 2 }))).toBe(false);
    expect(isCompleted(row({ installmentCount: 0, paidCount: 0 }))).toBe(false);
    expect(isCompleted(row({}))).toBe(false);
  });
});

describe("matchesPaymentSearch", () => {
  it("öğrenci ya da paket adında, Türkçe harf kuralıyla", () => {
    expect(matchesPaymentSearch(row({}), "SELİN")).toBe(true);
    expect(matchesPaymentSearch(row({}), "yks")).toBe(true);
    expect(matchesPaymentSearch(row({}), "deniz")).toBe(false);
    expect(matchesPaymentSearch(row({}), "  ")).toBe(true);
  });
});

describe("paidPercent", () => {
  it("ödenen / taksite bölünen; özet yoksa ya da taksit yoksa null", () => {
    expect(
      paidPercent(row({ paidAmount: 10000, scheduledAmount: 25000 }))
    ).toBe(40);
    expect(paidPercent(row({}))).toBeNull();
    expect(paidPercent(row({ paidAmount: 0, scheduledAmount: 0 }))).toBeNull();
  });
});

describe("installmentStatus", () => {
  it("ödendi · gecikti · bekliyor", () => {
    expect(
      installmentStatus(
        { paidAt: "2026-09-01T10:00:00Z", dueDate: "2026-09-01" },
        TODAY
      ).kind
    ).toBe("paid");
    expect(
      installmentStatus({ paidAt: null, dueDate: "2026-09-28" }, TODAY).kind
    ).toBe("overdue");
    expect(
      installmentStatus({ paidAt: null, dueDate: TODAY }, TODAY).kind
    ).toBe("upcoming");
  });
});

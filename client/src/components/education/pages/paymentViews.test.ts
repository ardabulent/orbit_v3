import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PaymentRow } from "../types";
import { AdminPaymentsTable } from "./AdminPaymentsTable";
import { ParentPaymentCards } from "./ParentPaymentCards";

(globalThis as unknown as { React: typeof React }).React = React;

const TODAY = "2026-09-29";

const rows: PaymentRow[] = [
  {
    id: "p1",
    studentId: "s1",
    student: "Selin Koç",
    plan: "YKS Paketi",
    due: "15 Eylül 2026",
    amount: "10.000,00 ₺",
    totalAmount: 30000,
    overdueCount: 1,
    nextDueDate: "2026-09-15",
    installmentCount: 3,
    paidCount: 1,
    scheduledAmount: 25000,
    paidAmount: 10000,
  },
  {
    id: "p2",
    studentId: "s2",
    student: "Deniz Aydın",
    plan: "LGS Paketi",
    due: "",
    amount: "",
    totalAmount: 20000,
    overdueCount: 0,
    nextDueDate: null,
    installmentCount: 2,
    paidCount: 2,
    scheduledAmount: 20000,
    paidAmount: 20000,
  },
];

describe("AdminPaymentsTable (2026-09-29)", () => {
  it("süzgeç sayıları, ödenen/taksite bölünen ve durum rozetleri", () => {
    const html = renderToStaticMarkup(
      createElement(AdminPaymentsTable, { rows, today: TODAY })
    );
    expect(html).toContain("Tümü · 2");
    expect(html).toContain("Vadesi geçen · 1");
    expect(html).toContain("Tamamlanan · 1");
    expect(html).toContain("1 taksit gecikmiş");
    expect(html).toContain("Tamamlandı");
    // Paket 30.000 ama taksitlere 25.000 bölünmüş: ikisi de yazılır.
    expect(html).toContain("taksitlere bölünen");
  });
});

describe("ParentPaymentCards (2026-09-29)", () => {
  it("her plan kart; bütün taksitler durumlarıyla, kalan tutar", () => {
    const html = renderToStaticMarkup(
      createElement(ParentPaymentCards, {
        rows: [rows[0]],
        today: TODAY,
        installments: new Map([
          [
            "p1",
            [
              {
                id: "i1",
                organizationId: "o",
                planId: "p1",
                sequenceNo: 1,
                dueDate: "2026-08-15",
                amount: 10000,
                paidAt: "2026-08-14T09:00:00Z",
              },
              {
                id: "i2",
                organizationId: "o",
                planId: "p1",
                sequenceNo: 2,
                dueDate: "2026-09-15",
                amount: 10000,
                paidAt: null,
              },
              {
                id: "i3",
                organizationId: "o",
                planId: "p1",
                sequenceNo: 3,
                dueDate: "2026-10-15",
                amount: 5000,
                paidAt: null,
              },
            ],
          ],
        ]),
      })
    );
    expect(html).toContain("YKS Paketi");
    expect(html).toContain("Kalan");
    expect(html).toContain("Ödendi · 14 Ağustos 2026");
    expect(html).toContain("Gecikti");
    expect(html).toContain("Bekliyor");
  });
});

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

const rpc = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: (name: string, args: unknown) => rpc(name, args) },
}));

import { InstallmentScheduleTable } from "@/components/education/pages/InstallmentScheduleTable";
import { savePaymentPlan } from "./paymentService";

describe("ödeme planı tek ekran (2026-09-30)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("plan ve taksitler tek çağrıyla gider; tutarlar sayı", async () => {
    rpc.mockResolvedValue({ data: "plan-1", error: null });

    const id = await savePaymentPlan({
      organizationId: "o",
      planId: null,
      studentId: "s",
      name: "  YKS Paketi  ",
      totalAmount: 30000,
      installments: [
        { dueDate: "2026-10-15", amount: 15000 },
        { dueDate: "2026-11-15", amount: 15000 },
      ],
    });

    expect(id).toBe("plan-1");
    expect(rpc).toHaveBeenCalledWith("save_payment_plan", {
      p_organization_id: "o",
      p_plan_id: null,
      p_student_id: "s",
      p_name: "YKS Paketi",
      p_total_amount: 30000,
      p_installments: [
        { due_date: "2026-10-15", amount: 15000 },
        { due_date: "2026-11-15", amount: 15000 },
      ],
    });
  });

  it("sunucunun 'toplam eşit değil' iletisi Türkçe olduğu gibi gösterilir", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message:
          "Taksitlerin toplamı (20000) paket tutarına (30000) eşit değil",
      },
    });

    await expect(
      savePaymentPlan({
        organizationId: "o",
        planId: "p",
        studentId: null,
        name: "YKS",
        totalAmount: 30000,
        installments: [{ dueDate: "2026-10-15", amount: 20000 }],
      })
    ).rejects.toThrow("paket tutarına (30000) eşit değil");
  });

  it("tablo: ödenmiş taksit kilitli ve düzenlenemez, öbürleri satırda düzenlenir", () => {
    const html = renderToStaticMarkup(
      createElement(InstallmentScheduleTable, {
        paid: [
          {
            id: "i1",
            organizationId: "o",
            planId: "p",
            sequenceNo: 1,
            dueDate: "2026-09-15",
            amount: 10000,
            paidAt: "2026-09-14T09:00:00Z",
          },
        ],
        rows: [
          { dueDate: "2026-10-15", amount: 5000, isDownPayment: true },
          { dueDate: "2026-11-15", amount: 15000 },
        ],
        onChange: () => {},
      })
    );
    expect(html).toContain("Ödendi");
    // Ödenmiş satırda girdi yok; yeni satırlar 2. ve 3. sıradan başlar.
    expect(html).not.toContain("1. taksit tutarı");
    expect(html).toContain("2. taksit tutarı");
    expect(html).toContain("3. taksit vadesi");
    expect(html).toContain("peşinat");
    expect(html).toContain("Satır ekle");
  });
});

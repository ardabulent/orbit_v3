import { describe, expect, it } from "vitest";
import { addMonthsIso, buildSchedule, sumAmounts } from "./paymentSchedule";

describe("ödeme planı taksit tablosu (2026-09-30)", () => {
  it("peşinat + eşit taksitler; kalan son taksite eklenir, toplam tutar", () => {
    const rows = buildSchedule({
      total: 30000,
      downPayment: 5000,
      downPaymentDate: "2026-10-01",
      installmentCount: 3,
      firstDueDate: "2026-11-15",
    });
    expect(rows).toEqual([
      { dueDate: "2026-10-01", amount: 5000, isDownPayment: true },
      { dueDate: "2026-11-15", amount: 8333 },
      { dueDate: "2026-12-15", amount: 8333 },
      { dueDate: "2027-01-15", amount: 8334 },
    ]);
    expect(sumAmounts(rows)).toBe(30000);
  });

  it("kuruşlu tutarda da toplam birebir tutar", () => {
    const rows = buildSchedule({
      total: 1000.5,
      downPayment: 0,
      downPaymentDate: null,
      installmentCount: 3,
      firstDueDate: "2026-10-31",
    });
    expect(rows.map(r => r.amount)).toEqual([333, 333, 334.5]);
    expect(sumAmounts(rows)).toBe(1000.5);
  });

  it("ay sonu: 31 Ekim + 4 ay = 28 Şubat; artık yılda 29", () => {
    expect(addMonthsIso("2026-10-31", 4)).toBe("2027-02-28");
    expect(addMonthsIso("2027-10-31", 4)).toBe("2028-02-29");
    expect(addMonthsIso("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("peşinat toplamın tamamıysa tek satır", () => {
    expect(
      buildSchedule({
        total: 5000,
        downPayment: 5000,
        downPaymentDate: "2026-10-01",
        installmentCount: 3,
        firstDueDate: "2026-11-01",
      })
    ).toEqual([{ dueDate: "2026-10-01", amount: 5000, isDownPayment: true }]);
  });

  it("⛔ geçersiz girdide tablo kurulmaz", () => {
    const temel = {
      total: 1000,
      downPayment: 0,
      downPaymentDate: null,
      installmentCount: 2,
      firstDueDate: "2026-10-01",
    };
    expect(buildSchedule({ ...temel, total: 0 })).toEqual([]);
    expect(buildSchedule({ ...temel, downPayment: 2000 })).toEqual([]);
    expect(buildSchedule({ ...temel, installmentCount: 0 })).toEqual([]);
    expect(buildSchedule({ ...temel, firstDueDate: "" })).toEqual([]);
    // 2 lira 3 taksite bölünemez (sıfır taksit çıkar)
    expect(buildSchedule({ ...temel, total: 2, installmentCount: 3 })).toEqual(
      []
    );
  });
});

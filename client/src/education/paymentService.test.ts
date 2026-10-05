import { beforeEach, describe, expect, it, vi } from "vitest";
import { READ_PAGE_SIZE } from "@/lib/pagedRead";
import {
  PAYMENT_TOTAL_CAP,
  extractStudentName,
  formatCurrency,
  loadPaymentOverviewCounts,
  loadPaymentPlanSummaries,
  loadPayments,
  loadStudentPaymentStatuses,
  mapPaymentRow,
  archivePaymentPlan,
  restorePaymentPlan,
  loadPlanInstallments,
  markInstallmentPaid,
  unmarkInstallmentPaid,
  translatePaymentError,
  type PaymentPlanSummary,
  type RawPaymentPlanRow,
} from "./paymentService";
import { buildPaymentStats } from "@/components/education/educationData";
import { PaymentsPage } from "@/components/education/pages/PaymentsPage";
import type { PaymentRow } from "@/components/education/types";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({
    identity: {
      displayName: "Ayşe Yalçın",
      membership: { organizationId: "org-1" },
    },
  }),
}));

type QueryResult = { data: unknown; error: unknown };

function createQueryChain(
  result: QueryResult,
  spy?: {
    selectArg?: string;
    eqArgs?: [string, unknown][];
    isArgs?: [string, unknown];
    ilikeArgs?: [string, unknown][];
    orderArgs?: [string, { ascending?: boolean }][];
    limitArg?: number;
  }
) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn((columns: string) => {
    if (spy) spy.selectArg = columns;
    return chain;
  });
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (spy) {
      if (!spy.eqArgs) spy.eqArgs = [];
      spy.eqArgs.push([col, val]);
    }
    return chain;
  });
  chain.is = vi.fn((col: string, val: unknown) => {
    if (spy) spy.isArgs = [col, val];
    return chain;
  });
  chain.ilike = vi.fn((col: string, val: unknown) => {
    if (spy) {
      if (!spy.ilikeArgs) spy.ilikeArgs = [];
      spy.ilikeArgs.push([col, val]);
    }
    return chain;
  });
  chain.order = vi.fn((col: string, opts: { ascending?: boolean }) => {
    if (spy) {
      if (!spy.orderArgs) spy.orderArgs = [];
      spy.orderArgs.push([col, opts]);
    }
    return chain;
  });
  chain.limit = vi.fn((limit: number) => {
    if (spy) spy.limitArg = limit;
    return Promise.resolve(result);
  });
  // Sayfalı okuma (2026-10-05): `range(from, to)` verinin o dilimini döner;
  // `limitArg` istenen satırın üst ucu (to + 1).
  chain.range = vi.fn((from: number, to: number) => {
    if (spy) spy.limitArg = to + 1;
    const res = result as { data?: unknown; error?: unknown };
    if (res.error || !Array.isArray(res.data)) return Promise.resolve(result);
    return Promise.resolve({ ...res, data: res.data.slice(from, to + 1) });
  });
  return chain;
}

describe("paymentService (v1.3-01 · E parçası)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatCurrency & extractStudentName", () => {
    it("tutarları Türkçe para formatına çevirir (ör. ₺7.200)", () => {
      expect(formatCurrency(7200)).toBe("₺7.200");
      expect(formatCurrency(6800.5)).toBe("₺6.800,5");
      expect(formatCurrency(248600)).toBe("₺248.600");
      expect(formatCurrency(0)).toBe("₺0");
    });

    it("geçersiz değerlerde boş dizge döner (K-04)", () => {
      expect(formatCurrency(NaN)).toBe("");
      expect(formatCurrency(undefined as unknown as number)).toBe("");
    });

    it("öğrenci nesnesinden veya dizisinden ad çıkarır", () => {
      expect(extractStudentName({ full_name: "Zeynep Kaya" })).toBe(
        "Zeynep Kaya"
      );
      expect(extractStudentName([{ full_name: "Ali Can" }])).toBe("Ali Can");
      expect(extractStudentName(null)).toBe("");
      expect(extractStudentName(undefined)).toBe("");
    });
  });

  describe("mapPaymentRow (K-22, K-03 & Durum Kuralı)", () => {
    it("vadesi geçmiş taksit olduğunda (overdue_count > 0) durum 'Takip gerekli' olur", () => {
      const plan: RawPaymentPlanRow = {
        id: "plan-1",
        name: "YKS Eşit Ağırlık Paket",
        student_id: "stu-1",
        students: { full_name: "Aras Öztürk" },
      };
      const summary: PaymentPlanSummary = {
        planId: "plan-1",
        overdueCount: 1,
        nextDueDate: "2026-08-18",
        nextDueAmount: 6800,
      };

      const row = mapPaymentRow(plan, summary);
      expect(row.student).toBe("Aras Öztürk");
      expect(row.plan).toBe("YKS Eşit Ağırlık Paket");
      expect(row.due).toBe("18 Ağustos 2026");
      expect(row.amount).toBe("₺6.800");
      expect(row.status).toBe("Takip gerekli");
    });

    it("vadesi geçmiş taksit olmadığında (overdue_count = 0) durum 'Güncel' olur", () => {
      const plan: RawPaymentPlanRow = {
        id: "plan-2",
        name: "YKS Sayısal Paket",
        student_id: "stu-2",
        students: { full_name: "Zeynep Kaya" },
      };
      const summary: PaymentPlanSummary = {
        planId: "plan-2",
        overdueCount: 0,
        nextDueDate: "2026-09-05",
        nextDueAmount: 7200,
      };

      const row = mapPaymentRow(plan, summary);
      expect(row.status).toBe("Güncel");
      expect(row.due).toBe("5 Eylül 2026");
      expect(row.amount).toBe("₺7.200");
    });

    it("satır olmadığında (summary undefined) status undefined kalır, 'Güncel' uydurulmaz (K-22)", () => {
      const plan: RawPaymentPlanRow = {
        id: "plan-3",
        name: "Temel Paket",
        student_id: "stu-3",
        students: { full_name: "Can Demir" },
      };

      const row = mapPaymentRow(plan, undefined);
      expect(row.status).toBeUndefined();
      expect(row.due).toBe("");
      expect(row.amount).toBe("");
    });

    it("next_due_date veya next_due_amount null iken sütunlara hiçbir şey yazılmaz (K-22, K-03)", () => {
      const plan: RawPaymentPlanRow = {
        id: "plan-empty",
        name: "Taksitsiz Paket",
        student_id: "stu-4",
        students: { full_name: "Efe Kaya" },
      };
      const summary: PaymentPlanSummary = {
        planId: "plan-empty",
        overdueCount: 0,
        nextDueDate: null,
        nextDueAmount: null,
      };

      const row = mapPaymentRow(plan, summary);
      // ⛔ "0" ya da "—" yazılmaz, sütun boş kalır
      expect(row.due).toBe("");
      expect(row.amount).toBe("");
      expect(row.due).not.toBe("—");
      expect(row.amount).not.toBe("₺0");
      expect(row.amount).not.toBe("0");
    });
  });

  describe("loadStudentPaymentStatuses (RPC student_payment_summaries)", () => {
    it("boş listede veritabanına sorgu atmadan boş Map döner", async () => {
      const res = await loadStudentPaymentStatuses([]);
      expect(res.size).toBe(0);
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("PostgREST'ten DİZGE gelen overdue_count değerini doğru çevirir ve tek seferde çeker", async () => {
      rpcMock.mockResolvedValue({
        data: [
          { student_id: "stu-1", overdue_count: "2" }, // Dizge "2" -> Takip gerekli
          { student_id: "stu-2", overdue_count: "0" }, // Dizge "0" -> Güncel
        ],
        error: null,
      });

      const map = await loadStudentPaymentStatuses([
        "stu-1",
        "stu-2",
        "stu-3", // Planı olmayan öğrenci
      ]);

      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("student_payment_summaries", {
        target_student_ids: ["stu-1", "stu-2", "stu-3"],
      });

      // ⛔ installments tablosuna doğrudan sorgu atılmaz (K-03)
      expect(fromMock).not.toHaveBeenCalledWith("installments");

      expect(map.get("stu-1")).toBe("Takip gerekli");
      expect(map.get("stu-2")).toBe("Güncel");

      // ⛔ Ödeme planı olmayan öğrencinin durumu undefined kalır (K-22)
      expect(map.get("stu-3")).toBeUndefined();
    });

    it("⛔ Boş küme 'Güncel'e çevrilmez (öğretmen/öğrenci hali)", async () => {
      // Öğretmen ve öğrenci çağrısında fonksiyon boş dizi döndürür
      rpcMock.mockResolvedValue({
        data: [],
        error: null,
      });

      const map = await loadStudentPaymentStatuses(["stu-1", "stu-2"]);
      expect(map.size).toBe(0);
      expect(map.get("stu-1")).toBeUndefined();
      expect(map.get("stu-2")).toBeUndefined();
      // ⛔ Kesinlikle "Güncel" değil
      expect(map.get("stu-1")).not.toBe("Güncel");
    });

    it("veritabanı hatasında fail-closed davranarak boş Map döner (K-04)", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "timeout" },
      });

      const map = await loadStudentPaymentStatuses(["stu-1"]);
      expect(map.size).toBe(0);
    });
  });

  describe("loadPaymentPlanSummaries (RPC payment_plan_summaries)", () => {
    it("plan özetlerini fonksiyondan çeker ve sayıları dizgeden dönüştürür", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            plan_id: "plan-1",
            overdue_count: "1",
            next_due_date: "2026-08-18",
            next_due_amount: "6800.00", // PostgREST numeric string
          },
        ],
        error: null,
      });

      const map = await loadPaymentPlanSummaries(["plan-1"]);

      expect(rpcMock).toHaveBeenCalledWith("payment_plan_summaries", {
        target_plan_ids: ["plan-1"],
      });
      // ⛔ installments tablosuna doğrudan sorgu atılmaz
      expect(fromMock).not.toHaveBeenCalledWith("installments");

      const item = map.get("plan-1");
      expect(item?.overdueCount).toBe(1);
      expect(item?.nextDueDate).toBe("2026-08-18");
      expect(item?.nextDueAmount).toBe(6800);
      expect(typeof item?.nextDueAmount).toBe("number");
    });
  });

  describe("loadPayments (Plan Listesi & Sayfalama)", () => {
    it("payment_plans tablosunu sorgular, açık organization_id süzgeci uygular, özetleri bağlar ve arşivliyi eler (§4.12, #249)", async () => {
      const spy: {
        selectArg?: string;
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean }][];
        limitArg?: number;
      } = {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: [
              {
                id: "plan-1",
                name: "YKS Eşit Ağırlık Paket",
                student_id: "stu-1",
                students: { full_name: "Aras Öztürk" },
              },
            ],
            error: null,
          },
          spy
        )
      );

      rpcMock.mockResolvedValue({
        data: [
          {
            plan_id: "plan-1",
            overdue_count: "1",
            next_due_date: "2026-08-18",
            next_due_amount: "6800.00",
          },
        ],
        error: null,
      });

      const result = await loadPayments("org-1", {
        limit: PAYMENT_TOTAL_CAP,
      });

      expect(fromMock).toHaveBeenCalledWith("payment_plans");
      // ⛔ installments tablosuna doğrudan sorgu atılmaz
      expect(fromMock).not.toHaveBeenCalledWith("installments");
      expect(spy.selectArg).not.toContain("installments");

      // Açık organization_id süzgeci şarttır (§4.12)
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.orderArgs).toEqual([
        ["created_at", { ascending: false }],
        ["id", { ascending: false }],
      ]);
      // Sayfalı okuma (2026-10-05): ilk sayfa READ_PAGE_SIZE satır ister.
      expect(spy.limitArg).toBe(READ_PAGE_SIZE);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].student).toBe("Aras Öztürk");
      expect(result.rows[0].plan).toBe("YKS Eşit Ağırlık Paket");
      expect(result.rows[0].due).toBe("18 Ağustos 2026");
      expect(result.rows[0].amount).toBe("₺6.800");
      expect(result.rows[0].status).toBe("Takip gerekli");
      expect(result.truncated).toBe(false);
    });

    it("studentId ve search parametrelerini filtre olarak ekler", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        ilikeArgs?: [string, unknown][];
      } = {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: [],
            error: null,
          },
          spy
        )
      );
      rpcMock.mockResolvedValue({ data: [], error: null });

      await loadPayments("org-1", {
        studentId: "stu-1",
        search: " Paket ",
      });

      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["student_id", "stu-1"]);
      expect(spy.ilikeArgs).toContainEqual(["name", "%Paket%"]);
    });

    it("satır sayısı limite ulaştığında truncated true döner (K-03)", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: [{ id: "p1", name: "P1", student_id: "s1" }],
          error: null,
        })
      );
      rpcMock.mockResolvedValue({ data: [], error: null });

      const result = await loadPayments("org-1", { limit: 1 });
      expect(result.truncated).toBe(true);
    });

    it("veritabanı hatasında Türkçe anlamlı hata fırlatır (K-04)", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: null,
          error: { message: "database offline" },
        })
      );

      await expect(loadPayments("org-1")).rejects.toThrow(
        "Ödeme listesi yüklenemedi."
      );
    });
  });

  describe("loadPaymentOverviewCounts (RPC payment_overview_counts & 3.E)", () => {
    it("yönetici istatistik sayılarını çeker ve dizgeleri sayıya çevirir", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            collected_this_month: "1500.00",
            upcoming_count: "7",
            overdue_count: "2",
          },
        ],
        error: null,
      });

      const counts = await loadPaymentOverviewCounts();

      expect(rpcMock).toHaveBeenCalledWith("payment_overview_counts");
      // ⛔ installments tablosuna doğrudan sorgu atılmaz
      expect(fromMock).not.toHaveBeenCalledWith("installments");

      expect(counts).not.toBeNull();
      expect(counts?.collectedThisMonth).toBe(1500);
      expect(counts?.upcomingCount).toBe(7);
      expect(counts?.overdueCount).toBe(2);
    });

    it("⛔ Fonksiyon boş döndüğünde (yetkisiz çağırana satır dönmez) null döner, 0 uydurulmaz", async () => {
      rpcMock.mockResolvedValue({
        data: [], // having count(*) > 0 boş kümede hiç satır dönmez
        error: null,
      });

      const counts = await loadPaymentOverviewCounts();
      expect(counts).toBeNull();
    });

    it("hata durumunda null döner (K-04)", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      });

      const counts = await loadPaymentOverviewCounts();
      expect(counts).toBeNull();
    });
  });

  describe("buildPaymentStats (3.E Kart Eşlemesi)", () => {
    it("counts null iken boş dizi döner ve kartlar çizilmez (K-22)", () => {
      expect(buildPaymentStats(null)).toEqual([]);
    });

    it("counts verildiğinde üç kartın değerlerini biçimlendirir ve '%82' uydurmaz (K-03, #239)", () => {
      const stats = buildPaymentStats({
        collectedThisMonth: 1500,
        upcomingCount: 7,
        overdueCount: 2,
      });

      expect(stats).toHaveLength(3);

      // Kart 1: Bu ay tahsilat
      expect(stats[0].label).toBe("Bu ay tahsilat");
      expect(stats[0].value).toBe("₺1.500");
      // ⛔ "Planlanan tahsilatın %82'si" ÜRETİMDE ÜRETİLMEZ.
      // 2026-09-29: alt metin sayıyla çelişmez (eskiden "₺1.500 · Vadesi
      // gelen taksit yok" basılıyordu ve bu test onu sabitliyordu).
      expect(stats[0].detail).toBe("Bu ay ödenen taksitler");
      expect(stats[0].detail).not.toContain("%82");

      // Kart 2: Yaklaşan taksit
      expect(stats[1].label).toBe("Yaklaşan taksit");
      expect(stats[1].value).toBe("7");
      expect(stats[1].detail).toBe("Önümüzdeki 7 gün");

      // Kart 3: Takip gereken
      expect(stats[2].label).toBe("Takip gereken");
      expect(stats[2].value).toBe("2");
      expect(stats[2].detail).toBe("Vadesi geçmiş, ödenmemiş taksit");

      // Sıfırken "…yok" metni doğru ve kalır.
      const empty = buildPaymentStats({
        collectedThisMonth: 0,
        upcomingCount: 0,
        overdueCount: 0,
      });
      expect(empty[0].detail).toBe("Bu ay henüz ödeme yok");
      expect(empty[2].detail).toBe("Takip gereken ödeme yok");
    });
  });

  describe("PaymentsPage UI Davranışları (K-22 & Üretim vs Demo)", () => {
    it("üretimde (isDemo: false) yazma butonları (Yeni kayıt ve Hatırlat) KESİNLİKLE ÇİZİLMEZ", () => {
      const rows: PaymentRow[] = [
        {
          id: "plan-test-1",
          studentId: "stu-1",
          student: "Aras Öztürk",
          plan: "YKS Eşit Ağırlık Paket",
          due: "18 Ağustos 2026",
          amount: "₺6.800",
          totalAmount: 68000,
          status: "Takip gerekli",
        },
      ];

      const element = PaymentsPage({
        role: "admin",
        paymentRows: rows,
        overviewStats: [],
        isDemo: false,
      });

      const elementString = JSON.stringify(element);

      // Veriler çizilir
      expect(elementString).toContain("Aras Öztürk");
      expect(elementString).toContain("YKS Eşit Ağırlık Paket");
      expect(elementString).toContain("18 Ağustos 2026");
      expect(elementString).toContain("₺6.800");
      expect(elementString).toContain("Takip gerekli");

      // ⛔ ÜRETİMDE YAZMA BUTONLARI DEVRE DIŞIDIR:
      // 1. "Yeni kayıt" butonu yok
      expect(elementString).not.toContain("Yeni kayıt");
      // 2. "Hatırlat" butonu yok
      expect(elementString).not.toContain("Hatırlat");
    });

    it("üretimde overviewStats boş iken yönetici kartları çizilmez (sıfır uydurulmaz, K-22)", () => {
      const element = PaymentsPage({
        role: "admin",
        paymentRows: [],
        overviewStats: [],
        isDemo: false,
      });

      const elementString = JSON.stringify(element);
      expect(elementString).not.toContain("Bu ay tahsilat");
      expect(elementString).not.toContain("Yaklaşan taksit");
      expect(elementString).not.toContain("Takip gereken");
    });

    it("üretimde overviewStats verildiğinde kartlar çizilir ve '%82' ibaresi KESİNLİKLE YER ALMAZ", () => {
      const stats = buildPaymentStats({
        collectedThisMonth: 1500,
        upcomingCount: 7,
        overdueCount: 2,
      });

      const element = PaymentsPage({
        role: "admin",
        paymentRows: [],
        overviewStats: stats,
        isDemo: false,
      });

      const elementString = JSON.stringify(element);
      expect(elementString).toContain("Bu ay tahsilat");
      expect(elementString).toContain("₺1.500");
      expect(elementString).not.toContain("Planlanan tahsilatın %82");
    });

    it("status undefined iken rozet çizilmez (K-22)", () => {
      const rows: PaymentRow[] = [
        {
          id: "plan-test-2",
          studentId: "stu-2",
          student: "Ahmet Demir",
          plan: "Temel Paket",
          due: "",
          amount: "",
          totalAmount: 20000,
          status: undefined,
        },
      ];

      const element = PaymentsPage({
        role: "admin",
        paymentRows: rows,
        isDemo: false,
      });

      const elementString = JSON.stringify(element);
      expect(elementString).toContain("Ahmet Demir");
      expect(elementString).not.toContain("Güncel");
      expect(elementString).not.toContain("Takip gerekli");
    });

    it("demo modunda tüm yazma butonları ve demo kartları tam olarak çizilir", () => {
      const element = PaymentsPage({
        role: "admin",
        isDemo: true,
      });

      const elementString = JSON.stringify(element);
      expect(elementString).toContain("Yeni kayıt");
      expect(elementString).toContain("Hatırlat");
      expect(elementString).toContain("₺248.600");
      expect(elementString).toContain("Planlanan tahsilatın %82’si");
    });
  });

  describe("v1.4-06 Ödeme Planı ve Taksit Servisleri (Yazma & Detay)", () => {
    const orgId = "org-1";
    describe("archivePaymentPlan & restorePaymentPlan", () => {
      it("archivePaymentPlan: archived_at zaman damgası koyar, satır silmez", async () => {
        let capturedPayload: unknown = null;
        fromMock.mockReturnValueOnce({
          update: vi.fn((payload: unknown) => {
            capturedPayload = payload;
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [{ id: "plan-1" }], error: null })
            );
            return chain;
          }),
        });

        await archivePaymentPlan(orgId, "plan-1");

        expect(capturedPayload).toHaveProperty("archived_at");
        expect(
          (capturedPayload as { archived_at: string }).archived_at
        ).toBeTruthy();
      });

      it("archivePaymentPlan: sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
        fromMock.mockReturnValueOnce({
          update: vi.fn(() => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [], error: null })
            );
            return chain;
          }),
        });

        await expect(archivePaymentPlan(orgId, "plan-missing")).rejects.toThrow(
          "Ödeme planı bulunamadı veya arşivlenemedi."
        );
      });

      it("restorePaymentPlan: archived_at null yapar", async () => {
        let capturedPayload: unknown = null;
        fromMock.mockReturnValueOnce({
          update: vi.fn((payload: unknown) => {
            capturedPayload = payload;
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [{ id: "plan-1" }], error: null })
            );
            return chain;
          }),
        });

        await restorePaymentPlan(orgId, "plan-1");

        expect(capturedPayload).toEqual({ archived_at: null });
      });

      it("restorePaymentPlan: sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
        fromMock.mockReturnValueOnce({
          update: vi.fn(() => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [], error: null })
            );
            return chain;
          }),
        });

        await expect(restorePaymentPlan(orgId, "plan-missing")).rejects.toThrow(
          "Ödeme planı bulunamadı veya geri yüklenemedi."
        );
      });
    });

    describe("loadPlanInstallments", () => {
      it("organization_id ve plan_id süzgeciyle aktif taksitleri sıra no'ya göre yükler", async () => {
        const eqCalls: [string, unknown][] = [];
        let isFilter: [string, unknown] | null = null;

        fromMock.mockReturnValueOnce({
          select: vi.fn(() => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn((col: string, val: unknown) => {
              eqCalls.push([col, val]);
              return chain;
            });
            chain.is = vi.fn((col: string, val: unknown) => {
              isFilter = [col, val];
              return chain;
            });
            chain.order = vi.fn(() => chain);
            chain.then = (
              onfulfilled?: ((value: unknown) => unknown) | null,
              onrejected?: ((reason: unknown) => unknown) | null
            ) =>
              Promise.resolve({
                data: [
                  {
                    id: "inst-1",
                    organization_id: orgId,
                    plan_id: "plan-1",
                    sequence_no: 1,
                    due_date: "2026-10-15",
                    amount: 15000,
                    paid_at: null,
                    archived_at: null,
                    created_at: "2026-09-01T10:00:00Z",
                  },
                  {
                    id: "inst-2",
                    organization_id: orgId,
                    plan_id: "plan-1",
                    sequence_no: 2,
                    due_date: "2026-11-15",
                    amount: 15000,
                    paid_at: "2026-09-10T12:00:00Z",
                    archived_at: null,
                    created_at: "2026-09-01T10:00:00Z",
                  },
                ],
                error: null,
              }).then(onfulfilled, onrejected);
            return chain;
          }),
        });

        const installments = await loadPlanInstallments(orgId, "plan-1");

        expect(eqCalls).toEqual([
          ["organization_id", orgId],
          ["plan_id", "plan-1"],
        ]);
        expect(isFilter).toEqual(["archived_at", null]);
        expect(installments).toHaveLength(2);
        expect(installments[0].sequenceNo).toBe(1);
        expect(installments[0].paidAt).toBeNull();
        expect(installments[1].sequenceNo).toBe(2);
        expect(installments[1].paidAt).toBe("2026-09-10T12:00:00Z");
      });
    });
    describe("markInstallmentPaid & unmarkInstallmentPaid", () => {
      it("markInstallmentPaid: paid_at zaman damgası koyar", async () => {
        let capturedPayload: unknown = null;
        fromMock.mockReturnValueOnce({
          update: vi.fn((payload: unknown) => {
            capturedPayload = payload;
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [{ id: "inst-1" }], error: null })
            );
            return chain;
          }),
        });

        await markInstallmentPaid(orgId, "inst-1");

        expect(capturedPayload).toHaveProperty("paid_at");
        expect((capturedPayload as { paid_at: string }).paid_at).toBeTruthy();
      });

      it("unmarkInstallmentPaid: paid_at'i null yapar", async () => {
        let capturedPayload: unknown = null;
        fromMock.mockReturnValueOnce({
          update: vi.fn((payload: unknown) => {
            capturedPayload = payload;
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [{ id: "inst-1" }], error: null })
            );
            return chain;
          }),
        });

        await unmarkInstallmentPaid(orgId, "inst-1");

        expect(capturedPayload).toEqual({ paid_at: null });
      });

      it("unmarkInstallmentPaid: sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
        fromMock.mockReturnValueOnce({
          update: vi.fn(() => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() =>
              Promise.resolve({ data: [], error: null })
            );
            return chain;
          }),
        });

        await expect(
          unmarkInstallmentPaid(orgId, "inst-missing")
        ).rejects.toThrow(
          "Taksit bulunamadı veya ödeme işareti kaldırılamadı."
        );
      });
    });

    describe("translatePaymentError", () => {
      it("23505 tekillik hatasını anlaşılır Türkçe cümleye çevirir (ham kod sızmaz)", () => {
        const error = {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "installments_plan_sequence_key"',
        };
        const msg = translatePaymentError(error);
        expect(msg).toBe(
          "Bu plana ait aynı sıra numarasına sahip aktif bir taksit zaten mevcut."
        );
        expect(msg).not.toContain("23505");
      });

      it("23514 tutar veya sıra kısıtı hatasını anlaşılır Türkçe cümleye çevirir", () => {
        expect(
          translatePaymentError({
            code: "23514",
            message: 'violates check constraint "installments_amount_check"',
          })
        ).toBe("Taksit tutarı sıfırdan büyük olmalıdır.");

        expect(
          translatePaymentError({
            code: "23514",
            message: 'violates check constraint "installments_sequence_check"',
          })
        ).toBe("Taksit sıra numarası 1 veya daha büyük olmalıdır.");
      });

      it("42501 yetki hatasını açıkça bildirir", () => {
        expect(
          translatePaymentError({
            code: "42501",
            message: "permission denied for table payment_plans",
          })
        ).toBe(
          "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor."
        );
      });
    });
  });
});

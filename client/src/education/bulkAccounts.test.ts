import { describe, expect, it, vi } from "vitest";
import {
  BULK_BATCH_SIZE,
  mapBulkItem,
  openAccountsInBulk,
  type BulkAccountItem,
  type InvokeBulk,
} from "./bulkAccounts";

const created = (id: string): BulkAccountItem => ({
  kind: "student",
  recordId: id,
  fullName: id,
  status: "created",
  linked: true,
  credentials: { loginNumber: "1", temporaryPassword: "x" },
});

describe("openAccountsInBulk", () => {
  it("öğrencileri 10'arlı partilerle sırayla gönderir ve ilerlemeyi bildirir", async () => {
    const ids = Array.from({ length: 23 }, (_, i) => `s${i}`);
    const invoke = vi.fn<InvokeBulk>(async batch => batch.map(created));
    const progress: number[] = [];
    const result = await openAccountsInBulk(ids, true, n => progress.push(n), {
      invoke,
      newKey: () => "k",
    });
    expect(BULK_BATCH_SIZE).toBe(10);
    expect(invoke.mock.calls.map(c => c[0].length)).toEqual([10, 10, 3]);
    expect(invoke.mock.calls.every(c => c[1] === true)).toBe(true);
    expect(progress).toEqual([10, 20, 23]);
    expect(result.items).toHaveLength(23);
    expect(result.stoppedWith).toBeNull();
  });

  it("bir parti başarısız olursa durur ve o ana kadar açılanları kaybetmez", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `s${i}`);
    const invoke = vi
      .fn<InvokeBulk>()
      .mockImplementationOnce(async batch => batch.map(created))
      .mockRejectedValueOnce(new Error("Çok fazla istek gönderildi."));
    const result = await openAccountsInBulk(ids, false, () => {}, {
      invoke,
      newKey: () => "k",
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(10);
    expect(result.processedStudents).toBe(10);
    expect(result.stoppedWith).toBe("Çok fazla istek gönderildi.");
  });

  it("her parti ayrı tekrar anahtarı taşır", async () => {
    let n = 0;
    const invoke = vi.fn<InvokeBulk>(async () => []);
    await openAccountsInBulk(
      Array.from({ length: 15 }, (_, i) => `s${i}`),
      false,
      () => {},
      { invoke, newKey: () => `k${n++}` }
    );
    expect(invoke.mock.calls.map(c => c[2])).toEqual(["k0", "k1"]);
  });
});

describe("mapBulkItem", () => {
  it("açılan hesabın giriş bilgisini çıkarır", () => {
    expect(
      mapBulkItem({
        kind: "guardian",
        recordId: "g1",
        fullName: "Veli",
        forStudent: "Ece",
        status: "created",
        linked: false,
        login_number: "10001009",
        temporary_password: "gecici",
      })
    ).toEqual({
      kind: "guardian",
      recordId: "g1",
      fullName: "Veli",
      forStudent: "Ece",
      status: "created",
      linked: false,
      credentials: {
        loginNumber: "10001009",
        temporaryPassword: "gecici",
        passwordLockSet: true,
      },
    });
  });

  it("tanınmayan kalemi atar", () => {
    expect(
      mapBulkItem({ kind: "x", recordId: "1", status: "created" })
    ).toBeNull();
    expect(
      mapBulkItem({ kind: "student", recordId: "1", status: "yok" })
    ).toBeNull();
  });
});

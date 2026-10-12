import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadClassStaffNames } from "./classStaffNames";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

// 2026-10-12: sınıf, ödev ve ders programı servislerindeki üç ayrı test
// bloğu, kopyaları tek modüle toplanınca buraya taşındı.
describe("loadClassStaffNames (class_staff_names RPC, #228/#231)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("boş listede veritabanına gitmeden boş harita döner", async () => {
    const result = await loadClassStaffNames([]);
    expect(result.size).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("RPC'yi tek seferde, tekilleştirilmiş kimliklerle çağırır (N+1 yok)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          class_id: "cls-1",
          membership_id: "mem-1",
          display_name: "Bahar Aydın",
        },
        {
          class_id: "cls-2",
          membership_id: "mem-2",
          display_name: "Kemal Demir",
        },
        {
          class_id: "cls-1",
          membership_id: "mem-3",
          display_name: "Mehmet Demir (Vekil)",
        },
      ],
      error: null,
    });

    const names = await loadClassStaffNames(["cls-1", "cls-2", "cls-1", ""]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("class_staff_names", {
      target_class_ids: ["cls-1", "cls-2"],
    });
    expect(names.get("mem-1")).toBe("Bahar Aydın");
    expect(names.get("mem-2")).toBe("Kemal Demir");
    expect(names.get("mem-3")).toBe("Mehmet Demir (Vekil)");
  });

  it("⛔ profiles veya organization_memberships tablolarına doğrudan sorgu gitmez (#228)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          class_id: "cls-1",
          membership_id: "mem-1",
          display_name: "Bahar Aydın",
        },
      ],
      error: null,
    });

    await loadClassStaffNames(["cls-1"]);

    expect(fromMock).not.toHaveBeenCalledWith("profiles");
    expect(fromMock).not.toHaveBeenCalledWith("organization_memberships");
  });

  it("RPC hatasında uydurulmuş ad dönmez, harita boş kalır (K-22)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "timeout" } });

    const names = await loadClassStaffNames(["cls-1"]);

    expect(names.size).toBe(0);
    expect(names.get("mem-unresolved")).toBeUndefined();
  });
});

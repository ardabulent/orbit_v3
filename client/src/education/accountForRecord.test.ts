import { describe, expect, it, vi } from "vitest";
import { openAccountForRecord, type OpenAccountDeps } from "./accountForRecord";

const kimlik = {
  loginNumber: "10001009",
  temporaryPassword: "gecici",
  membershipId: "m-1",
};

function deps(overrides: Partial<OpenAccountDeps> = {}): OpenAccountDeps {
  return {
    createMember: vi.fn().mockResolvedValue(kimlik),
    linkStudentAccount: vi.fn().mockResolvedValue(undefined),
    linkGuardianAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("openAccountForRecord", () => {
  it("öğrenciye öğrenci hesabı açar, şubesiyle, ve öğrenci kaydına bağlar", async () => {
    const d = deps();
    const sonuc = await openAccountForRecord(
      {
        kind: "student",
        recordId: "s-1",
        fullName: " Ece Kaya ",
        branchId: "b-1",
      },
      "anahtar",
      d
    );
    expect(d.createMember).toHaveBeenCalledWith(
      { fullName: "Ece Kaya", role: "student", branchId: "b-1" },
      "anahtar"
    );
    expect(d.linkStudentAccount).toHaveBeenCalledWith("s-1", "m-1");
    expect(d.linkGuardianAccount).not.toHaveBeenCalled();
    expect(sonuc).toEqual({ credentials: kimlik, linked: true });
  });

  it("veliye veli hesabı açar ve veli kaydına bağlar", async () => {
    const d = deps();
    await openAccountForRecord(
      {
        kind: "guardian",
        recordId: "g-1",
        fullName: "Hülya Kaya",
        branchId: null,
      },
      "anahtar",
      d
    );
    expect(d.createMember).toHaveBeenCalledWith(
      { fullName: "Hülya Kaya", role: "parent", branchId: null },
      "anahtar"
    );
    expect(d.linkGuardianAccount).toHaveBeenCalledWith("g-1", "m-1");
  });

  it("hesap açılamazsa fırlatır ve bağlamayı denemez", async () => {
    const d = deps({
      createMember: vi.fn().mockRejectedValue(new Error("hız sınırı")),
    });
    await expect(
      openAccountForRecord(
        { kind: "student", recordId: "s-1", fullName: "Ece", branchId: null },
        "k",
        d
      )
    ).rejects.toThrow("hız sınırı");
    expect(d.linkStudentAccount).not.toHaveBeenCalled();
  });

  it("bağlama başarısız olsa bile giriş bilgisini döndürür (şifre bir kez üretilir)", async () => {
    const d = deps({
      linkStudentAccount: vi.fn().mockRejectedValue(new Error("ORB03")),
    });
    const sonuc = await openAccountForRecord(
      { kind: "student", recordId: "s-1", fullName: "Ece", branchId: null },
      "k",
      d
    );
    expect(sonuc.credentials).toEqual(kimlik);
    expect(sonuc.linked).toBe(false);
    expect(sonuc.message).toContain("Giriş hesabı ata");
  });

  it("sunucu üyelik kimliği döndürmezse bağlamaz ama bilgiyi verir", async () => {
    const d = deps({
      createMember: vi
        .fn()
        .mockResolvedValue({ loginNumber: "1", temporaryPassword: "x" }),
    });
    const sonuc = await openAccountForRecord(
      { kind: "guardian", recordId: "g-1", fullName: "V", branchId: null },
      "k",
      d
    );
    expect(sonuc.linked).toBe(false);
    expect(d.linkGuardianAccount).not.toHaveBeenCalled();
  });
});

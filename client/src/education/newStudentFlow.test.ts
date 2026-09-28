import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import {
  runNewStudentFlow,
  type NewStudentDeps,
  type NewStudentInput,
} from "./newStudentFlow";

function makeDeps(overrides: Partial<NewStudentDeps> = {}): NewStudentDeps {
  let member = 0;
  return {
    createStudent: vi.fn().mockResolvedValue({ id: "student-1" }),
    enrollStudent: vi.fn().mockResolvedValue({ id: "enr-1" }),
    createGuardian: vi.fn().mockResolvedValue({ id: "guardian-1" }),
    linkStudentGuardian: vi.fn().mockResolvedValue({ id: "link-1" }),
    createMember: vi.fn().mockImplementation(async () => {
      member += 1;
      return {
        loginNumber: `7801810${member}`,
        temporaryPassword: "gecici",
        membershipId: `mem-${member}`,
      };
    }),
    linkStudentAccount: vi.fn().mockResolvedValue(undefined),
    linkGuardianAccount: vi.fn().mockResolvedValue(undefined),
    newIdempotencyKey: vi.fn().mockReturnValue("key"),
    ...overrides,
  } as NewStudentDeps;
}

const full: NewStudentInput = {
  organizationId: "org-1",
  branchId: "branch-1",
  fullName: "  Deniz Aydın ",
  studentNumber: "YKS-101",
  classId: "class-1",
  guardian: { mode: "new", fullName: "Hakan Aydın", phone: "" },
  createStudentAccount: true,
  createGuardianAccount: true,
};

describe("runNewStudentFlow", () => {
  it("kayıt, sınıf, veli ve iki hesabı sırayla kurar ve bağlar", async () => {
    const deps = makeDeps();
    const result = await runNewStudentFlow(full, deps);

    expect(deps.createStudent).toHaveBeenCalledWith({
      organizationId: "org-1",
      branchId: "branch-1",
      fullName: "Deniz Aydın",
      studentNumber: "YKS-101",
    });
    expect(deps.enrollStudent).toHaveBeenCalledWith({
      organizationId: "org-1",
      classId: "class-1",
      studentId: "student-1",
    });
    expect(deps.linkStudentGuardian).toHaveBeenCalledWith(
      "org-1",
      "student-1",
      "guardian-1"
    );
    expect(deps.createMember).toHaveBeenNthCalledWith(
      1,
      { fullName: "Deniz Aydın", role: "student", branchId: "branch-1" },
      "key"
    );
    expect(deps.linkStudentAccount).toHaveBeenCalledWith("student-1", "mem-1");
    expect(deps.createMember).toHaveBeenNthCalledWith(
      2,
      { fullName: "Hakan Aydın", role: "parent", branchId: "branch-1" },
      "key"
    );
    expect(deps.linkGuardianAccount).toHaveBeenCalledWith(
      "guardian-1",
      "mem-2"
    );

    expect(result.steps.every(step => step.ok)).toBe(true);
    expect(result.accounts.map(a => a.subjectLabel)).toEqual([
      "Öğrenci",
      "Veli",
    ]);
  });

  it("öğrenci kaydı oluşmazsa fırlatır ve başka hiçbir şey yapmaz", async () => {
    const deps = makeDeps({
      createStudent: vi.fn().mockRejectedValue(new Error("Numara kullanımda.")),
    });

    await expect(runNewStudentFlow(full, deps)).rejects.toThrow(
      "Numara kullanımda."
    );
    expect(deps.enrollStudent).not.toHaveBeenCalled();
    expect(deps.createGuardian).not.toHaveBeenCalled();
    expect(deps.createMember).not.toHaveBeenCalled();
  });

  it("hesap açılıp bağlanamazsa giriş bilgisi yine döner ve yarım durum söylenir", async () => {
    const deps = makeDeps({
      linkStudentAccount: vi
        .fn()
        .mockRejectedValue(new Error("Bu hesap başka bir kayda bağlı.")),
    });

    const result = await runNewStudentFlow(full, deps);

    // Şifre yalnız bir kez döner: bağlama hatası onu kaybettirmemeli.
    expect(result.accounts[0].credentials.temporaryPassword).toBe("gecici");
    const failed = result.steps.find(step => !step.ok);
    expect(failed?.label).toBe("Öğrenci hesabı açıldı ama bağlanamadı");
    expect(failed?.message).toContain('"Hesap bağla"');
    // Sonraki adım yine denendi.
    expect(deps.linkGuardianAccount).toHaveBeenCalled();
  });

  it("sunucu üyelik kimliği döndürmezse bağlamayı denemez, söyler", async () => {
    const deps = makeDeps({
      createMember: vi.fn().mockResolvedValue({
        loginNumber: "1",
        temporaryPassword: "x",
      }),
    });

    const result = await runNewStudentFlow(
      { ...full, createGuardianAccount: false },
      deps
    );

    expect(deps.linkStudentAccount).not.toHaveBeenCalled();
    expect(result.steps.at(-1)?.label).toBe(
      "Öğrenci hesabı açıldı ama bağlanamadı"
    );
  });

  it("zaten hesabı olan mevcut veliye ikinci hesap açılmaz", async () => {
    const deps = makeDeps();

    const result = await runNewStudentFlow(
      {
        ...full,
        guardian: {
          mode: "existing",
          guardianId: "guardian-9",
          guardianName: "Gül Arslan",
          hasAccount: true,
        },
      },
      deps
    );

    expect(deps.createGuardian).not.toHaveBeenCalled();
    expect(deps.linkStudentGuardian).toHaveBeenCalledWith(
      "org-1",
      "student-1",
      "guardian-9"
    );
    expect(deps.createMember).toHaveBeenCalledTimes(1);
    expect(result.steps.map(step => step.label)).toContain(
      "Velinin zaten giriş hesabı var"
    );
  });

  it("veli seçilmediyse veli hesabı açılmaz ve bu söylenir", async () => {
    const deps = makeDeps();

    const result = await runNewStudentFlow(
      { ...full, guardian: { mode: "none" }, classId: null },
      deps
    );

    expect(deps.enrollStudent).not.toHaveBeenCalled();
    expect(deps.createMember).toHaveBeenCalledTimes(1);
    expect(result.steps.at(-1)).toMatchObject({
      label: "Veli hesabı açılmadı",
      ok: false,
    });
  });
});

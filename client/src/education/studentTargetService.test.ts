import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabaseClient";
import { loadStudentTargets, saveStudentTargets } from "./studentTargetService";

const query = {
  select: vi.fn(),
  eq: vi.fn(),
  not: vi.fn(),
  upsert: vi.fn(),
};

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: vi.fn(() => query) },
}));

describe("studentTargetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
  });

  it("geçerli hedefleri okur, toplam hedef önce gelir", async () => {
    query.not.mockResolvedValue({
      data: [
        {
          subject_id: "mat",
          target_net: "30.00",
          subjects: { name: "Matematik" },
        },
        { subject_id: null, target_net: "80.00", subjects: null },
      ],
      error: null,
    });
    await expect(loadStudentTargets("s1")).resolves.toEqual([
      { targetNet: 80 },
      { subjectId: "mat", subjectName: "Matematik", targetNet: 30 },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("student_targets");
    expect(query.eq).toHaveBeenCalledWith("student_id", "s1");
    expect(query.not).toHaveBeenCalledWith("target_net", "is", null);
  });

  it("değişiklikleri tek upsert ile yazar; kaldırma değeri boşaltır", async () => {
    query.upsert.mockResolvedValue({ error: null });
    await saveStudentTargets("org-1", "s1", [
      { targetNet: 85 },
      { subjectId: "mat", targetNet: null },
    ]);
    expect(query.upsert).toHaveBeenCalledWith(
      [
        {
          organization_id: "org-1",
          student_id: "s1",
          subject_id: null,
          target_net: 85,
        },
        {
          organization_id: "org-1",
          student_id: "s1",
          subject_id: "mat",
          target_net: null,
        },
      ],
      { onConflict: "student_id,subject_id" }
    );
  });

  it("aralık dışı hedefi göndermeden reddeder", async () => {
    await expect(
      saveStudentTargets("org-1", "s1", [{ targetNet: 250 }])
    ).rejects.toThrow("Hedef 0 ile 200 net arasında olmalı.");
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("yetki hatasını anlaşılır metne çevirir", async () => {
    query.upsert.mockResolvedValue({
      error: { code: "42501", message: "rls" },
    });
    await expect(
      saveStudentTargets("org-1", "s1", [{ targetNet: 50 }])
    ).rejects.toThrow("Bu öğrencinin hedefini değiştirme yetkiniz yok.");
  });
});

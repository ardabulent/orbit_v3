import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabaseClient";
import {
  loadExamAbsences,
  markExamAbsent,
  restoreExamResult,
  translateAbsenceError,
} from "./examAbsenceService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;

describe("Sınava girmedi servisi (2026-10-05)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("işaretleme sebebi kırparak, boşsa null gönderir", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as RpcResult);

    await markExamAbsent({ examId: "e", studentId: "s", reason: "  raporlu " });
    await markExamAbsent({ examId: "e", studentId: "s", reason: "   " });

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "mark_exam_absent", {
      p_exam_id: "e",
      p_student_id: "s",
      p_reason: "raporlu",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "mark_exam_absent", {
      p_exam_id: "e",
      p_student_id: "s",
      p_reason: null,
    });
  });

  it("geri alma hatası Türkçe iletilir", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Geri alınacak işaret yok." },
    } as unknown as RpcResult);

    await expect(
      restoreExamResult({ examId: "e", studentId: "s" })
    ).rejects.toThrow("Geri alınacak işaret yok.");
  });

  it("yetki hatası insan diliyle söylenir", () => {
    expect(translateAbsenceError({ code: "42501" })).toContain(
      "sınıfın öğretmeni"
    );
  });

  it("kurum kimliği yoksa sorgu atılmaz", async () => {
    expect((await loadExamAbsences("", "e")).size).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

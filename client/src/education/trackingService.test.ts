import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabaseClient";
import {
  loadTrackingDefaults,
  loadTrackingMetrics,
  saveTrackingDefaults,
} from "./trackingService";

const query = {
  select: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
};

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(() => query) },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;

describe("trackingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
  });

  it("ham sayıları okur, ders netlerini ayrıştırır ve adsız satırı atlar", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          student_id: "s1",
          student_name: " Selin Koç ",
          class_names: "12-A",
          lesson_count: 5,
          present_count: 1,
          late_count: 1,
          absent_count: 3,
          excused_count: 1,
          absence_streak: 3,
          exam_expected: 3,
          exam_missed: 1,
          last_net: "38.00",
          previous_net: "30.00",
          net_avg3: "34.00",
          class_avg_last: null,
          subject_nets: [
            {
              subject_id: "mat",
              subject_name: "Matematik",
              avg_net: 21.5,
              class_avg: null,
              exam_count: 2,
            },
            { subject_id: "", subject_name: "Bozuk", avg_net: 1 },
          ],
          homework_expected: 2,
          homework_submitted: 1,
        },
        { student_id: "s2", student_name: "  " },
      ],
      error: null,
    } as unknown as RpcResult);

    const rows = await loadTrackingMetrics({ weeks: 8, classId: "c1" });
    expect(supabase.rpc).toHaveBeenCalledWith("tracking_student_metrics", {
      p_weeks: 8,
      p_class_id: "c1",
      p_student_id: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      studentName: "Selin Koç",
      lastNet: 38,
      previousNet: 30,
      classAvgLast: undefined,
      absenceStreak: 3,
      subjectNets: [
        { subjectId: "mat", avgNet: 21.5, classAvg: undefined, examCount: 2 },
      ],
    });
  });

  it("yetki hatasını Türkçe ve teknik olmayan metne çevirir", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    } as unknown as RpcResult);
    await expect(loadTrackingMetrics({ weeks: 4 })).rejects.toThrow(
      "Bu işlem için yetkiniz bulunmuyor."
    );
  });

  it("kurum varsayılanlarını okur, bilinmeyen ölçütü atlar", async () => {
    query.eq.mockResolvedValue({
      data: [
        { metric: "attendance_pct", risk_limit: "75.00", safe_limit: "85.00" },
        { metric: "uydurma", risk_limit: 1, safe_limit: 2 },
      ],
      error: null,
    });
    await expect(loadTrackingDefaults("org-1")).resolves.toEqual({
      attendance_pct: { risk: 75, safe: 85 },
    });
    expect(supabase.from).toHaveBeenCalledWith("tracking_threshold_defaults");
    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("varsayılanları tek upsert ile yazar; yazar alanını göndermez", async () => {
    query.upsert.mockResolvedValue({ error: null });
    await saveTrackingDefaults("org-1", {
      attendance_pct: { risk: 75, safe: 85 },
      late_count: { risk: 3, safe: 1 },
    });
    expect(query.upsert).toHaveBeenCalledTimes(1);
    expect(query.upsert).toHaveBeenCalledWith(
      [
        {
          organization_id: "org-1",
          metric: "attendance_pct",
          risk_limit: 75,
          safe_limit: 85,
        },
        {
          organization_id: "org-1",
          metric: "late_count",
          risk_limit: 3,
          safe_limit: 1,
        },
      ],
      { onConflict: "organization_id,metric" }
    );
  });

  it("yön kuralı ihlalini anlaşılır metne çevirir", async () => {
    query.upsert.mockResolvedValue({
      error: { code: "23514", message: "check" },
    });
    await expect(
      saveTrackingDefaults("org-1", { homework_pct: { risk: 90, safe: 80 } })
    ).rejects.toThrow("riskli sınırı güvenli sınırını geçemez");
  });
});

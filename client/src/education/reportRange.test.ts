import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { supabase } from "@/lib/supabaseClient";
import { ReportsPage } from "@/components/education/pages/ReportsPage";
import { loadAttendanceWeeks, loadExamAverages } from "./reportService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;

describe("Raporlar süzgeci ve net deneme (2026-09-29)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aralık ve sınıf veritabanına parametre olarak gider", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [],
      error: null,
    } as unknown as RpcResult);

    await loadAttendanceWeeks({ weeks: 8, classId: "c1" });
    expect(supabase.rpc).toHaveBeenCalledWith("report_attendance_weeks", {
      p_weeks: 8,
      p_class_id: "c1",
    });

    await loadExamAverages({ weeks: 12, classId: null });
    expect(supabase.rpc).toHaveBeenCalledWith("report_exam_averages", {
      p_limit: 12,
      p_class_id: null,
    });
  });

  it("net denemede ortalama net okunur, yüzde uydurulmaz", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          exam_id: "n1",
          exam_name: "TYT 1",
          exam_date: "2026-09-20",
          average_percent: null,
          average_net: "34.63",
          is_net: true,
          result_count: 2,
        },
        {
          exam_id: "p1",
          exam_name: "Yazılı",
          exam_date: "2026-09-21",
          average_percent: "72.9",
          average_net: null,
          is_net: false,
          result_count: 1,
        },
      ],
      error: null,
    } as unknown as RpcResult);

    const result = await loadExamAverages();
    expect(result).toEqual([
      expect.objectContaining({ examId: "n1", isNet: true, averageNet: 34.63 }),
      expect.objectContaining({
        examId: "p1",
        isNet: false,
        averagePercent: 72.9,
      }),
    ]);
    expect(result![0].averagePercent).toBeUndefined();
  });

  it("ekran: süzgeç, net kartı ve ayrı puanlı sınav kartı", () => {
    const html = renderToStaticMarkup(
      createElement(ReportsPage, {
        role: "teacher",
        isDemo: false,
        attendanceWeeks: null,
        homeworkWeeks: null,
        examAverages: [
          {
            examId: "n1",
            examName: "TYT 1",
            examDate: "2026-09-20",
            isNet: true,
            averageNet: 34.63,
            resultCount: 2,
          },
          {
            examId: "p1",
            examName: "Yazılı",
            examDate: "2026-09-21",
            isNet: false,
            averagePercent: 72.9,
            resultCount: 1,
          },
        ],
        range: { weeks: 8, classId: "c1" },
        onRangeChange: () => {},
        classes: [{ id: "c1", name: "12-A" }],
      })
    );

    expect(html).toContain("Bütün sınıflarım");
    expect(html).toMatch(/aria-pressed="true"[^>]*><span[^>]*>8 hafta/);
    expect(html).toContain("Son 8 deneme · ortalama net · 12-A");
    expect(html).toContain("34,6");
    expect(html).toContain("Puanlı sınavlar");
    expect(html).toContain("%72,9");
    expect(html).toContain("Son 8 takvim haftası");
  });

  it("puanlı sınav yoksa ayrı kart çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(ReportsPage, {
        role: "admin",
        isDemo: false,
        attendanceWeeks: null,
        homeworkWeeks: null,
        examAverages: null,
        range: { weeks: 4, classId: null },
        onRangeChange: () => {},
      })
    );
    expect(html).toContain("Bütün kurum");
    expect(html).not.toContain("Puanlı sınavlar");
  });
});

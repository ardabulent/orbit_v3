import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { supabase } from "@/lib/supabaseClient";
import { ClassComparisonTable } from "@/components/education/pages/ClassComparisonTable";
import { classComparisonCsv } from "./reportCsv";
import { loadClassComparison, type ClassComparisonRow } from "./reportService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;

const rows: ClassComparisonRow[] = [
  {
    classId: "a",
    className: "12-A Sayısal",
    studentCount: 2,
    attendancePercent: 50,
    homeworkPercent: 50,
    netExamCount: 1,
    netAverage: 34.63,
  },
  { classId: "b", className: "=HYPERLINK()", studentCount: 1 },
];

describe("Sınıf karşılaştırma (2026-09-29)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("servis sayıları yüzdeye çevirir, ölçülmeyeni boş bırakır", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          class_id: "a",
          class_name: "12-A",
          student_count: 2,
          present_count: 1,
          late_count: 1,
          absent_count: 2,
          submission_count: 3,
          expected_count: 4,
          net_exam_count: 2,
          net_average: "41.25",
        },
        {
          class_id: "b",
          class_name: "12-B",
          student_count: 0,
          present_count: null,
          late_count: null,
          absent_count: null,
          submission_count: null,
          expected_count: null,
          net_exam_count: null,
          net_average: null,
        },
      ],
      error: null,
    } as unknown as RpcResult);

    const result = await loadClassComparison(8);
    expect(supabase.rpc).toHaveBeenCalledWith("report_class_comparison", {
      p_weeks: 8,
    });
    expect(result[0]).toMatchObject({
      attendancePercent: 50,
      homeworkPercent: 75,
      netExamCount: 2,
      netAverage: 41.25,
    });
    expect(result[1].attendancePercent).toBeUndefined();
    expect(result[1].homeworkPercent).toBeUndefined();
    expect(result[1].netAverage).toBeUndefined();
  });

  it("CSV: BOM, noktalı virgül, ondalık virgül, boş hücre, formül koruması", () => {
    const csv = classComparisonCsv([
      ...rows,
      { classId: "c", className: "Eksi", studentCount: 1, netAverage: -2.5 },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Sınıf;Öğrenci;Devam %;Ödev tamamlama %;Net deneme sayısı;Ortalama net"
    );
    expect(lines[1]).toBe("12-A Sayısal;2;50;50;1;34,63");
    expect(lines[2]).toBe("'=HYPERLINK();1;;;;");
    // Negatif net bir sayıdır; formül koruması onu bozmaz.
    expect(lines[3]).toBe("Eksi;1;;;;-2,5");
  });

  it("tablo: değerler, ölçülmeyen '—', seçili satır ve CSV düğmesi", () => {
    const html = renderToStaticMarkup(
      createElement(ClassComparisonTable, {
        rows,
        weeks: 4,
        selectedClassId: "a",
        onSelectClass: () => {},
        today: "2026-09-29",
      })
    );
    expect(html).toContain("Sınıf karşılaştırma");
    expect(html).toContain("%50");
    expect(html).toContain("34,6");
    expect(html).toContain("1 deneme");
    expect(html).toContain("—");
    expect(html).toContain("bg-blue-50/60");
    expect(html).toContain("CSV indir");
  });
});

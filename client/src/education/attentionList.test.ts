import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { supabase } from "@/lib/supabaseClient";
import { AttentionList } from "@/components/education/pages/AttentionList";
import { attentionReasons } from "./attentionReasons";
import { loadAttentionStudents, type AttentionStudent } from "./reportService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;

const base: AttentionStudent = {
  studentId: "s1",
  studentName: "Selin Koç",
  classNames: "12-A Sayısal",
  lowAttendance: false,
  lowHomework: false,
  netDrop: false,
  belowAverage: false,
};

describe("Dikkat listesi (2026-09-29)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("servis bayrakları ve ham sayıları okur", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          student_id: "s1",
          student_name: "Selin Koç",
          class_names: "12-A",
          lesson_count: 5,
          attended_count: 3,
          homework_expected: 3,
          homework_submitted: 1,
          last_net: "54.00",
          previous_net: "60.00",
          class_average: null,
          low_attendance: true,
          low_homework: true,
          net_drop: true,
          below_average: false,
        },
      ],
      error: null,
    } as unknown as RpcResult);

    const [row] = await loadAttentionStudents(12);
    expect(supabase.rpc).toHaveBeenCalledWith("report_attention_students", {
      p_weeks: 12,
    });
    expect(row).toMatchObject({
      lessonCount: 5,
      attendedCount: 3,
      lastNet: 54,
      previousNet: 60,
      lowAttendance: true,
      belowAverage: false,
    });
    expect(row.classAverage).toBeUndefined();
  });

  it("nedenler yalnız kalkan bayraklardan yazılır", () => {
    expect(
      attentionReasons({
        ...base,
        lessonCount: 5,
        attendedCount: 3,
        homeworkExpected: 3,
        homeworkSubmitted: 1,
        lastNet: 30,
        previousNet: 50,
        classAverage: 43.4,
        lowAttendance: true,
        lowHomework: true,
        netDrop: true,
        belowAverage: true,
      })
    ).toEqual([
      "Devam %60 (3/5 ders)",
      "Ödev 1/3",
      "Net 50 → 30",
      "Son deneme 30 · sınıf ort. 43,4",
    ]);
    // Sayı var ama bayrak yoksa neden yazılmaz.
    expect(
      attentionReasons({ ...base, lessonCount: 5, attendedCount: 4 })
    ).toEqual([]);
  });

  it("ekran: sayı rozeti, nedenler ve boş durum", () => {
    const html = renderToStaticMarkup(
      createElement(AttentionList, {
        rows: [
          {
            ...base,
            homeworkExpected: 5,
            homeworkSubmitted: 2,
            lowHomework: true,
          },
        ],
        weeks: 4,
        onOpenStudent: () => {},
      })
    );
    expect(html).toContain("Dikkat listesi");
    expect(html).toContain("Selin Koç");
    expect(html).toContain("12-A Sayısal");
    expect(html).toContain("Ödev 2/5");

    const empty = renderToStaticMarkup(
      createElement(AttentionList, {
        rows: [],
        weeks: 4,
        onOpenStudent: () => {},
      })
    );
    expect(empty).toContain("Bu aralıkta dikkat gerektiren öğrenci yok");
  });
});

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import type { ExamListItem } from "@/education/examNetService";
import { ExamList } from "./ExamList";
import { ExamSectionsQuickStart } from "./ExamSectionsQuickStart";
import { examResultStatus } from "./examSections";

const sinav = (over: Partial<ExamListItem>): ExamListItem => ({
  id: "e",
  name: "TYT Deneme",
  examDate: "2026-09-29",
  maxScore: null,
  netPenalty: 4,
  classId: "c1",
  className: "12-A",
  subjectName: null,
  resultCount: null,
  average: null,
  ...over,
});

describe("sınav sonuç durumu (2026-09-30)", () => {
  it("tarihi gelmemiş sınav planlı; bugünkü sınav sonuç bekler", () => {
    expect(
      examResultStatus(sinav({ examDate: "2026-10-03" }), "2026-09-30", 4)
    ).toEqual({ kind: "planned" });
    expect(
      examResultStatus(sinav({ examDate: "2026-09-30" }), "2026-09-30", 4)
    ).toEqual({ kind: "missing", entered: 0, expected: 4 });
  });

  it("eksik ve tamam; beklenen bilinmiyorsa uydurulmaz", () => {
    expect(
      examResultStatus(sinav({ resultCount: 2 }), "2026-09-30", 4)
    ).toEqual({ kind: "missing", entered: 2, expected: 4 });
    expect(
      examResultStatus(sinav({ resultCount: 4 }), "2026-09-30", 4)
    ).toEqual({ kind: "complete", entered: 4, expected: 4 });
    expect(
      examResultStatus(
        sinav({ resultCount: 3, classId: null }),
        "2026-09-30",
        null
      )
    ).toEqual({ kind: "missing", entered: 3, expected: null });
  });

  it("liste: 'Sonuç gir · 2/4', 'Sonuçlar tamam', 'Planlandı'", () => {
    const html = renderToStaticMarkup(
      createElement(ExamList, {
        rows: [
          sinav({ id: "a", resultCount: 2 }),
          sinav({ id: "b", name: "Tam", resultCount: 4 }),
          sinav({ id: "c", name: "İleri", examDate: "2026-10-05" }),
        ],
        today: "2026-09-30",
        onOpen: () => {},
        classStudentCounts: new Map([["c1", 4]]),
      })
    );
    expect(html).toContain("Sonuç gir · 2/4");
    expect(html).toContain("Sonuçlar tamam · 4/4");
    expect(html).toContain("Planlandı");
  });
});

describe("ExamSectionsQuickStart", () => {
  it("düzenleyebilen kişi sınavın ceza kuralına uyan şablonları görür", () => {
    const html = renderToStaticMarkup(
      createElement(ExamSectionsQuickStart, {
        netPenalty: 4,
        canEdit: true,
        onApply: async () => {},
      })
    );
    expect(html).toContain("Sonuç girmek için önce denemenin derslerini seçin");
    expect(html).toContain("TYT");
    expect(html).toContain("AYT Sayısal");
    expect(html).not.toContain("LGS");
  });

  it("düzenleyemeyen kişi şablon görmez", () => {
    const html = renderToStaticMarkup(
      createElement(ExamSectionsQuickStart, {
        netPenalty: 3,
        canEdit: false,
        onApply: async () => {},
      })
    );
    expect(html).toContain("henüz girilmedi");
    expect(html).not.toContain("LGS");
  });
});

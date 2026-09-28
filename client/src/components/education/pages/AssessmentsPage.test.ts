import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/auth/runtime", () => ({ isDemoMode: false }));
vi.mock("@/education/trDate", async importOriginal => ({
  ...(await importOriginal<typeof import("@/education/trDate")>()),
  getOrbitToday: () => "2026-09-29",
}));

import type { ExamListItem } from "@/education/examNetService";
import { AssessmentsPage } from "./AssessmentsPage";
import { splitExams } from "./examSections";

const exam = (over: Partial<ExamListItem>): ExamListItem => ({
  id: "e",
  name: "Sınav",
  examDate: "2026-09-29",
  maxScore: null,
  netPenalty: null,
  classId: "c1",
  className: "12-A",
  subjectName: null,
  resultCount: null,
  average: null,
  ...over,
});

const rows = [
  exam({
    id: "past",
    name: "TYT Deneme 1",
    examDate: "2026-09-20",
    netPenalty: 4,
    resultCount: 24,
    average: 61.25,
  }),
  exam({ id: "far", name: "Yazılı 2", examDate: "2026-10-15" }),
  exam({
    id: "today",
    name: "LGS Deneme",
    examDate: "2026-09-29",
    netPenalty: 3,
  }),
];

describe("Sınavlar listesi (2026-09-28, C-07)", () => {
  it("yaklaşan en yakın önce; bugünkü sınav yaklaşandır, geçmiş ayrı", () => {
    const { upcoming, past } = splitExams(rows, "2026-09-29");
    expect(upcoming.map(r => r.id)).toEqual(["today", "far"]);
    expect(past.map(r => r.id)).toEqual(["past"]);
  });

  it("öğretmen listeyi görür; netli sınav rozeti, sonuç sayısı ve ortalama yazılır", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentsPage, {
        role: "teacher",
        onNavigate: vi.fn(),
        exams: rows,
        organizationId: "org-1",
      })
    );
    expect(html).toContain("Yaklaşan");
    expect(html).toContain("Geçmiş");
    expect(html).toContain("Net · YKS");
    expect(html).toContain("Net · LGS");
    expect(html).toContain("24 sonuç");
    expect(html).toContain("Ort. 61,25 net");
    // "Yeni sınav" yalnız başlıkta — bir sınavın düğmesi gibi durmaz.
    expect(html.match(/Yeni sınav/g)?.length).toBe(1);
  });

  it("liste boşsa 'Henüz sınav kaydı yok'", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentsPage, {
        role: "admin",
        onNavigate: vi.fn(),
        exams: [],
      })
    );
    expect(html).toContain("Henüz sınav kaydı yok");
  });
});

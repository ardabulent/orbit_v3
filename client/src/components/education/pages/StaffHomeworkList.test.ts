import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Homework } from "../types";
import { StaffHomeworkList } from "./StaffHomeworkList";

(globalThis as unknown as { React: typeof React }).React = React;

const hw = (over: Partial<Homework>): Homework => ({
  id: "h",
  classGroup: "12-A",
  classId: "c1",
  subject: "Matematik",
  title: "Ödev",
  description: "",
  assignedDate: "",
  dueDate: "",
  rawDueDate: "2026-09-29",
  status: "Aktif",
  submissionsRecordedAt: null,
  ...over,
});

describe("StaffHomeworkList (2026-09-29)", () => {
  it("kontrol bekleyen ödevde öne çıkan 'Teslimleri işaretle', biten ödevde teslim oranı", () => {
    const html = renderToStaticMarkup(
      createElement(StaffHomeworkList, {
        items: [
          hw({ id: "gecmis", title: "Türev", rawDueDate: "2026-09-25" }),
          hw({ id: "aktif", title: "İntegral", rawDueDate: "2026-10-02" }),
          hw({
            id: "bitti",
            title: "Limit",
            rawDueDate: "2026-09-20",
            submissionsRecordedAt: "2026-09-21T10:00:00Z",
            submissionCount: 18,
            totalStudents: 20,
          }),
        ],
        today: "2026-09-29",
        classes: [],
        archivingId: null,
        onManageSubmissions: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
      })
    );

    expect(html).toContain("Kontrol bekleyen");
    expect(html).toContain("Teslim tarihi geçti");
    expect(html.match(/Teslimleri işaretle/g)?.length).toBe(1);
    expect(html).toContain("18 / 20 teslim");
    // Oran yalnız işaretlemesi biten ödevde: aktif ödevde teslim sayısı yok.
    expect(html.match(/teslim<\/span>/g)?.length).toBe(1);
  });
});

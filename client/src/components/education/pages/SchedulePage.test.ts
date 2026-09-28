import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/auth/runtime", () => ({ isDemoMode: false }));

import type { ScheduleItem } from "../types";
import { SchedulePage } from "./SchedulePage";

const rows: ScheduleItem[] = [
  {
    id: "e1",
    day: "Pazartesi",
    time: "09:00",
    title: "Matematik",
    group: "12-A Sayısal",
    teacher: "Murat Kaya",
    classId: "c1",
    membershipId: "m1",
  },
  {
    id: "e2",
    day: "Salı",
    time: "11:00",
    title: "Fizik",
    group: "12-B",
    teacher: null,
    classId: "c2",
    membershipId: null,
  },
];

const render = (role: "admin" | "teacher") =>
  renderToStaticMarkup(
    createElement(SchedulePage, {
      role,
      schedule: rows,
      organizationId: "org-1",
      classes: [
        { id: "c1", name: "12-A Sayısal" },
        { id: "c2", name: "12-B" },
      ],
    })
  );

describe("SchedulePage — haftalık tablo (2026-09-28)", () => {
  it("yöneticide sınıf ve öğretmen süzgeci, öğretmensiz ders sayısı çizilir", () => {
    const html = render("admin");
    expect(html).toContain(">Sınıf<");
    expect(html).toContain(">Öğretmen<");
    expect(html).toContain("1 ders öğretmensiz");
    // Tablo: gün başlıkları ve saat satırları
    expect(html).toContain("<table");
    expect(html).toContain(">09:00<");
    expect(html).toContain(">11:00<");
    // Boş hücreden ekleme yalnız yöneticide
    expect(html).toContain("için ders ekle");
  });

  it("öğretmende öğretmen süzgeci, öğretmensiz sayacı ve yazma eylemi yok", () => {
    const html = render("teacher");
    expect(html).toContain(">Sınıf<");
    expect(html).not.toContain(">Öğretmen<");
    expect(html).not.toContain("ders öğretmensiz");
    expect(html).not.toContain("için ders ekle");
    expect(html).not.toContain("programdan kaldır");
  });
});

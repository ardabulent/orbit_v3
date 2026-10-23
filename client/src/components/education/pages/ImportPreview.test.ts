import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { ImportPreview } from "./ImportPreview";
import type { ImportRow } from "@/education/studentImport";

const row = (name: string, className: string): ImportRow => ({
  full_name: name,
  student_number: "",
  class_name: className,
  guardian_name: "",
  guardian_phone: "",
});

const render = (
  rows: ImportRow[],
  errors: { row: number; field: string; message: string }[] = []
) =>
  renderToStaticMarkup(
    createElement(ImportPreview, {
      fileName: "liste.xlsx",
      rows,
      rowLabels: rows.map((_, i) => `${i + 2}. satır`),
      result: { saved: false, rowCount: rows.length, errors },
      saving: false,
      onSave: vi.fn(),
      onBack: vi.fn(),
      onCancel: vi.fn(),
    })
  );

// Test turu B9 (2026-10-18): sınıf sütunu eşlenmezse ön izleme "hata yok"
// diyor ve herkes sessizce sınıfsız gidiyordu.
describe("ImportPreview — sınıfsız uyarısı", () => {
  it("hiçbir öğrencinin sınıfı yoksa söyler", () => {
    const html = render([row("Ece", ""), row("Can", "")]);
    expect(html).toContain("Hiçbir öğrencinin sınıfı yok");
    expect(html).toContain("sınıfsız kaydedilecek");
  });

  it("bir kısmının sınıfı boşsa sayısını söyler", () => {
    expect(render([row("Ece", "12-A"), row("Can", "")])).toContain(
      "1 öğrencinin sınıfı boş"
    );
  });

  it("hepsinin sınıfı varsa ya da dosyada hata varsa uyarmaz", () => {
    expect(render([row("Ece", "12-A")])).not.toContain("sınıfsız kaydedilecek");
    expect(
      render([row("Ece", "")], [{ row: 1, field: "full_name", message: "x" }])
    ).not.toContain("sınıfsız kaydedilecek");
  });
});

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomNav } from "./BottomNav";
import { bottomNavSections } from "./bottomNavSections";
import { ReportCard } from "./shared";
import type { Section } from "./types";

(globalThis as unknown as { React: typeof React }).React = React;

/**
 * Telefon düzeni (2026-10-15, analiz turu · Arayüz 2).
 */
describe("alt gezinme çubuğu", () => {
  const ogrenciEkranlari: Section[] = [
    "Genel Bakış",
    "Ders Programı",
    "Sınavlar",
    "Ödevler",
    "İletişim",
    "Ayarlar",
  ];

  it("öğrenci ve veliye dört ekran ve Menü; personele hiç", () => {
    expect(bottomNavSections("student").map(i => i.section)).toEqual([
      "Genel Bakış",
      "Ders Programı",
      "Ödevler",
      "Sınavlar",
    ]);
    expect(bottomNavSections("parent")).toHaveLength(4);
    expect(bottomNavSections("admin")).toEqual([]);
    expect(bottomNavSections("teacher")).toEqual([]);
  });

  it("çubuk yalnız telefonda görünür, açık ekranı işaretler ve Menü'yü taşır", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNav, {
        role: "student",
        active: "Ödevler",
        available: ogrenciEkranlari,
        onNavigate: () => {},
        onOpenMenu: () => {},
      })
    );
    expect(html).toContain("lg:hidden");
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html).toMatch(/aria-current="page"[^>]*>.*Ödevler/);
    expect(html).toContain("Menü");
  });

  it("açık ekran çubukta yoksa Menü işaretlenir (ör. Ayarlar)", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNav, {
        role: "student",
        active: "Ayarlar",
        available: ogrenciEkranlari,
        onNavigate: () => {},
        onOpenMenu: () => {},
      })
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*>.*Menü/);
  });

  it("rolün göremediği ekran çubuğa konmaz", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNav, {
        role: "parent",
        active: "Genel Bakış",
        available: ["Genel Bakış", "Ders Programı", "Ayarlar"],
        onNavigate: () => {},
        onOpenMenu: () => {},
      })
    );
    expect(html).not.toContain("Sınavlar");
    expect(html.match(/<button/g)).toHaveLength(3);
  });
});

describe("rapor kartı az veriyle", () => {
  const kart = (values: (number | undefined)[]) =>
    renderToStaticMarkup(
      createElement(ReportCard, {
        title: "Deneme gelişimi",
        subtitle: "Son 4 deneme",
        values,
        labels: values.map((_, i) => `${i + 1}`),
        color: "bg-violet-500",
      })
    );

  it("tek ölçümde eğilim notu çıkar", () => {
    expect(kart([64.6])).toContain("eğilim ikinci ölçümden sonra görünür");
    expect(kart([undefined, 40, undefined])).toContain(
      "eğilim ikinci ölçümden sonra görünür"
    );
  });

  it("iki ve daha fazla ölçümde not çıkmaz; hiç veri yoksa boş durum", () => {
    expect(kart([40, 55])).not.toContain("eğilim ikinci ölçümden");
    expect(kart([undefined, undefined])).toContain("Rapor verisi henüz yok");
  });

  it("çubuk genişliği sınırlı: tek çubuk kartı kaplamaz", () => {
    expect(kart([64.6])).toContain("max-w-[56px]");
  });
});

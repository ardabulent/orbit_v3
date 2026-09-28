import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// JSX dönüşümü `React`'i kapsamda arıyor; `shared.test.ts` ve
// `platformQueries.test.ts` de aynı satırı taşıyor.
(globalThis as unknown as { React: typeof React }).React = React;

import { StudentDetail } from "./StudentDetail";
import type { Student } from "./types";

/**
 * Öğrenci detayı — canlı bir öğrencinin üzerine uydurma veri basılmaz.
 *
 * Bu testlerin sebebi somut. v1.3 kapandıktan sonra yapılan incelemede
 * `StudentDetail` üç sabit değer taşıyordu ve ikisi **canlıda çiziliyordu**:
 *
 *   1. Gerçek puan, sabit `detail="TYT Deneme 06"` altında gösteriliyordu —
 *      kurumda LGS denemesi yapılsa bile. Üstelik doğrusu elin altındaydı:
 *      `student_latest_exam_scores` `exam_name` döndürüyor, istemci onu
 *      okumuyordu.
 *   2. "Geometri konusunda düzenli tekrar önerildi. Veli görüşmesi için 20
 *      Ağustos tarihinde uygun slot bulundu." bloğu **koşulsuzdu** — istisnasız
 *      her öğrenci için, uydurma bir tarih ve uydurma bir öneriyle.
 *
 * Kök neden ikincisinde değil birincisindeydi: `StatCard.detail` **zorunlu**
 * bir prop'tu. Doldurulamayan zorunlu bir alan uydurulur (**K-03**). Alan
 * opsiyonel yapıldı.
 */
function ogrenci(overrides: Partial<Student> = {}): Student {
  return {
    id: "stu-1",
    name: "Zeynep Kaya",
    group: "12-A",
    branch: "Merkez",
    ...overrides,
  } as Student;
}

describe("StudentDetail — uydurma veri yok (K-03 / K-22)", () => {
  it("⛔ gerçek puanın altına sabit bir sınav adı yazmaz", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: ogrenci({ score: 84 }),
        onClose: vi.fn(),
      })
    );

    expect(html).toContain("84");
    expect(html).not.toContain("TYT Deneme 06");
  });

  it("⛔ hiçbir öğrenciye sabit rehberlik notu basmaz", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: ogrenci({ score: 84, attendance: 92 }),
        onClose: vi.fn(),
      })
    );

    expect(html).not.toContain("Geometri");
    expect(html).not.toContain("20 Ağustos");
    expect(html).not.toContain("Son not");
  });

  it("⛔ kaynağı olmayan alanlar hiç çizilmez, sıfır ya da tire uydurulmaz", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        // Üretimde bugünkü hâli: puan ve devam var, ödev/ödeme/risk yok.
        student: ogrenci({ score: 84, attendance: 92 }),
        onClose: vi.fn(),
      })
    );

    // `homework` tanımsız: payda (`/9`) da dahil hiçbir şey çizilmemeli.
    expect(html).not.toContain("Ödev tamamlama");
    expect(html).not.toContain("/9");
    expect(html).not.toContain("Ödeme durumu");
    expect(html).not.toContain("Akademik sinyal");
  });

  it("veri varsa çizilir — test yalnızca uydurmayı değil, çizmeyi de sabitler", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: ogrenci({
          attendance: 92,
          payment: "Takip gerekli",
          parent: "Murat Kaya",
        }),
        onClose: vi.fn(),
      })
    );

    expect(html).toContain("Murat Kaya");
    expect(html).toContain("92");
    // 2026-09-28: ödeme Öğrenciler sekmesinde gösterilmez; yeri Kayıt ve
    // Ödemeler sekmesi.
    expect(html).not.toContain("Takip gerekli");
    expect(html).not.toContain("Ödeme durumu");
  });

  it("#257: gerçek sınav adı, tarihi ve tam puanı dolu olduğunda çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: ogrenci({
          score: 84,
          latestExamName: "TYT Deneme 01",
          latestExamDate: "2026-09-10",
          latestExamMaxScore: 100,
        }),
        onClose: vi.fn(),
      })
    );

    expect(html).toContain("84 / 100");
    expect(html).toContain("TYT Deneme 01 · 10 Eylül 2026");
  });

  it("v1.4-15: gerçek ödev teslim oranı dolu olduğunda 'Ödev tamamlama' ve oran çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: ogrenci({
          homework: "7/9",
        }),
        onClose: vi.fn(),
      })
    );

    expect(html).toContain("Ödev tamamlama");
    expect(html).toContain("7/9");
  });
});

describe("StudentDetail — Veliler Bölümü (v1.4-10 R1 / R2)", () => {
  const dummyStudent = ogrenci();

  const dummyGuardians = [
    {
      id: "link-1",
      organizationId: "org-1",
      studentId: "stu-1",
      guardianId: "g-1",
      guardian: {
        id: "g-1",
        fullName: "Fatma Demir",
        phone: "+90 555 123 4567",
        hasAccount: false,
      },
    },
    {
      id: "link-2",
      organizationId: "org-1",
      studentId: "stu-1",
      guardianId: "g-2",
      guardian: {
        id: "g-2",
        fullName: "Ali Veli",
        phone: null,
        hasAccount: true,
      },
    },
  ];

  it("bağlı velisi olan bir öğrencide veli adı, telefonu ve hesap rozeti çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: dummyStudent,
        onClose: vi.fn(),
        role: "admin",
        studentGuardians: dummyGuardians,
      })
    );

    // Veli 1: adı, telefonu, 'Hesap bağlı değil' rozeti çizilir
    expect(html).toContain("Fatma Demir");
    expect(html).toContain("+90 555 123 4567");
    expect(html).toContain("Hesap bağlı değil");

    // Veli 2: adı çizilir, hesabı olduğu için rozet çizilmez
    expect(html).toContain("Ali Veli");
  });

  it("⛔ telefonu olmayan velide 'Telefon yok' gibi bir etiket üretilmez, tire (—) çizilir (K-22)", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: dummyStudent,
        onClose: vi.fn(),
        role: "admin",
        studentGuardians: dummyGuardians,
      })
    );

    // K-22: "Telefon yok" asla üretilmez
    expect(html).not.toContain("Telefon yok");
    expect(html).not.toContain("telefon yok");
    expect(html).toContain("—");
  });

  it("yönetici olmayan rolde (öğretmen) 'Veli bağla' ve 'Bağı kopar' butonları çizilmez", () => {
    const onLinkMock = vi.fn();
    const onUnlinkMock = vi.fn();

    // 1. Öğretmen rolü: butonlar çizilmez
    const teacherHtml = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: dummyStudent,
        onClose: vi.fn(),
        role: "teacher",
        studentGuardians: dummyGuardians,
        onLinkGuardian: onLinkMock,
        onUnlinkGuardian: onUnlinkMock,
      })
    );

    expect(teacherHtml).not.toContain("Veli bağla");
    expect(teacherHtml).not.toContain("Bağı kopar");

    // 2. Admin rolü: iki buton da çizilir
    const adminHtml = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: dummyStudent,
        onClose: vi.fn(),
        role: "admin",
        studentGuardians: dummyGuardians,
        onLinkGuardian: onLinkMock,
        onUnlinkGuardian: onUnlinkMock,
      })
    );

    expect(adminHtml).toContain("Veli bağla");
    expect(adminHtml).toContain("Bağı kopar");
  });

  it("bağlanabilir veli kalmadığında seçici yerine anlamlı cümle çizilir, açılır liste çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: dummyStudent,
        onClose: vi.fn(),
        role: "admin",
        studentGuardians: dummyGuardians,
        availableGuardians: [],
        isLinkGuardianOpen: true,
        onLinkGuardian: vi.fn(),
      })
    );

    expect(html).toContain("Bağlanabilir başka veli kaydı bulunmuyor.");
    expect(html).not.toContain("<select");
  });

  it("R1 Regresyonu: veli adı okunamadığında 'adı okunamadı' çizilir, 'İsimsiz' veya 'İsimsiz Veli' uydurulmaz", () => {
    const unreadGuardianLink = [
      {
        id: "link-unnamed",
        organizationId: "org-1",
        studentId: "stu-1",
        guardianId: "g-unnamed",
        guardian: {
          id: "g-unnamed",
          fullName: "",
          phone: null,
          hasAccount: true,
        },
      },
    ];

    const html = renderToStaticMarkup(
      createElement(StudentDetail, {
        student: dummyStudent,
        onClose: vi.fn(),
        role: "admin",
        studentGuardians: unreadGuardianLink,
      })
    );

    expect(html).toContain("adı okunamadı");
    expect(html).not.toContain("İsimsiz");
    expect(html).not.toContain("İsimsiz Veli");
  });
});

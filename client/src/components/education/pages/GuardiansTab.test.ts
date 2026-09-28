import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { GuardiansTab, LinkGuardianAccountPopover } from "./GuardiansTab";
import type { Guardian } from "@/education/guardianService";

describe("GuardiansTab UI — K-22, K-03, K-06 Güvenceleri", () => {
  const dummyGuardians: Guardian[] = [
    {
      id: "g-1",
      fullName: "Fatma Demir",
      phone: "+49 170 1234567",
      hasAccount: false,
      authUserId: null,
      studentCount: 1,
      studentNames: ["Ece Demir"],
    },
    {
      id: "g-2",
      fullName: "Ali Veli",
      phone: null,
      hasAccount: true,
      authUserId: "user-2",
      studentCount: 0,
      studentNames: [],
    },
  ];

  it("⛔ telefonu olmayan velide 'Telefon yok' gibi bir etiket üretilmez, tire (—) çizilir (K-22)", () => {
    const html = renderToStaticMarkup(
      createElement(GuardiansTab, {
        guardians: dummyGuardians,
        query: "",
        onQuery: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
      })
    );

    // K-22: "Telefon yok" asla üretilmemeli
    expect(html).not.toContain("Telefon yok");
    expect(html).not.toContain("telefon yok");
    // Telefonu olmayan veli için tire çizilmeli
    expect(html).toContain("—");
  });

  it("biçimi alışılmadık / uluslararası numara (+49 170 1234567) ekranda olduğu gibi çizilir", () => {
    const html = renderToStaticMarkup(
      createElement(GuardiansTab, {
        guardians: dummyGuardians,
        query: "",
        onQuery: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
      })
    );

    expect(html).toContain("+49 170 1234567");
  });

  it("hesabı bağlı olmayan veli için 'Hesap bağlı değil' rozeti çizilir, hesabı olanda çizilmez (K-22)", () => {
    const htmlUnlinked = renderToStaticMarkup(
      createElement(GuardiansTab, {
        guardians: [
          {
            id: "g-1",
            fullName: "Fatma Demir",
            phone: null,
            hasAccount: false,
            authUserId: null,
            studentCount: 0,
          },
        ],
        query: "",
        onQuery: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
      })
    );
    expect(htmlUnlinked).toContain("Hesap bağlı değil");

    const htmlLinked = renderToStaticMarkup(
      createElement(GuardiansTab, {
        guardians: [
          {
            id: "g-2",
            fullName: "Ali Veli",
            phone: null,
            hasAccount: true,
            authUserId: "user-2",
            studentCount: 0,
          },
        ],
        query: "",
        onQuery: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
      })
    );
    expect(htmlLinked).not.toContain("Hesap bağlı değil");
  });

  it("veli listesi tavana dayandığında kesilme söylenir ve öğüdü yapılabilir bir eylemdir (K-06)", () => {
    const html = renderToStaticMarkup(
      createElement(GuardiansTab, {
        guardians: dummyGuardians,
        query: "",
        onQuery: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
        truncated: true,
        limit: 100,
      })
    );

    expect(html).toContain("Liste üst sınıra (100 kayıt) ulaştı");
    expect(html).toContain("arama kutusunu kullanın");
  });
});

describe("LinkGuardianAccountPopover — R1 ve Boş Durum Güvenceleri", () => {
  const dummyGuardian: Guardian = {
    id: "g-1",
    fullName: "Fatma Demir",
    phone: null,
    hasAccount: false,
    authUserId: null,
    studentCount: 0,
  };

  it("R1: veli hesabı bağlama seçicisinde displayName null olduğunda 'adı okunamadı' yazar, 'İsimsiz' uydurulmaz", () => {
    const dummyMember = {
      membershipId: "mem-1",
      userId: "user-1",
      organizationId: "org-1",
      role: "parent" as const,
      displayName: null,
      email: "veli@example.com",
      loginNumber: "V100",
      joinedAt: "2026-09-01",
      status: "active" as const,
      branchName: null,
    };

    const html = renderToStaticMarkup(
      createElement(LinkGuardianAccountPopover, {
        guardian: dummyGuardian,
        members: [dummyMember],
        onLink: vi.fn(),
        open: true,
      })
    );

    expect(html).toContain("adı okunamadı");
    expect(html).toContain("(V100)");
    expect(html).not.toContain("İsimsiz");
    expect(html).not.toContain("isimsiz");
  });

  it("bağlanabilir veli hesabı olmadığında bilgilendirici metin çizilir, seçici çizilmez", () => {
    const html = renderToStaticMarkup(
      createElement(LinkGuardianAccountPopover, {
        guardian: dummyGuardian,
        members: [],
        onLink: vi.fn(),
        open: true,
      })
    );

    expect(html).toContain("Kurumda bağlanabilir veli hesabı bulunmuyor.");
    expect(html).not.toContain("<select");
  });
});

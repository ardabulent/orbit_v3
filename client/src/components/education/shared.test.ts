import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Vitest config runs in node without react plugin, so JSX compiled by esbuild expects React in global scope
(globalThis as unknown as { React: typeof React }).React = React;
import { AuthContext } from "@/auth/AuthContext";
import type { AuthContextValue } from "@/auth/types";
import { CardSkeleton, ErrorState, TableSkeleton } from "./shared";
import { StudentsPage } from "./pages/StudentsPage";
import { ClassesPage } from "./pages/ClassesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { AttendancePage } from "./pages/AttendancePage";
import { AssessmentsPage } from "./pages/AssessmentsPage";

function withAuth(children: React.ReactNode) {
  const dummyAuth: AuthContextValue = {
    identity: null,
    loading: false,
    demoMode: false,
    passwordRecovery: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    switchDemoRole: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
    cancelPasswordRecovery: vi.fn(),
    completeRequiredPasswordChange: vi.fn(),
    refreshIdentity: vi.fn(),
  };
  return createElement(AuthContext.Provider, { value: dummyAuth }, children);
}

describe("shared education components (v1.3-02b)", () => {
  describe("TableSkeleton", () => {
    it("renders role=status, aria-busy=true and screen reader text without visible plain text loading", () => {
      const html = renderToStaticMarkup(
        createElement(TableSkeleton, { rows: 3, columns: 4 })
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('class="sr-only">Yükleniyor…</span>');
      // Visible plain text should not be rendered
      expect(html).not.toMatch(/<p[^>]*>.*yükleniyor.*<\/p>/i);
    });

    it("renders expected rows and columns skeleton elements", () => {
      const html = renderToStaticMarkup(
        createElement(TableSkeleton, { rows: 2, columns: 3 })
      );

      // Header row has 3 columns, body has 2 rows * 3 columns = 9 skeleton elements total
      const matches = html.match(/data-slot="skeleton"/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(3 + 2 * 3);
    });
  });

  describe("CardSkeleton", () => {
    it("renders role=status, aria-busy=true and screen reader text", () => {
      const html = renderToStaticMarkup(createElement(CardSkeleton));

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('class="sr-only">Yükleniyor…</span>');
    });
  });

  describe("ErrorState", () => {
    it("renders error message and title with role=alert", () => {
      const html = renderToStaticMarkup(
        createElement(ErrorState, {
          title: "Özel Hata Başlığı",
          message: "Ağ bağlantısı kurulamadı.",
        })
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Özel Hata Başlığı");
      expect(html).toContain("Ağ bağlantısı kurulamadı.");
      // onRetry is not passed, so retry button MUST NOT be rendered
      expect(html).not.toContain("Tekrar dene");
    });

    it("renders retry button when onRetry is provided", () => {
      const onRetry = vi.fn();
      const html = renderToStaticMarkup(
        createElement(ErrorState, {
          message: "Sorgu başarısız.",
          onRetry,
        })
      );

      expect(html).toContain("Tekrar dene");
      expect(html).toContain("<button");
    });

    it("does not render retry button when onRetry is undefined", () => {
      const html = renderToStaticMarkup(
        createElement(ErrorState, {
          message: "Sorgu başarısız.",
          onRetry: undefined,
        })
      );

      expect(html).not.toContain("Tekrar dene");
    });
  });
});

describe("page state consistency & honesty (v1.3-02b / K-22)", () => {
  describe("ClassesPage", () => {
    it("K-22: does NOT make claims about institution when empty, uses honest copy", () => {
      const html = renderToStaticMarkup(
        createElement(ClassesPage, {
          role: "teacher",
          classes: [],
          onOpen: vi.fn(),
        })
      );

      // Honest copy:
      expect(html).toContain("Gösterilecek sınıf yok");
      // Old misleading copy MUST NOT return:
      expect(html).not.toContain("Henüz sınıf kaydı yok");
    });

    it("renders TableSkeleton and avoids old plain text during loading", () => {
      const html = renderToStaticMarkup(
        createElement(ClassesPage, {
          role: "admin",
          classes: [],
          isLoading: true,
          onOpen: vi.fn(),
        })
      );

      expect(html).toContain('role="status"');
      expect(html).not.toContain("Sınıflar yükleniyor…");
    });

    it("renders ErrorState with retry button when onRetry is passed, without it when undefined", () => {
      const withRetryHtml = renderToStaticMarkup(
        createElement(ClassesPage, {
          role: "admin",
          classes: [],
          error: new Error("Sunucuya ulaşılamadı"),
          onRetry: vi.fn(),
          onOpen: vi.fn(),
        })
      );
      expect(withRetryHtml).toContain("Sınıflar görüntülenemedi");
      expect(withRetryHtml).toContain("Tekrar dene");

      const noRetryHtml = renderToStaticMarkup(
        createElement(ClassesPage, {
          role: "admin",
          classes: [],
          error: new Error("Sunucuya ulaşılamadı"),
          onRetry: undefined,
          onOpen: vi.fn(),
        })
      );
      expect(noRetryHtml).toContain("Sınıflar görüntülenemedi");
      expect(noRetryHtml).not.toContain("Tekrar dene");
    });
  });

  describe("PaymentsPage", () => {
    it("K-22: does NOT make claims about institution when empty, uses honest copy", () => {
      const html = renderToStaticMarkup(
        createElement(PaymentsPage, {
          role: "parent",
          paymentRows: [],
          isDemo: false,
        })
      );

      // Honest copy:
      expect(html).toContain("Gösterilecek ödeme kaydı yok");
      // Old misleading copy MUST NOT return:
      expect(html).not.toContain("Henüz ödeme kaydı yok");
    });

    it("renders TableSkeleton and avoids old plain text during loading", () => {
      const html = renderToStaticMarkup(
        createElement(PaymentsPage, {
          role: "admin",
          isLoading: true,
          isDemo: false,
        })
      );

      expect(html).toContain('role="status"');
      expect(html).not.toContain("Ödeme bilgileri yükleniyor...");
    });

    it("renders ErrorState with retry button only when onRetry is passed", () => {
      const withRetryHtml = renderToStaticMarkup(
        createElement(PaymentsPage, {
          role: "admin",
          error: new Error("Veritabanı hatası"),
          onRetry: vi.fn(),
          isDemo: false,
        })
      );
      expect(withRetryHtml).toContain("Ödeme bilgileri görüntülenemedi");
      expect(withRetryHtml).toContain("Tekrar dene");

      const noRetryHtml = renderToStaticMarkup(
        createElement(PaymentsPage, {
          role: "admin",
          error: new Error("Veritabanı hatası"),
          onRetry: undefined,
          isDemo: false,
        })
      );
      expect(noRetryHtml).toContain("Ödeme bilgileri görüntülenemedi");
      expect(noRetryHtml).not.toContain("Tekrar dene");
    });
  });

  describe("AssessmentsPage (K-22 exception: exams is institution-wide)", () => {
    it("preserves 'Henüz sınav kaydı yok' when exam list is empty", () => {
      const html = renderToStaticMarkup(
        withAuth(
          createElement(AssessmentsPage, {
            role: "teacher",
            exam: null,
            isDemo: false,
            onNavigate: vi.fn(),
          })
        )
      );

      // Exception preserved per task §2: exams_select_member is institution-wide
      expect(html).toContain("Henüz sınav kaydı yok");
    });

    it("renders CardSkeleton and avoids old plain text during loading", () => {
      const html = renderToStaticMarkup(
        withAuth(
          createElement(AssessmentsPage, {
            role: "teacher",
            isLoading: true,
            isDemo: false,
            onNavigate: vi.fn(),
          })
        )
      );

      expect(html).toContain('role="status"');
      expect(html).not.toContain("Sınav bilgileri yükleniyor...");
    });

    it("renders ErrorState with retry button when onRetry provided, without it when undefined", () => {
      const withRetryHtml = renderToStaticMarkup(
        withAuth(
          createElement(AssessmentsPage, {
            role: "teacher",
            error: new Error("Sınav servisi hatası"),
            onRetry: vi.fn(),
            isDemo: false,
            onNavigate: vi.fn(),
          })
        )
      );
      expect(withRetryHtml).toContain("Sınav bilgileri görüntülenemedi");
      expect(withRetryHtml).toContain("Tekrar dene");

      const noRetryHtml = renderToStaticMarkup(
        withAuth(
          createElement(AssessmentsPage, {
            role: "teacher",
            error: new Error("Sınav servisi hatası"),
            onRetry: undefined,
            isDemo: false,
            onNavigate: vi.fn(),
          })
        )
      );
      expect(noRetryHtml).toContain("Sınav bilgileri görüntülenemedi");
      expect(noRetryHtml).not.toContain("Tekrar dene");
    });
  });

  describe("StudentsPage", () => {
    it("renders TableSkeleton and avoids old plain text during loading", () => {
      const html = renderToStaticMarkup(
        createElement(StudentsPage, {
          role: "admin",
          students: [],
          query: "",
          onQuery: vi.fn(),
          onSelect: vi.fn(),
          onAdd: vi.fn(),
          isLoading: true,
        })
      );

      expect(html).toContain('role="status"');
      expect(html).not.toContain("Öğrenciler yükleniyor…");
    });

    it("renders ErrorState with retry button when onRetry provided, without it when undefined", () => {
      const withRetryHtml = renderToStaticMarkup(
        createElement(StudentsPage, {
          role: "admin",
          students: [],
          query: "",
          onQuery: vi.fn(),
          onSelect: vi.fn(),
          onAdd: vi.fn(),
          error: new Error("Ağ koptu"),
          onRetry: vi.fn(),
        })
      );
      expect(withRetryHtml).toContain("Öğrenciler görüntülenemedi");
      expect(withRetryHtml).toContain("Tekrar dene");

      const noRetryHtml = renderToStaticMarkup(
        createElement(StudentsPage, {
          role: "admin",
          students: [],
          query: "",
          onQuery: vi.fn(),
          onSelect: vi.fn(),
          onAdd: vi.fn(),
          error: new Error("Ağ koptu"),
          onRetry: undefined,
        })
      );
      expect(noRetryHtml).toContain("Öğrenciler görüntülenemedi");
      expect(noRetryHtml).not.toContain("Tekrar dene");
    });
  });

  describe("SchedulePage", () => {
    it("renders TableSkeleton and avoids old plain text during loading", () => {
      const html = renderToStaticMarkup(
        createElement(SchedulePage, {
          role: "teacher",
          schedule: [],
          isLoading: true,
        })
      );

      expect(html).toContain('role="status"');
      expect(html).not.toContain("Ders programı yükleniyor…");
    });

    it("renders ErrorState with retry button when onRetry provided, without it when undefined", () => {
      const withRetryHtml = renderToStaticMarkup(
        createElement(SchedulePage, {
          role: "teacher",
          schedule: [],
          error: new Error("Program yüklenemedi"),
          onRetry: vi.fn(),
        })
      );
      expect(withRetryHtml).toContain("Ders programı görüntülenemedi");
      expect(withRetryHtml).toContain("Tekrar dene");

      const noRetryHtml = renderToStaticMarkup(
        createElement(SchedulePage, {
          role: "teacher",
          schedule: [],
          error: new Error("Program yüklenemedi"),
          onRetry: undefined,
        })
      );
      expect(noRetryHtml).toContain("Ders programı görüntülenemedi");
      expect(noRetryHtml).not.toContain("Tekrar dene");
    });
  });

  describe("AttendancePage", () => {
    it("renders CardSkeleton and avoids old plain text during loading", () => {
      const html = renderToStaticMarkup(
        createElement(AttendancePage, {
          role: "teacher",
          students: [],
          attendances: {},
          setAttendances: vi.fn(),
          isLoading: true,
          isDemo: false,
        })
      );

      expect(html).toContain('role="status"');
      expect(html).not.toContain("Yoklama oturumu yükleniyor...");
    });

    it("renders ErrorState with retry button when onRetry provided, without it when undefined", () => {
      const withRetryHtml = renderToStaticMarkup(
        createElement(AttendancePage, {
          role: "teacher",
          students: [],
          attendances: {},
          setAttendances: vi.fn(),
          error: new Error("Yoklama servisi erişilemiyor"),
          onRetry: vi.fn(),
          isDemo: false,
        })
      );
      expect(withRetryHtml).toContain("Yoklama bilgileri görüntülenemedi");
      expect(withRetryHtml).toContain("Tekrar dene");

      const noRetryHtml = renderToStaticMarkup(
        createElement(AttendancePage, {
          role: "teacher",
          students: [],
          attendances: {},
          setAttendances: vi.fn(),
          error: new Error("Yoklama servisi erişilemiyor"),
          onRetry: undefined,
          isDemo: false,
        })
      );
      expect(noRetryHtml).toContain("Yoklama bilgileri görüntülenemedi");
      expect(noRetryHtml).not.toContain("Tekrar dene");
    });
  });
});

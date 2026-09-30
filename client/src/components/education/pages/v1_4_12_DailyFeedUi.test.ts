import { readFileSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/auth/AuthContext";
import type { AuthContextValue } from "@/auth/types";
import type { EducationRole } from "@/components/educationAccess";
import { DailyFeedSection } from "./DailyFeedSection";
import { FeedPostFormDialog } from "./FeedPostFormDialog";
import { CommunicationsPage } from "./CommunicationsPage";
import { useFeedPosts } from "@/education/educationQueries";
import type { FeedPost } from "@/education/feedService";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/education/educationQueries", () => ({
  useFeedPosts: vi.fn(),
  educationKeys: {
    feed: (orgId: string) => ["education", "feed", orgId],
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children?: React.ReactNode;
    open?: boolean;
  }) =>
    createElement(
      "div",
      { "data-slot": "dialog", "data-open": open },
      open ? children : null
    ),
  DialogContent: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-content" }, children),
  DialogHeader: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-header" }, children),
  DialogTitle: ({ children }: { children?: React.ReactNode }) =>
    createElement("h2", { "data-slot": "dialog-title" }, children),
  DialogDescription: ({ children }: { children?: React.ReactNode }) =>
    createElement("p", { "data-slot": "dialog-description" }, children),
  DialogFooter: ({ children }: { children?: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-footer" }, children),
  useDialogComposition: () => ({
    isComposing: false,
    onCompositionStart: () => {},
    onCompositionEnd: () => {},
  }),
}));

function renderWithAuth(
  ui: React.ReactElement,
  options?: {
    role?: EducationRole;
    membershipId?: string;
    orgId?: string;
  }
) {
  const queryClient = new QueryClient();
  const dummyAuth: AuthContextValue = {
    identity: {
      user: {
        id: "usr-1",
        email: "test@orbit.local",
        phone: null,
        created_at: "",
      },
      membership: {
        id: options?.membershipId ?? "mem-teacher-1",
        membershipId: options?.membershipId ?? "mem-teacher-1",
        role: options?.role ?? "admin",
        organizationId: options?.orgId ?? "org-1",
        organizationName: "Güneş Dershanesi",
        branchName: "Kadıköy Şubesi",
      },
    } as unknown as AuthContextValue["identity"],
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

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AuthContext.Provider, { value: dummyAuth }, ui)
    )
  );
}

describe("v1.4-12 Günlük Akış Duyuru Panosu UI ve K-23 Testleri", () => {
  const sampleClasses = [
    { id: "cls-1", name: "12-A" },
    { id: "cls-2", name: "11-B" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Yüke id ve author_membership_id konmuyor", () => {
    it("feedService.ts kaynak kodunda insert/update payload'larında id veya author_membership_id bulunmaz", () => {
      const feedServicePath = path.resolve(
        import.meta.dirname,
        "../../../education/feedService.ts"
      );
      const code = readFileSync(feedServicePath, "utf-8");

      // createFeedPost payload
      expect(code).toContain("const payload = {");
      expect(code).not.toMatch(
        /insert\(\s*\{\s*[^}]*\bid:\s*[^,}]+[^}]*\}\s*\)/
      );
      expect(code).not.toMatch(
        /insert\(\s*\{\s*[^}]*\bauthor_membership_id:\s*[^,}]+[^}]*\}\s*\)/
      );
    });
  });

  describe("2. Başkasının duyurusunda 'Düzenle'/'Kaldır' çizilmiyor; kendi duyurusunda çiziliyor", () => {
    it("öğretmen rolünde yalnız kendi yazdığı sınıf duyurusunda işlem butonları çizilir", () => {
      const posts: FeedPost[] = [
        {
          id: "post-own",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          title: "Benim Duyurum",
          body: "Ödevler teslim edildi mi?",
          authorMembershipId: "mem-teacher-1", // Kendi üyeliği
          authorName: "Ahmet Öğretmen",
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
        {
          id: "post-other",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          title: "Müdürün Duyurusu",
          body: "Okul yarın tatil.",
          authorMembershipId: "mem-admin-boss", // Başkasının üyeliği
          authorName: "Mehmet Müdür",
          createdAt: "2026-09-13T09:00:00Z",
          updatedAt: "2026-09-13T09:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
      ];

      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: posts, truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "teacher",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "teacher", membershipId: "mem-teacher-1" }
      );

      // Kendi duyurusu ve başkasının duyurusu başlıkları görünür
      expect(html).toContain("Benim Duyurum");
      expect(html).toContain("Müdürün Duyurusu");

      // Sadece 1 adet "Düzenle" ve 1 adet "Kaldır" butonu olmalıdır (yalnız kendi duyurusunda)
      const editOccurrences = (html.match(/<span>Düzenle<\/span>/g) || [])
        .length;
      const deleteOccurrences = (html.match(/<span>Kaldır<\/span>/g) || [])
        .length;

      expect(editOccurrences).toBe(1);
      expect(deleteOccurrences).toBe(1);
    });

    it("yönetici rolünde tüm duyurularda Düzenle ve Kaldır çizilir", () => {
      const posts: FeedPost[] = [
        {
          id: "post-1",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          title: "Öğretmenin Duyurusu",
          body: null,
          authorMembershipId: "mem-teacher-1",
          authorName: "Ahmet Öğretmen",
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
        {
          id: "post-2",
          organizationId: "org-1",
          classId: null,
          className: null,
          title: "Kurum Geneli Duyuru",
          body: null,
          authorMembershipId: "mem-admin-1",
          authorName: "Müdür",
          createdAt: "2026-09-13T09:00:00Z",
          updatedAt: "2026-09-13T09:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
      ];

      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: posts, truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "admin",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "admin", membershipId: "mem-admin-1" }
      );

      const editOccurrences = (html.match(/<span>Düzenle<\/span>/g) || [])
        .length;
      expect(editOccurrences).toBe(2);
    });
  });

  describe("3. Öğretmene kurum geneli seçeneği sunulmuyor", () => {
    it("öğretmen için hedef seçicide 'Kurum Geneli' seçeneği yer almaz", () => {
      const html = renderWithAuth(
        createElement(FeedPostFormDialog, {
          open: true,
          onOpenChange: vi.fn(),
          organizationId: "org-1",
          role: "teacher",
          classes: sampleClasses,
        }),
        { role: "teacher" }
      );

      expect(html).not.toContain("Kurum Geneli (Tüm Sınıflar)");
      expect(html).toContain("12-A Sınıfı");
      expect(html).toContain("11-B Sınıfı");
    });

    it("yönetici için hedef seçicide 'Kurum Geneli' seçeneği mevcuttur", () => {
      const html = renderWithAuth(
        createElement(FeedPostFormDialog, {
          open: true,
          onOpenChange: vi.fn(),
          organizationId: "org-1",
          role: "admin",
          classes: sampleClasses,
        }),
        { role: "admin" }
      );

      expect(html).toContain("Kurum Geneli (Tüm Sınıflar)");
    });
  });

  describe("4. Kurum geneli ile sınıf duyurusu ekranda ayırt ediliyor", () => {
    it("kurum geneli duyuruda 'Kurum Geneli' rozeti, sınıf duyurusunda sınıf adı rozeti basılır", () => {
      const posts: FeedPost[] = [
        {
          id: "p-org",
          organizationId: "org-1",
          classId: null,
          className: null,
          title: "Tüm Kuruma Duyuru",
          body: "Yarın tatil",
          authorMembershipId: "mem-1",
          authorName: "İdare",
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
        {
          id: "p-cls",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          title: "Sınav Duyurusu",
          body: "Matematik ödevi",
          authorMembershipId: "mem-2",
          authorName: "Ali Hoca",
          createdAt: "2026-09-13T09:00:00Z",
          updatedAt: "2026-09-13T09:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
      ];

      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: posts, truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "student",
          organizationId: "org-1",
          classes: [],
        }),
        { role: "student" }
      );

      expect(html).toContain("Kurum Geneli");
      expect(html).toContain("12-A");
    });
  });

  describe("5. Yazarın adı çözülemediğinde ham kimlik basılmıyor", () => {
    it("yazarın adı çözülemediğinde 'adı okunamadı' yazar, ham UUID basılmaz", () => {
      const posts: FeedPost[] = [
        {
          id: "p-unresolved",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          title: "Gizemli Duyuru",
          body: "Duyuru metni",
          authorMembershipId: "018f3a5e-1234-7890-abcd-ef0123456789",
          authorName: "adı okunamadı", // Çözülememiş yazar adı
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
      ];

      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: posts, truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "student",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "student" }
      );

      expect(html).toContain("adı okunamadı");
      expect(html).not.toContain("018f3a5e-1234-7890-abcd-ef0123456789");
    });
  });

  describe("6. body boşken boş gövde bloğu çizilmiyor", () => {
    it("body null veya boşluktan ibaretken gövde paragrafı çizilmez", () => {
      const posts: FeedPost[] = [
        {
          id: "p-no-body",
          organizationId: "org-1",
          classId: null,
          className: null,
          title: "Sadece Başlıktan İbaret Duyuru",
          body: null,
          authorMembershipId: "mem-1",
          authorName: "Müdür",
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
        {
          id: "p-with-body",
          organizationId: "org-1",
          classId: null,
          className: null,
          title: "Gövdesi Olan Duyuru",
          body: "Burada detaylı bir açıklama yer almaktadır.",
          authorMembershipId: "mem-1",
          authorName: "Müdür",
          createdAt: "2026-09-13T09:00:00Z",
          updatedAt: "2026-09-13T09:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
      ];

      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: posts, truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "student",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "student" }
      );

      expect(html).toContain("Sadece Başlıktan İbaret Duyuru");
      expect(html).toContain("Burada detaylı bir açıklama yer almaktadır.");

      // p-no-body için gövde bloğu çizilmez, yalnızca p-with-body için 1 adet çizilir
      const bodyBlocks = (html.match(/data-slot="feed-body"/g) || []).length;
      expect(bodyBlocks).toBe(1);
    });
  });

  describe("7. Sıfır satır etkileyen yazma hata fırlatıyor (K-14)", () => {
    it("feedService kaynak kodu update, archive ve restore fonksiyonlarında sıfır satır kontrolü yapar", () => {
      const feedServicePath = path.resolve(
        import.meta.dirname,
        "../../../education/feedService.ts"
      );
      const code = readFileSync(feedServicePath, "utf-8");

      expect(code).toContain("if (!data || data.length === 0)");
      expect(code).toContain(
        "Duyuru güncellenemedi veya bu işlem için yetkiniz bulunmuyor"
      );
      expect(code).toContain(
        "Duyuru arşivlenemedi veya bu işlem için yetkiniz bulunmuyor"
      );
      expect(code).toContain(
        "Duyuru arşivden çıkarılamadı veya bu işlem için yetkiniz bulunmuyor"
      );
    });
  });

  describe("8. Ekran hata cümlesini ikinci kez çevirmiyor", () => {
    it("DailyFeedSection ve FeedPostFormDialog servis hatasını doğrudan ekrana taşır", () => {
      const dialogPath = path.resolve(
        import.meta.dirname,
        "FeedPostFormDialog.tsx"
      );
      const dialogCode = readFileSync(dialogPath, "utf-8");
      expect(dialogCode).toContain("err instanceof Error ? err.message :");
      expect(dialogCode).not.toContain("translateFeedError");

      const sectionPath = path.resolve(
        import.meta.dirname,
        "DailyFeedSection.tsx"
      );
      const sectionCode = readFileSync(sectionPath, "utf-8");
      expect(sectionCode).toContain("err instanceof Error ? err.message :");
      expect(sectionCode).not.toContain("translateFeedError");
    });
  });

  describe("9. Öğrenci/veli rolünde yazma eylemleri çizilmiyor", () => {
    it("öğrenci rolünde 'Duyuru Paylaş', 'Düzenle', 'Kaldır' çizilmez", () => {
      const posts: FeedPost[] = [
        {
          id: "p-1",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          title: "Sınıf Duyurusu",
          body: "Yarın sınav var",
          authorMembershipId: "mem-1",
          authorName: "Öğretmen",
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
          archivedAt: null,
          audience: "all" as const,
          pinned: false,
          kind: "general",
          eventDate: null,
        },
      ];

      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: posts, truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const studentHtml = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "student",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "student" }
      );

      expect(studentHtml).not.toContain("Duyuru Paylaş");
      expect(studentHtml).not.toContain("Düzenle");
      expect(studentHtml).not.toContain("Kaldır");

      const parentHtml = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "parent",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "parent" }
      );

      expect(parentHtml).not.toContain("Duyuru Paylaş");
      expect(parentHtml).not.toContain("Düzenle");
      expect(parentHtml).not.toContain("Kaldır");
    });
  });

  describe("10. Liste tavana dayandığında kesilme söyleniyor (K-06)", () => {
    it("truncated true olduğunda uyarı bandı görünür", () => {
      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: [], truncated: true },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "admin",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "admin" }
      );

      expect(html).toContain("Liste üst sınıra (50 kayıt) ulaştı");
    });

    it("truncated false olduğunda uyarı bandı görünmez", () => {
      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: [], truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(DailyFeedSection, {
          role: "admin",
          organizationId: "org-1",
          classes: sampleClasses,
        }),
        { role: "admin" }
      );

      expect(html).not.toContain("Liste üst sınıra");
    });
  });

  describe("11. window.confirm kullanılmaz", () => {
    it("DailyFeedSection ve FeedPostFormDialog kaynak kodunda window.confirm veya alert geçmez", () => {
      const sectionPath = path.resolve(
        import.meta.dirname,
        "DailyFeedSection.tsx"
      );
      const sectionCode = readFileSync(sectionPath, "utf-8");
      expect(sectionCode).not.toContain("window.confirm");
      expect(sectionCode).not.toContain("window.alert");

      const dialogPath = path.resolve(
        import.meta.dirname,
        "FeedPostFormDialog.tsx"
      );
      const dialogCode = readFileSync(dialogPath, "utf-8");
      expect(dialogCode).not.toContain("window.confirm");
      expect(dialogCode).not.toContain("window.alert");
    });
  });

  describe("12. CommunicationsPage entegrasyonu", () => {
    it("CommunicationsPage varsayılan olarak Günlük Akış sekmesinde başlar ve DailyFeedSection render eder", () => {
      vi.mocked(useFeedPosts).mockReturnValue({
        data: { rows: [], truncated: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useFeedPosts>);

      const html = renderWithAuth(
        createElement(CommunicationsPage, {
          role: "admin",
          message: "",
          setMessage: vi.fn(),
          organizationId: "org-1",
          classes: sampleClasses,
          isDemo: false,
        }),
        { role: "admin" }
      );

      // 2026-09-29: birebir mesajlaşma yok; üretimde sekme ve mesaj kutusu
      // çizilmez (gönderemeyen bir kutu sunulmaz).
      expect(html).not.toContain("Birebir Mesajlar");
      expect(html).not.toContain("Mesajı gönder");
      expect(html).toContain("Günlük Akış Duyuru Panosu");
    });
  });
});

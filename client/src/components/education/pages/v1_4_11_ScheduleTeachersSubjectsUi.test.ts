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
import { SettingsSubjectsSection } from "./SettingsSubjectsSection";
import { ClassTeachersDialog } from "./ClassTeachersDialog";
import { SchedulePage } from "./SchedulePage";
import { ClassesPage } from "./ClassesPage";
import { useSubjects, useClassTeachers } from "@/education/educationQueries";
import { useSettingsMembers } from "@/settings/settingsQueries";
import type { ClassGroup, ScheduleItem } from "../types";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/education/educationQueries", () => ({
  useSubjects: vi.fn(),
  useClassTeachers: vi.fn(),
  educationKeys: {
    subjects: (orgId: string) => ["education", "subjects", orgId],
    classTeachers: (orgId: string, classId?: string) => [
      "education",
      "classTeachers",
      orgId,
      classId,
    ],
    classes: (orgId: string) => ["education", "classes", orgId],
    schedule: (orgId: string) => ["education", "schedule", orgId],
    homework: (orgId: string) => ["education", "homework", orgId],
    exam: (orgId: string) => ["education", "exam", orgId],
    exams: (orgId: string) => ["education", "exams", orgId],
  },
}));

vi.mock("@/settings/settingsQueries", () => ({
  useSettingsMembers: vi.fn(),
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
}));

function renderWithAuth(
  ui: React.ReactElement,
  options?: {
    role?: EducationRole;
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
        id: "mem-1",
        membershipId: "mem-1",
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

describe("v1.4-11 Arayüz ve Sözleşme Testleri (#287 / K-23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSubjects).mockReturnValue({
      data: {
        rows: [
          {
            id: "sub-1",
            organizationId: "org-1",
            name: "Matematik",
            archivedAt: null,
          },
        ],
        truncated: false,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSubjects>);

    vi.mocked(useClassTeachers).mockReturnValue({
      data: {
        rows: [
          {
            id: "ct-1",
            organizationId: "org-1",
            classId: "class-1",
            membershipId: "mem-teacher-1",
            teacherName: "Zeynep Hoca",
            subjectId: "sub-1",
            subjectName: "Matematik",
            createdAt: "2026-09-13T00:00:00Z",
            archivedAt: null,
          },
        ],
        truncated: false,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useClassTeachers>);

    vi.mocked(useSettingsMembers).mockReturnValue({
      data: [
        {
          membershipId: "mem-admin",
          displayName: "Müdür Bey",
          role: "admin",
          status: "active",
        },
        {
          membershipId: "mem-teacher-1",
          displayName: "Zeynep Hoca",
          role: "teacher",
          status: "active",
        },
        {
          membershipId: "mem-student-1",
          displayName: "Ali Öğrenci",
          role: "student",
          status: "active",
        },
        {
          membershipId: "mem-parent-1",
          displayName: "Veli Anne",
          role: "parent",
          status: "active",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettingsMembers>);
  });

  describe("1. Yönetici olmayan rolde yazma eylemleri çizilmiyor", () => {
    it("SettingsSubjectsSection: öğretmen rolünde 'Yeni Ders', 'Düzenle', 'Kapat' çizilmez", () => {
      const html = renderWithAuth(createElement(SettingsSubjectsSection), {
        role: "teacher",
      });

      expect(html).toContain("Matematik");
      expect(html).not.toContain("<span>Yeni Ders</span>");
      expect(html).not.toContain("<span>Düzenle</span>");
      expect(html).not.toContain("<span>Kapat</span>");
    });

    it("SchedulePage: öğretmen rolünde 'Ders programı ekle', 'Düzenle', 'Kaldır' çizilmez", () => {
      // SchedulePage uses getTodayWeekDay()
      const scheduleItems: ScheduleItem[] = [
        {
          id: "sched-1",
          day: "Pazar",
          time: "09:00",
          title: "Matematik",
          group: "12-A",
          teacher: "Zeynep Hoca",
          room: "A-101",
          duration: "50 dk",
        },
        {
          id: "sched-2",
          day: "Pazartesi",
          time: "09:00",
          title: "Fizik",
          group: "12-A",
          teacher: "Zeynep Hoca",
          room: "A-101",
          duration: "50 dk",
        },
      ];

      const html = renderWithAuth(
        createElement(SchedulePage, {
          role: "teacher",
          schedule: scheduleItems,
        }),
        { role: "teacher" }
      );

      expect(html).not.toContain("Ders programı ekle");
      expect(html).not.toContain("Düzenle");
      expect(html).not.toContain("Kaldır");
    });

    it("ClassesPage: öğretmen rolünde 'Öğretmenler' ve 'Düzenle'/'Arşivle' butonları çizilmez", () => {
      const classes: ClassGroup[] = [
        {
          id: "class-1",
          name: "12-A",
          program: "YKS",
          mentor: "Merve Karaca",
          studentCount: 15,
        },
      ];

      const html = renderWithAuth(
        createElement(ClassesPage, {
          role: "teacher",
          classes,
          onOpen: vi.fn(),
        }),
        { role: "teacher" }
      );

      expect(html).toContain("12-A");
      expect(html).not.toContain("Öğretmenler");
      expect(html).not.toContain("Düzenle");
      expect(html).not.toContain("Arşivle");
    });
  });

  describe("2. Liste tavana dayandığında kesilme söyleniyor", () => {
    it("SettingsSubjectsSection: truncated true iken üst sınır uyarısı gösterilir", () => {
      vi.mocked(useSubjects).mockReturnValue({
        data: {
          rows: [
            {
              id: "sub-1",
              organizationId: "org-1",
              name: "Ders 1",
              archivedAt: null,
            },
          ],
          truncated: true,
        },
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useSubjects>);

      const html = renderWithAuth(createElement(SettingsSubjectsSection), {
        role: "admin",
      });

      expect(html).toContain("Ders listesi üst sınıra ulaştı");
    });

    it("ClassTeachersDialog: truncated true iken üst sınır uyarısı gösterilir", () => {
      vi.mocked(useClassTeachers).mockReturnValue({
        data: {
          rows: [],
          truncated: true,
        },
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useClassTeachers>);

      const dummyClass: ClassGroup = {
        id: "class-1",
        name: "12-A",
        program: null,
        mentor: null,
        studentCount: 10,
      };

      const html = renderWithAuth(
        createElement(ClassTeachersDialog, {
          open: true,
          onOpenChange: vi.fn(),
          organizationId: "org-1",
          classData: dummyClass,
        }),
        { role: "admin" }
      );

      expect(html).toContain("Atama listesi üst sınıra ulaştı");
    });

    it("SchedulePage: truncated true iken üst sınır uyarısı gösterilir", () => {
      const html = renderWithAuth(
        createElement(SchedulePage, {
          role: "admin",
          schedule: [],
          truncated: true,
          limit: 200,
        }),
        { role: "admin" }
      );

      expect(html).toContain("Liste üst sınıra (200 kayıt) ulaştı");
    });
  });

  describe("3. Öğretmen atamasında 'Düzenle' çizilmiyor (UPDATE yalnızca archived_at)", () => {
    it("ClassTeachersDialog içinde 'Düzenle' butonu bulunmaz — yalnızca 'Kaldır' ve atama formu vardır", () => {
      const dummyClass: ClassGroup = {
        id: "class-1",
        name: "12-A",
        program: null,
        mentor: null,
        studentCount: 10,
      };

      const html = renderWithAuth(
        createElement(ClassTeachersDialog, {
          open: true,
          onOpenChange: vi.fn(),
          organizationId: "org-1",
          classData: dummyClass,
        }),
        { role: "admin" }
      );

      expect(html).toContain("Kaldır");
      expect(html).toContain("Öğretmeni Ata");
      expect(html).not.toContain("Düzenle");
    });
  });

  describe("4. Öğretmen atamasında yalnızca admin/teacher rolleri sunuluyor", () => {
    it("ClassTeachersDialog öğretmen seçimi öğrenci ve veli üyelerini listelemez", () => {
      const dummyClass: ClassGroup = {
        id: "class-1",
        name: "12-A",
        program: null,
        mentor: null,
        studentCount: 10,
      };

      const html = renderWithAuth(
        createElement(ClassTeachersDialog, {
          open: true,
          onOpenChange: vi.fn(),
          organizationId: "org-1",
          classData: dummyClass,
        }),
        { role: "admin" }
      );

      // Admin ve Teacher üyeleri seçeneklerde yer almalı
      expect(html).toContain("Müdür Bey");
      expect(html).toContain("Zeynep Hoca");
      // Öğrenci ve Veli üyeleri seçeneklerde KESİNLİKLE yer almamalı
      expect(html).not.toContain("Ali Öğrenci");
      expect(html).not.toContain("Veli Anne");
    });
  });

  describe("5. Ekran hata cümlesini ikinci kez çevirmiyor (servis çevirir, ekran taşır)", () => {
    it("SettingsSubjectsSection translateSubjectError çağırmaz, servisin cümlesini taşır", () => {
      const dosya = readFileSync(
        path.join(import.meta.dirname, "SettingsSubjectsSection.tsx"),
        "utf8"
      );
      const kod = dosya
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");

      expect(kod).not.toContain("translateSubjectError");
      expect(kod).toContain("err instanceof Error");
    });

    it("ClassTeachersDialog translateClassTeacherError çağırmaz, servisin cümlesini taşır", () => {
      const dosya = readFileSync(
        path.join(import.meta.dirname, "ClassTeachersDialog.tsx"),
        "utf8"
      );
      const kod = dosya
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");

      expect(kod).not.toContain("translateClassTeacherError");
      expect(kod).toContain("err instanceof Error");
    });

    it("ScheduleEntryFormDialog translateScheduleError çağırmaz, servisin cümlesini taşır", () => {
      const dosya = readFileSync(
        path.join(import.meta.dirname, "ScheduleEntryFormDialog.tsx"),
        "utf8"
      );
      const kod = dosya
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");

      expect(kod).not.toContain("translateScheduleError");
      expect(kod).toContain("err instanceof Error");
    });
  });
});

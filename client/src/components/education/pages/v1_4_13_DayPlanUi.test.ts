import { readFileSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/auth/AuthContext";
import type { AuthContextValue } from "@/auth/types";
import type { CalendarEventItem, TaskItem } from "@/education/dayPlanService";
import { getOrbitToday } from "@/education/trDate";
import type { ScheduleItem } from "../types";
import { DayPlanAgenda } from "./DayPlanAgenda";
import {
  type DayPlanDisplayEvent,
  filterLessonsForDayPlan,
} from "./dayPlanHelpers";
import { DayPlanTaskCard } from "./DayPlanTaskCard";
import { DayPlanToDoBoard } from "./DayPlanToDoBoard";

(globalThis as unknown as { React: typeof React }).React = React;

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

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const dummyAuth: AuthContextValue = {
    identity: {
      user: {
        id: "usr-1",
        email: "test@orbit.local",
        phone: null,
        created_at: "",
      },
      membership: {
        id: "mem-teacher-1",
        membershipId: "mem-teacher-1",
        role: "teacher",
        organizationId: "org-1",
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

describe("v1.4-13 Gün Planı UI ve K-23 Invariant Testleri", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Yüke id konmuyor; owner_membership_id giriş yapan kişinin üyeliği", () => {
    it("dayPlanService.ts kaynak kodunda insert/update yüklerinde id bulunmaz", () => {
      const servicePath = path.resolve(
        import.meta.dirname,
        "../../../education/dayPlanService.ts"
      );
      const code = readFileSync(servicePath, "utf-8");

      expect(code).not.toMatch(
        /insert\(\s*\{\s*[^}]*\bid:\s*[^,}]+[^}]*\}\s*\)/
      );
      expect(code).not.toMatch(
        /update\(\s*\{\s*[^}]*\bid:\s*[^,}]+[^}]*\}\s*\)/
      );
      // owner_membership_id parametresi gönderilir
      expect(code).toContain("owner_membership_id: input.ownerMembershipId");
    });
  });

  describe("2. Sıfır satır etkileyen yazma hata fırlatıyor (K-14)", () => {
    it("dayPlanService.ts güncelleme ve arşivleme fonksiyonlarında sıfır satırda açıkça hata fırlatır", () => {
      const servicePath = path.resolve(
        import.meta.dirname,
        "../../../education/dayPlanService.ts"
      );
      const code = readFileSync(servicePath, "utf-8");

      expect(code).toContain("data.length === 0");
      expect(code).toContain("throw new Error");
    });
  });

  describe("3. Ekran hata cümlesini ikinci kez çevirmiyor", () => {
    it("UI bileşenlerinde yakalanan Error nesneleri doğrudan err.message olarak sunulur", () => {
      const taskCardPath = path.resolve(
        import.meta.dirname,
        "DayPlanTaskCard.tsx"
      );
      const taskCardCode = readFileSync(taskCardPath, "utf-8");
      expect(taskCardCode).toContain("err instanceof Error ? err.message : ");
      expect(taskCardCode).not.toContain("translateDayPlanError");

      const agendaPath = path.resolve(import.meta.dirname, "DayPlanAgenda.tsx");
      const agendaCode = readFileSync(agendaPath, "utf-8");
      expect(agendaCode).toContain("err instanceof Error ? err.message : ");
      expect(agendaCode).not.toContain("translateDayPlanError");
    });
  });

  describe("4. Takvimde ders satırları salt okunur — üzerlerinde düzenleme/kaldırma çizilmiyor", () => {
    it("ders programı satırında 'Ders Programı' rozeti çizilir, Düzenle ve Kaldır butonları çizilmez", () => {
      const sampleLesson: ScheduleItem = {
        id: "sch-1",
        day: "Salı",
        time: "09:00 - 09:40",
        title: "11-A Matematik",
        group: "11-A",
        teacher: "Ahmet Öğretmen",
        room: "Derslik 3",
        startsAt: "09:00",
        endsAt: "09:40",
        dayOfWeek: 2,
        membershipId: "mem-teacher-1",
      };

      const personalEvent: CalendarEventItem = {
        id: "evt-1",
        organizationId: "org-1",
        ownerMembershipId: "mem-teacher-1",
        title: "Veli Görüşmesi",
        subtitle: "Ali Veli velisi ile görüşme",
        startsAt: "2026-09-15T10:00:00+03:00",
        endsAt: "2026-09-15T10:30:00+03:00",
        archivedAt: null,
        createdAt: "2026-09-13T10:00:00Z",
        updatedAt: "2026-09-13T10:00:00Z",
      };

      const displayEvents: DayPlanDisplayEvent[] = [
        {
          id: "lesson-1",
          date: "2026-09-15",
          startTime: "09:00",
          endTime: "09:40",
          title: sampleLesson.title,
          subtitle: "11-A · Ahmet Öğretmen · Derslik 3",
          isLesson: true,
          rawLesson: sampleLesson,
        },
        {
          id: "event-1",
          date: "2026-09-15",
          startTime: "10:00",
          endTime: "10:30",
          title: personalEvent.title,
          subtitle: personalEvent.subtitle,
          isLesson: false,
          rawEvent: personalEvent,
        },
      ];

      const html = renderWithClient(
        createElement(DayPlanAgenda, {
          selectedDate: new Date("2026-09-15T12:00:00"),
          events: displayEvents,
          organizationId: "org-1",
          membershipId: "mem-teacher-1",
          onEditEvent: vi.fn(),
        })
      );

      // Ders satırı ve rozeti görünür
      expect(html).toContain("11-A Matematik");
      expect(html).toContain("Ders Programı");

      // Kişisel etkinlik ve rozeti görünür
      expect(html).toContain("Veli Görüşmesi");
      expect(html).toContain("Kişisel");

      // Düzenleme ve kaldırma butonları YALNIZCA kişisel etkinlik için 1 adet çizilir
      const editButtons = (html.match(/aria-label="Etkinliği düzenle"/g) || [])
        .length;
      const archiveButtons = (
        html.match(/aria-label="Etkinliği kaldır"/g) || []
      ).length;

      expect(editButtons).toBe(1);
      expect(archiveButtons).toBe(1);
    });
  });

  describe("5. Öğretmende ders satırları membership_id ile süzülüyor", () => {
    it("öğretmen kendi membershipId'sine ait olmayan dersleri gün planında görmez", () => {
      const schedule: ScheduleItem[] = [
        {
          id: "sch-1",
          day: "Pazartesi",
          time: "09:00 - 09:40",
          title: "Benim Dersim (Matematik)",
          group: "12-A",
          membershipId: "mem-teacher-me",
          dayOfWeek: 1,
        },
        {
          id: "sch-2",
          day: "Pazartesi",
          time: "10:00 - 10:40",
          title: "Başka Öğretmenin Dersi (Fizik)",
          group: "12-A",
          membershipId: "mem-teacher-other",
          dayOfWeek: 1,
        },
      ];

      // Öğretmen olarak süz
      const teacherFiltered = filterLessonsForDayPlan(
        schedule,
        "teacher",
        "mem-teacher-me"
      );

      expect(teacherFiltered).toHaveLength(1);
      expect(teacherFiltered[0].title).toBe("Benim Dersim (Matematik)");

      // 🔴 R1 (#290 Revizyon 1): Yönetici okulun tamamını değil, yalnızca kendi derslerini görür
      const adminTeachingFiltered = filterLessonsForDayPlan(
        schedule,
        "admin",
        "mem-teacher-me"
      );
      expect(adminTeachingFiltered).toHaveLength(1);
      expect(adminTeachingFiltered[0].title).toBe("Benim Dersim (Matematik)");

      // Ders vermeyen yönetici gün planında ders görmez (0 satır)
      const adminNoTeachingFiltered = filterLessonsForDayPlan(
        schedule,
        "admin",
        "mem-admin-director"
      );
      expect(adminNoTeachingFiltered).toHaveLength(0);

      // Öğrenci veya veli tüm dersleri görür
      const studentFiltered = filterLessonsForDayPlan(
        schedule,
        "student",
        "mem-student-1"
      );
      expect(studentFiltered).toHaveLength(2);
    });
  });

  describe("6. 'Gecikti' hesabı kurum gününe göre — ham new Date() karşılaştırması yok", () => {
    it("vadesi kurum gününden (Europe/Istanbul) önce olan görevler 'Gecikti' ve 'rose' rozetiyle çizilir", () => {
      const today = getOrbitToday();
      // Geçmiş bir tarih oluştur
      const yesterday = "2026-09-12";

      const overdueTask: TaskItem = {
        id: "task-overdue",
        organizationId: "org-1",
        ownerMembershipId: "mem-teacher-1",
        title: "Geciken Rapor",
        detail: "Müdüre teslim edilecek",
        dueOn: yesterday,
        dueTime: null,
        status: "planned",
        priority: "high",
        label: "report",
        estimatedMinutes: 30,
        completedAt: null,
        archivedAt: null,
        createdAt: "2026-09-10T10:00:00Z",
        updatedAt: "2026-09-10T10:00:00Z",
      };

      const todayTask: TaskItem = {
        id: "task-today",
        organizationId: "org-1",
        ownerMembershipId: "mem-teacher-1",
        title: "Bugünkü Görev",
        detail: null,
        dueOn: today,
        dueTime: "14:00",
        status: "today",
        priority: "normal",
        label: null,
        estimatedMinutes: null,
        completedAt: null,
        archivedAt: null,
        createdAt: "2026-09-13T10:00:00Z",
        updatedAt: "2026-09-13T10:00:00Z",
      };

      const htmlOverdue = renderWithClient(
        createElement(DayPlanTaskCard, {
          task: overdueTask,
          organizationId: "org-1",
          membershipId: "mem-teacher-1",
        })
      );

      expect(htmlOverdue).toContain("Gecikti");
      // Öncelik, etiket ve süre kartta (C-10, MoneyFlow mantığı).
      expect(htmlOverdue).toContain("Yüksek");
      expect(htmlOverdue).toContain("Rapor");
      expect(htmlOverdue).toContain("30 dk");

      const htmlToday = renderWithClient(
        createElement(DayPlanTaskCard, {
          task: todayTask,
          organizationId: "org-1",
          membershipId: "mem-teacher-1",
        })
      );

      expect(htmlToday).toContain("Bugün");
      expect(htmlToday).toContain("14:00");
      expect(htmlToday).not.toContain("Gecikti");
    });
  });

  describe("7. Üretimde veri yokken boş durum doğru cümleyi söylüyor", () => {
    // C-10 (2026-09-27): boş panoda da dört sütun çizilir; kullanıcı ilk
    // görevden önce nereye ne ekleyebileceğini görür. Boşluk yine bir hata
    // gibi gösterilmez (K-22).
    const renderEmpty = () =>
      renderWithClient(
        createElement(DayPlanToDoBoard, {
          tasks: [],
          organizationId: "org-1",
          membershipId: "mem-teacher-1",
          onAddTask: vi.fn(),
        })
      );

    it("boş panoda dört sütun ve görevin nasıl ekleneceği görünür", () => {
      const html = renderEmpty();

      for (const label of ["Planla", "Bugün", "Odaklan", "Tamamlandı"]) {
        expect(html).toContain(label);
      }
      expect(html).toContain(
        "Henüz görev yok. Bir sütundaki + ile o sütuna görev ekleyebilirsiniz."
      );
      expect(html).not.toContain("yüklenemedi");
      expect(html).not.toContain("Hata oluştu");
    });

    it("'+' Tamamlandı dışındaki üç sütunda var", () => {
      const html = renderEmpty();

      expect(html).toContain('aria-label="Planla sütununa görev ekle"');
      expect(html).toContain('aria-label="Bugün sütununa görev ekle"');
      expect(html).toContain('aria-label="Odaklan sütununa görev ekle"');
      // Yeni görev tamamlanmış doğmaz.
      expect(html).not.toContain('aria-label="Tamamlandı sütununa görev ekle"');
    });

    it("olmayan bir şeyden söz edilmez", () => {
      const html = renderEmpty();

      expect(html).not.toContain("Önemli olanı ilerletin");
      expect(html).not.toContain("zaman kutusu");
    });
  });

  describe("7b. Sütun elle seçilen durumdur, tarihten türetilmez", () => {
    it("gecikmiş ama 'planned' bir görev Planla'da kalır ve Gecikti rozeti taşır", () => {
      const overdue: TaskItem = {
        id: "task-overdue-planned",
        organizationId: "org-1",
        ownerMembershipId: "mem-teacher-1",
        title: "Geciken ama planlanmış",
        detail: null,
        dueOn: "2026-09-01",
        dueTime: null,
        status: "planned",
        priority: "normal",
        label: null,
        estimatedMinutes: null,
        completedAt: null,
        archivedAt: null,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-01T10:00:00Z",
      };

      const html = renderWithClient(
        createElement(DayPlanToDoBoard, {
          tasks: [overdue],
          organizationId: "org-1",
          membershipId: "mem-teacher-1",
          onAddTask: vi.fn(),
        })
      );

      const planla = html.slice(
        html.indexOf("Planla sütununa görev ekle"),
        html.indexOf("Bugün sütununa görev ekle")
      );
      expect(planla).toContain("Geciken ama planlanmış");
      expect(planla).toContain("Gecikti");
    });
  });

  describe("8. Liste tavana dayandığında kesilme söyleniyor", () => {
    it("DayPlanToDoBoard truncated true olduğunda sınır uyarısını görüntüler", () => {
      const tasks: TaskItem[] = [
        {
          id: "task-1",
          organizationId: "org-1",
          ownerMembershipId: "mem-teacher-1",
          title: "Örnek Görev",
          detail: null,
          dueOn: null,
          dueTime: null,
          status: "planned",
          priority: "normal",
          label: null,
          estimatedMinutes: null,
          completedAt: null,
          archivedAt: null,
          createdAt: "2026-09-13T10:00:00Z",
          updatedAt: "2026-09-13T10:00:00Z",
        },
      ];

      const html = renderWithClient(
        createElement(DayPlanToDoBoard, {
          tasks,
          organizationId: "org-1",
          membershipId: "mem-teacher-1",
          truncated: true,
        })
      );

      expect(html).toContain("Liste üst sınıra (100 kayıt) ulaştı.");
    });
  });
});

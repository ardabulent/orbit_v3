import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveCalendarEvent,
  archiveTask,
  completeTask,
  createCalendarEvent,
  createTask,
  DEFAULT_DAY_PLAN_LIMIT,
  loadCalendarEvents,
  loadTasks,
  translateDayPlanError,
  uncompleteTask,
  updateCalendarEvent,
  updateTask,
} from "./dayPlanService";

const fromMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

describe("dayPlanService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadTasks", () => {
    it("kurum veya üyelik kimliği boşsa sorgu atmadan boş dizi döner", async () => {
      const res1 = await loadTasks("", "mem-1");
      expect(res1.rows).toEqual([]);
      expect(res1.truncated).toBe(false);

      const res2 = await loadTasks("org-1", "");
      expect(res2.rows).toEqual([]);
      expect(res2.truncated).toBe(false);

      expect(fromMock).not.toHaveBeenCalled();
    });

    it("kurum ve üyelik kimliğiyle arşivlenmemiş görevleri çeker", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            organization_id: "org-1",
            owner_membership_id: "mem-1",
            title: "Öğrenci dosyalarını incele",
            detail: "Detay notu",
            due_on: "2026-09-15",
            due_time: "14:30:00",
            status: "focus",
            priority: "high",
            label: "parent_meeting",
            estimated_minutes: 25,
            completed_at: null,
            archived_at: null,
            created_at: "2026-09-13T10:00:00Z",
            updated_at: "2026-09-13T10:00:00Z",
          },
        ],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqMember = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqMember });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ select: mockSelect });

      const result = await loadTasks("org-1", "mem-1");

      expect(fromMock).toHaveBeenCalledWith("tasks");
      expect(mockEqOrg).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockEqMember).toHaveBeenCalledWith("owner_membership_id", "mem-1");
      expect(mockIs).toHaveBeenCalledWith("archived_at", null);
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(DEFAULT_DAY_PLAN_LIMIT);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        id: "task-1",
        organizationId: "org-1",
        ownerMembershipId: "mem-1",
        title: "Öğrenci dosyalarını incele",
        detail: "Detay notu",
        dueOn: "2026-09-15",
        dueTime: "14:30",
        status: "focus",
        priority: "high",
        label: "parent_meeting",
        estimatedMinutes: 25,
        completedAt: null,
        archivedAt: null,
        createdAt: "2026-09-13T10:00:00Z",
        updatedAt: "2026-09-13T10:00:00Z",
      });
      expect(result.truncated).toBe(false);
    });

    it("satır sayısı limite eşit olduğunda truncated true döner (K-06)", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [{ id: "t1" }],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqMember = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqMember });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ select: mockSelect });

      const result = await loadTasks("org-1", "mem-1", { limit: 1 });
      expect(result.truncated).toBe(true);
    });
  });

  describe("createTask", () => {
    it("yüke id KONMAZ, owner_membership_id giriş yapan üyeliktir (K-00 / #290)", async () => {
      let capturedPayload: unknown;

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "new-task-1",
          organization_id: "org-1",
          owner_membership_id: "mem-current",
          title: "Veli görüşmesi yap",
          detail: null,
          due_on: "2026-09-16",
          completed_at: null,
          archived_at: null,
          created_at: "2026-09-13T10:00:00Z",
          updated_at: "2026-09-13T10:00:00Z",
        },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { select: mockSelect };
      });

      fromMock.mockReturnValue({ insert: mockInsert });

      const result = await createTask({
        organizationId: "org-1",
        ownerMembershipId: "mem-current",
        title: "  Veli görüşmesi yap  ",
        dueOn: "2026-09-16",
      });

      // Verilmeyen alan yüke girmez; veritabanı varsayılanı geçerli olur.
      expect(capturedPayload).toEqual({
        organization_id: "org-1",
        owner_membership_id: "mem-current",
        title: "Veli görüşmesi yap",
        due_on: "2026-09-16",
      });

      // 🔴 K-23: Yükte kesinlikle id olamaz
      expect(capturedPayload).not.toHaveProperty("id");
      expect(result.id).toBe("new-task-1");
    });

    it("kurum veya üyelik kimliği boşsa veritabanına gitmeden hata fırlatır (fail-closed / K-04)", async () => {
      await expect(
        createTask({
          organizationId: "",
          ownerMembershipId: "mem-1",
          title: "Görev",
        })
      ).rejects.toThrow("Kurum ve üyelik bilgisi zorunludur.");
      expect(fromMock).not.toHaveBeenCalled();

      await expect(
        createTask({
          organizationId: "org-1",
          ownerMembershipId: "",
          title: "Görev",
        })
      ).rejects.toThrow("Kurum ve üyelik bilgisi zorunludur.");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("geçersiz başlıklı görev oluşturulduğunda sunucuya gider ve 23514 hatası çevrilir (#292 / B)", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details:
            "Failing row contains (8fe72462-87c1-4ba2-bb52-5a21ff11b7df, bb000000-0000-0000-0000-000000000001, bb300000-0000-0000-0000-000000000001,    , null, null, null, null, 2026-09-13 16:30:00+00, 2026-09-13 16:30:00+00)",
          hint: null,
          message:
            'new row for relation "tasks" violates check constraint "tasks_title_check"',
        },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      fromMock.mockReturnValue({ insert: mockInsert });

      await expect(
        createTask({
          organizationId: "org-1",
          ownerMembershipId: "mem-1",
          title: "   ",
        })
      ).rejects.toThrow("Görev başlığı 1 ile 200 karakter arasında olmalıdır.");

      // 🔴 B iddiası: İstemci baştan reddetmedi, veritabanına gitti
      expect(fromMock).toHaveBeenCalledWith("tasks");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "",
          organization_id: "org-1",
          owner_membership_id: "mem-1",
        })
      );
    });
  });

  describe("updateTask", () => {
    it("yüke id veya owner_membership_id konmaz, sıfır satırda hata fırlatır (K-14)", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            organization_id: "org-1",
            owner_membership_id: "mem-1",
            title: "Güncellenen görev",
            detail: "Yeni detay",
            due_on: null,
            completed_at: null,
            archived_at: null,
            created_at: "",
            updated_at: "",
          },
        ],
        error: null,
      });
      const mockEqTask = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      fromMock.mockReturnValue({ update: mockUpdate });

      await updateTask("org-1", "task-1", {
        title: "Güncellenen görev",
        detail: "Yeni detay",
      });

      expect(capturedPayload).toEqual({
        title: "Güncellenen görev",
        detail: "Yeni detay",
      });
      expect(capturedPayload).not.toHaveProperty("id");
      expect(capturedPayload).not.toHaveProperty("owner_membership_id");
    });

    it("sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockEqTask = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(
        updateTask("org-1", "task-1", { title: "Test" })
      ).rejects.toThrow(
        "Görev güncellenemedi veya bu işlem için yetkiniz bulunmuyor."
      );
    });

    it("geçersiz başlıklı görev güncellendiğinde sunucuya gider ve 23514 hatası çevrilir (#292 / B)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details: "Failing row contains (..., ...)",
          hint: null,
          message:
            'new row for relation "tasks" violates check constraint "tasks_title_check"',
        },
      });
      const mockEqTask = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });
      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(
        updateTask("org-1", "task-1", { title: "   " })
      ).rejects.toThrow("Görev başlığı 1 ile 200 karakter arasında olmalıdır.");

      expect(fromMock).toHaveBeenCalledWith("tasks");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "" })
      );
    });
  });

  describe("completeTask & uncompleteTask", () => {
    it("completeTask completed_at alanını doldurur ve sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            organization_id: "org-1",
            owner_membership_id: "mem-1",
            title: "Test",
            detail: null,
            due_on: null,
            completed_at: "2026-09-13T12:00:00Z",
            archived_at: null,
            created_at: "",
            updated_at: "",
          },
        ],
        error: null,
      });
      const mockEqTask = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      const result = await completeTask("org-1", "task-1");
      expect(result.completedAt).toBe("2026-09-13T12:00:00Z");
    });

    it("uncompleteTask completed_at alanını null yapar ve sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            organization_id: "org-1",
            owner_membership_id: "mem-1",
            title: "Test",
            detail: null,
            due_on: null,
            completed_at: null,
            archived_at: null,
            created_at: "",
            updated_at: "",
          },
        ],
        error: null,
      });
      const mockEqTask = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      const result = await uncompleteTask("org-1", "task-1");
      expect(result.completedAt).toBeNull();
    });
  });

  describe("archiveTask", () => {
    it("archived_at alanını doldurur ve sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "task-1" }],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqTask = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      await archiveTask("org-1", "task-1");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ archived_at: expect.any(String) })
      );
    });

    it("arşivlemede sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqTask = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqTask });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(archiveTask("org-1", "task-1")).rejects.toThrow(
        "Görev arşivlenemedi veya bu işlem için yetkiniz bulunmuyor."
      );
    });
  });

  describe("loadCalendarEvents", () => {
    it("kurum veya üyelik boşsa sorgu atmaz", async () => {
      const res = await loadCalendarEvents("", "mem-1");
      expect(res.rows).toEqual([]);
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("kişisel takvim etkinliklerini başlangıç saatine göre sıralı getirir", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            id: "ev-1",
            organization_id: "org-1",
            owner_membership_id: "mem-1",
            title: "Veli Görüşmesi",
            subtitle: "Ali Yılmaz velisi",
            starts_at: "2026-09-15T09:00:00Z",
            ends_at: "2026-09-15T09:30:00Z",
            archived_at: null,
            created_at: "",
            updated_at: "",
          },
        ],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqMember = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqMember });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ select: mockSelect });

      const result = await loadCalendarEvents("org-1", "mem-1");

      expect(fromMock).toHaveBeenCalledWith("calendar_events");
      expect(mockOrder).toHaveBeenCalledWith("starts_at", { ascending: true });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("Veli Görüşmesi");
      expect(result.rows[0].startsAt).toBe("2026-09-15T09:00:00Z");
    });
  });

  describe("createCalendarEvent", () => {
    it("yüke id konmaz, owner_membership_id gönderilir", async () => {
      let capturedPayload: unknown;

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "ev-new",
          organization_id: "org-1",
          owner_membership_id: "mem-1",
          title: "Zümre Toplantısı",
          subtitle: null,
          starts_at: "2026-09-15T14:00:00Z",
          ends_at: "2026-09-15T15:00:00Z",
          archived_at: null,
          created_at: "",
          updated_at: "",
        },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { select: mockSelect };
      });

      fromMock.mockReturnValue({ insert: mockInsert });

      const res = await createCalendarEvent({
        organizationId: "org-1",
        ownerMembershipId: "mem-1",
        title: "Zümre Toplantısı",
        startsAt: "2026-09-15T14:00:00Z",
        endsAt: "2026-09-15T15:00:00Z",
      });

      expect(capturedPayload).toEqual({
        organization_id: "org-1",
        owner_membership_id: "mem-1",
        title: "Zümre Toplantısı",
        subtitle: null,
        starts_at: "2026-09-15T14:00:00Z",
        ends_at: "2026-09-15T15:00:00Z",
      });
      expect(capturedPayload).not.toHaveProperty("id");
      expect(res.id).toBe("ev-new");
    });

    it("bitiş saati başlangıçtan önceyse SUNUCUYA gider ve 23514 çevrilir (#292 / B)", async () => {
      // Bu kontrol eskiden istemcideydi ve `calendar_events_time_check`
      // kısıtının kopyasıydı — başlık kontrolleriyle aynı sınıf. Altı başlık
      // kopyası kaldırılırken bunun bırakılması aynı dosyada iki farklı kural
      // demekti (**K-06**). Kural tek yerde: şema.
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details:
            "Failing row contains (ev-1, org-1, mem-1, Toplantı, null, 2026-09-15 14:00:00+00, 2026-09-15 13:00:00+00, null, …)",
          hint: null,
          message:
            'new row for relation "calendar_events" violates check constraint "calendar_events_time_check"',
        },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      fromMock.mockReturnValue({ insert: mockInsert });

      await expect(
        createCalendarEvent({
          organizationId: "org-1",
          ownerMembershipId: "mem-1",
          title: "Toplantı",
          startsAt: "2026-09-15T14:00:00Z",
          endsAt: "2026-09-15T13:00:00Z",
        })
      ).rejects.toThrow("Bitiş saati başlangıç saatinden sonra olmalıdır.");

      // 🔴 İddia: istemci baştan reddetmedi, kararı sunucu verdi.
      expect(fromMock).toHaveBeenCalledWith("calendar_events");
    });

    it("kurum veya üyelik kimliği boşsa veritabanına gitmeden hata fırlatır (fail-closed / K-04)", async () => {
      await expect(
        createCalendarEvent({
          organizationId: "",
          ownerMembershipId: "mem-1",
          title: "Toplantı",
          startsAt: "2026-09-15T14:00:00Z",
        })
      ).rejects.toThrow("Kurum ve üyelik bilgisi zorunludur.");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("geçersiz başlıklı etkinlik oluşturulduğunda sunucuya gider ve 23514 hatası çevrilir (#292 / B)", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details:
            "Failing row contains (8fe72462-87c1-4ba2-bb52-5a21ff11b7df, bb000000-0000-0000-0000-000000000001, bb300000-0000-0000-0000-000000000001,    , null, 2026-09-15 10:00:00+00, null, null, 2026-09-13 16:30:00+00, 2026-09-13 16:30:00+00)",
          hint: null,
          message:
            'new row for relation "calendar_events" violates check constraint "calendar_events_title_check"',
        },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      fromMock.mockReturnValue({ insert: mockInsert });

      await expect(
        createCalendarEvent({
          organizationId: "org-1",
          ownerMembershipId: "mem-1",
          title: "   ",
          startsAt: "2026-09-15T14:00:00Z",
        })
      ).rejects.toThrow(
        "Etkinlik başlığı 1 ile 200 karakter arasında olmalıdır."
      );

      expect(fromMock).toHaveBeenCalledWith("calendar_events");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "",
          organization_id: "org-1",
          owner_membership_id: "mem-1",
        })
      );
    });
  });

  describe("updateCalendarEvent & archiveCalendarEvent", () => {
    it("updateCalendarEvent sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEqEv = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqEv });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(
        updateCalendarEvent("org-1", "ev-1", { title: "Yeni Başlık" })
      ).rejects.toThrow(
        "Etkinlik güncellenemedi veya bu işlem için yetkiniz bulunmuyor."
      );
    });

    it("geçersiz başlıklı etkinlik güncellendiğinde sunucuya gider ve 23514 hatası çevrilir (#292 / B)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details: "Failing row contains (..., ...)",
          hint: null,
          message:
            'new row for relation "calendar_events" violates check constraint "calendar_events_title_check"',
        },
      });
      const mockEqEv = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqEv });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });
      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(
        updateCalendarEvent("org-1", "ev-1", { title: "   " })
      ).rejects.toThrow(
        "Etkinlik başlığı 1 ile 200 karakter arasında olmalıdır."
      );

      expect(fromMock).toHaveBeenCalledWith("calendar_events");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "" })
      );
    });

    it("archiveCalendarEvent sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqEv = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqEv });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(archiveCalendarEvent("org-1", "ev-1")).rejects.toThrow(
        "Etkinlik arşivlenemedi veya bu işlem için yetkiniz bulunmuyor."
      );
    });
  });

  describe("translateDayPlanError", () => {
    it("42501 yetki hatasını açıklar", () => {
      const msg = translateDayPlanError({ code: "42501" });
      expect(msg).toContain("Bu işlem için yetkiniz yok");
    });

    it("23514 tasks_title_check gerçek PostgREST hatasını (kısıt message içinde) doğru çevirir ve details sızmaz (A)", () => {
      const error = {
        code: "23514",
        details:
          "Failing row contains (8fe72462-87c1-4ba2-bb52-5a21ff11b7df, bb000000-0000-0000-0000-000000000001, bb300000-0000-0000-0000-000000000001,    , null, null, null, null, 2026-09-13 16:30:00+00, 2026-09-13 16:30:00+00)",
        hint: null,
        message:
          'new row for relation "tasks" violates check constraint "tasks_title_check"',
      };
      const msg = translateDayPlanError(error);
      expect(msg).toBe("Görev başlığı 1 ile 200 karakter arasında olmalıdır.");
      expect(msg).not.toContain("Failing row contains");
    });

    it("23514 calendar_events_title_check gerçek PostgREST hatasını (kısıt message içinde) doğru çevirir ve details sızmaz (A)", () => {
      const error = {
        code: "23514",
        details:
          "Failing row contains (8fe72462-87c1-4ba2-bb52-5a21ff11b7df, bb000000-0000-0000-0000-000000000001, bb300000-0000-0000-0000-000000000001,    , null, 2026-09-15 10:00:00+00, null, null, 2026-09-13 16:30:00+00, 2026-09-13 16:30:00+00)",
        hint: null,
        message:
          'new row for relation "calendar_events" violates check constraint "calendar_events_title_check"',
      };
      const msg = translateDayPlanError(error);
      expect(msg).toBe(
        "Etkinlik başlığı 1 ile 200 karakter arasında olmalıdır."
      );
      expect(msg).not.toContain("Failing row contains");
    });

    it("23514 calendar_events_time_check gerçek PostgREST hatasını (kısıt message içinde) doğru çevirir ve details sızmaz (A)", () => {
      const error = {
        code: "23514",
        details:
          "Failing row contains (8fe72462-87c1-4ba2-bb52-5a21ff11b7df, bb000000-0000-0000-0000-000000000001, bb300000-0000-0000-0000-000000000001, Toplantı, null, 2026-09-15 14:00:00+00, 2026-09-15 13:00:00+00, null, 2026-09-13 16:30:00+00, 2026-09-13 16:30:00+00)",
        hint: null,
        message:
          'new row for relation "calendar_events" violates check constraint "calendar_events_time_check"',
      };
      const msg = translateDayPlanError(error);
      expect(msg).toBe("Bitiş saati başlangıç saatinden sonra olmalıdır.");
      expect(msg).not.toContain("Failing row contains");
    });

    it("details çoğul alanından hata kodu çözer (K-23)", () => {
      const msg = translateDayPlanError({
        message: "Internal error",
        details: "42501 permission denied",
      });
      expect(msg).toContain("Bu işlem için yetkiniz yok");
    });
  });

  describe("görev panosu alanları (C-10)", () => {
    it("durum, öncelik, etiket, saat ve süre yüke doğru adlarla girer", async () => {
      let capturedPayload: unknown;
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "t-new",
          organization_id: "org-1",
          owner_membership_id: "mem-1",
          title: "Veli araması",
          detail: null,
          due_on: null,
          status: "focus",
          priority: "high",
          label: "parent_meeting",
          due_time: "09:15:00",
          estimated_minutes: 15,
          completed_at: null,
          archived_at: null,
          created_at: "2026-09-28T10:00:00Z",
          updated_at: "2026-09-28T10:00:00Z",
        },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { select: mockSelect };
      });
      fromMock.mockReturnValue({ insert: mockInsert });

      const created = await createTask({
        organizationId: "org-1",
        ownerMembershipId: "mem-1",
        title: "Veli araması",
        status: "focus",
        priority: "high",
        label: "parent_meeting",
        dueTime: "09:15",
        estimatedMinutes: 15,
      });

      expect(capturedPayload).toEqual({
        organization_id: "org-1",
        owner_membership_id: "mem-1",
        title: "Veli araması",
        status: "focus",
        priority: "high",
        label: "parent_meeting",
        due_time: "09:15",
        estimated_minutes: 15,
      });
      expect(created.dueTime).toBe("09:15");
      expect(created.status).toBe("focus");
    });

    it("bilinmeyen bir durum sessizce Planla sayılmaz: tamamlanmışsa done", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            id: "t-old",
            organization_id: "org-1",
            owner_membership_id: "mem-1",
            title: "Eski",
            detail: null,
            due_on: null,
            status: null,
            completed_at: "2026-09-01T10:00:00Z",
            archived_at: null,
            created_at: "2026-09-01T10:00:00Z",
            updated_at: "2026-09-01T10:00:00Z",
          },
        ],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqMember = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqMember });
      fromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEqOrg }),
      });

      const result = await loadTasks("org-1", "mem-1");

      expect(result.rows[0].status).toBe("done");
      expect(result.rows[0].priority).toBe("normal");
      expect(result.rows[0].label).toBeNull();
    });
  });
});
